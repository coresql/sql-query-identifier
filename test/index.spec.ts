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
      },
    ]);
  });

  it('should identify custom parameters', () => {
    const paramTypes: ParamTypes = {
      positional: true,
      numbered: ['$'],
      named: [':'],
      quoted: [':'],
      custom: [ '\\{[a-zA-Z0-9_]+\\}' ]
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
        tables: []
      }
    ])
  })

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

  ['UPDATE', 'DELETE', 'INSERT', 'TRUNCATE'].forEach((type) => {
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
