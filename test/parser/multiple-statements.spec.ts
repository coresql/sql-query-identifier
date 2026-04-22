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
            type: 'unknown',
            value: " INTO Persons (PersonID, Name) VALUES (1, 'Jack')",
            start: 6,
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
            value: ' * FROM Persons',
            start: 62,
            end: 76,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });

    describe('MySQL DELIMITER directive', () => {
      it('should split statements using a single-char delimiter', () => {
        const input = 'DELIMITER $\nSELECT 1$\nSELECT 2$';
        const actual = parse(input, true, 'mysql');

        expect(actual.body).to.have.lengthOf(3);
        expect(actual.body[0]).to.include({
          type: 'DELIMITER',
          executionType: 'NO_OP',
          start: 0,
          end: 10,
          endStatement: '\n',
          newDelimiter: '$',
        });
        expect(actual.body[1]).to.include({
          type: 'SELECT',
          start: 12,
          end: 20,
          endStatement: '$',
        });
        expect(actual.body[2]).to.include({
          type: 'SELECT',
          start: 22,
          end: 30,
          endStatement: '$',
        });
      });

      it('should split statements using a multi-char delimiter', () => {
        const input = 'DELIMITER $$\nSELECT 1$$\nSELECT 2$$';
        const actual = parse(input, true, 'mysql');

        expect(actual.body).to.have.lengthOf(3);
        expect(actual.body[0]).to.include({ type: 'DELIMITER', newDelimiter: '$$' });
        expect(actual.body[1]).to.include({ type: 'SELECT', endStatement: '$$' });
        expect(actual.body[2]).to.include({ type: 'SELECT', endStatement: '$$' });
      });

      it('should not treat literal ; as a terminator while delimiter is $$', () => {
        const input = 'DELIMITER $$\nCREATE PROCEDURE foo() BEGIN SELECT 1; SELECT 2; END$$';
        const actual = parse(input, true, 'mysql');

        expect(actual.body).to.have.lengthOf(2);
        expect(actual.body[0]).to.include({ type: 'DELIMITER', newDelimiter: '$$' });
        expect(actual.body[1]).to.include({
          type: 'CREATE_PROCEDURE',
          endStatement: '$$',
        });
      });

      it('should reset delimiter back to ; with DELIMITER ;', () => {
        const input = 'DELIMITER $$\nSELECT 1$$\nDELIMITER ;\nSELECT 2;';
        const actual = parse(input, true, 'mysql');

        expect(actual.body).to.have.lengthOf(4);
        expect(actual.body[0]).to.include({ type: 'DELIMITER', newDelimiter: '$$' });
        expect(actual.body[1]).to.include({ type: 'SELECT', endStatement: '$$' });
        expect(actual.body[2]).to.include({ type: 'DELIMITER', newDelimiter: ';' });
        expect(actual.body[3]).to.include({ type: 'SELECT', endStatement: ';' });
      });

      it('should finalize DELIMITER statement at EOF without a trailing newline', () => {
        const input = 'SELECT 1;\nDELIMITER $$';
        const actual = parse(input, true, 'mysql');

        expect(actual.body).to.have.lengthOf(2);
        expect(actual.body[1]).to.include({
          type: 'DELIMITER',
          newDelimiter: '$$',
          start: 10,
          end: 21,
        });
      });

      it('should strip matching surrounding quotes from the delimiter value', () => {
        const input = 'DELIMITER "//"\nSELECT 1//';
        const actual = parse(input, true, 'mysql');

        expect(actual.body).to.have.lengthOf(2);
        expect(actual.body[0]).to.include({ type: 'DELIMITER', newDelimiter: '//' });
        expect(actual.body[1]).to.include({ type: 'SELECT', endStatement: '//' });
      });

      it('should accept lowercase delimiter keyword', () => {
        const input = 'delimiter $$\nSELECT 1$$';
        const actual = parse(input, true, 'mysql');

        expect(actual.body).to.have.lengthOf(2);
        expect(actual.body[0]).to.include({ type: 'DELIMITER', newDelimiter: '$$' });
      });

      it('should handle \\r\\n line endings on the DELIMITER line', () => {
        const input = 'DELIMITER $$\r\nSELECT 1$$';
        const actual = parse(input, true, 'mysql');

        expect(actual.body).to.have.lengthOf(2);
        expect(actual.body[0]).to.include({
          type: 'DELIMITER',
          newDelimiter: '$$',
          end: 11,
        });
        expect(actual.body[1]).to.include({ type: 'SELECT' });
      });

      it('should ignore trailing inline comments on the DELIMITER line', () => {
        const input = 'DELIMITER $$ -- switch terminator\nSELECT 1$$';
        const actual = parse(input, true, 'mysql');

        expect(actual.body).to.have.lengthOf(2);
        expect(actual.body[0]).to.include({ type: 'DELIMITER', newDelimiter: '$$' });
      });

      it('should throw in strict mode for non-mysql dialects', () => {
        expect(() => parse('DELIMITER $$', true, 'generic')).to.throw(
          'Invalid statement parser "DELIMITER"',
        );
      });

      it('should fall back to UNKNOWN in non-strict mode for non-mysql dialects', () => {
        const actual = parse('DELIMITER $$\nSELECT 1$$', false, 'generic');
        expect(actual.body[0].type).to.eql('UNKNOWN');
      });
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
            type: 'unknown',
            value: " INTO Persons (PersonID, Name) VALUES (1, 'Jack')",
            start: 15,
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
            value: " * FROM Persons';\n      ",
            start: 80,
            end: 103,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });
  });
});
