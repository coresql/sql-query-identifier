import { parse } from './parser';


/**
 * Identifier
 */
export function identify (query, options = {}) {
  const isStrict = typeof options.strict === 'undefined' ? true : options.strict;

  const result = parse(query, isStrict);

  return result.body.map(statement => ({
    start: statement.start,
    end: statement.end,
    text: query.substring(statement.start, statement.end + 1),
    type: statement.type,
    executionType: statement.executionType,
  }));
}
