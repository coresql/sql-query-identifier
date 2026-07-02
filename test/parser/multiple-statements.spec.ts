import { expect } from 'chai';

import { aggregateUnknownTokens } from '../spec-helper';
import { parse } from '../../src/parser';

describe('parser', () => {
  describe('given queries with multiple statements', () => {
    it('should parse a query with different statements in a single line', () => {
      const actual = parse(
        "INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');SELECT * FROM Persons",
      );
      actual.tokens = aggregateUnknownTokens(actual.tokens);

      const expected = {
        type: 'QUERY',
        start: 0,
        end: 76,
        body: [
          // nodes
          {
            start: 0,
            end: 55,
            type: 'INSERT',
            executionType: 'MODIFICATION',
            endStatement: ';',
            parameters: [],
            tables: [],
            columns: [],
          },
          {
            start: 56,
            end: 76,
            type: 'SELECT',
            executionType: 'LISTING',
            parameters: [],
            tables: [],
            columns: [],
            limit: false,
            offset: false,
          },
        ],
        tokens: [
          {
            type: 'keyword',
            value: 'INSERT',
            start: 0,
            end: 5,
          },
          {
            type: 'whitespace',
            value: ' ',
            start: 6,
            end: 6,
          },
          {
            type: 'keyword',
            value: 'INTO',
            start: 7,
            end: 10,
          },
          {
            type: 'unknown',
            value: " Persons (PersonID, Name) VALUES (1, 'Jack')",
            start: 11,
            end: 54,
          },

          {
            type: 'semicolon',
            value: ';',
            start: 55,
            end: 55,
          },

          {
            type: 'keyword',
            value: 'SELECT',
            start: 56,
            end: 61,
          },
          {
            type: 'unknown',
            value: ' * ',
            start: 62,
            end: 64,
          },
          {
            type: 'keyword',
            value: 'FROM',
            start: 65,
            end: 68,
          },
          {
            type: 'unknown',
            value: ' Persons',
            start: 69,
            end: 76,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });

    it('should identify a query with different statements in multiple lines', () => {
      const actual = parse(`
        INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');
        SELECT * FROM Persons';
      `);

      actual.tokens = aggregateUnknownTokens(actual.tokens);

      const expected = {
        type: 'QUERY',
        start: 0,
        end: 103,
        body: [
          // nodes
          {
            start: 9,
            end: 64,
            type: 'INSERT',
            executionType: 'MODIFICATION',
            endStatement: ';',
            parameters: [],
            tables: [],
            columns: [],
          },
          {
            start: 74,
            end: 103,
            type: 'SELECT',
            executionType: 'LISTING',
            parameters: [],
            tables: [],
            columns: [],
            limit: false,
            offset: false,
          },
        ],
        tokens: [
          {
            type: 'whitespace',
            value: '\n        ',
            start: 0,
            end: 8,
          },
          {
            type: 'keyword',
            value: 'INSERT',
            start: 9,
            end: 14,
          },
          {
            type: 'whitespace',
            value: ' ',
            start: 15,
            end: 15,
          },
          {
            type: 'keyword',
            value: 'INTO',
            start: 16,
            end: 19,
          },
          {
            type: 'unknown',
            value: " Persons (PersonID, Name) VALUES (1, 'Jack')",
            start: 20,
            end: 63,
          },
          {
            type: 'semicolon',
            value: ';',
            start: 64,
            end: 64,
          },
          {
            type: 'whitespace',
            value: '\n        ',
            start: 65,
            end: 73,
          },
          {
            type: 'keyword',
            value: 'SELECT',
            start: 74,
            end: 79,
          },
          {
            type: 'unknown',
            value: ' * ',
            start: 80,
            end: 82,
          },
          {
            type: 'keyword',
            value: 'FROM',
            start: 83,
            end: 86,
          },
          {
            type: 'unknown',
            value: " Persons';\n      ",
            start: 87,
            end: 103,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });
  });
});
