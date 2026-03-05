import { expect } from 'chai';

import { identify } from '../../src';

describe('edge cases — missed references', () => {
  describe('column parser', () => {
    // Valid ANSI SQL — SELECT without FROM is allowed (e.g. SELECT 1+1)
    it('should not lose last column in SELECT without FROM (multiple columns)', () => {
      const actual = identify('SELECT a, b, c', { identifyColumns: true });
      // Actual: [{name:'a'}, {name:'b'}] — last column 'c' is lost (no flush at end of input)
      expect(actual[0].columns).to.eql([
        { name: 'a', isWildcard: false },
        { name: 'b', isWildcard: false },
        { name: 'c', isWildcard: false },
      ]);
    });

    // Valid ANSI SQL — single column SELECT without FROM
    it('should not lose single column in SELECT without FROM', () => {
      const actual = identify('SELECT a', { identifyColumns: true });
      // Actual: [] — the only column is never flushed
      expect(actual[0].columns).to.eql([{ name: 'a', isWildcard: false }]);
    });

    // Valid ANSI SQL — CASE expressions are standard SQL-92+
    it('should identify id column alongside CASE expression', () => {
      const actual = identify(
        "SELECT id, CASE WHEN status = 1 THEN 'active' ELSE 'inactive' END AS status_text FROM users",
        { identifyColumns: true },
      );
      const columns = actual[0].columns;
      expect(columns[0]).to.eql({ name: 'id', isWildcard: false });
    });

    // Valid MSSQL — TOP is a MSSQL-specific clause
    it('should not lose columns after MSSQL TOP clause', () => {
      const actual = identify('SELECT TOP 10 name, id FROM users', {
        identifyColumns: true,
        dialect: 'mssql',
      });
      // Actual: [{name:'TOP0', alias:'1'}, {name:'id'}] — 'name' is lost
      const colNames = actual[0].columns.map((col: { name: string }) => col.name);
      expect(colNames).to.include('name');
      expect(colNames).to.include('id');
    });

    // Valid PostgreSQL — DISTINCT ON is PostgreSQL-specific (9.0+)
    it('should not lose columns after PostgreSQL DISTINCT ON', () => {
      const actual = identify('SELECT DISTINCT ON (id) name, email FROM users', {
        identifyColumns: true,
        dialect: 'psql',
      });
      // Actual: [{name:'email'}] — 'name' is lost (ON absorbs into skipped parens expression)
      const colNames = actual[0].columns.map((col: { name: string }) => col.name);
      expect(colNames).to.include('name');
      expect(colNames).to.include('email');
    });

    // Valid ANSI SQL — string literals in SELECT list are standard
    it('should not lose columns after string literal', () => {
      const actual = identify("SELECT 'hello' AS greeting, id FROM users", {
        identifyColumns: true,
      });
      const colNames = actual[0].columns.map((col: { name: string }) => col.name);
      expect(colNames).to.include('id');
    });
  });

  describe('table parser', () => {
    // Valid ANSI SQL — comma-separated tables (implicit cross join) is SQL-89
    it('should find second table in comma-separated list', () => {
      const actual = identify('SELECT * FROM a, b', { identifyTables: true });
      // Actual: [{name:'a'}] — 'b' is missed (no PRE_TABLE_KEYWORD after comma)
      expect(actual[0].tables).to.eql([{ name: 'a' }, { name: 'b' }]);
    });

    // Valid ANSI SQL — multiple comma-separated tables
    it('should find all three comma-separated tables', () => {
      const actual = identify('SELECT * FROM a, b, c', { identifyTables: true });
      // Actual: [{name:'a'}] — 'b' and 'c' are missed
      expect(actual[0].tables).to.eql([{ name: 'a' }, { name: 'b' }, { name: 'c' }]);
    });

    // Valid ANSI SQL — comma-separated tables with aliases
    it('should find comma-separated tables with aliases', () => {
      const actual = identify('SELECT * FROM users u, orders o', { identifyTables: true });
      // Actual: [{name:'users', alias:'u'}] — 'orders' is missed
      expect(actual[0].tables).to.eql([
        { name: 'users', alias: 'u' },
        { name: 'orders', alias: 'o' },
      ]);
    });

    // Valid ANSI SQL — CTEs (WITH clause) are standard SQL:1999+
    it('should find table referenced from CTE', () => {
      const actual = identify('WITH cte AS (SELECT id FROM users) SELECT * FROM cte', {
        identifyTables: true,
      });
      // Actual: [] — 'cte' not found (WITH not handled, FROM inside parens is skipped)
      const tableNames = actual[0].tables.map((t: { name: string }) => t.name);
      expect(tableNames).to.include('cte');
    });

    // Valid ANSI SQL — UPDATE with table identification
    it('should find table in basic UPDATE statement', () => {
      const actual = identify('UPDATE users SET name = 1', { identifyTables: true });
      // Actual: [] — UPDATE not in PRE_TABLE_KEYWORDS, so the table is never found
      const tableNames = actual[0].tables.map((t: { name: string }) => t.name);
      expect(tableNames).to.include('users');
    });

    // Valid ANSI SQL — DELETE with table identification
    it('should find table in basic DELETE statement', () => {
      const actual = identify('DELETE FROM orders WHERE id = 1', { identifyTables: true });
      // Actual: [] — even though FROM is a PRE_TABLE_KEYWORD, the table is not found
      // (likely a flush issue — DELETE FROM orders ends without a NON_ALIAS_KEYWORD)
      const tableNames = actual[0].tables.map((t: { name: string }) => t.name);
      expect(tableNames).to.include('orders');
    });

    // Valid PostgreSQL — UPDATE ... FROM is PostgreSQL-specific
    it('should find both tables in UPDATE ... FROM (PostgreSQL)', () => {
      const actual = identify(
        'UPDATE target SET col = source.col FROM source WHERE target.id = source.id',
        { identifyTables: true, dialect: 'psql' },
      );
      // Actual: [] — neither table found (UPDATE not in PRE_TABLE_KEYWORDS,
      // and the parser state prevents FROM from triggering after SET)
      const tableNames = actual[0].tables.map((t: { name: string }) => t.name);
      expect(tableNames).to.include('target');
      expect(tableNames).to.include('source');
    });

    // Valid PostgreSQL — DELETE ... USING is PostgreSQL-specific
    it('should find USING table in DELETE ... USING (PostgreSQL)', () => {
      const actual = identify('DELETE FROM orders USING users WHERE orders.user_id = users.id', {
        identifyTables: true,
        dialect: 'psql',
      });
      // Actual: [] — 'orders' not found (flush issue), 'users' not found (USING not in PRE_TABLE_KEYWORDS)
      const tableNames = actual[0].tables.map((t: { name: string }) => t.name);
      expect(tableNames).to.include('orders');
      expect(tableNames).to.include('users');
    });
  });
});
