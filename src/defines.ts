export const DIALECTS = [
  'mssql',
  'sqlite',
  'mysql',
  'oracle',
  'psql',
  'bigquery',
  'generic',
] as const;
export type Dialect = (typeof DIALECTS)[number];
export type StatementType =
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'SELECT'
  | 'TRUNCATE'
  | 'CREATE_DATABASE'
  | 'CREATE_SCHEMA'
  | 'CREATE_TABLE'
  | 'CREATE_VIEW'
  | 'CREATE_TRIGGER'
  | 'CREATE_FUNCTION'
  | 'CREATE_INDEX'
  | 'CREATE_PROCEDURE'
  | 'SHOW_DATABASES'
  | 'SHOW_KEYS'
  | 'SHOW_INDEX'
  | 'SHOW_TABLE'
  | 'SHOW_TABLES'
  | 'SHOW_COLUMNS'
  | 'DROP_DATABASE'
  | 'DROP_SCHEMA'
  | 'DROP_TABLE'
  | 'DROP_VIEW'
  | 'DROP_TRIGGER'
  | 'DROP_FUNCTION'
  | 'DROP_INDEX'
  | 'DROP_PROCEDURE'
  | 'ALTER_DATABASE'
  | 'ALTER_SCHEMA'
  | 'ALTER_TABLE'
  | 'ALTER_VIEW'
  | 'ALTER_TRIGGER'
  | 'ALTER_FUNCTION'
  | 'ALTER_INDEX'
  | 'ALTER_PROCEDURE'
  | 'ANON_BLOCK'
  | 'UNKNOWN';

export type ExecutionType = 'LISTING' | 'MODIFICATION' | 'INFORMATION' | 'ANON_BLOCK' | 'UNKNOWN';

export interface IdentifyOptions {
  strict?: boolean;
  dialect?: Dialect;
}

export interface IdentifyResult {
  start: number;
  end: number;
  text: string;
  type: StatementType;
  executionType: ExecutionType;
  parameters: string[];
}

export interface Statement {
  start: number;
  end: number;
  type?: StatementType;
  executionType?: ExecutionType;
  endStatement?: string;
  canEnd?: boolean;
  definer?: number;
  algorithm?: number;
  sqlSecurity?: number;
  parameters: string[];
}

export interface ConcreteStatement extends Statement {
  type: StatementType;
  executionType: ExecutionType;
}

export interface State {
  start: number;
  end: number;
  position: number;
  input: string;
}

export interface Token {
  type:
    | 'whitespace'
    | 'comment-inline'
    | 'comment-block'
    | 'string'
    | 'semicolon'
    | 'keyword'
    | 'parameter'
    | 'unknown';
  value: string;
  start: number;
  end: number;
}

export interface ParseResult {
  type: 'QUERY';
  start: number;
  end: number;
  body: ConcreteStatement[];
  tokens: Token[];
}

export interface Step {
  preCanGoToNext: (token?: Token) => boolean;
  validation?: {
    requireBefore?: string[];
    acceptTokens: { type: string; value: string }[];
  };
  add: (token: Token) => void;
  postCanGoToNext: (token?: Token) => boolean;
}
