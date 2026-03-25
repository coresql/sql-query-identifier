import { expect } from 'chai';

import { identify } from '../../src';

describe('edge cases — misidentified references', () => {
  describe('column parser', () => {
    // Valid ANSI SQL — arithmetic expressions in SELECT are standard
    it('should not treat arithmetic operator as alias', () => {
      const actual = identify('SELECT a + b FROM t', { identifyColumns: true });
      // Actual: [{name:'a', alias:'+'}] — the + operator is misidentified as an alias
      const columns = actual[0].columns;
      const hasPlus = columns.some((col: { alias?: string }) => col.alias === '+');
      expect(hasPlus).to.equal(false);
    });

    // Valid MSSQL — TOP is a MSSQL-specific clause (SQL Server)
    it('should not misidentify MSSQL TOP as a column', () => {
      const actual = identify('SELECT TOP 10 name, id FROM users', {
        identifyColumns: true,
        dialect: 'mssql',
      });
      expect(actual[0].columns).to.eql([
        { name: 'name', isWildcard: false },
        { name: 'id', isWildcard: false },
      ]);
    });
  });

  describe('table parser', () => {
    // Valid ANSI SQL — derived table / subquery in FROM is standard SQL
    it('should not produce garbage from subquery in FROM', () => {
      const actual = identify('SELECT * FROM (SELECT id FROM users) AS subquery', {
        identifyTables: true,
      });
      // Actual: [{name:'(', alias:'SELECT'}, {name:'users'}]
      // The '(' is misidentified as a table name, 'SELECT' as its alias
      const tables = actual[0].tables;
      tables.forEach((t: { name: string }) => {
        expect(t.name).to.not.equal('(');
        expect(t.name).to.not.equal('SELECT');
      });
    });
  });
});
