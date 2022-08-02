/**
 * Tokenizer
 */
import type { Token, State, Dialect } from './defines';
export declare function scanToken(state: State, dialect?: Dialect): Token;
