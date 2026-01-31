import { expect } from 'chai';

import { identify } from '../../src';

describe('identifier', () => {
  describe('column identification', () => {
    describe('when identifyColumns is false or not provided', () => {
      it('should return empty columns array when option is false', () => {
        const actual = identify('SELECT * FROM Persons', { identifyColumns: false });
        expect(actual[0].columns).to.eql([]);
      });

      it('should return empty columns array when option is not provided', () => {
        const actual = identify('SELECT * FROM Persons');
        expect(actual[0].columns).to.eql([]);
      });
    });

    describe('basic column identification', () => {
      it('should identify wildcard', () => {
        const actual = identify('SELECT * FROM Persons', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: '*', isWildcard: true }]);
      });

      it('should identify single column', () => {
        const actual = identify('SELECT column_1 FROM Persons', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: 'column_1', isWildcard: false }]);
      });

      it('should identify multiple columns', () => {
        const actual = identify('SELECT column_1, column_2 FROM Persons', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'column_1', isWildcard: false },
          { name: 'column_2', isWildcard: false },
        ]);
      });

      it('should identify column with alias using AS', () => {
        const actual = identify('SELECT column_2 AS hello FROM Persons', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: 'column_2', alias: 'hello', isWildcard: false }]);
      });

      it('should identify column with implicit alias (no AS)', () => {
        const actual = identify('SELECT column_1 col1 FROM Persons', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: 'column_1', alias: 'col1', isWildcard: false }]);
      });

      it('should identify multiple columns with aliases', () => {
        const actual = identify('SELECT id AS user_id, name AS username FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'id', alias: 'user_id', isWildcard: false },
          { name: 'name', alias: 'username', isWildcard: false },
        ]);
      });

      it('should handle DISTINCT keyword', () => {
        const actual = identify('SELECT DISTINCT column_1 FROM Persons', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: 'column_1', isWildcard: false }]);
      });

      it('should handle DISTINCT with multiple columns', () => {
        const actual = identify('SELECT DISTINCT column_1, column_2 FROM Persons', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'column_1', isWildcard: false },
          { name: 'column_2', isWildcard: false },
        ]);
      });
    });

    describe('table-qualified columns', () => {
      it('should identify table.column', () => {
        const actual = identify('SELECT users.name FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: 'name', table: 'users', isWildcard: false }]);
      });

      it('should identify table.*', () => {
        const actual = identify('SELECT users.* FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: '*', table: 'users', isWildcard: true }]);
      });

      it('should identify multiple table-qualified columns', () => {
        const actual = identify('SELECT users.name, orders.id FROM users JOIN orders', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', table: 'users', isWildcard: false },
          { name: 'id', table: 'orders', isWildcard: false },
        ]);
      });

      it('should identify multiple wildcards from different tables', () => {
        const actual = identify('SELECT users.*, orders.* FROM users JOIN orders', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: '*', table: 'users', isWildcard: true },
          { name: '*', table: 'orders', isWildcard: true },
        ]);
      });

      it('should identify table-qualified column with alias', () => {
        const actual = identify('SELECT users.name AS username FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', table: 'users', alias: 'username', isWildcard: false },
        ]);
      });
    });

    describe('schema-qualified columns', () => {
      it('should identify schema.table.column', () => {
        const actual = identify('SELECT public.users.name FROM public.users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', schema: 'public', table: 'users', isWildcard: false },
        ]);
      });

      it('should identify schema.table.*', () => {
        const actual = identify('SELECT public.users.* FROM public.users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: '*', schema: 'public', table: 'users', isWildcard: true },
        ]);
      });

      it('should identify multiple schema-qualified columns', () => {
        const actual = identify(
          'SELECT public.users.name, dbo.orders.id FROM public.users JOIN dbo.orders',
          { identifyColumns: true },
        );
        expect(actual[0].columns).to.eql([
          { name: 'name', schema: 'public', table: 'users', isWildcard: false },
          { name: 'id', schema: 'dbo', table: 'orders', isWildcard: false },
        ]);
      });

      it('should identify schema.table.column with alias', () => {
        const actual = identify('SELECT public.users.name AS username FROM public.users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', schema: 'public', table: 'users', alias: 'username', isWildcard: false },
        ]);
      });
    });

    describe('function calls', () => {
      it('should identify COUNT(*) as expression', () => {
        const actual = identify('SELECT COUNT(*) FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: 'COUNT(*)', isWildcard: false }]);
      });

      it('should identify function with column argument', () => {
        const actual = identify('SELECT SUM(price) FROM orders', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: 'SUM(price)', isWildcard: false }]);
      });

      it('should identify multiple functions', () => {
        const actual = identify('SELECT COUNT(*), SUM(price) FROM orders', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'COUNT(*)', isWildcard: false },
          { name: 'SUM(price)', isWildcard: false },
        ]);
      });

      it('should identify function with alias', () => {
        const actual = identify('SELECT COUNT(*) AS total FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: 'COUNT(*)', alias: 'total', isWildcard: false }]);
      });

      it('should identify UPPER function with alias', () => {
        const actual = identify('SELECT UPPER(name) AS upper_name FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'UPPER(name)', alias: 'upper_name', isWildcard: false },
        ]);
      });

      it('should identify mixed columns and functions', () => {
        const actual = identify('SELECT id, name, COUNT(*) AS total FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: 'name', isWildcard: false },
          { name: 'COUNT(*)', alias: 'total', isWildcard: false },
        ]);
      });
    });

    describe('queries with different clauses', () => {
      it('should stop parsing at FROM clause', () => {
        const actual = identify('SELECT column_1 FROM Persons WHERE id = 1', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([{ name: 'column_1', isWildcard: false }]);
      });

      it('should stop parsing at WHERE clause (no FROM)', () => {
        const actual = identify('SELECT column_1 WHERE 1=1', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: 'column_1', isWildcard: false }]);
      });

      it('should stop parsing at GROUP BY', () => {
        const actual = identify('SELECT column_1, COUNT(*) FROM users GROUP BY column_1', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'column_1', isWildcard: false },
          { name: 'COUNT(*)', isWildcard: false },
        ]);
      });

      it('should stop parsing at ORDER BY', () => {
        const actual = identify('SELECT column_1 FROM users ORDER BY column_1', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([{ name: 'column_1', isWildcard: false }]);
      });

      it('should stop parsing at HAVING', () => {
        const actual = identify('SELECT COUNT(*) FROM users HAVING COUNT(*) > 10', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([{ name: 'COUNT(*)', isWildcard: false }]);
      });

      it('should stop parsing at LIMIT', () => {
        const actual = identify('SELECT column_1 FROM users LIMIT 10', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: 'column_1', isWildcard: false }]);
      });

      it('should stop parsing at UNION', () => {
        const actual = identify('SELECT column_1 FROM users UNION SELECT column_2 FROM orders', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([{ name: 'column_1', isWildcard: false }]);
      });
    });

    describe('edge cases', () => {
      it('should handle query with quoted identifier', () => {
        const actual = identify('SELECT "column name" FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: '"column name"', isWildcard: false }]);
      });

      it('should handle query with backtick quoted identifier', () => {
        const actual = identify('SELECT `column name` FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: '`column name`', isWildcard: false }]);
      });

      it('should handle inline comments in column list', () => {
        const actual = identify('SELECT column_1, /* comment */ column_2 FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'column_1', isWildcard: false },
          { name: 'column_2', isWildcard: false },
        ]);
      });

      it('should handle line comments in column list', () => {
        const actual = identify('SELECT column_1, -- comment\ncolumn_2 FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'column_1', isWildcard: false },
          { name: 'column_2', isWildcard: false },
        ]);
      });

      describe('duplicate column handling', () => {
        it('should deduplicate identical unqualified columns', () => {
          const actual = identify('SELECT column_1, column_1 FROM users', {
            identifyColumns: true,
          });
          expect(actual[0].columns).to.eql([{ name: 'column_1', isWildcard: false }]);
        });

        it('should deduplicate identical qualified columns', () => {
          const actual = identify('SELECT users.id, users.id FROM users', {
            identifyColumns: true,
          });
          expect(actual[0].columns).to.eql([{ name: 'id', table: 'users', isWildcard: false }]);
        });

        it('should keep columns with different aliases', () => {
          const actual = identify('SELECT column_1 AS first, column_1 AS second FROM users', {
            identifyColumns: true,
          });
          expect(actual[0].columns).to.eql([
            { name: 'column_1', alias: 'first', isWildcard: false },
            { name: 'column_1', alias: 'second', isWildcard: false },
          ]);
        });

        it('should keep same column name from different tables', () => {
          const actual = identify('SELECT users.id, orders.id FROM users JOIN orders', {
            identifyColumns: true,
          });
          expect(actual[0].columns).to.eql([
            { name: 'id', table: 'users', isWildcard: false },
            { name: 'id', table: 'orders', isWildcard: false },
          ]);
        });
      });
    });

    describe('combined with identifyTables', () => {
      it('should identify both tables and columns', () => {
        const actual = identify('SELECT id, name FROM users', {
          identifyTables: true,
          identifyColumns: true,
        });
        expect(actual[0].tables).to.eql(['users']);
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: 'name', isWildcard: false },
        ]);
      });

      it('should identify both with JOIN', () => {
        const actual = identify('SELECT users.id, orders.total FROM users JOIN orders', {
          identifyTables: true,
          identifyColumns: true,
        });
        expect(actual[0].tables).to.eql(['users', 'orders']);
        expect(actual[0].columns).to.eql([
          { name: 'id', table: 'users', isWildcard: false },
          { name: 'total', table: 'orders', isWildcard: false },
        ]);
      });
    });

    describe('non-SELECT statements', () => {
      it('should not identify columns for INSERT', () => {
        const actual = identify('INSERT INTO users (id, name) VALUES (1, "test")', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([]);
      });

      it('should not identify columns for UPDATE', () => {
        const actual = identify('UPDATE users SET name = "test"', { identifyColumns: true });
        expect(actual[0].columns).to.eql([]);
      });

      it('should not identify columns for DELETE', () => {
        const actual = identify('DELETE FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([]);
      });
    });
  });
});
