import { parse } from './parser';

const allowedDialects = ['mssql', 'sqlite', 'mysql', 'psql', 'generic'];
/**
 * Identifier
 */
export function identify (query, options = {}) {
  const isStrict = typeof options.strict === 'undefined' ? true : options.strict;
  const dialect = typeof options.dialect === 'undefined' ? 'generic' : options.dialect;

  if (!allowedDialects.includes(dialect)) {
    throw new Error(`Unknown dialect. Allowed values: ${allowedDialects.join(',')}`);
  }

  const result = parse(query, isStrict, dialect);

  return result.body.map(statement => ({
    start: statement.start,
    end: statement.end,
    text: query.substring(statement.start, statement.end + 1),
    type: statement.type,
    executionType: statement.executionType,
  }));
}
