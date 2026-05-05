import { parse } from '../../src/parser';
import { identify } from '../../src/index';
import { expect } from 'chai';

// DynamoDB supports a subset of PartiQL: only DML (SELECT, INSERT, UPDATE, DELETE).
//
// Top-level reference:
//   https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ql-reference.html
// Statements overview:
//   https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ql-reference.statements.html
describe('Parser for dynamodb (PartiQL)', () => {
  // SELECT syntax & examples (incl. "Table"."Index", document paths, IN/BETWEEN/ORDER BY):
  //   https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ql-reference.select.html
  // INSERT syntax (`INSERT INTO table VALUE item`, single-quoted strings/attribute names):
  //   https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ql-reference.insert.html
  // UPDATE syntax (SET / REMOVE / RETURNING [ALL OLD | MODIFIED OLD | ALL NEW | MODIFIED NEW] *):
  //   https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ql-reference.update.html
  // DELETE syntax:
  //   https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ql-reference.delete.html
  describe('supported DML statements', () => {
    it('parses a SELECT against a quoted table identifier', () => {
      const sql = `SELECT OrderID, Total FROM "Orders" WHERE OrderID = 1`;
      const result = parse(sql, true, 'dynamodb');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('SELECT');
      expect(result.body[0].executionType).to.eql('LISTING');
    });

    it('parses a SELECT querying a secondary index ("Table"."Index")', () => {
      const sql = `SELECT * FROM "Orders"."OrderIDIndex" WHERE OrderID = 1`;
      const result = parse(sql, true, 'dynamodb');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('SELECT');
    });

    it('parses an INSERT ... VALUE { ... } statement', () => {
      const sql = `INSERT INTO "Music" VALUE {'Artist' : 'Acme Band','SongTitle' : 'PartiQL Rocks'}`;
      const result = parse(sql, true, 'dynamodb');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('INSERT');
      expect(result.body[0].executionType).to.eql('MODIFICATION');
    });

    it('parses an UPDATE ... SET ... WHERE statement', () => {
      const sql = `UPDATE "Music" SET AwardsWon=1 WHERE Artist='Acme Band' AND SongTitle='PartiQL Rocks'`;
      const result = parse(sql, true, 'dynamodb');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('UPDATE');
      expect(result.body[0].executionType).to.eql('MODIFICATION');
    });

    it('parses an UPDATE ... REMOVE ... statement', () => {
      const sql = `UPDATE "Music" REMOVE AwardDetail.Grammys[2] WHERE Artist='Acme Band' AND SongTitle='PartiQL Rocks'`;
      const result = parse(sql, true, 'dynamodb');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('UPDATE');
    });

    it('parses an UPDATE with RETURNING ALL OLD * clause', () => {
      const sql = `UPDATE "Music" SET AwardsWon=1 WHERE Artist='Acme Band' AND SongTitle='PartiQL Rocks' RETURNING ALL OLD *`;
      const result = parse(sql, true, 'dynamodb');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('UPDATE');
    });

    it('parses a DELETE statement', () => {
      const sql = `DELETE FROM "Music" WHERE Artist='Acme Band' AND SongTitle='PartiQL Rocks'`;
      const result = parse(sql, true, 'dynamodb');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('DELETE');
      expect(result.body[0].executionType).to.eql('MODIFICATION');
    });
  });

  // Positional `?` parameters are bound via the `Parameters` field on the
  // ExecuteStatement / ExecuteTransaction / BatchExecuteStatement APIs:
  //   https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ExecuteStatement.html
  describe('parameters (positional `?` placeholders)', () => {
    it('captures positional `?` parameters in a SELECT', () => {
      const sql = `SELECT * FROM "Orders" WHERE OrderID = ? AND Address = ?`;
      const result = parse(sql, true, 'dynamodb');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].parameters).to.eql(['?', '?']);
    });

    it('captures positional `?` parameters in an INSERT', () => {
      const sql = `INSERT INTO "Music" VALUE {'Artist' : ?, 'SongTitle' : ?}`;
      const result = parse(sql, true, 'dynamodb');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].parameters).to.eql(['?', '?']);
    });
  });

  describe('multiple statements', () => {
    it('parses multiple semicolon-separated DML statements', () => {
      const sql = `SELECT * FROM "Orders"; UPDATE "Music" SET AwardsWon=1 WHERE Artist='Acme';`;
      const result = parse(sql, true, 'dynamodb');
      expect(result.body.length).to.eql(2);
      expect(result.body[0].type).to.eql('SELECT');
      expect(result.body[1].type).to.eql('UPDATE');
    });
  });

  // DynamoDB exposes transactions and batches as API operations rather than
  // SQL keywords, so BEGIN/COMMIT/ROLLBACK and DDL keywords are not part of
  // the grammar:
  //   https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ql-reference.multiplestatements.transactions.html
  //   https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ql-reference.multiplestatements.batching.html
  describe('unsupported statements (DDL, transactions, SHOW)', () => {
    [
      'CREATE TABLE foo (id int)',
      'DROP TABLE foo',
      'ALTER TABLE foo ADD COLUMN bar int',
      'TRUNCATE TABLE foo',
      'SHOW TABLES',
      'BEGIN TRANSACTION',
      'COMMIT',
      'ROLLBACK',
    ].forEach((sql) => {
      it(
        `throws in strict mode for: ${sql.split(' ')[0]} ${sql.split(' ')[1] ?? ''}`.trim(),
        () => {
          expect(() => parse(sql, true, 'dynamodb')).to.throw(
            /not supported by the DynamoDB PartiQL dialect/,
          );
        },
      );

      it(
        `falls back to UNKNOWN in non-strict mode for: ${sql.split(' ')[0]} ${
          sql.split(' ')[1] ?? ''
        }`.trim(),
        () => {
          const result = parse(sql, false, 'dynamodb');
          expect(result.body.length).to.eql(1);
          expect(result.body[0].type).to.eql('UNKNOWN');
        },
      );
    });
  });

  describe('public identify() integration', () => {
    it('identifies a DynamoDB SELECT via the public API', () => {
      const sql = `SELECT * FROM "Orders" WHERE OrderID = ?`;
      expect(identify(sql, { dialect: 'dynamodb' })).to.eql([
        {
          start: 0,
          end: sql.length - 1,
          text: sql,
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: ['?'],
          tables: [],
          columns: [],
        },
      ]);
    });

    it('rejects DDL via the public API in strict mode', () => {
      expect(() => identify('CREATE TABLE foo (id int)', { dialect: 'dynamodb' })).to.throw(
        /not supported by the DynamoDB PartiQL dialect/,
      );
    });
  });
});
