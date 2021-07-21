import { Dialect, getExecutionType, identify } from '../src/index';
import { expect } from 'chai';

describe('identify', () => {
  it('should throw error for invalid dialect', () => {
    expect(() => identify('SELECT * FROM foo', { dialect: 'invalid' as Dialect })).to.throw(
      'Unknown dialect. Allowed values: mssql, sqlite, mysql, psql, generic'
    );
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

  ['CREATE', 'DROP'].forEach((action) => {
    ['DATABASE', 'TABLE', 'VIEW', 'FUNCTION', 'TRIGGER'].forEach((type) => {
      it(`should return MODIFICATION for ${action}_${type}`, () => {
        expect(getExecutionType(`${action}_${type}`)).to.equal('MODIFICATION');
      });
    });
  });

  it('should return UNKNOWN for non-real type', () => {
    expect(getExecutionType('FAKE_TYPE')).to.equal('UNKNOWN');
  });
});
