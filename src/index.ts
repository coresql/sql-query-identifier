import { parse, EXECUTION_TYPES, defaultParamTypesFor } from './parser';
import { DIALECTS, ParamTypes } from './defines';
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

  if (!DIALECTS.includes(dialect)) {
    throw new Error(`Unknown dialect. Allowed values: ${DIALECTS.join(', ')}`);
  }

  let paramTypes: ParamTypes;

  // Default parameter types for each dialect
  if (options.paramTypes) {
    paramTypes = options.paramTypes;
  } else {
    paramTypes = defaultParamTypesFor(dialect);
  }

  const result = parse(query, isStrict, dialect, options.identifyTables, paramTypes);
  const sort = dialect === 'psql' && !options.paramTypes;

  return result.body.map((statement) => {
    const result: IdentifyResult = {
      start: statement.start,
      end: statement.end,
      text: query.substring(statement.start, statement.end + 1),
      type: statement.type,
      executionType: statement.executionType,
      // we want to sort the postgres params: $1 $2 $3, regardless of the order they appear
      parameters: sort ? statement.parameters.sort() : statement.parameters,
      tables: statement.tables || [],
    };
    return result;
  });
}

export function getExecutionType(command: string): ExecutionType {
  return EXECUTION_TYPES[command as StatementType] || 'UNKNOWN';
}
