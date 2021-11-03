import { expect } from 'chai';

import { identify } from '../../src';

describe('identifier', () => {
  describe('given queries with multiple statements', () => {
    it('should identify a query with different statements in a single line', () => {
      const actual = identify(
        "INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');SELECT * FROM Persons",
      );
      const expected = [
        {
          end: 55,
          start: 0,
          text: "INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');",
          type: 'INSERT',
          executionType: 'MODIFICATION',
          parameters: [],
        },
        {
          end: 76,
          start: 56,
          text: 'SELECT * FROM Persons',
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify a query with different statements in multiple lines', () => {
      const actual = identify(`
        INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');
        SELECT * FROM Persons;
      `);

      const expected = [
        {
          start: 9,
          end: 64,
          text: "INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');",
          type: 'INSERT',
          executionType: 'MODIFICATION',
          parameters: [],
        },
        {
          start: 74,
          end: 95,
          text: 'SELECT * FROM Persons;',
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify two queries with one using quoted identifier', () => {
      const actual = identify(
        `
        SELECT "foo'bar";
        SELECT * FROM table;
      `,
        { dialect: 'mysql' },
      );

      const expected = [
        {
          start: 9,
          end: 25,
          text: 'SELECT "foo\'bar";',
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
        },
        {
          start: 35,
          end: 54,
          text: 'SELECT * FROM table;',
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should able to ignore empty statements (extra semicolons)', () => {
      const actual = identify(
        `
        ;select 1;;select 2;;;
        ;
        select 3;
      `,
      );
      const expected = [
        {
          start: 10,
          end: 18,
          text: 'select 1;',
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
        },
        {
          start: 20,
          end: 28,
          text: 'select 2;',
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
        },
        {
          start: 50,
          end: 58,
          text: 'select 3;',
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
        },
      ];

      expect(actual).to.eql(expected);
    });

    describe('identifying multiple statements with CTEs', () => {
      it('should able to detect queries with a CTE in middle query', () => {
        const actual = identify(
          `
          INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');

          WITH employee AS (SELECT * FROM Employees)
          SELECT * FROM employee WHERE ID < 20
          UNION ALL
          SELECT * FROM employee WHERE Sex = 'M';

          SELECT * FROM Persons;
        `,
          { strict: false },
        );
        const expected = [
          {
            start: 11,
            end: 66,
            text: "INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');",
            type: 'INSERT',
            executionType: 'MODIFICATION',
            parameters: [],
          },
          {
            start: 79,
            end: 237,
            text: "WITH employee AS (SELECT * FROM Employees)\n          SELECT * FROM employee WHERE ID < 20\n          UNION ALL\n          SELECT * FROM employee WHERE Sex = 'M';",
            type: 'SELECT',
            executionType: 'LISTING',
            parameters: [],
          },
          {
            start: 250,
            end: 271,
            text: 'SELECT * FROM Persons;',
            type: 'SELECT',
            executionType: 'LISTING',
            parameters: [],
          },
        ];

        expect(actual).to.eql(expected);
      });

      it('should identify statements with semicolon following CTE', () => {
        const statement1 = `with temp as (
          select * from foo
        );`;
        const statement2 = `select * from foo;`;
        const sql = `${statement1}\n${statement2}`;
        const actual = identify(sql);

        const expected = [
          {
            start: 0,
            end: 52,
            text: statement1,
            type: 'UNKNOWN',
            executionType: 'UNKNOWN',
            parameters: [],
          },
          {
            start: 54,
            end: 71,
            text: statement2,
            type: 'SELECT',
            executionType: 'LISTING',
            parameters: [],
          },
        ];

        expect(actual).to.eql(expected);
        expect(sql.substring(actual[0].start, actual[0].end + 1)).to.eql(statement1);
        expect(sql.substring(actual[1].start, actual[1].end + 1)).to.eql(statement2);
      });
    });

    it('should identify statements with semicolon following with keyword', () => {
      const statement1 = `with;`;
      const statement2 = `select * from foo;`;
      const sql = `${statement1}\n${statement2}`;
      const actual = identify(sql);

      const expected = [
        {
          start: 0,
          end: 4,
          text: statement1,
          type: 'UNKNOWN',
          executionType: 'UNKNOWN',
          parameters: [],
        },
        {
          start: 6,
          end: 23,
          text: statement2,
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
        },
      ];

      expect(actual).to.eql(expected);
      expect(sql.substring(actual[0].start, actual[0].end + 1)).to.eql(statement1);
      expect(sql.substring(actual[1].start, actual[1].end + 1)).to.eql(statement2);
    });
  });
});
