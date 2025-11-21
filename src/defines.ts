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
  | 'SHOW_BINARY'
  | 'SHOW_BINLOG'
  | 'SHOW_CHARACTER'
  | 'SHOW_COLLATION'
  | 'SHOW_CREATE'
  | 'SHOW_ENGINE'
  | 'SHOW_ENGINES'
  | 'SHOW_ERRORS'
  | 'SHOW_EVENTS'
  | 'SHOW_FUNCTION'
  | 'SHOW_GRANTS'
  | 'SHOW_MASTER'
  | 'SHOW_OPEN'
  | 'SHOW_PLUGINS'
  | 'SHOW_PRIVILEGES'
  | 'SHOW_PROCEDURE'
  | 'SHOW_PROCESSLIST'
  | 'SHOW_PROFILE'
  | 'SHOW_PROFILES'
  | 'SHOW_RELAYLOG'
  | 'SHOW_REPLICAS'
  | 'SHOW_SLAVE'
  | 'SHOW_REPLICA'
  | 'SHOW_STATUS'
  | 'SHOW_TRIGGERS'
  | 'SHOW_VARIABLES'
  | 'SHOW_WARNINGS'
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
  | 'BEGIN_TRANSACTION'
  | 'COMMIT'
  | 'ROLLBACK'
  | 'ANON_BLOCK'
  | 'UNKNOWN';

export type ExecutionType =
  | 'LISTING'
  | 'MODIFICATION'
  | 'INFORMATION'
  | 'ANON_BLOCK'
  | 'TRANSACTION'
  | 'UNKNOWN';

export interface ParamTypes {
  positional?: boolean;
  numbered?: ('?' | ':' | '$')[];
  named?: (':' | '@' | '$')[];
  quoted?: (':' | '@' | '$')[];
  // regex for identifying that it is a param
  custom?: string[];
}

export interface IdentifyOptions {
  strict?: boolean;
  dialect?: Dialect;
  identifyTables?: boolean;
  paramTypes?: ParamTypes;
}

export interface IdentifyResult {
  start: number;
  end: number;
  text: string;
  type: StatementType;
  executionType: ExecutionType;
  parameters: string[];
  tables: string[];
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
  tables: string[];
  isCte?: boolean;
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
    | 'table'
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
