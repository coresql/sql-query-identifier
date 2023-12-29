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
          tables: [],
        },
        {
          end: 76,
          start: 56,
          text: 'SELECT * FROM Persons',
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
          tables: ['Persons']
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
          tables: [],
        },
        {
          start: 74,
          end: 95,
          text: 'SELECT * FROM Persons;',
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
          tables: ['Persons']
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
          tables: [],
        },
        {
          start: 35,
          end: 54,
          text: 'SELECT * FROM table;',
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
          tables: ['table'],
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
          tables: [],
        },
        {
          start: 20,
          end: 28,
          text: 'select 2;',
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
          tables: [],
        },
        {
          start: 50,
          end: 58,
          text: 'select 3;',
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
          tables: [],
        },
      ];

      expect(actual).to.eql(expected);
    });

    describe('identifying statements with anonymous blocks', () => {
      it('should work in strict mode', () => {
        const actual = identify(
          `
          DECLARE
            PK_NAME VARCHAR(200);

          BEGIN
            EXECUTE IMMEDIATE ('CREATE SEQUENCE "untitled_table8_seq"');

          SELECT
            cols.column_name INTO PK_NAME
          FROM
            all_constraints cons,
            all_cons_columns cols
          WHERE
            cons.constraint_type = 'P'
            AND cons.constraint_name = cols.constraint_name
            AND cons.owner = cols.owner
            AND cols.table_name = 'untitled_table8';

          execute immediate (
            'create or replace trigger "untitled_table8_autoinc_trg"  BEFORE INSERT on "untitled_table8"  for each row  declare  checking number := 1;  begin    if (:new."' || PK_NAME || '" is null) then      while checking >= 1 loop        select "untitled_table8_seq".nextval into :new."' || PK_NAME || '" from dual;        select count("' || PK_NAME || '") into checking from "untitled_table8"        where "' || PK_NAME || '" = :new."' || PK_NAME || '";      end loop;    end if;  end;'
          );

          END;
          `,
          { dialect: 'oracle', strict: true },
        );
        const expected = [
          {
            end: 1043,
            executionType: 'ANON_BLOCK',
            parameters: [],
            tables: [],
            start: 11,
            text: 'DECLARE\n            PK_NAME VARCHAR(200);\n\n          BEGIN\n            EXECUTE IMMEDIATE (\'CREATE SEQUENCE "untitled_table8_seq"\');\n\n          SELECT\n            cols.column_name INTO PK_NAME\n          FROM\n            all_constraints cons,\n            all_cons_columns cols\n          WHERE\n            cons.constraint_type = \'P\'\n            AND cons.constraint_name = cols.constraint_name\n            AND cons.owner = cols.owner\n            AND cols.table_name = \'untitled_table8\';\n\n          execute immediate (\n            \'create or replace trigger "untitled_table8_autoinc_trg"  BEFORE INSERT on "untitled_table8"  for each row  declare  checking number := 1;  begin    if (:new."\' || PK_NAME || \'" is null) then      while checking >= 1 loop        select "untitled_table8_seq".nextval into :new."\' || PK_NAME || \'" from dual;        select count("\' || PK_NAME || \'") into checking from "untitled_table8"        where "\' || PK_NAME || \'" = :new."\' || PK_NAME || \'";      end loop;    end if;  end;\'\n          );\n\n          END;',
            type: 'ANON_BLOCK',
          },
        ];
        expect(actual).to.eql(expected);
      });

      it('should identify a create table then a block', () => {
        const actual = identify(
          `
          create table
            "untitled_table8" (
              "id" integer not null primary key,
              "created_at" varchar(255) not null
            );

          DECLARE
            PK_NAME VARCHAR(200);

          BEGIN
            EXECUTE IMMEDIATE ('CREATE SEQUENCE "untitled_table8_seq"');

          SELECT
            cols.column_name INTO PK_NAME
          FROM
            all_constraints cons,
            all_cons_columns cols
          WHERE
            cons.constraint_type = 'P'
            AND cons.constraint_name = cols.constraint_name
            AND cons.owner = cols.owner
            AND cols.table_name = 'untitled_table8';

          execute immediate (
            'create or replace trigger "untitled_table8_autoinc_trg"  BEFORE INSERT on "untitled_table8"  for each row  declare  checking number := 1;  begin    if (:new."' || PK_NAME || '" is null) then      while checking >= 1 loop        select "untitled_table8_seq".nextval into :new."' || PK_NAME || '" from dual;        select count("' || PK_NAME || '") into checking from "untitled_table8"        where "' || PK_NAME || '" = :new."' || PK_NAME || '";      end loop;    end if;  end;'
          );

          END;
          `,
          { dialect: 'oracle', strict: false },
        );
        const expected = [
          {
            end: 167,
            executionType: 'MODIFICATION',
            parameters: [],
            tables: [],
            start: 11,
            text: 'create table\n            "untitled_table8" (\n              "id" integer not null primary key,\n              "created_at" varchar(255) not null\n            );',
            type: 'CREATE_TABLE',
          },
          {
            end: 1212,
            executionType: 'ANON_BLOCK',
            parameters: [],
            tables: [],
            start: 180,
            text: 'DECLARE\n            PK_NAME VARCHAR(200);\n\n          BEGIN\n            EXECUTE IMMEDIATE (\'CREATE SEQUENCE "untitled_table8_seq"\');\n\n          SELECT\n            cols.column_name INTO PK_NAME\n          FROM\n            all_constraints cons,\n            all_cons_columns cols\n          WHERE\n            cons.constraint_type = \'P\'\n            AND cons.constraint_name = cols.constraint_name\n            AND cons.owner = cols.owner\n            AND cols.table_name = \'untitled_table8\';\n\n          execute immediate (\n            \'create or replace trigger "untitled_table8_autoinc_trg"  BEFORE INSERT on "untitled_table8"  for each row  declare  checking number := 1;  begin    if (:new."\' || PK_NAME || \'" is null) then      while checking >= 1 loop        select "untitled_table8_seq".nextval into :new."\' || PK_NAME || \'" from dual;        select count("\' || PK_NAME || \'") into checking from "untitled_table8"        where "\' || PK_NAME || \'" = :new."\' || PK_NAME || \'";      end loop;    end if;  end;\'\n          );\n\n          END;',
            type: 'ANON_BLOCK',
          },
        ];
        expect(actual).to.eql(expected);
      });
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
            tables: [],
          },
          {
            start: 79,
            end: 237,
            text: "WITH employee AS (SELECT * FROM Employees)\n          SELECT * FROM employee WHERE ID < 20\n          UNION ALL\n          SELECT * FROM employee WHERE Sex = 'M';",
            type: 'SELECT',
            executionType: 'LISTING',
            parameters: [],
            tables: [],
          },
          {
            start: 250,
            end: 271,
            text: 'SELECT * FROM Persons;',
            type: 'SELECT',
            executionType: 'LISTING',
            parameters: [],
            tables: ['Persons'],
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
            tables: [],
          },
          {
            start: 54,
            end: 71,
            text: statement2,
            type: 'SELECT',
            executionType: 'LISTING',
            parameters: [],
            tables: ['foo'],
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
          tables: [],
        },
        {
          start: 6,
          end: 23,
          text: statement2,
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
          tables: ['foo'],
        },
      ];

      expect(actual).to.eql(expected);
      expect(sql.substring(actual[0].start, actual[0].end + 1)).to.eql(statement1);
      expect(sql.substring(actual[1].start, actual[1].end + 1)).to.eql(statement2);
    });

    it('should identify statements with semicolon inside CTE parens', () => {
      const statement1 = `with temp as ( SELECT ;`;
      const statement2 = 'select * from foo';
      const sql = `${statement1}\n${statement2}`;
      const actual = identify(sql);

      const expected = [
        {
          start: 0,
          end: 22,
          text: statement1,
          type: 'UNKNOWN',
          executionType: 'UNKNOWN',
          parameters: [],
          tables: [],
        },
        {
          start: 24,
          end: 40,
          text: statement2,
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
          tables: ['foo'],
        },
      ];

      expect(actual).to.eql(expected);
      expect(sql.substring(actual[0].start, actual[0].end + 1)).to.eql(statement1);
      expect(sql.substring(actual[1].start, actual[1].end + 1)).to.eql(statement2);
    });
  });

  describe('identifying transactions', () => {
    it('should identify transactions', () => {
      const statements = ['BEGIN TRANSACTION;', 'SELECT 1;', 'COMMIT;'];
      const actual = identify(statements.join('\n'), { strict: false });
      const expected = [
        {
          start: 0,
          end: 17,
          text: statements[0],
          type: 'UNKNOWN',
          executionType: 'UNKNOWN',
          parameters: [],
          tables: [],
        },
        {
          start: 19,
          end: 27,
          text: statements[1],
          type: 'SELECT',
          executionType: 'LISTING',
          parameters: [],
          tables: [],
        },
        {
          start: 29,
          end: 35,
          text: statements[2],
          type: 'UNKNOWN',
          executionType: 'UNKNOWN',
          parameters: [],
          tables: [],
        },
      ];
      expect(actual).to.eql(expected);
    });

    describe('identifying keywords for sqlite transactions', () => {
      ['DEFERRED', 'IMMEDIATE', 'EXCLUSIVE'].forEach((type) => {
        it(`identifies BEGIN ${type} TRANSACTION`, () => {
          const statements = [`BEGIN ${type} TRANSACTION;`, 'SELECT 1;', 'COMMIT;'];
          const actual = identify(statements.join('\n'), { dialect: 'sqlite', strict: false });
          const offset = type.length + 1;
          const expected = [
            {
              start: 0,
              end: 17 + offset,
              text: statements[0],
              type: 'UNKNOWN',
              executionType: 'UNKNOWN',
              parameters: [],
              tables: [],
            },
            {
              start: 19 + offset,
              end: 27 + offset,
              text: statements[1],
              type: 'SELECT',
              executionType: 'LISTING',
              parameters: [],
              tables: [],
            },
            {
              start: 29 + offset,
              end: 35 + offset,
              text: statements[2],
              type: 'UNKNOWN',
              executionType: 'UNKNOWN',
              parameters: [],
              tables: [],
            },
          ];
          expect(actual).to.eql(expected);
        });
      });
    });
  });
});
