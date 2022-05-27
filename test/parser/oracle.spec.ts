import { parse } from '../../src/parser';
import { expect } from 'chai';

describe('Parser for oracle', () => {
  describe('given an anonymous block with an OUT pram', () => {
    it.only('should treat a simple block as a single query', () => {
      const sql = `BEGIN
          SELECT
            cols.column_name INTO :variable
          FROM
            example_table;
        END`;
      const result = parse(sql, false, 'oracle');

      console.log(result);

      expect(result.body.length).to.eql(1);
    });
  });
  describe('given an anonymous block with a variable', () => {
    it('should treat a simple block as a single query', () => {
      const sql = `
        DECLARE
          PK_NAME VARCHAR(200);
        BEGIN
          SELECT
            cols.column_name INTO PK_NAME
          FROM
            example_table;
        END;
      `;
      const result = parse(sql, false, 'oracle');

      expect(result.body.length).to.eql(1);
    });

    it('Should treat a block with two queries as a single query', () => {
      const sql = `
        DECLARE
          PK_NAME VARCHAR(200);
          FOO integer;

        BEGIN
          SELECT
            cols.column_name INTO PK_NAME
          FROM
            example_table;
          SELECT 1 INTO FOO from other_example;
        END;
      `;
      const result = parse(sql, false, 'oracle');
      expect(result.body.length).to.eql(1);
    });

    it('Should treat a complex block as a single query', () => {
      const sql = `
        DECLARE
          PK_NAME VARCHAR(200);

        BEGIN
          EXECUTE IMMEDIATE ('CREATE SEQUENCE "untitled_table3_seq"');

        SELECT
          cols.column_name INTO PK_NAME
        FROM
          all_constraints cons,
          all_cons_columns cols
        WHERE
          cons.constraint_type = 'P'
          AND cons.constraint_name = cols.constraint_name
          AND cons.owner = cols.owner
          AND cols.table_name = 'untitled_table3';

        execute immediate (
          'create or replace trigger "untitled_table3_autoinc_trg"  BEFORE INSERT on "untitled_table3"  for each row  declare  checking number := 1;  begin    if (:new."' || PK_NAME || '" is null) then      while checking >= 1 loop        select "untitled_table3_seq".nextval into :new."' || PK_NAME || '" from dual;        select count("' || PK_NAME || '") into checking from "untitled_table3"        where "' || PK_NAME || '" = :new."' || PK_NAME || '";      end loop;    end if;  end;'
        );
        END;
      `;
      const result = parse(sql, false, 'oracle');
      expect(result.body.length).to.eql(1);
    });
  });
});
