import { parse } from './parser';


/**
 * Identifier
 */
export function identify (query) {
  const result = parse(query);

  return result.body.map(statement => statement.type);
}
