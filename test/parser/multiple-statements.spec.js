import { expect } from 'chai';

import { aggregateUnknownTokens } from '../spec-helper';
import { parse } from '../../src/parser';

/* eslint prefer-arrow-callback: 0 */
describe('parser', function () {
  describe('given queries with multiple statements', function () {
    it('should parse a query with different statements in a single line', function () {
      const actual = parse('INSERT INTO Persons (PersonID, Name) VALUES (1, \'Jack\');SELECT * FROM Persons');
      actual.tokens = aggregateUnknownTokens(actual.tokens);

      const expected = {
        type: 'QUERY',
        start: 0,
        end: 76,
        body: [ // nodes
          {
            start: 0,
            end: 55,
            type: 'INSERT',
            executionType: 'MODIFICATION',
            endStatement: ';',
          },
          {
            start: 56,
            end: 76,
            type: 'SELECT',
            executionType: 'LISTING',
          },
        ],
        tokens: [
          { type: 'keyword', value: 'INSERT', start: 0, end: 5 },
          { type: 'unknown', value: ' INTO Persons (PersonID, Name) VALUES (1, \'Jack\')', start: 6, end: 54 },

          { type: 'semicolon', value: ';', start: 55, end: 55 },

          { type: 'keyword', value: 'SELECT', start: 56, end: 61 },
          { type: 'unknown', value: ' * FROM Persons', start: 62, end: 76 },
        ],
      };

      expect(actual).to.eql(expected);
    });

    it('should identify a query with different statements in multiple lines', function () {
      const actual = parse(`
        INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');
        SELECT * FROM Persons';
      `);

      actual.tokens = aggregateUnknownTokens(actual.tokens);

      const expected = {
        type: 'QUERY',
        start: 0,
        end: 103,
        body: [ // nodes
          {
            start: 9,
            end: 64,
            type: 'INSERT',
            executionType: 'MODIFICATION',
            endStatement: ';',
          },
          {
            start: 74,
            end: 103,
            type: 'SELECT',
            executionType: 'LISTING',
          },
        ],
        tokens: [
          { type: 'whitespace', value: '\n        ', start: 0, end: 8 },
          { type: 'keyword', value: 'INSERT', start: 9, end: 14 },
          { type: 'unknown', value: ' INTO Persons (PersonID, Name) VALUES (1, \'Jack\')', start: 15, end: 63 },
          { type: 'semicolon', value: ';', start: 64, end: 64 },
          { type: 'whitespace', value: '\n        ', start: 65, end: 73 },
          { type: 'keyword', value: 'SELECT', start: 74, end: 79 },
          { type: 'unknown', value: ' * FROM Persons\';\n      ', start: 80, end: 103 },
        ],
      };

      expect(actual).to.eql(expected);
    });
  });
});

