import { scanToken } from './tokenizer';


/**
 * Parser
 */
export function parse (input) {
  const topLevelState = initState({ input });
  const topLevelStatement = {
    type: 'Query',
    start: 0,
    end: input.length - 1,
    body: [],
    tokens: [],
  };

  let prevState = topLevelState;
  let statementParser;

  while (prevState.position < topLevelState.end) {
    const tokenState = initState({ prevState });
    const token = scanToken(tokenState);

    if (!statementParser) {
      // ignore white spaces between statements
      if (token.type === 'whitespace') {
        topLevelStatement.tokens.push(token);
        prevState = tokenState;
        continue;
      }

      statementParser = createStatementParserByToken(token);
    }

    statementParser.addToken(token);
    topLevelStatement.tokens.push(token);
    prevState = tokenState;

    const statement = statementParser.getStatement();
    if (statement.endStatement) {
      topLevelStatement.body.push(statement);
      statementParser = null;
    }
  }

  // last statement without ending key
  if (statementParser) {
    const statement = statementParser.getStatement();
    if (!statement.endStatement) {
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


function createStatementParserByToken (token) {
  if (token.type === 'keyword') {
    switch (token.value.toUpperCase()) {
      case 'SELECT': return createSelectStatementParser();
      case 'CREATE': return createCreateStatementParser();
      case 'DROP': return createDropStatementParser();
      case 'INSERT': return createInsertStatementParser();
      case 'UPDATE': return createUpdateStatementParser();
      case 'DELETE': return createDeleteStatementParser();
      case 'TRUNCATE': return createTruncateStatementParser();
      default: break;
    }
  }

  throw new Error(`Invalid statement parser "${token.value}"`);
}


function createSelectStatementParser () {
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
      add: () => {
        statement.type = 'Select';
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps);
}


function createInsertStatementParser () {
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
      add: () => {
        statement.type = 'Insert';
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps);
}


function createUpdateStatementParser () {
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
      add: () => {
        statement.type = 'Update';
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps);
}


function createDeleteStatementParser () {
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
      add: () => {
        statement.type = 'Delete';
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps);
}


function createCreateStatementParser () {
  const statement = {};
  const types = {
    TABLE: 'Table',
    DATABASE: 'Database',
  };

  const steps = [
    // Create
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [
          { type: 'keyword', value: 'CREATE' },
        ],
      },
      add: () => {},
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
        ],
      },
      add: (token) => {
        statement.type = `Create${types[token.value.toUpperCase()]}`;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps);
}


function createDropStatementParser () {
  const statement = {};
  const types = {
    TABLE: 'Table',
    DATABASE: 'Database',
  };

  const steps = [
    // Drop
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [
          { type: 'keyword', value: 'DROP' },
        ],
      },
      add: () => {},
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
        ],
      },
      add: (token) => {
        statement.type = `Drop${types[token.value.toUpperCase()]}`;
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps);
}


function createTruncateStatementParser () {
  const statement = {};

  const steps = [
    {
      preCanGoToNext: () => false,
      validation: {
        acceptTokens: [
          { type: 'keyword', value: 'TRUNCATE' },
        ],
      },
      add: () => {
        statement.type = 'Truncate';
      },
      postCanGoToNext: () => true,
    },
  ];

  return stateMachineStatementParser(statement, steps);
}


function stateMachineStatementParser (statement, steps) {
  let currentStepIndex = 0;
  let prevToken;

  /* eslint arrow-body-style: 0, no-extra-parens: 0 */
  const isValidToken = (step, token) => {
    return step
      .validation
      .acceptTokens.filter(accept => {
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
      || ~step.requireBefore.indexOf(prevToken.type)
    );
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

      if (token.type === 'semicolon') {
        statement.endStatement = ';';
        return;
      }

      if (token.type === 'whitespace') {
        prevToken = token;
        return;
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

      if (!isValidToken(currentStep, token)) {
        const expecteds = currentStep
          .validation
          .acceptTokens
          .map(accept => `(type="${accept.type}" value="${accept.value}")`)
          .join(' or ');
        throw new Error(`Expected any of these tokens ${expecteds} instead of type="${token.type}" value="${token.value}" (currentStep=${currentStepIndex}).`);
      }

      currentStep.add(token);

      if (currentStep.postCanGoToNext(token)) {
        currentStepIndex++;
      }

      prevToken = token;
    },
  };
}
