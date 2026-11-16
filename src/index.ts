import { parse, EXECUTION_TYPES, defaultParamTypesFor } from './parser';
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

  if (!DIALECTS.includes(dialect)) {
    throw new Error(`Unknown dialect. Allowed values: ${DIALECTS.join(', ')}`);
  }

  // Default parameter types for each dialect
  const paramTypes = options.paramTypes || defaultParamTypesFor(dialect);

  const parsed = parse(
    query,
    isStrict,
    dialect,
    options.identifyTables,
    options.identifyColumns,
    paramTypes,
  );
  const sort = dialect === 'psql' && !options.paramTypes;

  // Use token boundaries so comment markers inside strings cannot become headers.
  let tokenIndex = 0;
  let previousEnd = -1;
  return parsed.body.map((statement) => {
    let start = statement.start;
    let leadingStart: number | undefined;
    let firstComment: number | undefined;
    while (
      (options.includeLeadingComments === true || options.includeLeadingWhitespace === true) &&
      tokenIndex < parsed.tokens.length &&
      parsed.tokens[tokenIndex].start < statement.start
    ) {
      const token = parsed.tokens[tokenIndex++];
      if (token.end <= previousEnd) continue;
      if (token.type === 'whitespace') {
        if (leadingStart === undefined) leadingStart = token.start;
      } else if (
        options.includeLeadingComments === true &&
        (token.type === 'comment-inline' || token.type === 'comment-block')
      ) {
        if (leadingStart === undefined) leadingStart = token.start;
        if (firstComment === undefined) firstComment = token.start;
      } else {
        leadingStart = undefined;
        firstComment = undefined;
      }
    }
    if (options.includeLeadingWhitespace === true && leadingStart !== undefined) {
      start = leadingStart;
    } else if (options.includeLeadingComments === true && firstComment !== undefined) {
      start = firstComment;
    }
    previousEnd = statement.end;
    const result: IdentifyResult = {
      start,
      end: statement.end,
      text: query.substring(start, statement.end + 1),
      type: statement.type,
      executionType: statement.executionType,
      // we want to sort the postgres params: $1 $2 $3, regardless of the order they appear
      parameters: sort ? statement.parameters.sort() : statement.parameters,
      tables: statement.tables || [],
      columns: statement.columns || [],
    };
    if (statement.limit !== undefined) result.limit = statement.limit;
    if (statement.offset !== undefined) result.offset = statement.offset;
    return result;
  });
}

export function getExecutionType(command: string): ExecutionType {
  return EXECUTION_TYPES[command as StatementType] || 'UNKNOWN';
}
