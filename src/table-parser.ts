import { TableReference, Token } from './defines';

export class TableParser {
  private parts: string[] = [];
  private alias?: string;
  private existing: Set<string> = new Set<string>();
  private parsing = false;
  private waitingForAlias = false;
  private maybeCommaSep = false;
  private parensDepth = 0;

  // keywords that come directly before a table name.
  // v1 - keeping it very simple.
  private PRE_TABLE_KEYWORDS = new Set<string>(['FROM', 'JOIN', 'INTO']);

  // Tokens that indicate "no alias follows" when we're in the pending state.
  // If we see one of these after a table name, we finalize without an alias.
  private NON_ALIAS_KEYWORDS = new Set<string>([
    'ON',
    'WHERE',
    'SET',
    'VALUES',
    'GROUP',
    'ORDER',
    'HAVING',
    'LIMIT',
    'OFFSET',
    'UNION',
    'INTERSECT',
    'EXCEPT',
    'LEFT',
    'RIGHT',
    'INNER',
    'CROSS',
    'FULL',
    'OUTER',
    'NATURAL',
    'FROM',
    'JOIN',
    'INTO',
  ]);

  resetState(): void {
    this.parts = [];
    this.alias = undefined;
    this.parsing = false;
    this.waitingForAlias = false;
    this.maybeCommaSep = false;
    this.parensDepth = 0;
  }

  processToken(token: Token, nextToken: Token): TableReference | null {
    const upper = token.value.toUpperCase();

    if (this.maybeCommaSep && token.value === ',') {
      this.parsing = true;
      this.maybeCommaSep = false;
      return null;
    }

    // Waiting for the alias token (after AS or implicit)
    if (this.waitingForAlias) {
      if (upper === 'AS') {
        return null;
      }
      this.alias = token.value;
      const ref = this.finalizeReference();
      if (nextToken.value === ',') {
        this.maybeCommaSep = true;
      }
      return ref;
    }

    // Actively collecting table name parts
    if (this.parsing) {
      const val = token.value;
      if (val === '(') {
        this.parensDepth++;
      } else if (val === ')') {
        this.parensDepth--;
      } else if (this.parensDepth === 0) {
        if (val !== '.') {
          this.parts.push(val);
        }
        if (val !== '.' && nextToken.value !== '.') {
          const nextUpper = nextToken.value.toUpperCase();
          if (
            this.NON_ALIAS_KEYWORDS.has(nextUpper) ||
            nextToken.type === 'semicolon' ||
            nextToken.value === ',' ||
            nextToken.value === '(' ||
            nextToken.value === ')'
          ) {
            const ref = this.finalizeReference();
            if (nextToken.value === ',') {
              this.maybeCommaSep = true;
            }
            return ref;
          }
          this.parsing = false;
          this.waitingForAlias = true;
          return null;
        }
      }
    } else if (this.PRE_TABLE_KEYWORDS.has(upper)) {
      this.parsing = true;
    }

    return null;
  }

  /**
   * Flush any pending table reference that hasn't been finalized yet.
   * Called when the statement ends (semicolon or end of input).
   */
  flush(): TableReference | null {
    if (this.waitingForAlias || this.parsing) {
      return this.finalizeReference();
    }
    return null;
  }

  private finalizeReference(): TableReference | null {
    const ref = this.buildReference();
    this.resetState();
    if (ref && !this.exists(ref)) {
      this.addRef(ref);
      return ref;
    }
    return null;
  }

  buildReference(): TableReference | null {
    if (this.parts.length <= 0) {
      return null;
    }

    let table: TableReference | null = null;

    if (this.parts.length === 1) {
      const name = this.parts[0];
      table = {
        name,
      };
    } else if (this.parts.length === 2) {
      const [schema, name] = this.parts;
      table = {
        name,
        schema,
      };
    } else if (this.parts.length === 3) {
      const [database, schema, name] = this.parts;
      table = {
        name,
        schema,
        database,
      };
    } else {
      const fullName = this.parts.join('.');
      table = {
        name: fullName,
      };
    }

    if (!!this.alias && !!table) {
      table.alias = this.alias;
    }

    return table;
  }

  exists(other: TableReference): boolean {
    return this.existing.has(this.getIdentString(other));
  }

  addRef(table: TableReference): void {
    this.existing.add(this.getIdentString(table));
  }

  getIdentString(table: TableReference): string {
    return `${table.database ?? 'none'}.${table.schema ?? 'none'}.${table.name ?? 'none'}:${
      table.alias ?? 'none'
    }`;
  }
}
