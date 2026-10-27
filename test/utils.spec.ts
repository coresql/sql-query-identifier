import { expect } from 'chai';

import { maybeStripQuotes } from '../src/utils';

describe('utils', () => {
  describe('maybeStripQuotes', () => {
    it('returns unquoted input unchanged', () => {
      expect(maybeStripQuotes('column_1', 'psql')).to.equal('column_1');
    });

    it('returns empty and single-char input unchanged', () => {
      expect(maybeStripQuotes('', 'psql')).to.equal('');
      expect(maybeStripQuotes('"', 'psql')).to.equal('"');
      expect(maybeStripQuotes('[', 'mssql')).to.equal('[');
    });

    it('strips double-quoted identifiers', () => {
      expect(maybeStripQuotes('"column name"', 'psql')).to.equal('column name');
      expect(maybeStripQuotes('"column name"', 'mssql')).to.equal('column name');
    });

    it('strips backtick identifiers for non-mssql dialects', () => {
      expect(maybeStripQuotes('`column name`', 'mysql')).to.equal('column name');
      expect(maybeStripQuotes('`column name`', 'psql')).to.equal('column name');
    });

    it('does not strip backtick identifiers for mssql', () => {
      expect(maybeStripQuotes('`column name`', 'mssql')).to.equal('`column name`');
    });

    it('strips MSSQL bracket identifiers', () => {
      expect(maybeStripQuotes('[col name]', 'mssql')).to.equal('col name');
    });

    it('does not strip bracket identifiers for non-mssql dialects', () => {
      expect(maybeStripQuotes('[col name]', 'psql')).to.equal('[col name]');
    });

    it('does not strip mismatched quote pairs', () => {
      expect(maybeStripQuotes('"foo`', 'psql')).to.equal('"foo`');
      expect(maybeStripQuotes('[foo"', 'mssql')).to.equal('[foo"');
    });

    it('unescapes doubled double-quotes', () => {
      expect(maybeStripQuotes('"weird""name"', 'psql')).to.equal('weird"name');
      expect(maybeStripQuotes('"weird""name"', 'mssql')).to.equal('weird"name');
    });

    it('unescapes doubled backticks', () => {
      expect(maybeStripQuotes('`weird``name`', 'mysql')).to.equal('weird`name');
    });

    it('unescapes doubled close brackets for MSSQL', () => {
      expect(maybeStripQuotes('[weird]]name]', 'mssql')).to.equal('weird]name');
    });

    it('handles empty quoted identifiers', () => {
      expect(maybeStripQuotes('""', 'psql')).to.equal('');
      expect(maybeStripQuotes('``', 'mysql')).to.equal('');
      expect(maybeStripQuotes('[]', 'mssql')).to.equal('');
    });

    it('handles identifiers that start with a literal quote char', () => {
      expect(maybeStripQuotes('"""abc"', 'psql')).to.equal('"abc');
    });

    it('handles identifiers that end with a literal quote char', () => {
      expect(maybeStripQuotes('"abc"""', 'psql')).to.equal('abc"');
    });

    it('handles multiple escape sequences in one identifier', () => {
      expect(maybeStripQuotes('"a""b""c"', 'psql')).to.equal('a"b"c');
    });

    it('handles an identifier consisting solely of an escaped quote', () => {
      expect(maybeStripQuotes('""""', 'psql')).to.equal('"');
      expect(maybeStripQuotes('[]]]', 'mssql')).to.equal(']');
    });

    it('unescapes backslash-escaped backticks for BigQuery', () => {
      expect(maybeStripQuotes('`a\\`b`', 'bigquery')).to.equal('a`b');
    });

    it('unescapes doubled double-quotes for Oracle', () => {
      expect(maybeStripQuotes('"weird""name"', 'oracle')).to.equal('weird"name');
    });

    it('passes through literal `[` inside MSSQL bracket identifier', () => {
      expect(maybeStripQuotes('[foo[bar]', 'mssql')).to.equal('foo[bar');
    });

    it('strips double-quoted identifiers for sqlite/dynamodb/generic', () => {
      expect(maybeStripQuotes('"col name"', 'sqlite')).to.equal('col name');
      expect(maybeStripQuotes('"col name"', 'dynamodb')).to.equal('col name');
      expect(maybeStripQuotes('"col name"', 'generic')).to.equal('col name');
    });

    it('strips backtick identifiers for sqlite/dynamodb/generic', () => {
      expect(maybeStripQuotes('`col name`', 'sqlite')).to.equal('col name');
      expect(maybeStripQuotes('`col name`', 'dynamodb')).to.equal('col name');
      expect(maybeStripQuotes('`col name`', 'generic')).to.equal('col name');
    });

    it('does not strip bracket identifiers for sqlite/dynamodb/generic', () => {
      expect(maybeStripQuotes('[col name]', 'sqlite')).to.equal('[col name]');
      expect(maybeStripQuotes('[col name]', 'dynamodb')).to.equal('[col name]');
      expect(maybeStripQuotes('[col name]', 'generic')).to.equal('[col name]');
    });

    it('unescapes doubled double-quotes for sqlite/dynamodb/generic', () => {
      expect(maybeStripQuotes('"a""b"', 'sqlite')).to.equal('a"b');
      expect(maybeStripQuotes('"a""b"', 'dynamodb')).to.equal('a"b');
      expect(maybeStripQuotes('"a""b"', 'generic')).to.equal('a"b');
    });
  });
});
