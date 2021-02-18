import { expect } from 'chai';

import { identify } from '../../src';

/* eslint prefer-arrow-callback: 0 */
describe('identifier', function () {
  describe('given queries with inner statements', function () {
    it('should identify a query with inner statements in a single line', function () {
      const actual = identify('INSERT INTO Customers (CustomerName, Country) SELECT SupplierName, Country FROM Suppliers');
      const expected = [
        {
          start: 0,
          end: 88,
          text: 'INSERT INTO Customers (CustomerName, Country) SELECT SupplierName, Country FROM Suppliers',
          type: 'INSERT',
          executionType: 'MODIFICATION',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify a query with inner statements in a single line and a comment block in the middle', function () {
      const actual = identify('INSERT INTO Customers (CustomerName, Country) /* comment */ SELECT SupplierName, Country FROM Suppliers');
      const expected = [
        {
          start: 0,
          end: 102,
          text: 'INSERT INTO Customers (CustomerName, Country) /* comment */ SELECT SupplierName, Country FROM Suppliers',
          type: 'INSERT',
          executionType: 'MODIFICATION',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify a query with inner statements in multiple lines', function () {
      const actual = identify(`
        INSERT INTO Customers (CustomerName, Country)
        SELECT SupplierName, Country FROM Suppliers;
      `);

      const expected = [
        {
          start: 9,
          end: 106,
          text: 'INSERT INTO Customers (CustomerName, Country)\n        SELECT SupplierName, Country FROM Suppliers;',
          type: 'INSERT',
          executionType: 'MODIFICATION',
        },
      ];

      expect(actual).to.eql(expected);
    });

    it('should identify a query with inner statements in multiple lines and inline comment in the middle', function () {
      const actual = identify(`
        INSERT INTO Customers (CustomerName, Country)
        -- comment
        SELECT SupplierName, Country FROM Suppliers;
      `);

      const expected = [
        {
          start: 9,
          end: 125,
          text: 'INSERT INTO Customers (CustomerName, Country)\n        -- comment\n        SELECT SupplierName, Country FROM Suppliers;',
          type: 'INSERT',
          executionType: 'MODIFICATION',
        },
      ];

      expect(actual).to.eql(expected);
    });
  });
});
