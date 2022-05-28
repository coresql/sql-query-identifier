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
} from './defines';

interface StatementParser {
  addToken: (token: Token) => void;
  getStatement: () => Statement;
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
  DROP_DATABASE: 'MODIFICATION',
  DROP_SCHEMA: 'MODIFICATION',
  DROP_TABLE: 'MODIFICATION',
  DROP_VIEW: 'MODIFICATION',
  DROP_TRIGGER: 'MODIFICATION',
  DROP_FUNCTION: 'MODIFICATION',
  DROP_INDEX: 'MODIFICATION',
  ALTER_DATABASE: 'MODIFICATION',
  ALTER_SCHEMA: 'MODIFICATION',
  ALTER_TABLE: 'MODIFICATION',
  ALTER_VIEW: 'MODIFICATION',
  ALTER_TRIGGER: 'MODIFICATION',
  ALTER_FUNCTION: 'MODIFICATION',
  ALTER_INDEX: 'MODIFICATION',
  ANON_BLOCK: 'UNKNOWN',
  UNKNOWN: 'UNKNOWN',
};

const genericStatementsWithEnds = ['CREATE_TRIGGER', 'CREATE_FUNCTION'];

const dialectStatementsWithEnds: any = {
  oracle: ['ANON_BLOCK'],
};

function statementsWithEnds(dialect: Dialect) {
  const dialectS = dialectStatementsWithEnds[dialect] || [];
  return [...genericStatementsWithEnds, ...dialectS];
}

const blockOpeners: Record<Dialect, string[]> = {
  generic: ['BEGIN', 'CASE'],
  psql: ['BEGIN', 'CASE', 'LOOP', 'IF'],
  mysql: ['BEGIN', 'CASE', 'LOOP', 'IF'],
  mssql: ['BEGIN', 'CASE'],
  sqlite: ['BEGIN', 'CASE'],
  oracle: ['BEGIN', 'CASE', 'IF', 'DECLARE'],
};


interface ParseOptions {
  isStrict: boolean;
  dialect: Dialect;
}

function createInitialStatement(): Statement {
  return {
    start: -1,
    end: 0,
    parameters: [],
  };
}

/**
 * Parser
 */
export function parse(input: string, isStrict = true, dialect: Dialect = 'generic'): ParseResult {
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
  const cteState: {
    isCte: boolean;
    asSeen: boolean;
    statementEnd: boolean;
    parens: 0;
    state: State;
  } = {
    isCte: false,
    asSeen: false,
    statementEnd: false,
    parens: 0,
    state: topLevelState,
  };

  const ignoreOutsideBlankTokens = ['whitespace', 'comment-inline', 'comment-block', 'semicolon'];

  while (prevState.position < topLevelState.end) {
    const tokenState = initState({ prevState });
    const token = scanToken(tokenState, dialect);

    if (!statementParser) {
      // ignore blank tokens before the start of a CTE / not part of a statement
      if (!cteState.isCte && ignoreOutsideBlankTokens.includes(token.type)) {
        topLevelStatement.tokens.push(token);
        prevState = tokenState;
        continue;
      } else if (
        !cteState.isCte &&
        token.type === 'keyword' &&
        token.value.toUpperCase() === 'WITH'
      ) {
        cteState.isCte = true;
        topLevelStatement.tokens.push(token);
        cteState.state = tokenState;
        prevState = tokenState;
        continue;
        // If we're scanning in a CTE, handle someone putting a semicolon anywhere (after 'with',
        // after semicolon, etc.) along it to "early terminate".
      } else if (cteState.isCte && token.type === 'semicolon') {
        topLevelStatement.tokens.push(token);
        prevState = tokenState;
        topLevelStatement.body.push({
          start: cteState.state.start,
          end: token.end,
          type: 'UNKNOWN',
          executionType: 'UNKNOWN',
          parameters: [],
        });
        cteState.isCte = false;
        cteState.asSeen = false;
        cteState.statementEnd = false;
        cteState.parens = 0;
        continue;
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
        continue;
      } else if (cteState.isCte && cteState.statementEnd && token.value === ',') {
        cteState.asSeen = false;
        cteState.statementEnd = false;

        topLevelStatement.tokens.push(token);
        prevState = tokenState;
        continue;
        // Ignore blank tokens after the end of the CTE till start of statement
      } else if (
        cteState.isCte &&
        cteState.statementEnd &&
        ignoreOutsideBlankTokens.includes(token.type)
      ) {
        topLevelStatement.tokens.push(token);
        prevState = tokenState;
        continue;
      }

      statementParser = createStatementParserByToken(token, { isStrict, dialect });
      if (cteState.isCte) {
        statementParser.getStatement().start = cteState.state.start;
        cteState.isCte = false;
        cteState.asSeen = false;
        cteState.statementEnd = false;
      }
    }

    statementParser.addToken(token);
    topLevelStatement.tokens.push(token);
    prevState = tokenState;

    const statement = statementParser.getStatement();
    if (statement.endStatement) {
      statement.end = token.end;
      topLevelStatement.body.push(statement as ConcreteStatement);
      statementParser = null;
    }
  }

  // last statement without ending key
  if (statementParser) {
    const statement = statementParser.getStatement();
    if (!statement.endStatement) {
      statement.end = topLevelStatement.end;
      topLevelStatement.body.push(statement as ConcreteStatement);
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

function createStatementParserByToken(token: Token, options: ParseOptions): StatementParser {
  if (token.type === 'keyword') {
    switch (token.value.toUpperCase()) {
      case 'SELECT':
        return createSelectStatementParser(options);
      case 'CREATE':
        return createCreateStatementParser(options);
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
      // lovely oracle, yum yum
      case 'BEGIN':
      case 'DECLARE':
        return createBlockStatementParser(options);
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
  statement.type = 'ANON_BLOCK'
  // ...start will always be 0? I guess not if there's whitespace...
  // but probably fine for now.
  statement.start = 0;
  const steps: Step[] = [
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [{ type: 'keyword', value: 'BEGIN' }, { type: 'keyword', value: 'DECLARE'}],
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
  { isStrict, dialect }: ParseOptions,
): StatementParser {
  let currentStepIndex = 0;
  let prevToken: Token;
  let prevPrevToken: Token;
  let lastBlockOpener: Token;
  let beginSkipped = false;

  let openBlocks = 0;

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
    prevPrevToken = prevToken;
    prevToken = token;
  };

  return {
    getStatement() {
      return statement;
    },

    addToken(token: Token) {
      console.log('addToken (start)', token)
      /* eslint no-param-reassign: 0 */
      if (statement.endStatement) {
        throw new Error('This statement has already got to the end.');
      }

      if (
        statement.type &&
        token.type === 'semicolon' &&
        (!statementsWithEnds(dialect).includes(statement.type) ||
          (openBlocks === 0 && statement.canEnd))
      ) {
        statement.endStatement = ';';
        return;
      }

      // BEGIN statements are weird as they behave differently to the other 'statementsWithEnds'
      // like create trigger and create function
      // because they use the shared block keyword BEGIN...
      // https://docs.oracle.com/cd/E17952_01/mysql-5.7-en/begin-end.html
      // they are technically 'compound statements', although we have no concept of nested
      // statements in this library.
      if (
        dialect === 'oracle' &&
        statementsWithEnds(dialect).includes(statement.type) &&
        token.value.toUpperCase() === 'END' && openBlocks == 0
      ) {
        statement.endStatement = 'END'
        return
      }

      // this should not count ANON_BLOCK statements as expression blocks
      // openBlock really refers to 'expression blocks' like CASE .... END
      // not statement blocks.
      if (token.value.toUpperCase() === 'END' && openBlocks > 0) {
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

      console.log('pre openblock check', token)
      if (
        token.type === 'keyword' &&
        blockOpeners[dialect].includes(token.value) &&
        prevPrevToken?.value.toUpperCase() !== 'END'
      ) {
        if (
          dialect === 'oracle' &&
          lastBlockOpener &&
          statement.startToken?.value.toUpperCase() !== 'DECLARE' &&
          token.value.toUpperCase() === 'BEGIN' &&
          beginSkipped === false
          ) {
          beginSkipped = true
          // skip
        } else {
          lastBlockOpener = token;
          openBlocks++;
          setPrevToken(token);
          return;
        }
      }

      console.log('post open block check')

      if (
        token.type === 'parameter' &&
        (token.value === '?' || !statement.parameters.includes(token.value))
      ) {
        statement.parameters.push(token.value);
      }

      if (statement.type && statement.start >= 0) {
        // statement has already been identified
        // just wait until end of the statement
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

      if (['psql', 'mssql'].includes(dialect) && token.value.toUpperCase() === 'MATERIALIZED') {
        setPrevToken(token);
        return;
      }

      // psql allows for optional "OR REPLACE" between "CREATE" and "FUNCTION"
      // mysql and psql allow it between "CREATE" and "VIEW"
      if (
        ['psql', 'mysql'].includes(dialect) &&
        ['OR', 'REPLACE'].includes(token.value.toUpperCase())
      ) {
        setPrevToken(token);
        return;
      }

      if (
        ['psql', 'sqlite'].includes(dialect) &&
        ['TEMP', 'TEMPORARY'].includes(token.value.toUpperCase())
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
        if (statement.definer === 1 && prevToken.type === 'whitespace') {
          statement.definer++;
          setPrevToken(token);
          return;
        }

        if (statement.definer > 1 && prevToken.type !== 'whitespace') {
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
        if (statement.algorithm === 1 && prevToken.type === 'whitespace') {
          statement.algorithm++;
          setPrevToken(token);
          return;
        }

        if (
          statement.algorithm > 1 &&
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
      } else {
        statement.startToken = token
      }

      console.log("ADDING TOKEN", token)

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
