import { Dialect, getExecutionType, identify } from '../src/index';
import { expect } from 'chai';
import { ParamTypes } from '../src/defines';

describe('identify', () => {
  it('should throw error for invalid dialect', () => {
    expect(() => identify('SELECT * FROM foo', { dialect: 'invalid' as Dialect })).to.throw(
      'Unknown dialect. Allowed values: mssql, sqlite, mysql, oracle, psql, bigquery, generic',
    );
  });

  it('should sort parameters for postgres', () => {
    expect(identify('SELECT * FROM foo WHERE bar = $2 AND baz = $1', { dialect: 'psql' })).to.eql([
      {
        start: 0,
        end: 44,
        text: 'SELECT * FROM foo WHERE bar = $2 AND baz = $1',
        type: 'SELECT',
        executionType: 'LISTING',
        parameters: ['$1', '$2'],
        tables: [],
        columns: [],
      },
    ]);
  });

  it('should identify custom parameters', () => {
    const paramTypes: ParamTypes = {
      positional: true,
      numbered: ['$'],
      named: [':'],
      quoted: [':'],
      custom: ['\\{[a-zA-Z0-9_]+\\}'],
    };
    const query = `SELECT * FROM foo WHERE bar = ? AND baz = $1 AND fizz = :fizzz  AND buzz = :"buzz buzz" AND foo2 = {fooo}`;

    expect(identify(query, { dialect: 'psql', paramTypes })).to.eql([
      {
        start: 0,
        end: 104,
        text: query,
        type: 'SELECT',
        executionType: 'LISTING',
        parameters: ['?', '$1', ':fizzz', ':"buzz buzz"', '{fooo}'],
        tables: [],
        columns: [],
      },
    ]);
  });

  it('custom params should override defaults for dialect', () => {
    const paramTypes: ParamTypes = {
      positional: true,
    };

    const query = 'SELECT * FROM foo WHERE bar = $1 AND bar = :named AND fizz = :`quoted`';

    expect(identify(query, { dialect: 'psql', paramTypes })).to.eql([
      {
        start: 0,
        end: 69,
        text: query,
        type: 'SELECT',
        executionType: 'LISTING',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);
  });

  it('params should be recognized in a CTE', () => {
    const query = `
      WITH foo AS (
        SELECT * FROM bar where user_id = $1::bigint
      )
      SELECT * FROM foo
    `;

    expect(identify(query.trim(), { dialect: 'psql' })).to.eql([
      {
        start: 0,
        end: 97,
        text: query.trim(),
        type: 'SELECT',
        executionType: 'LISTING',
        parameters: ['$1'],
        tables: [],
        columns: [],
      },
    ]);
  });

  it('should identify tables in simple for basic cases', () => {
    expect(
      identify('SELECT * FROM foo JOIN bar ON foo.id = bar.id', { identifyTables: true }),
    ).to.eql([
      {
        start: 0,
        end: 44,
        text: 'SELECT * FROM foo JOIN bar ON foo.id = bar.id',
        type: 'SELECT',
        executionType: 'LISTING',
        parameters: [],
        tables: [{ name: 'foo' }, { name: 'bar' }],
        columns: [],
      },
    ]);
  });

  it('should identify tables and schema', () => {
    expect(
      identify('SELECT * FROM public.foo JOIN public.bar ON foo.id = bar.id', {
        identifyTables: true,
      }),
    ).to.eql([
      {
        start: 0,
        end: 58,
        text: 'SELECT * FROM public.foo JOIN public.bar ON foo.id = bar.id',
        type: 'SELECT',
        executionType: 'LISTING',
        parameters: [],
        tables: [
          { name: 'foo', schema: 'public' },
          { name: 'bar', schema: 'public' },
        ],
        columns: [],
      },
    ]);
  });

  describe('Table identification with qualified names', () => {
    it('should identify single-part table names', () => {
      const result = identify('SELECT * FROM users', { identifyTables: true });
      expect(result[0].tables).to.eql([{ name: 'users' }]);
    });

    it('should identify two-part qualified names (schema.table)', () => {
      const result = identify('SELECT * FROM public.users', { identifyTables: true });
      expect(result[0].tables).to.eql([{ name: 'users', schema: 'public' }]);
    });

    it('should identify three-part qualified names (database.schema.table)', () => {
      const result = identify('SELECT * FROM mydb.public.users', { identifyTables: true });
      expect(result[0].tables).to.eql([{ name: 'users', schema: 'public', database: 'mydb' }]);
    });

    it('should handle mixed qualification levels in JOINs', () => {
      const result = identify(
        'SELECT * FROM users JOIN public.orders ON users.id = orders.user_id',
        { identifyTables: true },
      );
      expect(result[0].tables).to.eql([{ name: 'users' }, { name: 'orders', schema: 'public' }]);
    });

    it('should identify multiple three-part qualified names', () => {
      const result = identify('SELECT * FROM db1.schema1.table1 JOIN db2.schema2.table2', {
        identifyTables: true,
      });
      expect(result[0].tables).to.eql([
        { name: 'table1', schema: 'schema1', database: 'db1' },
        { name: 'table2', schema: 'schema2', database: 'db2' },
      ]);
    });

    it('should identify qualified table names in INSERT statements', () => {
      const result = identify('INSERT INTO public.users (id, name) VALUES (1, "test")', {
        identifyTables: true,
      });
      expect(result[0].tables).to.eql([{ name: 'users', schema: 'public' }]);
    });

    it('should handle multiple JOINs with different qualification levels', () => {
      const result = identify(
        'SELECT * FROM users u JOIN public.orders o ON u.id = o.user_id JOIN db.schema.products p ON o.product_id = p.id',
        { identifyTables: true },
      );
      expect(result[0].tables).to.eql([
        { name: 'users', alias: 'u' },
        { name: 'orders', schema: 'public', alias: 'o' },
        { name: 'products', schema: 'schema', database: 'db', alias: 'p' },
      ]);
    });

    it('should not duplicate table references without aliases', () => {
      const result = identify('SELECT * FROM users JOIN users ON users.id = users.manager_id', {
        identifyTables: true,
      });
      expect(result[0].tables).to.eql([{ name: 'users' }]);
    });

    it('should treat same table with different aliases as separate entries', () => {
      const result = identify('SELECT * FROM users u1 JOIN users u2 ON u1.id = u2.manager_id', {
        identifyTables: true,
      });
      expect(result[0].tables).to.eql([
        { name: 'users', alias: 'u1' },
        { name: 'users', alias: 'u2' },
      ]);
    });

    it('should identify tables with LEFT JOIN', () => {
      const result = identify(
        'SELECT * FROM public.customers LEFT JOIN orders ON customers.id = orders.customer_id',
        { identifyTables: true },
      );
      expect(result[0].tables).to.eql([
        { name: 'customers', schema: 'public' },
        { name: 'orders' },
      ]);
    });

    it('should identify tables with RIGHT JOIN', () => {
      const result = identify(
        'SELECT * FROM orders RIGHT JOIN db.schema.products ON orders.product_id = products.id',
        { identifyTables: true },
      );
      expect(result[0].tables).to.eql([
        { name: 'orders' },
        { name: 'products', schema: 'schema', database: 'db' },
      ]);
    });

    it('should identify tables with INNER JOIN', () => {
      const result = identify(
        'SELECT * FROM users INNER JOIN public.profiles ON users.id = profiles.user_id',
        { identifyTables: true },
      );
      expect(result[0].tables).to.eql([{ name: 'users' }, { name: 'profiles', schema: 'public' }]);
    });

    it('should identify INSERT INTO with three-part qualified name', () => {
      const result = identify('INSERT INTO mydb.dbo.employees (name, age) VALUES ("John", 30)', {
        identifyTables: true,
      });
      expect(result[0].tables).to.eql([{ name: 'employees', schema: 'dbo', database: 'mydb' }]);
    });

    it('should handle complex query with multiple qualification levels', () => {
      const result = identify(
        'SELECT * FROM users JOIN public.orders ON users.id = orders.user_id JOIN db.schema.products ON orders.product_id = products.id',
        { identifyTables: true },
      );
      expect(result[0].tables).to.eql([
        { name: 'users' },
        { name: 'orders', schema: 'public' },
        { name: 'products', schema: 'schema', database: 'db' },
      ]);
    });
  });

  describe('Table alias identification', () => {
    it('should identify explicit AS alias', () => {
      const result = identify('SELECT * FROM users AS u', { identifyTables: true });
      expect(result[0].tables).to.eql([{ name: 'users', alias: 'u' }]);
    });

    it('should identify implicit alias', () => {
      const result = identify('SELECT * FROM users u', { identifyTables: true });
      expect(result[0].tables).to.eql([{ name: 'users', alias: 'u' }]);
    });

    it('should identify explicit alias on schema-qualified table', () => {
      const result = identify('SELECT * FROM public.users AS u', { identifyTables: true });
      expect(result[0].tables).to.eql([{ name: 'users', schema: 'public', alias: 'u' }]);
    });

    it('should identify implicit alias on schema-qualified table', () => {
      const result = identify('SELECT * FROM public.users u', { identifyTables: true });
      expect(result[0].tables).to.eql([{ name: 'users', schema: 'public', alias: 'u' }]);
    });

    it('should identify alias on three-part qualified table', () => {
      const result = identify('SELECT * FROM mydb.public.users u', { identifyTables: true });
      expect(result[0].tables).to.eql([
        { name: 'users', schema: 'public', database: 'mydb', alias: 'u' },
      ]);
    });

    it('should identify explicit alias on three-part qualified table', () => {
      const result = identify('SELECT * FROM mydb.public.users AS u', { identifyTables: true });
      expect(result[0].tables).to.eql([
        { name: 'users', schema: 'public', database: 'mydb', alias: 'u' },
      ]);
    });

    it('should not treat WHERE as an alias', () => {
      const result = identify('SELECT * FROM users WHERE id = 1', { identifyTables: true });
      expect(result[0].tables).to.eql([{ name: 'users' }]);
    });

    it('should not treat ON as an alias', () => {
      const result = identify('SELECT * FROM users JOIN orders ON users.id = orders.user_id', {
        identifyTables: true,
      });
      expect(result[0].tables).to.eql([{ name: 'users' }, { name: 'orders' }]);
    });

    it('should not treat JOIN keywords as an alias', () => {
      const result = identify('SELECT * FROM users LEFT JOIN orders ON users.id = orders.user_id', {
        identifyTables: true,
      });
      expect(result[0].tables).to.eql([{ name: 'users' }, { name: 'orders' }]);
    });

    it('should handle mixed explicit and implicit aliases', () => {
      const result = identify('SELECT * FROM users AS u JOIN public.orders o ON u.id = o.user_id', {
        identifyTables: true,
      });
      expect(result[0].tables).to.eql([
        { name: 'users', alias: 'u' },
        { name: 'orders', schema: 'public', alias: 'o' },
      ]);
    });

    it('should handle alias followed by WHERE clause', () => {
      const result = identify('SELECT * FROM users u WHERE u.id = 1', { identifyTables: true });
      expect(result[0].tables).to.eql([{ name: 'users', alias: 'u' }]);
    });

    it('should not capture alias for INSERT INTO', () => {
      const result = identify('INSERT INTO users (name) VALUES ("test")', {
        identifyTables: true,
      });
      expect(result[0].tables).to.eql([{ name: 'users' }]);
    });
  });
});

describe('getExecutionType', () => {
  it('should return LISTING for SELECT', () => {
    expect(getExecutionType('SELECT')).to.equal('LISTING');
  });

  ['UPDATE', 'DELETE', 'INSERT', 'TRUNCATE'].forEach((type) => {
    it(`should return MODIFICATION for ${type}`, () => {
      expect(getExecutionType(type)).to.equal('MODIFICATION');
    });
  });

  ['BEGIN_TRANSACTION', 'COMMIT', 'ROLLBACK'].forEach((type) => {
    it(`should return TRANSACTION for ${type}`, () => {
      expect(getExecutionType(type)).to.equal('TRANSACTION');
    });
  });

  ['CREATE', 'DROP', 'ALTER'].forEach((action) => {
    ['DATABASE', 'SCHEMA', 'TABLE', 'VIEW', 'FUNCTION', 'TRIGGER'].forEach((type) => {
      it(`should return MODIFICATION for ${action}_${type}`, () => {
        expect(getExecutionType(`${action}_${type}`)).to.equal('MODIFICATION');
      });
    });
  });

  it('should return UNKNOWN for non-real type', () => {
    expect(getExecutionType('FAKE_TYPE')).to.equal('UNKNOWN');
  });
});

describe('Regression tests', () => {
  // Regression test: https://github.com/beekeeper-studio/beekeeper-studio/issues/2560
  it('Double colon should not be recognized as a param for mssql', () => {
    const result = identify(
      `
      DECLARE @g geometry;
      DECLARE @h geometry;
      SET @g = geometry::STGeomFromText('POLYGON((0 0, 2 0, 2 2, 0 2, 0 0))', 0);
      set @h = geometry::STGeomFromText('POLYGON((1 1, 3 1, 3 3, 1 3, 1 1))', 0);
      SELECT @g.STWithin(@h);
    `,
      { strict: false, dialect: 'mssql' as Dialect },
    );
    result.forEach((res) => {
      // :: cast syntax should not produce colon-prefixed parameters
      expect(res.parameters.every((param) => !param.startsWith(':'))).to.equal(true);
    });
  });

  // Regression test: https://github.com/beekeeper-studio/beekeeper-studio/issues/2560
  it('Double colon should not be recognized as a param for psql', () => {
    const result = identify(
      `
        SELECT '123'::INTEGER;
      `,
      { strict: false, dialect: 'psql' as Dialect },
    );
    result.forEach((res) => {
      expect(res.parameters.length).to.equal(0);
    });
  });
});

describe('Transaction statements', () => {
  it('should identify BEGIN TRANSACTION', () => {
    expect(identify('BEGIN TRANSACTION', { strict: false })).to.eql([
      {
        start: 0,
        end: 16,
        text: 'BEGIN TRANSACTION',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);
  });

  it('should identify BEGIN without TRANSACTION keyword', () => {
    expect(identify('BEGIN;', { strict: false })).to.eql([
      {
        start: 0,
        end: 5,
        text: 'BEGIN;',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);
  });

  it('should identify START TRANSACTION', () => {
    expect(identify('START TRANSACTION', { strict: false })).to.eql([
      {
        start: 0,
        end: 16,
        text: 'START TRANSACTION',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);
  });

  it('should identify COMMIT', () => {
    expect(identify('COMMIT', { strict: false })).to.eql([
      {
        start: 0,
        end: 5,
        text: 'COMMIT',
        type: 'COMMIT',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);
  });

  it('should identify ROLLBACK', () => {
    expect(identify('ROLLBACK', { strict: false })).to.eql([
      {
        start: 0,
        end: 7,
        text: 'ROLLBACK',
        type: 'ROLLBACK',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);
  });

  it('should still identify BEGIN as ANON_BLOCK for oracle/bigquery when not followed by TRANSACTION', () => {
    expect(identify('BEGIN select 1; END;', { dialect: 'oracle' })).to.eql([
      {
        start: 0,
        end: 19,
        text: 'BEGIN select 1; END;',
        type: 'ANON_BLOCK',
        executionType: 'ANON_BLOCK',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);
  });

  it('should not identify START REPLICA as a transaction', () => {
    expect(() => identify('START REPLICA;', { dialect: 'mysql' })).to.throw(
      `Invalid statement parser "START"`,
    );
  });

  it('Should identify ANSI-ish / generic transaction start syntaxes', () => {
    expect(identify('START TRANSACTION;', { dialect: 'generic' })).to.eql([
      {
        start: 0,
        end: 17,
        text: 'START TRANSACTION;',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);

    expect(identify('BEGIN;', { dialect: 'generic' })).to.eql([
      {
        start: 0,
        end: 5,
        text: 'BEGIN;',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);
  });

  it('Should identify MySQL/MariaDB style transaction start syntaxes', () => {
    expect(identify('START TRANSACTION;', { dialect: 'mysql' })).to.eql([
      {
        start: 0,
        end: 17,
        text: 'START TRANSACTION;',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);

    expect(identify('BEGIN;', { dialect: 'mysql' })).to.eql([
      {
        start: 0,
        end: 5,
        text: 'BEGIN;',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);

    expect(identify('BEGIN WORK;', { dialect: 'mysql' })).to.eql([
      {
        start: 0,
        end: 10,
        text: 'BEGIN WORK;',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);

    expect(identify('START TRANSACTION READ ONLY;', { dialect: 'mysql' })).to.eql([
      {
        start: 0,
        end: 27,
        text: 'START TRANSACTION READ ONLY;',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);

    expect(
      identify('START TRANSACTION ISOLATION LEVEL SERIALIZABLE;', { dialect: 'mysql' }),
    ).to.eql([
      {
        start: 0,
        end: 46,
        text: 'START TRANSACTION ISOLATION LEVEL SERIALIZABLE;',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);
  });

  it('Should identify Postgres style transaction start syntaxes', () => {
    expect(identify('BEGIN;', { dialect: 'psql' })).to.eql([
      {
        start: 0,
        end: 5,
        text: 'BEGIN;',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);

    expect(identify('START TRANSACTION;', { dialect: 'psql' })).to.eql([
      {
        start: 0,
        end: 17,
        text: 'START TRANSACTION;',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);

    expect(identify('BEGIN TRANSACTION;', { dialect: 'psql' })).to.eql([
      {
        start: 0,
        end: 17,
        text: 'BEGIN TRANSACTION;',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);

    expect(
      identify('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;', { dialect: 'psql' }),
    ).to.eql([
      {
        start: 0,
        end: 49,
        text: 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;',
        type: 'BEGIN_TRANSACTION',
        executionType: 'TRANSACTION',
        parameters: [],
        tables: [],
        columns: [],
      },
    ]);
  });
});
