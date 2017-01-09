import { parse } from './parser';


/**
 * Identifier
 */
export function identify (query) {
  const result = parse(query);

  return result.body.map(statement => ({
    start: statement.start,
    end: statement.end,
    text: query.substring(statement.start, statement.end + 1),
    type: statement.type,
  }));
}
