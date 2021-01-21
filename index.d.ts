export type Dialect = 'generic' | 'mysql' | 'psql' | 'sqlite' | 'mssql';

export type StatementType =
  'SELECT'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'CREATE_TABLE'
  | 'CREATE_DATABASE'
  | 'CREATE_TRIGGER'
  | 'CREATE_FUNCTION'
  | 'DROP_TABLE'
  | 'DROP_DATABASE'
  | 'DROP_TRIGGER'
  | 'DROP_FUNCTION'
  | 'TRUNCATE'
  | 'UNKNOWN';

export type ExecutionType = 'LISTING' | 'MODIFICATION' | 'INFORMATION' | 'UNKNOWN';

export interface Options {
  /**
   * Disables strict mode which will ignore unknown types (defaults to true).
   */
  strict?: boolean;
  /**
   * Set dialect for database specific parsing (defaults to generic)
   */
  dialect?: Dialect;
}

export interface Result {
  start: number;
  end: number;
  text: string;
  type: StatementType;
  executionType: ExecutionType;
}

export function identify(query: string, options?: Options): Result[];
