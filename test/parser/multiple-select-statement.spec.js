import { expect } from 'chai';

import { aggregateUnkownTokens } from '../spec-helper';
import { parse } from '../../src/parser';

/* eslint prefer-arrow-callback: 0 */
describe('parser', function () {
  describe('given queries with multiple statements', function () {
    it('should parse a query with different statements in a single line', function () {
      const actual = parse('INSERT INTO Persons (PersonID, Name) VALUES (1, \'Jack\');SELECT * FROM Persons');
      actual.tokens = aggregateUnkownTokens(actual.tokens);

      const expected = {
        type: 'Query',
        start: 0,
        end: 76,
        body: [ // nodes
          {
            type: 'Insert',
            endStatement: ';',
          },
          {
            type: 'Select',
          },
        ],
        tokens: [
          { type: 'keyword', value: 'INSERT', start: 0, end: 5 },
          { type: 'unkown', value: ' INTO Persons (PersonID, Name) VALUES (1, \'Jack\')', start: 6, end: 54 },

          { type: 'semicolon', value: ';', start: 55, end: 55 },

          { type: 'keyword', value: 'SELECT', start: 56, end: 61 },
          { type: 'unkown', value: ' * FROM Persons', start: 62, end: 76 },
        ],
      };

      expect(actual).to.eql(expected);
    });
  });
});
