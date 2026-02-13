import { ColumnReference, Token } from './defines';

export class ColumnParser {
  private parts: string[] = [];
  private currentPart = '';
  private alias?: string;
  private waitingForAlias = false;
  private parensDepth = 0;
  private skipCurrent = false;
  private finished = false;
  private existing: Set<string> = new Set<string>();

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

  processToken(
    token: Token,
    prevToken?: Token,
    prevNonWhitespaceToken?: Token,
  ): ColumnReference | null {
    if (this.STOP_KEYWORDS.has(token.value.toUpperCase())) {
      this.finished = true;
      const ref = this.buildReference();
      if (ref && !this.exists(ref)) {
        this.addRef(ref);
        return ref;
      }
      return null;
    } else if (token.value.toUpperCase() === 'DISTINCT') {
      // Skip distinct keyword
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
      const ref = this.buildReference();
      this.resetState();
      if (ref && !this.exists(ref)) {
        this.addRef(ref);
        return ref;
      }
      return null;
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
          prevToken?.type === 'whitespace'
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
}
