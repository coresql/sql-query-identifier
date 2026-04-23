import { scanToken } from './tokenizer';
import type {
  ExecutionType,
  Dialect,
  State,
  Statement,
  StatementType,
  Token,
  Step,
  ParseResult,
  ConcreteStatement,
  ParamTypes,
} from './defines';
import { ColumnParser } from './column-parser';
import { TableParser } from './table-parser';

interface StatementParser {
  addToken: (token: Token, nextToken: Token) => void;
  getStatement: () => Statement;
  flush: () => void;
}

/**
 * Execution types allow to know what is the query behavior
 *  - LISTING: is when the query list the data
 *  - MODIFICATION: is when the query modificate the database somehow (structure or data)
 *  - INFORMATION: is show some data information such as a profile data
 *  - UNKNOWN
 */
export const EXECUTION_TYPES: Record<StatementType, ExecutionType> = {
  SELECT: 'LISTING',
  INSERT: 'MODIFICATION',
  DELETE: 'MODIFICATION',
  UPDATE: 'MODIFICATION',
  TRUNCATE: 'MODIFICATION',
  CREATE_DATABASE: 'MODIFICATION',
  CREATE_SCHEMA: 'MODIFICATION',
  CREATE_TABLE: 'MODIFICATION',
  CREATE_VIEW: 'MODIFICATION',
  CREATE_TRIGGER: 'MODIFICATION',
  CREATE_FUNCTION: 'MODIFICATION',
  CREATE_INDEX: 'MODIFICATION',
  CREATE_PROCEDURE: 'MODIFICATION',
  SHOW_BINARY: 'LISTING',
  SHOW_BINLOG: 'LISTING',
  SHOW_CHARACTER: 'LISTING',
  SHOW_COLLATION: 'LISTING',
  SHOW_CREATE: 'LISTING',
  SHOW_ENGINE: 'LISTING',
  SHOW_ENGINES: 'LISTING',
  SHOW_ERRORS: 'LISTING',
  SHOW_EVENTS: 'LISTING',
  SHOW_FUNCTION: 'LISTING',
  SHOW_GRANTS: 'LISTING',
  SHOW_MASTER: 'LISTING',
  SHOW_OPEN: 'LISTING',
  SHOW_PLUGINS: 'LISTING',
  SHOW_PRIVILEGES: 'LISTING',
  SHOW_PROCEDURE: 'LISTING',
  SHOW_PROCESSLIST: 'LISTING',
  SHOW_PROFILE: 'LISTING',
  SHOW_PROFILES: 'LISTING',
  SHOW_RELAYLOG: 'LISTING',
  SHOW_REPLICAS: 'LISTING',
  SHOW_SLAVE: 'LISTING',
  SHOW_REPLICA: 'LISTING',
  SHOW_STATUS: 'LISTING',
  SHOW_TRIGGERS: 'LISTING',
  SHOW_VARIABLES: 'LISTING',
  SHOW_WARNINGS: 'LISTING',
  SHOW_DATABASES: 'LISTING',
  SHOW_KEYS: 'LISTING',
  SHOW_INDEX: 'LISTING',
  SHOW_TABLE: 'LISTING', // for SHOW TABLE STATUS
  SHOW_TABLES: 'LISTING',
  SHOW_COLUMNS: 'LISTING',
  DROP_DATABASE: 'MODIFICATION',
  DROP_SCHEMA: 'MODIFICATION',
  DROP_TABLE: 'MODIFICATION',
  DROP_VIEW: 'MODIFICATION',
  DROP_TRIGGER: 'MODIFICATION',
  DROP_FUNCTION: 'MODIFICATION',
  DROP_INDEX: 'MODIFICATION',
  DROP_PROCEDURE: 'MODIFICATION',
  ALTER_DATABASE: 'MODIFICATION',
  ALTER_SCHEMA: 'MODIFICATION',
  ALTER_TABLE: 'MODIFICATION',
  ALTER_VIEW: 'MODIFICATION',
  ALTER_TRIGGER: 'MODIFICATION',
  ALTER_FUNCTION: 'MODIFICATION',
  ALTER_INDEX: 'MODIFICATION',
  ALTER_PROCEDURE: 'MODIFICATION',
  BEGIN_TRANSACTION: 'TRANSACTION',
  COMMIT: 'TRANSACTION',
  ROLLBACK: 'TRANSACTION',
  UNKNOWN: 'UNKNOWN',
  ANON_BLOCK: 'ANON_BLOCK',
  DELIMITER: 'NO_OP',
};

const statementsWithEnds = [
  'CREATE_TRIGGER',
  'CREATE_FUNCTION',
  'CREATE_PROCEDURE',
  'ANON_BLOCK',
  'UNKNOWN',
];

const blockOpeners: Record<Dialect, string[]> = {
  generic: ['BEGIN', 'CASE'],
  psql: ['BEGIN', 'CASE', 'LOOP', 'IF'],
  mysql: ['BEGIN', 'CASE', 'LOOP', 'IF'],
  mssql: ['BEGIN', 'CASE'],
  sqlite: ['BEGIN', 'CASE'],
  oracle: ['DECLARE', 'BEGIN', 'CASE'],
  bigquery: ['BEGIN', 'CASE', 'IF', 'LOOP', 'REPEAT', 'WHILE', 'FOR'],
};

interface ParseOptions {
  isStrict: boolean;
  dialect: Dialect;
  identifyTables: boolean;
  identifyColumns: boolean;
}

function createInitialStatement(): Statement {
  return {
    start: -1,
    end: 0,
    parameters: [],
    tables: [],
    columns: [],
  };
}

function nextNonWhitespaceToken(state: State, dialect: Dialect, delimiter: string): Token {
  let token: Token;
  do {
    state = initState({ prevState: state });
    token = scanToken(state, dialect, undefined, delimiter);
  } while (token.type === 'whitespace');
  return token;
}

/**
 * Parser
 */
export function parse(
  input: string,
  isStrict = true,
  dialect: Dialect = 'generic',
  identifyTables = false,
  identifyColumns = false,
  paramTypes?: ParamTypes,
): ParseResult {
  const topLevelState = initState({ input });
  const topLevelStatement: ParseResult = {
    type: 'QUERY',
    start: 0,
    end: input.length - 1,
    body: [],
    tokens: [],
  };

  let prevState: State = topLevelState;
  let statementParser: StatementParser | null = null;
  let currentDelimiter = ';';
  const cteState: {
    isCte: boolean;
    asSeen: boolean;
    statementEnd: boolean;
    parens: 0;
    state: State;
    params: Array<string>;
  } = {
    isCte: false,
    asSeen: false,
    statementEnd: false,
    parens: 0,
    state: topLevelState,
    params: [],
  };

  const ignoreOutsideBlankTokens = ['whitespace', 'comment-inline', 'comment-block', 'delimiter'];

  while (prevState.position < topLevelState.end) {
    const tokenState = initState({ prevState });
    const token = scanToken(tokenState, dialect, paramTypes, currentDelimiter);
    const nextToken = nextNonWhitespaceToken(tokenState, dialect, currentDelimiter);

    if (!statementParser) {
      // ignore blank tokens before the start of a CTE / not part of a statement
      if (!cteState.isCte && ignoreOutsideBlankTokens.includes(token.type)) {
        topLevelStatement.tokens.push(token);
        prevState = tokenState;
      } else if (
        !cteState.isCte &&
        token.type === 'keyword' &&
        token.value.toUpperCase() === 'WITH'
      ) {
        cteState.isCte = true;
        topLevelStatement.tokens.push(token);
        cteState.state = tokenState;
        prevState = tokenState;

        // If we're scanning in a CTE, handle someone putting a semicolon anywhere (after 'with',
        // after semicolon, etc.) along it to "early terminate".
      } else if (cteState.isCte && token.type === 'delimiter') {
        topLevelStatement.tokens.push(token);
        prevState = tokenState;
        topLevelStatement.body.push({
          start: cteState.state.start,
          end: token.end,
          type: 'UNKNOWN',
          executionType: 'UNKNOWN',
          endStatement: token.value,
          parameters: [],
          tables: [],
          columns: [],
        });
        cteState.isCte = false;
        cteState.asSeen = false;
        cteState.statementEnd = false;
        cteState.parens = 0;
      } else if (cteState.isCte && !cteState.statementEnd) {
        if (cteState.asSeen) {
          if (token.value === '(') {
            cteState.parens++;
          } else if (token.value === ')') {
            cteState.parens--;
            if (cteState.parens === 0) {
              cteState.statementEnd = true;
            }
          }
        } else if (token.value.toUpperCase() === 'AS') {
          cteState.asSeen = true;
        }

        topLevelStatement.tokens.push(token);
        prevState = tokenState;
      } else if (cteState.isCte && cteState.statementEnd && token.value === ',') {
        cteState.asSeen = false;
        cteState.statementEnd = false;

        topLevelStatement.tokens.push(token);
        prevState = tokenState;

        // Ignore blank tokens after the end of the CTE till start of statement
      } else if (
        cteState.isCte &&
        cteState.statementEnd &&
        ignoreOutsideBlankTokens.includes(token.type)
      ) {
        topLevelStatement.tokens.push(token);
        prevState = tokenState;
      } else if (
        !cteState.isCte &&
        dialect === 'mysql' &&
        token.type === 'keyword' &&
        token.value.toUpperCase() === 'DELIMITER'
      ) {
        // Handle DELIMITER entirely by raw-scanning the input from the
        // keyword onwards. If we let this go through the token-based
        // statement parser, a malformed argument like `DELIMITER '` would
        // be tokenised as a string spanning the rest of the file, which
        // would hide every subsequent statement. Raw scanning is also what
        // mysql-shell does: arguments are whitespace-delimited; the rest
        // of the line is consumed as part of the directive.
        topLevelStatement.tokens.push(token);
        const lineResult = parseDelimiterLine(input, token, currentDelimiter, isStrict);
        topLevelStatement.body.push(lineResult.statement as ConcreteStatement);
        if (lineResult.statement.newDelimiter) {
          currentDelimiter = lineResult.statement.newDelimiter;
        }
        // Advance prevState to the character before the next scan position
        // (first char after the consumed DELIMITER line).
        prevState = {
          input,
          position: lineResult.consumedTo,
          start: lineResult.consumedTo,
          end: input.length - 1,
        };
      } else {
        statementParser = createStatementParserByToken(token, nextToken, {
          isStrict,
          dialect,
          identifyTables,
          identifyColumns,
        });
        if (cteState.isCte) {
          statementParser.getStatement().start = cteState.state.start;
          statementParser.getStatement().isCte = true;
          statementParser.getStatement().parameters.push(...cteState.params);
          cteState.params = [];
          cteState.isCte = false;
          cteState.asSeen = false;
          cteState.statementEnd = false;
        }
      }

      if (cteState.isCte && token.type === 'parameter') {
        cteState.params.push(token.value);
      }
    } else {
      statementParser.addToken(token, nextToken);
      topLevelStatement.tokens.push(token);
      prevState = tokenState;

      const statement = statementParser.getStatement();
      if (statement.endStatement) {
        statementParser.flush();
        if (statement.type !== 'DELIMITER') {
          // DELIMITER sets its own `end` to the last delimiter-value char
          // (end-of-line is not included in the statement text).
          statement.end = token.end;
        }
        topLevelStatement.body.push(statement as ConcreteStatement);
        if (statement.type === 'DELIMITER' && statement.newDelimiter) {
          currentDelimiter = statement.newDelimiter;
        }
        statementParser = null;
      }
    }
  }

  // last statement without ending key
  if (statementParser) {
    statementParser.flush();
    const statement = statementParser.getStatement();
    if (!statement.endStatement) {
      if (statement.type !== 'DELIMITER' || !statement.end) {
        // DELIMITER parsers set `end` themselves to the last char of the
        // delimiter value; don't overwrite with trailing-whitespace EOF.
        statement.end = topLevelStatement.end;
      }
      topLevelStatement.body.push(statement as ConcreteStatement);
      if (statement.type === 'DELIMITER' && statement.newDelimiter) {
        currentDelimiter = statement.newDelimiter;
      }
    }
  }

  return topLevelStatement;
}

function initState({ input, prevState }: { input?: string; prevState?: State }): State {
  if (prevState) {
    return {
      input: prevState.input,
      position: prevState.position,
      start: prevState.position + 1,
      end: prevState.input.length - 1,
    };
  } else if (input === undefined) {
    throw new Error('You must define either input or prevState');
  }

  return {
    input,
    position: -1,
    start: 0,
    end: input.length - 1,
  };
}

function createStatementParserByToken(
  token: Token,
  nextToken: Token,
  options: ParseOptions,
): StatementParser {
  if (token.type === 'keyword') {
    switch (token.value.toUpperCase()) {
      case 'SELECT':
        return createSelectStatementParser(options);
      case 'CREATE':
        return createCreateStatementParser(options);
      case 'SHOW':
        if (['mysql', 'generic'].includes(options.dialect)) {
          return createShowStatementParser(options);
        }
        break;
      case 'DROP':
        return createDropStatementParser(options);
      case 'ALTER':
        return createAlterStatementParser(options);
      case 'INSERT':
        return createInsertStatementParser(options);
      case 'UPDATE':
        return createUpdateStatementParser(options);
      case 'DELETE':
        return createDeleteStatementParser(options);
      case 'TRUNCATE':
        return createTruncateStatementParser(options);
      case 'BEGIN':
        if (['bigquery', 'oracle'].includes(options.dialect) && nextToken.value !== 'TRANSACTION') {
          return createBlockStatementParser(options);
        }
        return createBeginTransactionStatementParser(options);
      case 'START':
        if (nextToken.value === 'TRANSACTION') {
          return createBeginTransactionStatementParser(options);
        }
        break;
      case 'COMMIT':
        return createCommitStatementParser(options);
      case 'ROLLBACK':
        return createRollbackStatementParser(options);
      case 'DECLARE':
        if (options.dialect === 'oracle') {
          return createBlockStatementParser(options);
        }
        break;
      // DELIMITER is intercepted inline in parse() for the mysql dialect,
      // so we never reach a `case 'DELIMITER'` here for that dialect.
      default:
        break;
    }
  }

  if (!options.isStrict) {
    return createUnknownStatementParser(options);
  }

  throw new Error(`Invalid statement parser "${token.value}"`);
}

function createSelectStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();

  const steps: Step[] = [
    // Select
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [{ type: 'keyword', value: 'SELECT' }],
      },
      add: (token) => {
        statement.type = 'SELECT';
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

function createBlockStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();
  statement.type = 'ANON_BLOCK';

  const steps: Step[] = [
    // Select
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [
          ...(options.dialect === 'oracle' ? [{ type: 'keyword', value: 'DECLARE' }] : []),
          { type: 'keyword', value: 'BEGIN' },
        ],
      },
      add: (token) => {
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

function createInsertStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();

  const steps: Step[] = [
    // Insert
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [{ type: 'keyword', value: 'INSERT' }],
      },
      add: (token) => {
        statement.type = 'INSERT';
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

function createUpdateStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();

  const steps: Step[] = [
    // Update
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [{ type: 'keyword', value: 'UPDATE' }],
      },
      add: (token) => {
        statement.type = 'UPDATE';
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

function createDeleteStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();

  const steps: Step[] = [
    // Delete
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [{ type: 'keyword', value: 'DELETE' }],
      },
      add: (token) => {
        statement.type = 'DELETE';
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

function createCreateStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();

  const steps: Step[] = [
    // Create
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [{ type: 'keyword', value: 'CREATE' }],
      },
      add: (token) => {
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
    // Table/Database
    {
      preCanGoToNext: () => false,
      validation: {
        requireBefore: ['whitespace'],
        acceptTokens: [
          ...(options.dialect !== 'sqlite'
            ? [
                { type: 'keyword', value: 'DATABASE' },
                { type: 'keyword', value: 'SCHEMA' },
                { type: 'keyword', value: 'PROCEDURE' },
              ]
            : []),
          { type: 'keyword', value: 'TABLE' },
          { type: 'keyword', value: 'VIEW' },
          { type: 'keyword', value: 'TRIGGER' },
          { type: 'keyword', value: 'FUNCTION' },
          { type: 'keyword', value: 'INDEX' },
        ],
      },
      add: (token) => {
        statement.type = `CREATE_${token.value.toUpperCase()}` as StatementType;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

function createDropStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();

  const steps: Step[] = [
    // Drop
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [{ type: 'keyword', value: 'DROP' }],
      },
      add: (token) => {
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
    // Table/Database
    {
      preCanGoToNext: () => false,
      validation: {
        requireBefore: ['whitespace'],
        acceptTokens: [
          ...(options.dialect !== 'sqlite'
            ? [
                { type: 'keyword', value: 'DATABASE' },
                { type: 'keyword', value: 'SCHEMA' },
                { type: 'keyword', value: 'PROCEDURE' },
              ]
            : []),
          { type: 'keyword', value: 'TABLE' },
          { type: 'keyword', value: 'VIEW' },
          { type: 'keyword', value: 'TRIGGER' },
          { type: 'keyword', value: 'FUNCTION' },
          { type: 'keyword', value: 'INDEX' },
        ],
      },
      add: (token) => {
        statement.type = `DROP_${token.value.toUpperCase()}` as StatementType;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

function createAlterStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();

  const steps: Step[] = [
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [{ type: 'keyword', value: 'ALTER' }],
      },
      add: (token) => {
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
    {
      preCanGoToNext: () => false,
      validation: {
        requireBefore: ['whitespace'],
        acceptTokens: [
          ...(options.dialect !== 'sqlite'
            ? [
                { type: 'keyword', value: 'DATABASE' },
                { type: 'keyword', value: 'SCHEMA' },
                { type: 'keyword', value: 'TRIGGER' },
                { type: 'keyword', value: 'FUNCTION' },
                { type: 'keyword', value: 'INDEX' },
                ...(options.dialect !== 'bigquery'
                  ? [{ type: 'keyword', value: 'PROCEDURE' }]
                  : []),
              ]
            : []),
          { type: 'keyword', value: 'TABLE' },
          { type: 'keyword', value: 'VIEW' },
        ],
      },
      add: (token) => {
        statement.type = `ALTER_${token.value.toUpperCase()}` as StatementType;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

function createTruncateStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();

  const steps: Step[] = [
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [{ type: 'keyword', value: 'TRUNCATE' }],
      },
      add: (token) => {
        statement.type = 'TRUNCATE';
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

function createShowStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();

  const steps: Step[] = [
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [{ type: 'keyword', value: 'SHOW' }],
      },
      add: (token) => {
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
    // Database/Table/Columns/...
    {
      preCanGoToNext: () => false,
      validation: {
        requireBefore: ['whitespace'],
        acceptTokens: [
          { type: 'keyword', value: 'DATABASES' },
          { type: 'keyword', value: 'DATABASE' },
          { type: 'keyword', value: 'KEYS' },
          { type: 'keyword', value: 'INDEX' },
          { type: 'keyword', value: 'COLUMNS' },
          { type: 'keyword', value: 'TABLES' },
          { type: 'keyword', value: 'TABLE' },
          { type: 'keyword', value: 'BINARY' },
          { type: 'keyword', value: 'BINLOG' },
          { type: 'keyword', value: 'CHARACTER' },
          { type: 'keyword', value: 'COLLATION' },
          { type: 'keyword', value: 'CREATE' },
          { type: 'keyword', value: 'ENGINE' },
          { type: 'keyword', value: 'ENGINES' },
          { type: 'keyword', value: 'ERRORS' },
          { type: 'keyword', value: 'EVENTS' },
          { type: 'keyword', value: 'FUNCTION' },
          { type: 'keyword', value: 'GRANTS' },
          { type: 'keyword', value: 'MASTER' },
          { type: 'keyword', value: 'OPEN' },
          { type: 'keyword', value: 'PLUGINS' },
          { type: 'keyword', value: 'PRIVILEGES' },
          { type: 'keyword', value: 'PROCEDURE' },
          { type: 'keyword', value: 'PROCESSLIST' },
          { type: 'keyword', value: 'PROFILE' },
          { type: 'keyword', value: 'PROFILES' },
          { type: 'keyword', value: 'RELAYLOG' },
          { type: 'keyword', value: 'REPLICAS' },
          { type: 'keyword', value: 'REPLICA' },
          { type: 'keyword', value: 'SLAVE' },
          { type: 'keyword', value: 'STATUS' },
          { type: 'keyword', value: 'TRIGGERS' },
          { type: 'keyword', value: 'VARIABLES' },
          { type: 'keyword', value: 'WARNINGS' },
        ],
      },
      add: (token) => {
        statement.type = `SHOW_${token.value.toUpperCase().replace(' ', '_')}` as StatementType;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

function createBeginTransactionStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();

  const steps: Step[] = [
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [
          { type: 'keyword', value: 'BEGIN' },
          { type: 'keyword', value: 'START' },
        ],
      },
      add: (token) => {
        statement.type = 'BEGIN_TRANSACTION';
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

function createCommitStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();

  const steps: Step[] = [
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [{ type: 'keyword', value: 'COMMIT' }],
      },
      add: (token) => {
        statement.type = 'COMMIT';
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

function createRollbackStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();

  const steps: Step[] = [
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [{ type: 'keyword', value: 'ROLLBACK' }],
      },
      add: (token) => {
        statement.type = 'ROLLBACK';
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

/**
 * Validate a candidate DELIMITER value. Matches mysql-shell's explicit
 * rejections (empty, backslash) and additionally rejects characters that
 * would break our tokenizer if used as a delimiter:
 *
 * - `'` `"` `` ` ``  — collide with string / quoted-identifier scanning
 * - `--` `#`         — collide with inline comment scanning
 * - `/` `*`          — collide with block-comment scanning (`/*`, `*\/`)
 *
 * mysql-shell itself accepts these characters but they wreck subsequent
 * parsing, so we're stricter on purpose. Returns `null` on success or an
 * error message string on rejection.
 */
function validateDelimiterValue(raw: string): string | null {
  if (raw.length === 0) {
    return "DELIMITER must be followed by a 'delimiter' character or string";
  }
  if (raw.includes('\\')) {
    return 'DELIMITER cannot contain a backslash character';
  }
  if (/['"`]/.test(raw)) {
    return 'DELIMITER cannot contain quote characters (\', ", `)';
  }
  if (/#/.test(raw) || raw.includes('--')) {
    return 'DELIMITER cannot contain SQL comment markers (--, #)';
  }
  if (raw.includes('/') || raw.includes('*')) {
    return 'DELIMITER cannot contain block-comment characters (/, *)';
  }
  return null;
}

/**
 * Raw-scan the DELIMITER line starting from the keyword token. Consumes
 * characters up to the first newline (or EOF). Returns the built statement
 * along with the input position the main parse loop should resume from.
 *
 * Bypassing the tokenizer here is deliberate: a bad argument like
 * `DELIMITER '` would otherwise tokenise as an unterminated string spanning
 * the rest of the file, hiding every subsequent statement. mysql-shell's
 * parser likewise lexes the delimiter argument as a single
 * whitespace-delimited word at the character level.
 */
function parseDelimiterLine(
  input: string,
  keywordToken: Token,
  currentDelimiter: string,
  isStrict: boolean,
): { statement: Statement; consumedTo: number } {
  // Skip spaces/tabs (but not newlines) after the keyword.
  let i = keywordToken.end + 1;
  while (i < input.length && (input[i] === ' ' || input[i] === '\t')) i++;
  const argStart = i;
  // Capture up to the first whitespace or EOF.
  while (i < input.length && !/\s/.test(input[i])) i++;
  const argEnd = i; // exclusive
  const raw = input.slice(argStart, argEnd);

  // `currentDelimiter` isn't used in the raw scan but is worth asserting on
  // so future callers don't pass it in erroneously; silence unused-var lint.
  void currentDelimiter;

  const statement: Statement = {
    start: keywordToken.start,
    end: argEnd > argStart ? argEnd - 1 : keywordToken.end,
    type: 'DELIMITER',
    executionType: 'NO_OP',
    parameters: [],
    tables: [],
    columns: [],
  };

  const error = validateDelimiterValue(raw);
  if (error) {
    if (isStrict) {
      throw new Error(error);
    }
    // Non-strict: emit the statement without `newDelimiter`. The main loop
    // will then NOT update currentDelimiter, matching mysql-shell's
    // behaviour of keeping the previous delimiter on a rejected argument.
  } else {
    statement.newDelimiter = raw;
  }

  // Consume through end-of-line so we resume from the next line.
  let consumedTo = argEnd;
  while (consumedTo < input.length && input[consumedTo] !== '\n') consumedTo++;
  // position should point at the last consumed char so that the main loop's
  // `prevState.position + 1` start picks up the next character.
  if (consumedTo < input.length) {
    // include the newline itself
    statement.endStatement = '\n';
  }
  return { statement, consumedTo };
}

function createUnknownStatementParser(options: ParseOptions) {
  const statement = createInitialStatement();

  const steps: Step[] = [
    {
      preCanGoToNext: () => false,
      add: (token) => {
        statement.type = 'UNKNOWN';
        if (statement.start < 0) {
          statement.start = token.start;
        }
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, options);
}

function stateMachineStatementParser(
  statement: Statement,
  steps: Step[],
  { isStrict, dialect, identifyTables, identifyColumns }: ParseOptions,
): StatementParser {
  let currentStepIndex = 0;
  let prevToken: Token | undefined;
  let prevNonWhitespaceToken: Token | undefined;

  let lastBlockOpener: Token | undefined;
  let anonBlockStarted = false;

  let openBlocks = 0;

  const columnParser = new ColumnParser(dialect);
  const tableParser = new TableParser();

  /* eslint arrow-body-style: 0, no-extra-parens: 0 */
  const isValidToken = (step: Step, token: Token) => {
    if (!step.validation) {
      return true;
    }

    return (
      step.validation.acceptTokens.filter((accept) => {
        const isValidType = token.type === accept.type;
        const isValidValue = !accept.value || token.value.toUpperCase() === accept.value;

        return isValidType && isValidValue;
      }).length > 0
    );
  };

  const setPrevToken = (token: Token) => {
    prevToken = token;
    if (token.type !== 'whitespace') {
      prevNonWhitespaceToken = token;
    }
  };

  return {
    getStatement() {
      return statement;
    },

    flush() {
      if (identifyTables) {
        const table = tableParser.flush();
        if (table) {
          statement.tables.push(table);
        }
      }
      if (identifyColumns) {
        const column = columnParser.flush();
        if (column) {
          statement.columns.push(column);
        }
      }
    },

    addToken(token: Token, nextToken: Token) {
      /* eslint no-param-reassign: 0 */
      if (statement.endStatement) {
        throw new Error('This statement has already got to the end.');
      }

      if (
        statement.type &&
        token.type === 'delimiter' &&
        (!statementsWithEnds.includes(statement.type) ||
          (openBlocks === 0 && (statement.type === 'UNKNOWN' || statement.canEnd)))
      ) {
        statement.endStatement = token.value;
        return;
      }

      if (openBlocks > 0 && token.value.toUpperCase() === 'END') {
        openBlocks--;
        if (openBlocks === 0) {
          statement.canEnd = true;
        }
        setPrevToken(token);
        return;
      }

      if (token.type === 'whitespace') {
        setPrevToken(token);
        return;
      }

      if (
        token.type === 'keyword' &&
        blockOpeners[dialect].includes(token.value.toUpperCase()) &&
        prevNonWhitespaceToken?.value.toUpperCase() !== 'END' &&
        (token.value.toUpperCase() !== 'BEGIN' ||
          (token.value.toUpperCase() === 'BEGIN' &&
            nextToken.value.toUpperCase() !== 'TRANSACTION' &&
            (dialect !== 'sqlite' ||
              (dialect === 'sqlite' &&
                !['DEFERRED', 'IMMEDIATE', 'EXCLUSIVE'].includes(nextToken.value.toUpperCase())))))
      ) {
        if (
          dialect === 'oracle' &&
          lastBlockOpener?.value === 'DECLARE' &&
          token.value.toUpperCase() === 'BEGIN'
        ) {
          // don't open a new block!
          setPrevToken(token);
          lastBlockOpener = token;
          return;
        }
        openBlocks++;
        lastBlockOpener = token;
        setPrevToken(token);
        if (statement.type === 'ANON_BLOCK' && !anonBlockStarted) {
          anonBlockStarted = true;
        } else if (statement.type) {
          return;
        }
      }

      if (identifyTables && !statement.isCte && statement.type?.match(/SELECT|INSERT/)) {
        const table = tableParser.processToken(token, nextToken);
        if (table) {
          statement.tables.push(table);
        }
      }

      if (identifyColumns && statement.type === 'SELECT' && !columnParser.shouldStop()) {
        const ref = columnParser.processToken(token, prevToken, prevNonWhitespaceToken);
        if (ref) {
          statement.columns.push(ref);
        }
      }

      if (
        token.type === 'parameter' &&
        (token.value === '?' || !statement.parameters.includes(token.value))
      ) {
        statement.parameters.push(token.value);
      }

      if (statement.type && statement.start >= 0) {
        // statement has already been identified
        // just wait until end of the statement
        setPrevToken(token);
        return;
      }

      // index modifiers
      if (
        token.value.toUpperCase() === 'UNIQUE' ||
        (dialect === 'mysql' && ['FULLTEXT', 'SPATIAL'].includes(token.value.toUpperCase())) ||
        (dialect === 'mssql' && ['CLUSTERED', 'NONCLUSTERED'].includes(token.value.toUpperCase()))
      ) {
        setPrevToken(token);
        return;
      }

      if (
        ['psql', 'mssql', 'bigquery'].includes(dialect) &&
        token.value.toUpperCase() === 'MATERIALIZED'
      ) {
        setPrevToken(token);
        return;
      }

      // technically these dialects don't allow "OR REPLACE" or "OR ALTER" between all statement
      // types, but we'll allow it for now.
      // For "ALTER", we need to make sure we only catch it here if it directly follows "OR", so
      // we don't catch it for "ALTER TABLE" statements
      if (
        dialect !== 'sqlite' &&
        (token.value.toUpperCase() === 'OR' ||
          (prevNonWhitespaceToken?.value.toUpperCase() === 'OR' &&
            token.value.toUpperCase() === (dialect === 'mssql' ? 'ALTER' : 'REPLACE')))
      ) {
        setPrevToken(token);
        return;
      }

      // Table/View modifiers
      if (
        (dialect === 'psql' && ['TEMP', 'TEMPORARY'].includes(token.value.toUpperCase())) ||
        (dialect === 'sqlite' &&
          ['TEMP', 'TEMPORARY', 'VIRTUAL'].includes(token.value.toUpperCase()))
      ) {
        setPrevToken(token);
        return;
      }

      // MySQL allows for setting a definer for a function which specifies who the function is executed as.
      // This clause is optional, and is defined between the "CREATE" and "FUNCTION" keywords for the statement.
      if (dialect === 'mysql' && token.value.toUpperCase() === 'DEFINER') {
        statement.definer = 0;
        setPrevToken(token);
        return;
      }

      if (statement.definer === 0 && token.value === '=') {
        statement.definer++;
        setPrevToken(token);
        return;
      }

      if (statement.definer !== undefined && statement.definer > 0) {
        if (statement.definer === 1 && prevToken?.type === 'whitespace') {
          statement.definer++;
          setPrevToken(token);
          return;
        }

        if (statement.definer > 1 && prevToken?.type !== 'whitespace') {
          setPrevToken(token);
          return;
        }

        delete statement.definer;
      }

      if (dialect === 'mysql' && token.value.toUpperCase() === 'ALGORITHM') {
        statement.algorithm = 0;
        setPrevToken(token);
        return;
      }

      if (statement.algorithm === 0 && token.value === '=') {
        statement.algorithm++;
        setPrevToken(token);
        return;
      }

      if (statement.algorithm !== undefined && statement.algorithm > 0) {
        if (statement.algorithm === 1 && prevToken?.type === 'whitespace') {
          statement.algorithm++;
          setPrevToken(token);
          return;
        }

        if (
          statement.algorithm > 1 &&
          prevToken &&
          ['UNDEFINED', 'MERGE', 'TEMPTABLE'].includes(prevToken.value.toUpperCase())
        ) {
          setPrevToken(token);
          return;
        }

        delete statement.algorithm;
      }

      if (dialect === 'mysql' && token.value.toUpperCase() === 'SQL') {
        statement.sqlSecurity = 0;
        setPrevToken(token);
        return;
      }

      if (statement.sqlSecurity !== undefined) {
        if (
          (statement.sqlSecurity === 0 && token.value.toUpperCase() === 'SECURITY') ||
          (statement.sqlSecurity === 1 &&
            ['DEFINER', 'INVOKER'].includes(token.value.toUpperCase()))
        ) {
          statement.sqlSecurity++;
          setPrevToken(token);
          return;
        } else if (statement.sqlSecurity === 2) {
          delete statement.sqlSecurity;
        }
      }

      let currentStep = steps[currentStepIndex];
      if (currentStep.preCanGoToNext(token)) {
        currentStepIndex++;
        currentStep = steps[currentStepIndex];
      }

      if (
        prevToken &&
        currentStep.validation &&
        currentStep.validation.requireBefore &&
        !currentStep.validation.requireBefore.includes(prevToken.type)
      ) {
        const requireds = currentStep.validation.requireBefore.join(' or ');
        throw new Error(
          `Expected any of these tokens ${requireds} before "${token.value}" (currentStep=${currentStepIndex}).`,
        );
      }

      if (!isValidToken(currentStep, token) && isStrict) {
        const expecteds = currentStep.validation
          ? currentStep.validation.acceptTokens
              .map((accept) => `(type="${accept.type}" value="${accept.value}")`)
              .join(' or ')
          : '()';
        throw new Error(
          `Expected any of these tokens ${expecteds} instead of type="${token.type}" value="${token.value}" (currentStep=${currentStepIndex}).`,
        );
      }

      currentStep.add(token);

      statement.executionType =
        statement.type && EXECUTION_TYPES[statement.type]
          ? EXECUTION_TYPES[statement.type]
          : 'UNKNOWN';

      if (currentStep.postCanGoToNext(token)) {
        currentStepIndex++;
      }

      setPrevToken(token);
    },
  };
}

export function defaultParamTypesFor(dialect: Dialect): ParamTypes {
  switch (dialect) {
    case 'psql':
      return {
        numbered: ['$'],
      };
    case 'mssql':
      return {
        named: [':'],
      };
    case 'bigquery':
      return {
        positional: true,
        named: ['@'],
        quoted: ['@'],
      };
    case 'sqlite':
      return {
        positional: true,
        numbered: ['?'],
        named: [':', '@'],
      };
    default:
      return {
        positional: true,
      };
  }
}
