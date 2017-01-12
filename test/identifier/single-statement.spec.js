import { expect } from 'chai';

import { identify } from '../../src';


/* eslint prefer-arrow-callback: 0 */
describe('identifier', function () {
  describe('given queries with a single statement', function () {
    it('should identify "SELECT" statement', function () {
      const actual = identify('SELECT * FROM Persons');
      const expected = [
        {
          start: 0,
          end: 20,
          text: 'SELECT * FROM Persons',
          type: 'SELECT',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify "CREATE TABLE" statement', function () {
      const actual = identify('CREATE TABLE Persons (PersonID int, Name varchar(255));');
      const expected = [
        {
          start: 0,
          end: 54,
          text: 'CREATE TABLE Persons (PersonID int, Name varchar(255));',
          type: 'CREATE_TABLE',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify "CREATE DATABASE" statement', function () {
      const actual = identify('CREATE DATABASE Profile;');
      const expected = [
        {
          start: 0,
          end: 23,
          text: 'CREATE DATABASE Profile;',
          type: 'CREATE_DATABASE',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify "DROP TABLE" statement', function () {
      const actual = identify('DROP TABLE Persons;');
      const expected = [
        {
          start: 0,
          end: 18,
          text: 'DROP TABLE Persons;',
          type: 'DROP_TABLE',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify "DROP DATABASE" statement', function () {
      const actual = identify('DROP DATABASE Profile;');
      const expected = [
        {
          start: 0,
          end: 21,
          text: 'DROP DATABASE Profile;',
          type: 'DROP_DATABASE',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify "TRUNCATE TABLE" statement', function () {
      const actual = identify('TRUNCATE TABLE Persons;');
      const expected = [
        {
          start: 0,
          end: 22,
          text: 'TRUNCATE TABLE Persons;',
          type: 'TRUNCATE',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify "INSERT" statement', function () {
      const actual = identify('INSERT INTO Persons (PersonID, Name) VALUES (1, \'Jack\');');
      const expected = [
        {
          start: 0,
          end: 55,
          text: 'INSERT INTO Persons (PersonID, Name) VALUES (1, \'Jack\');',
          type: 'INSERT',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify "UPDATE" statement', function () {
      const actual = identify('UPDATE Persons SET Name = \'John\' WHERE PersonID = 1;');
      const expected = [
        {
          start: 0,
          end: 51,
          text: 'UPDATE Persons SET Name = \'John\' WHERE PersonID = 1;',
          type: 'UPDATE',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify "DELETE" statement', function () {
      const actual = identify('DELETE FROM Persons WHERE PersonID = 1;');
      const expected = [
        {
          start: 0,
          end: 38,
          text: 'DELETE FROM Persons WHERE PersonID = 1;',
          type: 'DELETE',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify statement starting with inline comment', function () {
      const actual = identify(`
        -- some comment
        SELECT * FROM Persons
      `);
      const expected = [
        {
          start: 33,
          end: 60,
          text: 'SELECT * FROM Persons\n      ',
          type: 'SELECT',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify statement starting with block comment', function () {
      const actual = identify(`
        /**
          * some comment
          */
        SELECT * FROM Persons
      `);
      const expected = [
        {
          start: 59,
          end: 86,
          text: 'SELECT * FROM Persons\n      ',
          type: 'SELECT',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify statement ending with block comment', function () {
      const actual = identify(`
        SELECT * FROM Persons
        /**
          * some comment
          */
      `);
      const expected = [
        {
          start: 9,
          end: 86,
          text: 'SELECT * FROM Persons\n        /**\n          * some comment\n          */\n      ',
          type: 'SELECT',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify statement ending with inline comment', function () {
      const actual = identify(`
        SELECT * FROM Persons
        -- some comment
      `);
      const expected = [
        {
          start: 9,
          end: 60,
          text: 'SELECT * FROM Persons\n        -- some comment\n      ',
          type: 'SELECT',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify statement with inline comment in the middle', function () {
      const actual = identify(`
        SELECT *
        -- some comment
        FROM Persons
      `);
      const expected = [
        {
          start: 9,
          end: 68,
          text: 'SELECT *\n        -- some comment\n        FROM Persons\n      ',
          type: 'SELECT',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify statement with block comment in the middle', function () {
      const actual = identify(`
        SELECT *
        /**
          * some comment
          */
        FROM Persons
      `);
      const expected = [
        {
          start: 9,
          end: 94,
          text: 'SELECT *\n        /**\n          * some comment\n          */\n        FROM Persons\n      ',
          type: 'SELECT',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify empty statement', function () {
      const actual = identify('');
      const expected = [];

      expect(actual).to.eql(expected);
    });
  });
});

