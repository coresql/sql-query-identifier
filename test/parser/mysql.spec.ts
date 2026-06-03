import { parse } from '../../src/parser';
import { expect } from 'chai';

describe('Parser for MySQL', () => {
  it('parses a CREATE DEFINER query with wildcard', () => {
    const sql =
      'CREATE DEFINER=`example_user`@`%` PROCEDURE test_proc()\n' +
      'BEGIN\n' +
      '    SELECT 1;\n' +
      'END;';

    const result = parse(sql, true, 'mysql');
    expect(result.body.length).to.eql(1);
    expect(result.body[0].type).to.eql('CREATE_PROCEDURE');
    expect(result.body[0].executionType).to.eql('MODIFICATION');

    const sql2 =
      'CREATE DEFINER=`example_user`@`%` PROCEDURE test_proc()\n' +
      'BEGIN\n' +
      '    SELECT 1;\n' +
      'END;\n' +
      `SELECT 1 as one;`;

    const result2 = parse(sql2, true, 'mysql');
    expect(result2.body.length).to.eql(2);
  });
});
