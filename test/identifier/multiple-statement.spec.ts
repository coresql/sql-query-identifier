import { expect } from 'chai';

import { identify } from '../../src';

/* eslint prefer-arrow-callback: 0 */
describe('identifier', function () {
  describe('given queries with multiple statements', function () {
    it('should identify a query with different statements in a single line', function () {
      const actual = identify('INSERT INTO Persons (PersonID, Name) VALUES (1, \'Jack\');SELECT * FROM Persons');
      const expected = [
        {
          end: 55,
          start: 0,
          text: 'INSERT INTO Persons (PersonID, Name) VALUES (1, \'Jack\');',
          type: 'INSERT',
          executionType: 'MODIFICATION',
        },
        {
          end: 76,
          start: 56,
          text: 'SELECT * FROM Persons',
          type: 'SELECT',
          executionType: 'LISTING',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify a query with different statements in multiple lines', function () {
      const actual = identify(`
        INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');
        SELECT * FROM Persons;
      `);

      const expected = [
        {
          start: 9,
          end: 64,
          text: 'INSERT INTO Persons (PersonID, Name) VALUES (1, \'Jack\');',
          type: 'INSERT',
          executionType: 'MODIFICATION',
        },
        {
          start: 74,
          end: 95,
          text: 'SELECT * FROM Persons;',
          type: 'SELECT',
          executionType: 'LISTING',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify two queries with one using quoted identifier', function () {
      const actual = identify(`
        SELECT "foo'bar";
        SELECT * FROM table;
      `, { dialect: 'mysql' });

      const expected = [
        {
          start: 9,
          end: 25,
          text: 'SELECT "foo\'bar";',
          type: 'SELECT',
          executionType: 'LISTING',
        },
        {
          start: 35,
          end: 54,
          text: 'SELECT * FROM table;',
          type: 'SELECT',
          executionType: 'LISTING',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should able to detect queries with a CTE in middle query', function () {
      const actual = identify(`
        INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');

        WITH employee AS (SELECT * FROM Employees)
        SELECT * FROM employee WHERE ID < 20
        UNION ALL
        SELECT * FROM employee WHERE Sex = 'M';

        SELECT * FROM Persons;
      `, { strict: false });
      const expected = [
        {
          start: 9,
          end: 64,
          text: 'INSERT INTO Persons (PersonID, Name) VALUES (1, \'Jack\');',
          type: 'INSERT',
          executionType: 'MODIFICATION',
        },
        {
          start: 75,
          end: 227,
          text: 'WITH employee AS (SELECT * FROM Employees)\n        SELECT * FROM employee WHERE ID < 20\n        UNION ALL\n        SELECT * FROM employee WHERE Sex = \'M\';',
          type: 'SELECT',
          executionType: 'LISTING',
        },
        {
          start: 238,
          end: 259,
          text: 'SELECT * FROM Persons;',
          type: 'SELECT',
          executionType: 'LISTING',
        },
      ];

      expect(actual).to.eql(expected);
    });
  });
});
