import { parse } from '../../src/parser';
import { expect } from 'chai';

describe('Parser for oracle', () => {
  describe('Given a CASE Statement', () => {
    it('should parse a simple case statement', () => {
      const sql = `SELECT CASE WHEN a = 'a' THEN 'foo' ELSE 'bar' END CASE from table;`;
      const result = parse(sql, false, 'oracle');
      expect(result.body.length).to.eql(1);
    });
  });

  describe('given an anonymous block with an OUT pram', () => {
    it('should treat a simple block as a single query', () => {
      const sql = `BEGIN
          SELECT
            cols.column_name INTO :variable
          FROM
            example_table;
        END`;
      const result = parse(sql, false, 'oracle');

      expect(result.body[0].type).to.eq('ANON_BLOCK');
      expect(result.body[0].start).to.eq(0);
      expect(result.body[0].end).to.eq(119);
      expect(result.body.length).to.eql(1);
    });

    it('should identify a block query and a normal query together', () => {
      const sql = `BEGIN
      SELECT
      cols.column_name INTO :variable
      FROM
      example_table;
      END;

      select * from another_thing
      `;
      const result = parse(sql, false, 'oracle');
      expect(result.body.length).to.eql(2);
      expect(result.body[0].start).to.eq(0);
      expect(result.body[0].end).to.eq(98);
      expect(result.body[1].start).to.eq(107);
    });
  });
  describe('given an anonymous block with a variable', () => {
    it('should treat a block with DECLARE and another query as two separate queries', () => {
      const sql = `DECLARE
          PK_NAME VARCHAR(200);
        BEGIN
          SELECT
            cols.column_name INTO PK_NAME
          FROM
            example_table;
        END;

        select * from foo;
      `;
      const result = parse(sql, false, 'oracle');
      console.log(result);
      expect(result.body.length).to.eql(2);
      expect(result.body[0].start).to.eq(0);
      expect(result.body[0].end).to.eq(166);
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

    it('should identify a compound statement with a nested compound statement as a single statement', () => {
      const sql = `DECLARE
          n_emp_id EMPLOYEES.EMPLOYEE_ID%TYPE := &emp_id1;
        BEGIN
          DECLARE
            n_emp_id employees.employee_id%TYPE := &emp_id2;
            v_name   employees.first_name%TYPE;
          BEGIN
            SELECT first_name, CASE foo WHEN 'a' THEN 1 ELSE 2 END CASE as other
            INTO v_name
            FROM employees
            WHERE employee_id = n_emp_id;

            DBMS_OUTPUT.PUT_LINE('First name of employee ' || n_emp_id ||
                                              ' is ' || v_name);
            EXCEPTION
              WHEN no_data_found THEN
                DBMS_OUTPUT.PUT_LINE('Employee ' || n_emp_id || ' not found');
          END;
        END;`;
      // yes this is still just one statement.
      const result = parse(sql, false, 'oracle');
      console.log(result);
      expect(result.body.length).to.eql(1);
    });
  });
});
