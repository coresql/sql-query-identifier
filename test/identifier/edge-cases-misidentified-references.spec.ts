import { expect } from 'chai';

import { identify } from '../../src';

describe('edge cases — misidentified references', () => {
  describe('column parser', () => {
    // Valid ANSI SQL — arithmetic expressions in SELECT are standard
    it('should not treat arithmetic operator as alias', () => {
      const actual = identify('SELECT a + b FROM t', { identifyColumns: true });
      // Actual: [{name:'a', alias:'+'}] — the + operator is misidentified as an alias
      const columns = actual[0].columns;
      const hasPlus = columns.some((c: { alias?: string }) => c.alias === '+');
      expect(hasPlus).to.equal(false);
    });

    // Valid MSSQL — TOP is a MSSQL-specific clause (SQL Server)
    it('should not misidentify MSSQL TOP as a column', () => {
      const actual = identify('SELECT TOP 10 name, id FROM users', {
        identifyColumns: true,
        dialect: 'mssql',
      });
      // Actual: [{name:'TOP0', alias:'1'}, {name:'id'}] — TOP becomes a garbage column name
      const colNames = actual[0].columns.map((c: { name: string }) => c.name);
      expect(colNames).to.not.include('TOP');
      expect(colNames).to.not.include('TOP0');
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
