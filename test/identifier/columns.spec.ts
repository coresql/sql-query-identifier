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

      it('should handle DISTINCT with wildcard', () => {
        const actual = identify('SELECT DISTINCT * FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: '*', isWildcard: true }]);
      });

      it('should handle DISTINCT with qualified columns', () => {
        const actual = identify('SELECT DISTINCT users.id, users.name FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'id', table: 'users', isWildcard: false },
          { name: 'name', table: 'users', isWildcard: false },
        ]);
      });

      it('should handle DISTINCT with alias', () => {
        const actual = identify('SELECT DISTINCT column_1 AS col FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([{ name: 'column_1', alias: 'col', isWildcard: false }]);
      });

      it('should handle DISTINCT with qualified wildcard', () => {
        const actual = identify('SELECT DISTINCT users.* FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: '*', table: 'users', isWildcard: true }]);
      });
    });

    describe('MSSQL TOP clause', () => {
      it('should skip TOP with integer', () => {
        const actual = identify('SELECT TOP 10 name, id FROM users', {
          identifyColumns: true,
          dialect: 'mssql',
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', isWildcard: false },
          { name: 'id', isWildcard: false },
        ]);
      });

      it('should skip TOP with parenthesized integer', () => {
        const actual = identify('SELECT TOP (10) name, id FROM users', {
          identifyColumns: true,
          dialect: 'mssql',
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', isWildcard: false },
          { name: 'id', isWildcard: false },
        ]);
      });

      it('should skip TOP with PERCENT', () => {
        const actual = identify('SELECT TOP 10 PERCENT name, id FROM users', {
          identifyColumns: true,
          dialect: 'mssql',
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', isWildcard: false },
          { name: 'id', isWildcard: false },
        ]);
      });

      it('should skip TOP with parenthesized PERCENT', () => {
        const actual = identify('SELECT TOP (10) PERCENT name, id FROM users', {
          identifyColumns: true,
          dialect: 'mssql',
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', isWildcard: false },
          { name: 'id', isWildcard: false },
        ]);
      });

      it('should skip TOP with WITH TIES', () => {
        const actual = identify('SELECT TOP 10 WITH TIES name, id FROM users', {
          identifyColumns: true,
          dialect: 'mssql',
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', isWildcard: false },
          { name: 'id', isWildcard: false },
        ]);
      });

      it('should skip TOP with parenthesized WITH TIES', () => {
        const actual = identify('SELECT TOP (10) WITH TIES name, id FROM users', {
          identifyColumns: true,
          dialect: 'mssql',
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', isWildcard: false },
          { name: 'id', isWildcard: false },
        ]);
      });

      it('should skip TOP with PERCENT and WITH TIES', () => {
        const actual = identify('SELECT TOP 10 PERCENT WITH TIES name, id FROM users', {
          identifyColumns: true,
          dialect: 'mssql',
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', isWildcard: false },
          { name: 'id', isWildcard: false },
        ]);
      });

      it('should skip TOP with parenthesized PERCENT and WITH TIES', () => {
        const actual = identify('SELECT TOP (10) PERCENT WITH TIES name, id FROM users', {
          identifyColumns: true,
          dialect: 'mssql',
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', isWildcard: false },
          { name: 'id', isWildcard: false },
        ]);
      });

      it('should skip TOP with parenthesized expression', () => {
        const actual = identify('SELECT TOP (@n) name, id FROM users', {
          identifyColumns: true,
          dialect: 'mssql',
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', isWildcard: false },
          { name: 'id', isWildcard: false },
        ]);
      });

      it('should handle DISTINCT with TOP', () => {
        const actual = identify('SELECT DISTINCT TOP 10 name FROM users', {
          identifyColumns: true,
          dialect: 'mssql',
        });
        expect(actual[0].columns).to.eql([{ name: 'name', isWildcard: false }]);
      });

      it('should handle TOP with wildcard', () => {
        const actual = identify('SELECT TOP 10 * FROM users', {
          identifyColumns: true,
          dialect: 'mssql',
        });
        expect(actual[0].columns).to.eql([{ name: '*', isWildcard: true }]);
      });

      it('should handle TOP with qualified columns', () => {
        const actual = identify('SELECT TOP 5 u.name, u.id FROM users u', {
          identifyColumns: true,
          dialect: 'mssql',
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', table: 'u', isWildcard: false },
          { name: 'id', table: 'u', isWildcard: false },
        ]);
      });

      it('should handle TOP with column alias', () => {
        const actual = identify('SELECT TOP 10 name AS n, id FROM users', {
          identifyColumns: true,
          dialect: 'mssql',
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', alias: 'n', isWildcard: false },
          { name: 'id', isWildcard: false },
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

    describe('wildcard edge cases', () => {
      it('should identify wildcard mixed with regular column before it', () => {
        const actual = identify('SELECT id, * FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: '*', isWildcard: true },
        ]);
      });

      it('should identify wildcard mixed with regular column after it', () => {
        const actual = identify('SELECT *, id FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([
          { name: '*', isWildcard: true },
          { name: 'id', isWildcard: false },
        ]);
      });

      it('should identify wildcard between columns', () => {
        const actual = identify('SELECT id, *, name FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: '*', isWildcard: true },
          { name: 'name', isWildcard: false },
        ]);
      });

      it('should identify unqualified and qualified wildcards together', () => {
        const actual = identify('SELECT *, users.* FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([
          { name: '*', isWildcard: true },
          { name: '*', table: 'users', isWildcard: true },
        ]);
      });

      it('should identify multiple qualified wildcards', () => {
        const actual = identify('SELECT users.*, orders.*, products.* FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: '*', table: 'users', isWildcard: true },
          { name: '*', table: 'orders', isWildcard: true },
          { name: '*', table: 'products', isWildcard: true },
        ]);
      });

      it('should identify schema-qualified wildcards mixed with unqualified', () => {
        const actual = identify('SELECT *, public.users.* FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([
          { name: '*', isWildcard: true },
          { name: '*', schema: 'public', table: 'users', isWildcard: true },
        ]);
      });
    });

    describe('function calls', () => {
      // Functions with parentheses are skipped in simple mode.
      // Only actual column references and wildcards are captured.

      it('should skip COUNT(*) as expression', () => {
        const actual = identify('SELECT COUNT(*) FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([]);
      });

      it('should skip function with column argument', () => {
        const actual = identify('SELECT SUM(price) FROM orders', { identifyColumns: true });
        expect(actual[0].columns).to.eql([]);
      });

      it('should skip multiple functions', () => {
        const actual = identify('SELECT COUNT(*), SUM(price) FROM orders', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([]);
      });

      it('should skip function with alias', () => {
        const actual = identify('SELECT COUNT(*) AS total FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([]);
      });

      it('should skip UPPER function with alias', () => {
        const actual = identify('SELECT UPPER(name) AS upper_name FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([]);
      });

      it('should identify columns but skip functions when mixed', () => {
        const actual = identify('SELECT id, name, COUNT(*) AS total FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: 'name', isWildcard: false },
        ]);
      });

      it('should skip nested functions', () => {
        const actual = identify('SELECT UPPER(LOWER(name)) FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([]);
      });

      it('should skip function with multiple arguments', () => {
        const actual = identify('SELECT COALESCE(col1, col2, col3) FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([]);
      });

      it('should skip function with qualified column argument', () => {
        const actual = identify('SELECT COUNT(users.id) FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([]);
      });

      it('should skip function with schema-qualified column argument', () => {
        const actual = identify('SELECT SUM(public.orders.amount) FROM public.orders', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([]);
      });

      it('should skip string concatenation function', () => {
        const actual = identify('SELECT CONCAT(first_name, last_name) FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([]);
      });

      it('should skip aggregate with DISTINCT inside parentheses', () => {
        const actual = identify('SELECT COUNT(DISTINCT user_id) FROM orders', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([]);
      });

      it('should skip multiple nested function calls', () => {
        const actual = identify('SELECT ROUND(AVG(price), 2) FROM products', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([]);
      });

      it('should skip triply nested functions', () => {
        const actual = identify("SELECT COALESCE(UPPER(TRIM(name)), 'UNKNOWN') FROM users", {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([]);
      });
    });

    describe('parentheses without functions', () => {
      it('should skip parenthesized expression', () => {
        const actual = identify('SELECT (price * 1.1) FROM products', { identifyColumns: true });
        expect(actual[0].columns).to.eql([]);
      });

      it('should skip parenthesized column reference', () => {
        const actual = identify('SELECT (id) FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([]);
      });

      it('should handle regular columns mixed with parenthesized expressions', () => {
        const actual = identify('SELECT id, (price * 1.1), name FROM products', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: 'name', isWildcard: false },
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
        expect(actual[0].columns).to.eql([{ name: 'column_1', isWildcard: false }]);
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
        expect(actual[0].columns).to.eql([]);
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

      it('should stop parsing at UNION ALL', () => {
        const actual = identify(
          'SELECT column_1 FROM users UNION ALL SELECT column_2 FROM orders',
          {
            identifyColumns: true,
          },
        );
        expect(actual[0].columns).to.eql([{ name: 'column_1', isWildcard: false }]);
      });

      it('should handle multiple columns before UNION', () => {
        const actual = identify(
          'SELECT id, name, email FROM users UNION SELECT id, title, author FROM posts',
          {
            identifyColumns: true,
          },
        );
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: 'name', isWildcard: false },
          { name: 'email', isWildcard: false },
        ]);
      });

      it('should stop parsing with no FROM clause before WHERE', () => {
        const actual = identify('SELECT 1, 2, 3 WHERE 1=1', { identifyColumns: true });
        expect(actual[0].columns).to.eql([
          { name: '1', isWildcard: false },
          { name: '2', isWildcard: false },
          { name: '3', isWildcard: false },
        ]);
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

      describe('quoted identifiers with special characters', () => {
        it('should handle quoted identifier with dots inside', () => {
          const actual = identify('SELECT "column.with.dots" FROM users', {
            identifyColumns: true,
          });
          expect(actual[0].columns).to.eql([{ name: '"column.with.dots"', isWildcard: false }]);
        });

        it('should handle backtick identifier with dots inside', () => {
          const actual = identify('SELECT `column.with.dots` FROM users', {
            identifyColumns: true,
          });
          expect(actual[0].columns).to.eql([{ name: '`column.with.dots`', isWildcard: false }]);
        });

        it('should handle mixed quoted and unquoted columns', () => {
          const actual = identify('SELECT "first name", last_name, "middle name" FROM users', {
            identifyColumns: true,
          });
          expect(actual[0].columns).to.eql([
            { name: '"first name"', isWildcard: false },
            { name: 'last_name', isWildcard: false },
            { name: '"middle name"', isWildcard: false },
          ]);
        });

        it('should handle quoted identifier with alias', () => {
          const actual = identify('SELECT "column name" AS col FROM users', {
            identifyColumns: true,
          });
          expect(actual[0].columns).to.eql([
            { name: '"column name"', alias: 'col', isWildcard: false },
          ]);
        });

        it('should handle qualified quoted identifier', () => {
          const actual = identify('SELECT users."column name" FROM users', {
            identifyColumns: true,
          });
          expect(actual[0].columns).to.eql([
            { name: '"column name"', table: 'users', isWildcard: false },
          ]);
        });
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

        it('should deduplicate wildcard', () => {
          const actual = identify('SELECT *, * FROM users', { identifyColumns: true });
          expect(actual[0].columns).to.eql([{ name: '*', isWildcard: true }]);
        });

        it('should deduplicate qualified wildcard', () => {
          const actual = identify('SELECT users.*, users.* FROM users', { identifyColumns: true });
          expect(actual[0].columns).to.eql([{ name: '*', table: 'users', isWildcard: true }]);
        });

        it('should not deduplicate columns with one qualified and one unqualified', () => {
          const actual = identify('SELECT id, users.id FROM users', { identifyColumns: true });
          expect(actual[0].columns).to.eql([
            { name: 'id', isWildcard: false },
            { name: 'id', table: 'users', isWildcard: false },
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
        expect(actual[0].tables).to.eql([{ name: 'users' }]);
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
        expect(actual[0].tables).to.eql([{ name: 'users' }, { name: 'orders' }]);
        expect(actual[0].columns).to.eql([
          { name: 'id', table: 'users', isWildcard: false },
          { name: 'total', table: 'orders', isWildcard: false },
        ]);
      });
    });

    describe('alias variations', () => {
      it('should identify qualified column with implicit alias', () => {
        const actual = identify('SELECT users.name username FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([
          { name: 'name', table: 'users', alias: 'username', isWildcard: false },
        ]);
      });

      it('should identify schema-qualified column with implicit alias', () => {
        const actual = identify('SELECT public.users.name username FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'name', schema: 'public', table: 'users', alias: 'username', isWildcard: false },
        ]);
      });

      it('should identify multiple columns with same name but different aliases', () => {
        const actual = identify('SELECT id AS user_id, id AS order_id FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'id', alias: 'user_id', isWildcard: false },
          { name: 'id', alias: 'order_id', isWildcard: false },
        ]);
      });

      it('should handle reserved word as quoted alias', () => {
        const actual = identify('SELECT column_1 AS "select" FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'column_1', alias: '"select"', isWildcard: false },
        ]);
      });

      it('should handle alias with special characters', () => {
        const actual = identify('SELECT id AS "user-id" FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: 'id', alias: '"user-id"', isWildcard: false }]);
      });

      it('should handle backtick alias', () => {
        const actual = identify('SELECT id AS `user id` FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: 'id', alias: '`user id`', isWildcard: false }]);
      });

      it('should handle mixed explicit and implicit aliases', () => {
        const actual = identify('SELECT id AS user_id, name username, email FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'id', alias: 'user_id', isWildcard: false },
          { name: 'name', alias: 'username', isWildcard: false },
          { name: 'email', isWildcard: false },
        ]);
      });
    });

    describe('whitespace and formatting', () => {
      it('should handle extra spaces around commas', () => {
        const actual = identify('SELECT id  ,  name  ,  email FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: 'name', isWildcard: false },
          { name: 'email', isWildcard: false },
        ]);
      });

      it('should handle newlines between columns', () => {
        const actual = identify('SELECT\nid,\nname,\nemail\nFROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: 'name', isWildcard: false },
          { name: 'email', isWildcard: false },
        ]);
      });

      it('should handle tabs between columns', () => {
        const actual = identify('SELECT\tid,\tname\tFROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: 'name', isWildcard: false },
        ]);
      });

      it('should handle mixed whitespace', () => {
        const actual = identify('SELECT  id,\n\t  name   FROM users', { identifyColumns: true });
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: 'name', isWildcard: false },
        ]);
      });

      it('should handle no whitespace around dots in qualified columns', () => {
        const actual = identify('SELECT users.id,orders.total FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'id', table: 'users', isWildcard: false },
          { name: 'total', table: 'orders', isWildcard: false },
        ]);
      });

      it('should handle excessive whitespace in qualified columns', () => {
        const actual = identify('SELECT users . id , orders . total FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'id', table: 'users', isWildcard: false },
          { name: 'total', table: 'orders', isWildcard: false },
        ]);
      });
    });

    describe('complex mixed scenarios', () => {
      it('should handle columns, wildcards, and functions mixed together', () => {
        const actual = identify('SELECT id, users.*, COUNT(*), name FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: '*', table: 'users', isWildcard: true },
          { name: 'name', isWildcard: false },
        ]);
      });

      it('should handle multiple qualified wildcards with regular columns', () => {
        const actual = identify('SELECT users.*, orders.id, orders.total, products.* FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: '*', table: 'users', isWildcard: true },
          { name: 'id', table: 'orders', isWildcard: false },
          { name: 'total', table: 'orders', isWildcard: false },
          { name: '*', table: 'products', isWildcard: true },
        ]);
      });

      it('should handle all qualification levels in one query', () => {
        const actual = identify('SELECT id, users.name, public.orders.total, * FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: 'name', table: 'users', isWildcard: false },
          { name: 'total', schema: 'public', table: 'orders', isWildcard: false },
          { name: '*', isWildcard: true },
        ]);
      });

      it('should handle columns with functions interspersed', () => {
        const actual = identify(
          'SELECT id, COUNT(*), name, SUM(price), email, MAX(created_at) FROM users',
          { identifyColumns: true },
        );
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: 'name', isWildcard: false },
          { name: 'email', isWildcard: false },
        ]);
      });

      it('should handle schema-qualified columns with functions', () => {
        const actual = identify(
          'SELECT public.users.id, COUNT(*), dbo.orders.total, SUM(amount) FROM users',
          { identifyColumns: true },
        );
        expect(actual[0].columns).to.eql([
          { name: 'id', schema: 'public', table: 'users', isWildcard: false },
          { name: 'total', schema: 'dbo', table: 'orders', isWildcard: false },
        ]);
      });

      it('should handle DISTINCT with mixed column types and functions', () => {
        const actual = identify('SELECT DISTINCT id, users.name, COUNT(*), * FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'id', isWildcard: false },
          { name: 'name', table: 'users', isWildcard: false },
          { name: '*', isWildcard: true },
        ]);
      });

      it('should handle all features combined: DISTINCT, qualified, wildcards, aliases, functions', () => {
        const actual = identify(
          'SELECT DISTINCT id AS user_id, users.*, public.orders.total AS total, COUNT(*), name FROM users',
          { identifyColumns: true },
        );
        expect(actual[0].columns).to.eql([
          { name: 'id', alias: 'user_id', isWildcard: false },
          { name: '*', table: 'users', isWildcard: true },
          { name: 'total', schema: 'public', table: 'orders', alias: 'total', isWildcard: false },
          { name: 'name', isWildcard: false },
        ]);
      });
    });

    describe('long and unusual column names', () => {
      it('should handle very long column name', () => {
        const longName = 'a'.repeat(100);
        const actual = identify(`SELECT ${longName} FROM users`, { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: longName, isWildcard: false }]);
      });

      it('should handle very long alias', () => {
        const longAlias = 'b'.repeat(100);
        const actual = identify(`SELECT id AS ${longAlias} FROM users`, { identifyColumns: true });
        expect(actual[0].columns).to.eql([{ name: 'id', alias: longAlias, isWildcard: false }]);
      });

      it('should handle column name with underscores', () => {
        const actual = identify('SELECT _col_name_, __private__, column_name_123 FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: '_col_name_', isWildcard: false },
          { name: '__private__', isWildcard: false },
          { name: 'column_name_123', isWildcard: false },
        ]);
      });

      it('should handle column name with numbers', () => {
        const actual = identify('SELECT col1, col2, col123, column1name FROM users', {
          identifyColumns: true,
        });
        expect(actual[0].columns).to.eql([
          { name: 'col1', isWildcard: false },
          { name: 'col2', isWildcard: false },
          { name: 'col123', isWildcard: false },
          { name: 'column1name', isWildcard: false },
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
