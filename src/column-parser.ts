import { ColumnReference, Dialect, Token } from './defines';

// States for skipping MSSQL's TOP clause: SELECT TOP n [PERCENT] [WITH TIES]
// The tokenizer emits digits as individual single-character 'unknown' tokens,
// so CONSUMING_BARE_VALUE keeps consuming until a non-digit token appears.
const enum TopState {
  NONE = 0, // Not in a TOP clause
  EXPECTING_VALUE = 1, // Seen TOP, expecting a number or '('
  CONSUMING_NUM = 2, // Inside a bare numeric value (e.g., consuming '1','0' for TOP 10)
  INSIDE_PARENS = 3, // Inside TOP(...), waiting for closing ')'
  AFTER_VALUE = 4, // Consumed the TOP value, may see PERCENT / WITH TIES
  AFTER_PERCENT = 5, // Seen PERCENT, may still see WITH TIES
  EXPECTING_TIES = 6, // Seen WITH, expecting TIES
}

// States for skipping PostgreSQL's DISTINCT ON (...) clause:
// SELECT DISTINCT ON (expr [, ...]) col1, col2 ...
const enum DistinctOnState {
  NONE = 0, // Not in a DISTINCT ON clause
  EXPECTING_ON = 1, // Seen DISTINCT, expecting ON (or not — plain DISTINCT is valid too)
  EXPECTING_OPEN_PAREN = 2, // Seen ON, expecting '('
  INSIDE_PARENS = 3, // Inside ON(...), waiting for closing ')'
}

export class ColumnParser {
  private parts: string[] = [];
  private currentPart = '';
  private alias?: string;
  private waitingForAlias = false;
  private parensDepth = 0;
  private skipCurrent = false;
  private finished = false;
  private existing: Set<string> = new Set<string>();

  // State for skipping MSSQL TOP clause
  private topState: TopState = TopState.NONE;
  private topParensDepth = 0;

  // State for skipping PostgreSQL DISTINCT ON (...) clause
  private distinctOnState: DistinctOnState = DistinctOnState.NONE;
  private distinctOnParensDepth = 0;

  constructor(private dialect: Dialect) {}

  private STOP_KEYWORDS: Set<string> = new Set<string>([
    'FROM',
    'WHERE',
    'GROUP',
    'ORDER',
    'HAVING',
    'LIMIT',
    'OFFSET',
    'UNION',
    'INTERSECT',
    'EXCEPT',
  ]);

  shouldStop(): boolean {
    return this.finished;
  }

  resetState(): void {
    this.parts = [];
    this.currentPart = '';
    this.alias = undefined;
    this.waitingForAlias = false;
    this.skipCurrent = false;
  }

  /**
   * Handles MSSQL TOP clause skipping. Returns true if the token was consumed
   * by the TOP state machine (i.e., should not be processed as a column token).
   */
  private processTopToken(token: Token): boolean {
    const upper = token.value.toUpperCase();

    switch (this.topState) {
      case TopState.EXPECTING_VALUE:
        if (token.value === '(') {
          this.topParensDepth = 1;
          this.topState = TopState.INSIDE_PARENS;
        } else {
          // Bare value — the tokenizer emits digits as individual characters,
          // so we enter CONSUMING_BARE_VALUE to eat all remaining digit tokens
          this.topState = TopState.CONSUMING_NUM;
        }
        return true;

      case TopState.CONSUMING_NUM:
        // Keep consuming digit characters; stop when we see a non-digit
        if (/^\d+$/.test(token.value)) {
          return true;
        }
        // Non-digit token — the bare number is fully consumed, transition to AFTER_VALUE
        // and fall through to let AFTER_VALUE handle this token
        this.topState = TopState.AFTER_VALUE;
        return this.processTopToken(token);

      case TopState.INSIDE_PARENS:
        if (token.value === '(') {
          this.topParensDepth++;
        } else if (token.value === ')') {
          this.topParensDepth--;
          if (this.topParensDepth === 0) {
            this.topState = TopState.AFTER_VALUE;
          }
        }
        return true;

      case TopState.AFTER_VALUE:
        if (upper === 'PERCENT') {
          this.topState = TopState.AFTER_PERCENT;
          return true;
        } else if (upper === 'WITH') {
          this.topState = TopState.EXPECTING_TIES;
          return true;
        }
        // Not a TOP modifier -- done skipping, let normal parsing handle this token
        this.topState = TopState.NONE;
        return false;

      case TopState.AFTER_PERCENT:
        if (upper === 'WITH') {
          this.topState = TopState.EXPECTING_TIES;
          return true;
        }
        // Done skipping
        this.topState = TopState.NONE;
        return false;

      case TopState.EXPECTING_TIES:
        if (upper === 'TIES') {
          this.topState = TopState.NONE;
          return true;
        }
        // 'WITH' was not followed by 'TIES' -- done skipping, process this token normally
        this.topState = TopState.NONE;
        return false;

      default:
        return false;
    }
  }

  /**
   * Handles PostgreSQL DISTINCT ON (...) clause skipping. Returns true if the
   * token was consumed by the state machine (i.e., should not be processed as
   * a column token).
   */
  private processDistinctOnToken(token: Token): boolean {
    const upper = token.value.toUpperCase();

    switch (this.distinctOnState) {
      case DistinctOnState.EXPECTING_ON:
        if (upper === 'ON') {
          this.distinctOnState = DistinctOnState.EXPECTING_OPEN_PAREN;
          return true;
        }
        // Not ON — this is a plain DISTINCT (already skipped), let normal parsing handle this token
        this.distinctOnState = DistinctOnState.NONE;
        return false;

      case DistinctOnState.EXPECTING_OPEN_PAREN:
        if (token.value === '(') {
          this.distinctOnParensDepth = 1;
          this.distinctOnState = DistinctOnState.INSIDE_PARENS;
          return true;
        }
        // No opening paren — unexpected, bail out
        this.distinctOnState = DistinctOnState.NONE;
        return false;

      case DistinctOnState.INSIDE_PARENS:
        if (token.value === '(') {
          this.distinctOnParensDepth++;
        } else if (token.value === ')') {
          this.distinctOnParensDepth--;
          if (this.distinctOnParensDepth === 0) {
            this.distinctOnState = DistinctOnState.NONE;
          }
        }
        return true;

      default:
        return false;
    }
  }

  processToken(
    token: Token,
    prevToken?: Token,
    prevNonWhitespaceToken?: Token,
  ): ColumnReference | null {
    // Skip MSSQL TOP clause tokens
    if (this.topState !== TopState.NONE) {
      if (this.processTopToken(token)) {
        return null;
      }
    }

    // Skip PostgreSQL DISTINCT ON (...) clause tokens
    if (this.distinctOnState !== DistinctOnState.NONE) {
      if (this.processDistinctOnToken(token)) {
        return null;
      }
    }

    if (this.STOP_KEYWORDS.has(token.value.toUpperCase())) {
      this.finished = true;
      return this.finalizeReference();
    } else if (token.value.toUpperCase() === 'DISTINCT') {
      // Skip distinct keyword; for psql, also watch for DISTINCT ON (...)
      if (this.dialect === 'psql') {
        this.distinctOnState = DistinctOnState.EXPECTING_ON;
      }
    } else if (
      this.dialect === 'mssql' &&
      token.value.toUpperCase() === 'TOP' &&
      this.topState === TopState.NONE
    ) {
      // Enter TOP-skipping mode for MSSQL dialect
      this.topState = TopState.EXPECTING_VALUE;
    } else if (token.value === '(') {
      if (this.parensDepth === 0) {
        this.skipCurrent = true;
      }
      this.parensDepth++;
    } else if (token.value === ')') {
      this.parensDepth--;
    } else if (token.type === 'keyword' && token.value.toUpperCase() === 'AS') {
      this.waitingForAlias = true;
    } else if (
      this.waitingForAlias &&
      token.type !== 'comment-inline' &&
      token.type !== 'comment-block'
    ) {
      this.alias = token.value;
      this.waitingForAlias = false;
    } else if (token.value === ',' && this.parensDepth === 0) {
      return this.finalizeReference();
    } else if (token.value === '.' && this.parensDepth === 0) {
      // Separator, keep building but don't add to parts
    } else if (
      token.type !== 'comment-inline' &&
      token.type !== 'comment-block' &&
      this.parensDepth === 0 &&
      !this.waitingForAlias
    ) {
      if (prevNonWhitespaceToken?.value === '.' && !!this.currentPart) {
        this.parts.push(this.currentPart);
        this.currentPart = token.value;
      } else {
        if (
          (this.parts.length > 0 || !!this.currentPart) &&
          prevNonWhitespaceToken?.value !== '.' &&
          prevNonWhitespaceToken?.value !== ',' &&
          prevToken?.type === 'whitespace' &&
          this.maybeIdent(token)
        ) {
          if (!this.alias) {
            this.alias = token.value;
          }
        } else {
          this.currentPart += token.value;
        }
      }
    }

    return null;
  }

  flush(): ColumnReference | null {
    if (!this.finished) {
      return this.finalizeReference();
    }
    return null;
  }

  private finalizeReference(): ColumnReference | null {
    const ref = this.buildReference();
    this.resetState();
    if (ref && !this.exists(ref)) {
      this.addRef(ref);
      return ref;
    }
    return null;
  }

  buildReference(): ColumnReference | null {
    if ((this.parts.length <= 0 && !this.currentPart) || this.skipCurrent) {
      return null;
    }

    if (this.currentPart) {
      this.parts.push(this.currentPart);
    }

    let col: ColumnReference | null = null;

    if (this.parts.length === 1) {
      const name = this.parts[0];
      col = {
        name,
        isWildcard: name === '*',
      };
    } else if (this.parts.length === 2) {
      const [table, name] = this.parts;
      col = {
        name,
        table,
        isWildcard: name === '*',
      };
    } else if (this.parts.length === 3) {
      const [schema, table, name] = this.parts;
      col = {
        name,
        table,
        schema,
        isWildcard: name === '*',
      };
    } else {
      const fullName = this.parts.join('.');
      col = {
        name: fullName,
        isWildcard: false,
      };
    }

    if (!!this.alias && !!col) {
      col.alias = this.alias;
    }

    return col;
  }

  exists(other: ColumnReference): boolean {
    return this.existing.has(this.getIdentString(other));
  }

  addRef(col: ColumnReference): void {
    this.existing.add(this.getIdentString(col));
  }

  getIdentString(col: ColumnReference): string {
    return `${col.schema ?? 'none'}.${col.table ?? 'none'}.${col.name ?? 'none'}:${
      col.alias ?? 'none'
    }`;
  }

  private maybeIdent(token: Token): boolean {
    const ch = token.value[0];
    const startChars = this.dialect === 'mssql' ? ['"', '['] : ['"', '`'];
    return token.type !== 'string' && (startChars.includes(ch) || /[a-zA-Z_]/.test(ch));
  }
}
