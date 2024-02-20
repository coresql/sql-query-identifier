import { parse, EXECUTION_TYPES } from './parser';
import { DIALECTS } from './defines';
import type { ExecutionType, IdentifyOptions, IdentifyResult, StatementType } from './defines';

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
export function identify(query: string, options: IdentifyOptions = {}): IdentifyResult[] {
  const isStrict = typeof options.strict === 'undefined' ? true : options.strict === true;
  const dialect = typeof options.dialect === 'undefined' ? 'generic' : options.dialect;
  const enableCrossDBParameters =
    typeof options.enableCrossDBParameters === 'undefined'
      ? false
      : options.enableCrossDBParameters;

  if (!DIALECTS.includes(dialect)) {
    throw new Error(`Unknown dialect. Allowed values: ${DIALECTS.join(', ')}`);
  }

  const result = parse(query, isStrict, dialect, enableCrossDBParameters);

  return result.body.map((statement) => {
    const result: IdentifyResult = {
      start: statement.start,
      end: statement.end,
      text: query.substring(statement.start, statement.end + 1),
      type: statement.type,
      executionType: statement.executionType,
      // we want to sort the postgres params: $1 $2 $3, regardless of the order they appear
      parameters: dialect === 'psql' ? statement.parameters.sort() : statement.parameters,
    };
    return result;
  });
}

export function getExecutionType(command: string): ExecutionType {
  return EXECUTION_TYPES[command as StatementType] || 'UNKNOWN';
}
