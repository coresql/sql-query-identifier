import { parse } from './parser';
import { DIALECTS } from './defines';
import type { IdentifyOptions, IdentifyResult } from './defines';

export type {
  ExecutionType,
  Dialect,
  IdentifyOptions as Options,
  IdentifyResult as Result,
  StatementType,
} from './defines';

/**
 * Identifier
 */
export function identify (query: string, options: IdentifyOptions = {}): IdentifyResult[] {
  const isStrict = typeof options.strict === 'undefined' ? true : options.strict === true;
  const dialect = typeof options.dialect === 'undefined' ? 'generic' : options.dialect;

  if (!DIALECTS.includes(dialect)) {
    throw new Error(`Unknown dialect. Allowed values: ${DIALECTS.join(',')}`);
  }

  const result = parse(query, isStrict, dialect);

  return result.body.map((statement) => ({
    start: statement.start,
    end: statement.end,
    text: query.substring(statement.start, statement.end + 1),
    type: statement.type,
    executionType: statement.executionType,
  }));
}
