import { expect } from 'chai';
import { parse } from '../../src/parser';

/* eslint prefer-arrow-callback: 0 */
describe('parser', function () {
  describe('given sub select statement', function () {
    it.skip('parse sub select statement', function () {
      const actual = parse(`
        SELECT id FROM people;
      `);
      const expected = {
        type: 'QueryStatement',
        start: 0,
        end: 69,
        body: [ // nodes
          {
            type: 'Select',
            columns: [
              { type: 'Column', name: 'id' },
            ],
            from: 'people',
            endStatement: ';',
          },
          {
            type: 'Select',
            columns: [
              { type: 'Column', name: '*' },
            ],
            from: 'contacts',
            endStatement: ';',
          },
        ],
        tokens: [
          { type: 'whitespace', value: '\n        ', start: 0, end: 8 },
          { type: 'keyword', value: 'SELECT', start: 9, end: 14 },
          { type: 'whitespace', value: ' ', start: 15, end: 15 },
          { type: 'identifier', value: 'id', start: 16, end: 17 },
          { type: 'whitespace', value: ' ', start: 18, end: 18 },
          { type: 'keyword', value: 'FROM', start: 19, end: 22 },
          { type: 'whitespace', value: ' ', start: 23, end: 23 },
          { type: 'identifier', value: 'people', start: 24, end: 29 },
          { type: 'semicolon', value: ';', start: 30, end: 30 },
          { type: 'whitespace', value: '\n        ', start: 31, end: 39 },
          { type: 'keyword', value: 'SELECT', start: 40, end: 45 },
          { type: 'whitespace', value: ' ', start: 46, end: 46 },
          { type: 'asterisk', value: '*', start: 47, end: 47 },
          { type: 'whitespace', value: ' ', start: 48, end: 48 },
          { type: 'keyword', value: 'FROM', start: 49, end: 52 },
          { type: 'whitespace', value: ' ', start: 53, end: 53 },
          { type: 'identifier', value: 'contacts', start: 54, end: 61 },
          { type: 'semicolon', value: ';', start: 62, end: 62 },
          { type: 'whitespace', value: '\n      ', start: 63, end: 69 },
        ],
      };

      expect(actual).to.eql(expected);
    });
  });
});
