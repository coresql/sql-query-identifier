import { scanToken } from './tokenizer';

/**
 * Execution types allow to know what is the query behavior
 *  - LISTING: is when the query list the data
 *  - MODIFICATION: is when the query modificate the database somehow (structure or data)
 *  - INFORMATION: is show some data information such as a profile data
 *  - UNKNOWN
 */
const EXECUTION_TYPES = {
  SELECT: 'LISTING',
  INSERT: 'MODIFICATION',
  DELETE: 'MODIFICATION',
  UPDATE: 'MODIFICATION',
  CREATE_DATABASE: 'MODIFICATION',
  CREATE_TABLE: 'MODIFICATION',
  CREATE_TRIGGER: 'MODIFICATION',
  CREATE_FUNCTION: 'MODIFICATION',
  DROP_DATABASE: 'MODIFICATION',
  DROP_TABLE: 'MODIFICATION',
  DROP_TRIGGER: 'MODIFICATION',
  TRUNCATE: 'MODIFICATION',
  UNKNOWN: 'UNKNOWN',
};

const statementsWithEnds = ['CREATE_TRIGGER', 'CREATE_FUNCTION'];
const blockOpeners = {
  generic: ['BEGIN', 'CASE'],
  psql: ['BEGIN', 'CASE', 'LOOP', 'IF'],
  mysql: ['BEGIN', 'CASE', 'LOOP', 'IF'],
  mssql: ['BEGIN', 'CASE'],
  sqlite: ['BEGIN', 'CASE'],
};

/**
 * Parser
 */
export function parse (input, isStrict = true, dialect = 'generic') {
  const topLevelState = initState({ input });
  const topLevelStatement = {
    type: 'QUERY',
    start: 0,
    end: input.length - 1,
    body: [],
    tokens: [],
  };

  let prevState = topLevelState;
  let statementParser;

  const ignoreOutsideBlankTokens = [
    'whitespace',
    'comment-inline',
    'comment-block',
  ];

  while (prevState.position < topLevelState.end) {
    const tokenState = initState({ prevState });
    const token = scanToken(tokenState);

    if (!statementParser) {
      // ignore blank tokens that are not in a statement
      if (ignoreOutsideBlankTokens.includes(token.type)) {
        topLevelStatement.tokens.push(token);
        prevState = tokenState;
        continue;
      }

      statementParser = createStatementParserByToken(token, { isStrict, dialect });
    }

    statementParser.addToken(token);
    topLevelStatement.tokens.push(token);
    prevState = tokenState;

    const statement = statementParser.getStatement();
    if (statement.endStatement) {
      statement.end = token.end;
      topLevelStatement.body.push(statement);
      statementParser = null;
    }
  }

  // last statement without ending key
  if (statementParser) {
    const statement = statementParser.getStatement();
    if (!statement.endStatement) {
      statement.end = topLevelStatement.end;
      topLevelStatement.body.push(statement);
    }
  }

  return topLevelStatement;
}

function initState ({ input, prevState }) {
  if (prevState) {
    return {
      input: prevState.input,
      position: prevState.position,
      start: prevState.position + 1,
      end: prevState.input.length - 1,
      body: [],
    };
  }

  return {
    input,
    position: -1,
    start: 0,
    end: input.length - 1,
    body: [],
  };
}

function createStatementParserByToken (token, options) {
  if (token.type === 'keyword') {
    switch (token.value.toUpperCase()) {
      case 'SELECT': return createSelectStatementParser(options);
      case 'CREATE': return createCreateStatementParser(options);
      case 'DROP': return createDropStatementParser(options);
      case 'INSERT': return createInsertStatementParser(options);
      case 'UPDATE': return createUpdateStatementParser(options);
      case 'DELETE': return createDeleteStatementParser(options);
      case 'TRUNCATE': return createTruncateStatementParser(options);
      default: break;
    }
  }

  if (!options.isStrict && token.type === 'unknown') {
    return createUnknownStatementParser(options.isStrict);
  }

  throw new Error(`Invalid statement parser "${token.value}"`);
}

function createSelectStatementParser ({ isStrict }) {
  const statement = {};

  const steps = [
    // Select
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [
          { type: 'keyword', value: 'SELECT' },
        ],
      },
      add: (token) => {
        statement.type = 'SELECT';
        statement.start = token.start;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, { isStrict });
}

function createInsertStatementParser ({ isStrict }) {
  const statement = {};

  const steps = [
    // Insert
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [
          { type: 'keyword', value: 'INSERT' },
        ],
      },
      add: (token) => {
        statement.type = 'INSERT';
        statement.start = token.start;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, { isStrict });
}

function createUpdateStatementParser ({ isStrict }) {
  const statement = {};

  const steps = [
    // Update
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [
          { type: 'keyword', value: 'UPDATE' },
        ],
      },
      add: (token) => {
        statement.type = 'UPDATE';
        statement.start = token.start;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, { isStrict });
}

function createDeleteStatementParser ({ isStrict }) {
  const statement = {};

  const steps = [
    // Delete
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [
          { type: 'keyword', value: 'DELETE' },
        ],
      },
      add: (token) => {
        statement.type = 'DELETE';
        statement.start = token.start;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, { isStrict });
}

function createCreateStatementParser ({ isStrict, dialect }) {
  const statement = {};

  const steps = [
    // Create
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [
          { type: 'keyword', value: 'CREATE' },
        ],
      },
      add: (token) => {
        statement.start = token.start;
      },
      postCanGoToNext: () => true,
    },
    // Table/Database
    {
      preCanGoToNext: () => false,
      validation: {
        requireBefore: ['whitespace'],
        acceptTokens: [
          { type: 'keyword', value: 'TABLE' },
          { type: 'keyword', value: 'DATABASE' },
          { type: 'keyword', value: 'TRIGGER' },
          { type: 'keyword', value: 'FUNCTION' },
        ],
      },
      add: (token) => {
        statement.type = `CREATE_${token.value.toUpperCase()}`;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, { isStrict, dialect });
}

function createDropStatementParser ({ isStrict }) {
  const statement = {};

  const steps = [
    // Drop
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [
          { type: 'keyword', value: 'DROP' },
        ],
      },
      add: (token) => {
        statement.start = token.start;
      },
      postCanGoToNext: () => true,
    },
    // Table/Database
    {
      preCanGoToNext: () => false,
      validation: {
        requireBefore: ['whitespace'],
        acceptTokens: [
          { type: 'keyword', value: 'TABLE' },
          { type: 'keyword', value: 'DATABASE' },
          { type: 'keyword', value: 'TRIGGER' },
        ],
      },
      add: (token) => {
        statement.type = `DROP_${token.value.toUpperCase()}`;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, { isStrict });
}

function createTruncateStatementParser ({ isStrict }) {
  const statement = {};

  const steps = [
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [
          { type: 'keyword', value: 'TRUNCATE' },
        ],
      },
      add: (token) => {
        statement.type = 'TRUNCATE';
        statement.start = token.start;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, { isStrict });
}

function createUnknownStatementParser ({ isStrict }) {
  const statement = {};

  const steps = [
    {
      preCanGoToNext: () => false,
      add: (token) => {
        statement.type = 'UNKNOWN';
        statement.start = token.start;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps, { isStrict });
}

function stateMachineStatementParser (statement, steps, { isStrict, dialect = 'generic' }) {
  let currentStepIndex = 0;
  let prevToken;
  let prevPrevToken;

  let openBlocks = 0;

  /* eslint arrow-body-style: 0, no-extra-parens: 0 */
  const isValidToken = (step, token) => {
    if (!step.validation) {
      return true;
    }

    return step
      .validation
      .acceptTokens.filter((accept) => {
        const isValidType = token.type === accept.type;
        const isValidValue = (
          !accept.value
          || token.value.toUpperCase() === accept.value
        );

        return isValidType && isValidValue;
      }).length > 0;
  };

  const hasRequiredBefore = (step) => {
    return (
      !step.requireBefore
      || step.requireBefore.includes(prevToken.type)
    );
  };

  const setPrevToken = (token) => {
    prevPrevToken = prevToken;
    prevToken = token;
  };

  return {
    getStatement () {
      return statement;
    },

    addToken (token) {
      /* eslint no-param-reassign: 0 */
      if (statement.endStatement) {
        throw new Error('This statement has already got to the end.');
      }

      if (
        token.type === 'semicolon'
        && (
          !statementsWithEnds.includes(statement.type)
          || (openBlocks === 0 && statement.canEnd)
        )
      ) {
        statement.endStatement = ';';
        return;
      }

      if (token.value.toUpperCase() === 'END') {
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

      // Postgres allows for optional "OR REPLACE" between "CREATE" and "FUNCTION", so we need to ignore
      // these tokens.
      if (dialect === 'psql' && ['OR', 'REPLACE'].includes(token.value.toUpperCase())) {
        return;
      }

      if (token.type === 'keyword' && blockOpeners[dialect].includes(token.value) && prevPrevToken.value !== 'END') {
        openBlocks++;
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

      if (statement.definer > 0) {
        if (statement.definer === 1 && prevToken.type === 'whitespace') {
          statement.definer++;
          setPrevToken(token);
          return;
        }

        if (statement.definer > 1 && prevToken.type !== 'whitespace') {
          setPrevToken(token);
          return;
        }

        statement.definer = false;
      }

      if (statement.type) {
        // statement has already been identified
        // just wait until end of the statement
        return;
      }

      let currentStep = steps[currentStepIndex];
      if (currentStep.preCanGoToNext(token)) {
        currentStepIndex++;
        currentStep = steps[currentStepIndex];
      }

      if (!hasRequiredBefore(currentStep)) {
        const requireds = currentStep.requireBefore.join(' or ');
        throw new Error(`Expected any of these tokens ${requireds} before "${token.value}" (currentStep=${currentStepIndex}).`);
      }

      if (!isValidToken(currentStep, token) && isStrict) {
        const expecteds = currentStep
          .validation
          .acceptTokens
          .map((accept) => `(type="${accept.type}" value="${accept.value}")`)
          .join(' or ');
        throw new Error(`Expected any of these tokens ${expecteds} instead of type="${token.type}" value="${token.value}" (currentStep=${currentStepIndex}).`);
      }

      currentStep.add(token);

      statement.executionType = EXECUTION_TYPES[statement.type] || 'UNKNOWN';

      if (currentStep.postCanGoToNext(token)) {
        currentStepIndex++;
      }

      setPrevToken(token);
    },
  };
}
