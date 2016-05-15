import { expect } from 'chai';

import { identify } from '../../src';

/* eslint prefer-arrow-callback: 0 */
describe('identifier', function () {
  describe('given queries with multiple statements', function () {
    it('should identify a query with different statements in a single line', function () {
      const actual = identify('INSERT INTO Persons (PersonID, Name) VALUES (1, \'Jack\');SELECT * FROM Persons');
      const expected = [
        'Insert',
        'Select',
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify a query with different statements in multiple lines', function () {
      const actual = identify(`
        INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');
        SELECT * FROM Persons';
      `);

      const expected = [
        'Insert',
        'Select',
      ];

      expect(actual).to.eql(expected);
    });
  });
});
