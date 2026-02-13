import { TableReference, Token } from "./defines";

export class TableParser {
  private parts: string[] = [];
  private alias?: string;
  private existing: Set<string> = new Set<string>();
  private parsing = false;

  private PRE_TABLE_KEYWORDS = new Set<string>(['FROM', 'JOIN', 'INTO']);

  resetState() {
    this.parts = [];
    this.alias = undefined;
    this.parsing = false;
  }

  processToken(token: Token, nextToken: Token): TableReference | null {
    if (this.parsing) {
      const val = token.value;
      if (val !== '.') {
        this.parts.push(val);
      }
      if (val !== '.' && nextToken.value !== '.') {
        const ref = this.buildReference();
        this.resetState();
        if (ref && !this.exists(ref)) {
          this.addRef(ref);
          return ref;
        }
        return null;
      }
    } else if (this.PRE_TABLE_KEYWORDS.has(token.value.toUpperCase())) {
      this.parsing = true;
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

  addRef(table: TableReference) {
    this.existing.add(this.getIdentString(table));
  }

  getIdentString(table: TableReference) {
    // These can be undefined but as long as it's always the same I don't think we care?
    return `${table.database}.${table.schema}.${table.name}:${table.alias}`;
  }
}
