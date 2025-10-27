import { Dialect, getExecutionType, identify } from '../src/index';
import { expect } from 'chai';
import { ParamTypes } from '../src/defines';

describe('identify', () => {
  it.only('test', () => {
    const result = identify("SET search_path = 'cycle_a,cycle_a.data,cycle_a.macros';", { dialect: 'generic', strict: false })
    console.log("RESULT: ", result)
    expect(true)
  })

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
        tables: ['foo', 'bar'],
      },
    ]);
  });
});

describe('getExecutionType', () => {
  it('should return LISTING for SELECT', () => {
    expect(getExecutionType('SELECT')).to.equal('LISTING');
  });

  ['UPDATE', 'DELETE', 'INSERT', 'TRUNCATE', 'BEGIN_TRANSACTION', 'COMMIT', 'ROLLBACK'].forEach((type) => {
    it(`should return MODIFICATION for ${type}`, () => {
      expect(getExecutionType(type)).to.equal('MODIFICATION');
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
      expect(res.parameters.length).to.equal(0);
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
        executionType: 'MODIFICATION',
        parameters: [],
        tables: [],
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
        executionType: 'MODIFICATION',
        parameters: [],
        tables: [],
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
        executionType: 'MODIFICATION',
        parameters: [],
        tables: [],
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
        executionType: 'MODIFICATION',
        parameters: [],
        tables: [],
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
        executionType: 'MODIFICATION',
        parameters: [],
        tables: [],
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
      },
    ]);
  });
});
