import { parse, defaultParamTypesFor } from '../../src/parser';
import { expect } from 'chai';

describe('Parser for snowflake', () => {
  // Anonymous blocks
  describe('anonymous blocks', () => {
    it('should parse bare BEGIN as ANON_BLOCK', () => {
      const result = parse('BEGIN SELECT 1; END;', false, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
    });

    it('should parse bare BEGIN...END followed by another statement', () => {
      const result = parse('BEGIN SELECT 1; END; SELECT 2;', false, 'snowflake');
      expect(result.body.length).to.eql(2);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
      expect(result.body[1].type).to.eql('SELECT');
    });

    it('should parse DECLARE...BEGIN...END as a single ANON_BLOCK', () => {
      const sql = `DECLARE
        x INTEGER;
      BEGIN
        x := 1;
        SELECT x;
      END;`;
      const result = parse(sql, false, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
    });

    it('should parse DECLARE...BEGIN...END followed by another statement', () => {
      const sql = `DECLARE
        x INTEGER;
      BEGIN
        SELECT x;
      END;

      SELECT * FROM foo;`;
      const result = parse(sql, false, 'snowflake');
      expect(result.body.length).to.eql(2);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
      expect(result.body[1].type).to.eql('SELECT');
    });

    it('should handle nested BEGIN...END blocks', () => {
      const sql = `BEGIN
        BEGIN
          SELECT 1;
        END;
        SELECT 2;
      END;`;
      const result = parse(sql, false, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
    });

    it('should handle a block with multiple internal statements', () => {
      const sql = `BEGIN
        INSERT INTO t1 VALUES (1);
        INSERT INTO t1 VALUES (2);
        INSERT INTO t1 VALUES (3);
      END;`;
      const result = parse(sql, false, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
    });

    it('should handle CASE inside a block', () => {
      const sql = `BEGIN
        SELECT CASE WHEN a = 1 THEN 'yes' ELSE 'no' END CASE FROM t;
      END;`;
      const result = parse(sql, false, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
    });

    it('should handle IF inside a block', () => {
      const sql = `BEGIN
        IF (x > 0) THEN
          SELECT 1;
        ELSE
          SELECT 2;
        END IF;
      END;`;
      const result = parse(sql, false, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
    });

    it('should handle WHILE inside a block', () => {
      const sql = `BEGIN
        WHILE (x < 10) DO
          SELECT x;
        END WHILE;
      END;`;
      const result = parse(sql, false, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
    });

    it('should handle FOR inside a block', () => {
      const sql = `BEGIN
        FOR i IN 1 TO 10 DO
          SELECT i;
        END FOR;
      END;`;
      const result = parse(sql, false, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
    });

    it('should handle LOOP inside a block', () => {
      const sql = `BEGIN
        LOOP
          SELECT 1;
        END LOOP;
      END;`;
      const result = parse(sql, false, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
    });
  });

  // Transactions
  describe('transactions', () => {
    it('should parse BEGIN TRANSACTION as BEGIN_TRANSACTION', () => {
      const result = parse('BEGIN TRANSACTION; SELECT 1; COMMIT;', false, 'snowflake');
      expect(result.body.length).to.eql(3);
      expect(result.body[0].type).to.eql('BEGIN_TRANSACTION');
      expect(result.body[1].type).to.eql('SELECT');
      expect(result.body[2].type).to.eql('COMMIT');
    });

    it('should parse BEGIN WORK as BEGIN_TRANSACTION', () => {
      const result = parse('BEGIN WORK; SELECT 1; COMMIT;', false, 'snowflake');
      expect(result.body.length).to.eql(3);
      expect(result.body[0].type).to.eql('BEGIN_TRANSACTION');
      expect(result.body[1].type).to.eql('SELECT');
      expect(result.body[2].type).to.eql('COMMIT');
    });

    it('should parse START TRANSACTION as BEGIN_TRANSACTION', () => {
      const result = parse('START TRANSACTION; SELECT 1; COMMIT;', false, 'snowflake');
      expect(result.body.length).to.eql(3);
      expect(result.body[0].type).to.eql('BEGIN_TRANSACTION');
      expect(result.body[1].type).to.eql('SELECT');
      expect(result.body[2].type).to.eql('COMMIT');
    });

    it('should parse BEGIN TRANSACTION with NAME', () => {
      const result = parse(
        'BEGIN TRANSACTION NAME T1; INSERT INTO t VALUES (1); COMMIT;',
        false,
        'snowflake',
      );
      expect(result.body.length).to.eql(3);
      expect(result.body[0].type).to.eql('BEGIN_TRANSACTION');
      expect(result.body[1].type).to.eql('INSERT');
      expect(result.body[2].type).to.eql('COMMIT');
    });

    it('should parse COMMIT and ROLLBACK', () => {
      const result = parse('COMMIT;', false, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('COMMIT');

      const result2 = parse('ROLLBACK;', false, 'snowflake');
      expect(result2.body.length).to.eql(1);
      expect(result2.body[0].type).to.eql('ROLLBACK');
    });

    it('should not treat BEGIN WORK inside a block as a block opener', () => {
      const sql = `BEGIN
        BEGIN WORK;
        INSERT INTO t VALUES (1);
        COMMIT;
      END;`;
      const result = parse(sql, false, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
    });
  });

  // Standard statement identification
  describe('standard statements', () => {
    it('should identify SELECT', () => {
      const result = parse('SELECT * FROM foo;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('SELECT');
    });

    it('should identify INSERT', () => {
      const result = parse('INSERT INTO foo VALUES (1);', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('INSERT');
    });

    it('should identify UPDATE', () => {
      const result = parse('UPDATE foo SET bar = 1;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('UPDATE');
    });

    it('should identify DELETE', () => {
      const result = parse('DELETE FROM foo;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('DELETE');
    });

    it('should identify TRUNCATE', () => {
      const result = parse('TRUNCATE TABLE foo;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('TRUNCATE');
    });
  });

  // CREATE statements with modifiers
  describe('CREATE statements', () => {
    it('should identify CREATE TABLE', () => {
      const result = parse('CREATE TABLE foo (id INTEGER);', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_TABLE');
    });

    it('should identify CREATE OR REPLACE TABLE', () => {
      const result = parse('CREATE OR REPLACE TABLE foo (id INTEGER);', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_TABLE');
    });

    it('should identify CREATE OR ALTER VIEW', () => {
      const result = parse('CREATE OR ALTER VIEW v AS SELECT 1;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_VIEW');
    });

    it('should identify CREATE TEMPORARY TABLE', () => {
      const result = parse('CREATE TEMPORARY TABLE foo (id INTEGER);', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_TABLE');
    });

    it('should identify CREATE TEMP TABLE', () => {
      const result = parse('CREATE TEMP TABLE foo (id INTEGER);', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_TABLE');
    });

    it('should identify CREATE TRANSIENT TABLE', () => {
      const result = parse('CREATE TRANSIENT TABLE foo (id INTEGER);', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_TABLE');
    });

    it('should identify CREATE VOLATILE TABLE', () => {
      const result = parse('CREATE VOLATILE TABLE foo (id INTEGER);', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_TABLE');
    });

    it('should identify CREATE MATERIALIZED VIEW', () => {
      const result = parse('CREATE MATERIALIZED VIEW v AS SELECT 1;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_VIEW');
    });

    it('should identify CREATE VIEW', () => {
      const result = parse('CREATE VIEW v AS SELECT 1;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_VIEW');
    });

    it('should identify CREATE SCHEMA', () => {
      const result = parse('CREATE SCHEMA myschema;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_SCHEMA');
    });

    it('should identify CREATE DATABASE', () => {
      const result = parse('CREATE DATABASE mydb;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_DATABASE');
    });

    it('should identify CREATE FUNCTION', () => {
      const result = parse(
        'CREATE FUNCTION myfunc() RETURNS INTEGER AS $$ SELECT 1 $$;',
        true,
        'snowflake',
      );
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_FUNCTION');
    });

    it('should identify CREATE PROCEDURE', () => {
      const result = parse(
        'CREATE PROCEDURE myproc() RETURNS INTEGER AS $$ SELECT 1 $$;',
        true,
        'snowflake',
      );
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_PROCEDURE');
    });

    it('should identify CREATE OR REPLACE FUNCTION', () => {
      const result = parse(
        'CREATE OR REPLACE FUNCTION myfunc() RETURNS INTEGER AS $$ SELECT 1 $$;',
        true,
        'snowflake',
      );
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('CREATE_FUNCTION');
    });
  });

  // DROP statements
  describe('DROP statements', () => {
    it('should identify DROP TABLE', () => {
      const result = parse('DROP TABLE foo;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('DROP_TABLE');
    });

    it('should identify DROP VIEW', () => {
      const result = parse('DROP VIEW v;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('DROP_VIEW');
    });

    it('should identify DROP DATABASE', () => {
      const result = parse('DROP DATABASE mydb;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('DROP_DATABASE');
    });

    it('should identify DROP SCHEMA', () => {
      const result = parse('DROP SCHEMA myschema;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('DROP_SCHEMA');
    });
  });

  // ALTER statements
  describe('ALTER statements', () => {
    it('should identify ALTER TABLE', () => {
      const result = parse('ALTER TABLE foo ADD COLUMN bar INTEGER;', true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('ALTER_TABLE');
    });

    it('should identify ALTER VIEW', () => {
      const result = parse("ALTER VIEW v SET COMMENT = 'test';", true, 'snowflake');
      expect(result.body.length).to.eql(1);
      expect(result.body[0].type).to.eql('ALTER_VIEW');
    });
  });

  // Multiple statements / splitting
  describe('statement splitting', () => {
    it('should split multiple simple statements', () => {
      const result = parse('SELECT 1; SELECT 2; SELECT 3;', false, 'snowflake');
      expect(result.body.length).to.eql(3);
      expect(result.body[0].type).to.eql('SELECT');
      expect(result.body[1].type).to.eql('SELECT');
      expect(result.body[2].type).to.eql('SELECT');
    });

    it('should split mixed statement types', () => {
      const result = parse(
        'CREATE TABLE foo (id INTEGER); INSERT INTO foo VALUES (1); SELECT * FROM foo;',
        true,
        'snowflake',
      );
      expect(result.body.length).to.eql(3);
      expect(result.body[0].type).to.eql('CREATE_TABLE');
      expect(result.body[1].type).to.eql('INSERT');
      expect(result.body[2].type).to.eql('SELECT');
    });

    it('should not split on semicolons inside BEGIN...END blocks', () => {
      const sql = `BEGIN
        INSERT INTO t1 VALUES (1);
        INSERT INTO t2 VALUES (2);
      END;
      SELECT * FROM t1;`;
      const result = parse(sql, false, 'snowflake');
      expect(result.body.length).to.eql(2);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
      expect(result.body[1].type).to.eql('SELECT');
    });

    it('should not split on semicolons inside DECLARE...BEGIN...END blocks', () => {
      const sql = `DECLARE
        x INTEGER;
      BEGIN
        INSERT INTO t1 VALUES (1);
        INSERT INTO t2 VALUES (2);
      END;
      SELECT * FROM t1;`;
      const result = parse(sql, false, 'snowflake');
      expect(result.body.length).to.eql(2);
      expect(result.body[0].type).to.eql('ANON_BLOCK');
      expect(result.body[1].type).to.eql('SELECT');
    });

    it('should handle a block after a CREATE TABLE', () => {
      const sql = `CREATE TABLE foo (id INTEGER);
      BEGIN
        INSERT INTO foo VALUES (1);
        INSERT INTO foo VALUES (2);
      END;`;
      const result = parse(sql, false, 'snowflake');
      expect(result.body.length).to.eql(2);
      expect(result.body[0].type).to.eql('CREATE_TABLE');
      expect(result.body[1].type).to.eql('ANON_BLOCK');
    });
  });

  // Parameters
  describe('parameters', () => {
    it('should identify positional parameters', () => {
      const result = parse(
        'SELECT * FROM foo WHERE id = ?;',
        true,
        'snowflake',
        false,
        false,
        defaultParamTypesFor('snowflake'),
      );
      expect(result.body[0].parameters).to.eql(['?']);
    });

    it('should identify named parameters with colon', () => {
      const result = parse(
        'SELECT * FROM foo WHERE id = :id AND name = :name;',
        true,
        'snowflake',
        false,
        false,
        defaultParamTypesFor('snowflake'),
      );
      expect(result.body[0].parameters).to.include(':id');
      expect(result.body[0].parameters).to.include(':name');
    });
  });
});
