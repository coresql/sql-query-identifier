import { expect } from 'chai';

import { aggregateUnknownTokens } from '../spec-helper';
import { parse } from '../../src/parser';
import { Token } from '../../src/defines';

/* eslint prefer-arrow-callback: 0 */
describe('parser', function () {
  describe('given is a not reconized statement', function () {
    it('should throw an error including the unknown statement', function () {
      expect(() => parse('LIST * FROM Persons')).to.throw('Invalid statement parser "LIST"');
    });
  });

  describe('given queries with a single statement', function () {
    it('should parse "SELECT" statement', function () {
      const actual = parse('SELECT * FROM Persons');
      actual.tokens = aggregateUnknownTokens(actual.tokens);

      const expected = {
        type: 'QUERY',
        start: 0,
        end: 20,
        body: [ // nodes
          {
            start: 0,
            end: 20,
            type: 'SELECT',
            executionType: 'LISTING',
            parameters: [],
          },
        ],
        tokens: [
          {
            type: 'keyword', value: 'SELECT', start: 0, end: 5,
          },
          {
            type: 'unknown', value: ' * FROM Persons', start: 6, end: 20,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });

    it('should parse "select" statement', function () {
      const actual = parse('select * FROM Persons');
      actual.tokens = aggregateUnknownTokens(actual.tokens);

      const expected = {
        type: 'QUERY',
        start: 0,
        end: 20,
        body: [ // nodes
          {
            start: 0,
            end: 20,
            type: 'SELECT',
            executionType: 'LISTING',
            parameters: [],
          },
        ],
        tokens: [
          {
            type: 'keyword', value: 'select', start: 0, end: 5,
          },
          {
            type: 'unknown', value: ' * FROM Persons', start: 6, end: 20,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });

    it('should parse "CREATE TABLE" statement', function () {
      const actual = parse('CREATE TABLE Persons (PersonID int, Name varchar(255));');
      actual.tokens = aggregateUnknownTokens(actual.tokens);

      const expected = {
        type: 'QUERY',
        start: 0,
        end: 54,
        body: [ // nodes
          {
            start: 0,
            end: 54,
            type: 'CREATE_TABLE',
            executionType: 'MODIFICATION',
            endStatement: ';',
            parameters: [],
          },
        ],
        tokens: [
          {
            type: 'keyword', value: 'CREATE', start: 0, end: 5,
          },
          {
            type: 'whitespace', value: ' ', start: 6, end: 6,
          },
          {
            type: 'keyword', value: 'TABLE', start: 7, end: 11,
          },
          {
            type: 'unknown', value: ' Persons (PersonID int, Name varchar(255))', start: 12, end: 53,
          },
          {
            type: 'semicolon', value: ';', start: 54, end: 54,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });

    it('should parse "CREATE DATABASE" statement', function () {
      const actual = parse('CREATE DATABASE Profile;');
      actual.tokens = aggregateUnknownTokens(actual.tokens);

      const expected = {
        type: 'QUERY',
        start: 0,
        end: 23,
        body: [ // nodes
          {
            start: 0,
            end: 23,
            type: 'CREATE_DATABASE',
            executionType: 'MODIFICATION',
            endStatement: ';',
            parameters: [],
          },
        ],
        tokens: [
          {
            type: 'keyword', value: 'CREATE', start: 0, end: 5,
          },
          {
            type: 'whitespace', value: ' ', start: 6, end: 6,
          },
          {
            type: 'keyword', value: 'DATABASE', start: 7, end: 14,
          },
          {
            type: 'unknown', value: ' Profile', start: 15, end: 22,
          },
          {
            type: 'semicolon', value: ';', start: 23, end: 23,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });

    it('should parse "DROP TABLE" statement', function () {
      const actual = parse('DROP TABLE Persons;');
      actual.tokens = aggregateUnknownTokens(actual.tokens);

      const expected = {
        type: 'QUERY',
        start: 0,
        end: 18,
        body: [ // nodes
          {
            start: 0,
            end: 18,
            type: 'DROP_TABLE',
            executionType: 'MODIFICATION',
            endStatement: ';',
            parameters: [],
          },
        ],
        tokens: [
          {
            type: 'keyword', value: 'DROP', start: 0, end: 3,
          },
          {
            type: 'whitespace', value: ' ', start: 4, end: 4,
          },
          {
            type: 'keyword', value: 'TABLE', start: 5, end: 9,
          },
          {
            type: 'unknown', value: ' Persons', start: 10, end: 17,
          },
          {
            type: 'semicolon', value: ';', start: 18, end: 18,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });

    it('should parse "DROP DATABASE" statement', function () {
      const actual = parse('DROP DATABASE Profile;');
      actual.tokens = aggregateUnknownTokens(actual.tokens);

      const expected = {
        type: 'QUERY',
        start: 0,
        end: 21,
        body: [ // nodes
          {
            start: 0,
            end: 21,
            type: 'DROP_DATABASE',
            executionType: 'MODIFICATION',
            endStatement: ';',
            parameters: [],
          },
        ],
        tokens: [
          {
            type: 'keyword', value: 'DROP', start: 0, end: 3,
          },
          {
            type: 'whitespace', value: ' ', start: 4, end: 4,
          },
          {
            type: 'keyword', value: 'DATABASE', start: 5, end: 12,
          },
          {
            type: 'unknown', value: ' Profile', start: 13, end: 20,
          },
          {
            type: 'semicolon', value: ';', start: 21, end: 21,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });

    it('should parse "INSERT" statement', function () {
      const actual = parse('INSERT INTO Persons (PersonID, Name) VALUES (1, \'Jack\');');
      actual.tokens = aggregateUnknownTokens(actual.tokens);
      const expected = {
        type: 'QUERY',
        start: 0,
        end: 55,
        body: [ // nodes
          {
            start: 0,
            end: 55,
            type: 'INSERT',
            executionType: 'MODIFICATION',
            endStatement: ';',
            parameters: [],
          },
        ],
        tokens: [
          {
            type: 'keyword', value: 'INSERT', start: 0, end: 5,
          },
          {
            type: 'unknown', value: ' INTO Persons (PersonID, Name) VALUES (1, \'Jack\')', start: 6, end: 54,
          },
          {
            type: 'semicolon', value: ';', start: 55, end: 55,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });

    it('should parse "UPDATE" statement', function () {
      const actual = parse('UPDATE Persons SET Name = \'John\' WHERE PersonID = 1;');
      actual.tokens = aggregateUnknownTokens(actual.tokens);

      const expected = {
        type: 'QUERY',
        start: 0,
        end: 51,
        body: [ // nodes
          {
            start: 0,
            end: 51,
            type: 'UPDATE',
            executionType: 'MODIFICATION',
            endStatement: ';',
            parameters: [],
          },
        ],
        tokens: [
          {
            type: 'keyword', value: 'UPDATE', start: 0, end: 5,
          },
          {
            type: 'unknown', value: ' Persons SET Name = \'John\' WHERE PersonID = 1', start: 6, end: 50,
          },
          {
            type: 'semicolon', value: ';', start: 51, end: 51,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });

    it('should parse "DELETE" statement', function () {
      const actual = parse('DELETE FROM Persons WHERE PersonID = 1;');
      actual.tokens = aggregateUnknownTokens(actual.tokens);

      const expected = {
        type: 'QUERY',
        start: 0,
        end: 38,
        body: [ // nodes
          {
            start: 0,
            end: 38,
            type: 'DELETE',
            executionType: 'MODIFICATION',
            endStatement: ';',
            parameters: [],
          },
        ],
        tokens: [
          {
            type: 'keyword', value: 'DELETE', start: 0, end: 5,
          },
          {
            type: 'unknown', value: ' FROM Persons WHERE PersonID = 1', start: 6, end: 37,
          },
          {
            type: 'semicolon', value: ';', start: 38, end: 38,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });

    it('should parse "TRUNCATE" statement', function () {
      const actual = parse('TRUNCATE TABLE Persons;');
      actual.tokens = aggregateUnknownTokens(actual.tokens);

      const expected = {
        type: 'QUERY',
        start: 0,
        end: 22,
        body: [ // nodes
          {
            start: 0,
            end: 22,
            type: 'TRUNCATE',
            executionType: 'MODIFICATION',
            endStatement: ';',
            parameters: [],
          },
        ],
        tokens: [
          {
            type: 'keyword', value: 'TRUNCATE', start: 0, end: 7,
          },
          {
            type: 'whitespace', value: ' ', start: 8, end: 8,
          },
          {
            type: 'keyword', value: 'TABLE', start: 9, end: 13,
          },
          {
            type: 'unknown', value: ' Persons', start: 14, end: 21,
          },
          {
            type: 'semicolon', value: ';', start: 22, end: 22,
          },
        ],
      };

      expect(actual).to.eql(expected);
    });

    describe("with parameters", function () {
      it('should extract the parameters', function () {
        const actual = parse("select x from a where x = ?");
        actual.tokens = aggregateUnknownTokens(actual.tokens);
        const expected: Token[] = [
          {
            type: 'keyword', value: 'select', start: 0, end: 5,
          },
          {
            type: 'unknown', value: ' x from a where x = ', start: 6, end: 25,
          },
          {
            type: 'parameter', value: '?', start: 26, end: 26
          }
        ];
        expect(actual.tokens).to.eql(expected);
        expect(actual.body[0].parameters).to.eql(['?']);
      });

      it('should extract PSQL parameters', function () {
        const actual = parse("select x from a where x = $1", true, 'psql');
        actual.tokens = aggregateUnknownTokens(actual.tokens);
        const expected: Token[] = [
          {
            type: 'keyword', value: 'select', start: 0, end: 5,
          },
          {
            type: 'unknown', value: ' x from a where x = ', start: 6, end: 25,
          },
          {
            type: 'parameter', value: '$1', start: 26, end: 27
          }
        ];
        expect(actual.tokens).to.eql(expected);
        expect(actual.body[0].parameters).to.eql(['$1']);
      });

      it('should extract multiple PSQL parameters', function () {
        const actual = parse("select x from a where x = $1 and y = $2", true, 'psql');
        actual.tokens = aggregateUnknownTokens(actual.tokens);
        const expected: Token[] = [
          {
            type: 'keyword', value: 'select', start: 0, end: 5,
          },
          {
            type: 'unknown', value: ' x from a where x = ', start: 6, end: 25,
          },
          {
            type: 'parameter', value: '$1', start: 26, end: 27
          },
          {
            type: 'unknown', value: ' and y = ', start: 28, end: 36
          },
          {
            type: 'parameter', value: '$2', start: 37, end: 38
          }
        ];
        expect(actual.tokens).to.eql(expected);
        expect(actual.body[0].parameters).to.eql(['$1', '$2']);
      });

      it('should extract mssql parameters', function () {
        const actual = parse("select x from a where x = :foo", true, 'mssql');
        actual.tokens = aggregateUnknownTokens(actual.tokens);
        const expected: Token[] = [
          {
            type: 'keyword', value: 'select', start: 0, end: 5,
          },
          {
            type: 'unknown', value: ' x from a where x = ', start: 6, end: 25,
          },
          {
            type: 'parameter', value: ':foo', start: 26, end: 29
          }
        ];
        expect(actual.tokens).to.eql(expected);
        expect(actual.body[0].parameters).to.eql([':foo']);
      });

      it('should not identify params in a comment', function () {
        const actual = parse("-- comment ?");
        const expected: Token[] = [
          {
            type: 'comment-inline', value: '-- comment ?', start: 0, end: 11
          }
        ];
        expect(actual.tokens).to.eql(expected);
      });

      it('should not identify params in a string', function () {
        const actual = parse("select '$1'", true, 'psql');
        const expected: Token[] = [
          {
            type: 'keyword', value: 'select', start: 0, end: 5
          },
          {
            type: 'whitespace', value: " ", start: 6, end: 6
          },
          {
            type: 'string', value: "'$1'", start: 7, end: 10
          }
        ];
        expect(actual.tokens).to.eql(expected);
      });


      it('should extract multiple mssql parameters', function () {
        const actual = parse("select x from a where x = :foo and y = :bar", true, 'mssql');
        actual.tokens = aggregateUnknownTokens(actual.tokens);
        const expected: Token[] = [
          {
            type: 'keyword', value: 'select', start: 0, end: 5,
          },
          {
            type: 'unknown', value: ' x from a where x = ', start: 6, end: 25,
          },
          {
            type: 'parameter', value: ':foo', start: 26, end: 29
          },
          {
            type: 'unknown', value: ' and y = ', start: 30, end: 38
          },
          {
            type: 'parameter', value: ':bar', start: 39, end: 42
          }
        ];
        expect(actual.tokens).to.eql(expected);
        expect(actual.body[0].parameters).to.eql([':foo', ':bar']);
      });

    });
  });
});
