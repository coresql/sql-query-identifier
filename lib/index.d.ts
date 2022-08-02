import type { ExecutionType, IdentifyOptions, IdentifyResult } from './defines';
export type { ExecutionType, Dialect, IdentifyOptions as Options, IdentifyResult as Result, StatementType, } from './defines';
/**
 * Identifier
 */
export declare function identify(query: string, options?: IdentifyOptions): IdentifyResult[];
export declare function getExecutionType(command: string): ExecutionType;
