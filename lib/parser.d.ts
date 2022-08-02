import type { ExecutionType, Dialect, StatementType, ParseResult } from './defines';
/**
 * Execution types allow to know what is the query behavior
 *  - LISTING: is when the query list the data
 *  - MODIFICATION: is when the query modificate the database somehow (structure or data)
 *  - INFORMATION: is show some data information such as a profile data
 *  - UNKNOWN
 */
export declare const EXECUTION_TYPES: Record<StatementType, ExecutionType>;
/**
 * Parser
 */
export declare function parse(input: string, isStrict?: boolean, dialect?: Dialect): ParseResult;
