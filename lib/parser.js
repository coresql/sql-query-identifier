'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parse = parse;

var _tokenizer = require('./tokenizer');

/**
 * Parser
 */
function parse(input) {
  var topLevelState = initState({ input: input });
  var topLevelStatement = {
    type: 'QUERY',
    start: 0,
    end: input.length - 1,
    body: [],
    tokens: []
  };

  var prevState = topLevelState;
  var statementParser = void 0;

  while (prevState.position < topLevelState.end) {
    var tokenState = initState({ prevState: prevState });
    var token = (0, _tokenizer.scanToken)(tokenState);

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

    var statement = statementParser.getStatement();
    if (statement.endStatement) {
      statement.end = token.end;
      topLevelStatement.body.push(statement);
      statementParser = null;
    }
  }

  // last statement without ending key
  if (statementParser) {
    var _statement = statementParser.getStatement();
    if (!_statement.endStatement) {
      _statement.end = topLevelStatement.end;
      topLevelStatement.body.push(_statement);
    }
  }

  return topLevelStatement;
}

function initState(_ref) {
  var input = _ref.input;
  var prevState = _ref.prevState;

  if (prevState) {
    return {
      input: prevState.input,
      position: prevState.position,
      start: prevState.position + 1,
      end: prevState.input.length - 1,
      body: []
    };
  }

  return {
    input: input,
    position: -1,
    start: 0,
    end: input.length - 1,
    body: []
  };
}

function createStatementParserByToken(token) {
  if (token.type === 'keyword') {
    switch (token.value.toUpperCase()) {
      case 'SELECT':
        return createSelectStatementParser();
      case 'CREATE':
        return createCreateStatementParser();
      case 'DROP':
        return createDropStatementParser();
      case 'INSERT':
        return createInsertStatementParser();
      case 'UPDATE':
        return createUpdateStatementParser();
      case 'DELETE':
        return createDeleteStatementParser();
      case 'TRUNCATE':
        return createTruncateStatementParser();
      default:
        break;
    }
  }

  throw new Error('Invalid statement parser "' + token.value + '"');
}

function createSelectStatementParser() {
  var statement = {};

  var steps = [
  // Select
  {
    preCanGoToNext: function preCanGoToNext() {
      return false;
    },
    validation: {
      acceptTokens: [{ type: 'keyword', value: 'SELECT' }]
    },
    add: function add(token) {
      statement.type = 'SELECT';
      statement.start = token.start;
    },
    postCanGoToNext: function postCanGoToNext() {
      return true;
    }
  }];

  return stateMachineStatementParser(statement, steps);
}

function createInsertStatementParser() {
  var statement = {};

  var steps = [
  // Insert
  {
    preCanGoToNext: function preCanGoToNext() {
      return false;
    },
    validation: {
      acceptTokens: [{ type: 'keyword', value: 'INSERT' }]
    },
    add: function add(token) {
      statement.type = 'INSERT';
      statement.start = token.start;
    },
    postCanGoToNext: function postCanGoToNext() {
      return true;
    }
  }];

  return stateMachineStatementParser(statement, steps);
}

function createUpdateStatementParser() {
  var statement = {};

  var steps = [
  // Update
  {
    preCanGoToNext: function preCanGoToNext() {
      return false;
    },
    validation: {
      acceptTokens: [{ type: 'keyword', value: 'UPDATE' }]
    },
    add: function add(token) {
      statement.type = 'UPDATE';
      statement.start = token.start;
    },
    postCanGoToNext: function postCanGoToNext() {
      return true;
    }
  }];

  return stateMachineStatementParser(statement, steps);
}

function createDeleteStatementParser() {
  var statement = {};

  var steps = [
  // Delete
  {
    preCanGoToNext: function preCanGoToNext() {
      return false;
    },
    validation: {
      acceptTokens: [{ type: 'keyword', value: 'DELETE' }]
    },
    add: function add(token) {
      statement.type = 'DELETE';
      statement.start = token.start;
    },
    postCanGoToNext: function postCanGoToNext() {
      return true;
    }
  }];

  return stateMachineStatementParser(statement, steps);
}

function createCreateStatementParser() {
  var statement = {};

  var steps = [
  // Create
  {
    preCanGoToNext: function preCanGoToNext() {
      return false;
    },
    validation: {
      acceptTokens: [{ type: 'keyword', value: 'CREATE' }]
    },
    add: function add(token) {
      statement.start = token.start;
    },
    postCanGoToNext: function postCanGoToNext() {
      return true;
    }
  },
  // Table/Database
  {
    preCanGoToNext: function preCanGoToNext() {
      return false;
    },
    validation: {
      requireBefore: ['whitespace'],
      acceptTokens: [{ type: 'keyword', value: 'TABLE' }, { type: 'keyword', value: 'DATABASE' }]
    },
    add: function add(token) {
      statement.type = 'CREATE_' + token.value.toUpperCase();
    },
    postCanGoToNext: function postCanGoToNext() {
      return true;
    }
  }];

  return stateMachineStatementParser(statement, steps);
}

function createDropStatementParser() {
  var statement = {};

  var steps = [
  // Drop
  {
    preCanGoToNext: function preCanGoToNext() {
      return false;
    },
    validation: {
      acceptTokens: [{ type: 'keyword', value: 'DROP' }]
    },
    add: function add(token) {
      statement.start = token.start;
    },
    postCanGoToNext: function postCanGoToNext() {
      return true;
    }
  },
  // Table/Database
  {
    preCanGoToNext: function preCanGoToNext() {
      return false;
    },
    validation: {
      requireBefore: ['whitespace'],
      acceptTokens: [{ type: 'keyword', value: 'TABLE' }, { type: 'keyword', value: 'DATABASE' }]
    },
    add: function add(token) {
      statement.type = 'DROP_' + token.value.toUpperCase();
    },
    postCanGoToNext: function postCanGoToNext() {
      return true;
    }
  }];

  return stateMachineStatementParser(statement, steps);
}

function createTruncateStatementParser() {
  var statement = {};

  var steps = [{
    preCanGoToNext: function preCanGoToNext() {
      return false;
    },
    validation: {
      acceptTokens: [{ type: 'keyword', value: 'TRUNCATE' }]
    },
    add: function add(token) {
      statement.type = 'TRUNCATE';
      statement.start = token.start;
    },
    postCanGoToNext: function postCanGoToNext() {
      return true;
    }
  }];

  return stateMachineStatementParser(statement, steps);
}

function stateMachineStatementParser(statement, steps) {
  var currentStepIndex = 0;
  var prevToken = void 0;

  /* eslint arrow-body-style: 0, no-extra-parens: 0 */
  var isValidToken = function isValidToken(step, token) {
    return step.validation.acceptTokens.filter(function (accept) {
      var isValidType = token.type === accept.type;
      var isValidValue = !accept.value || token.value.toUpperCase() === accept.value;

      return isValidType && isValidValue;
    }).length > 0;
  };

  var hasRequiredBefore = function hasRequiredBefore(step) {
    return !step.requireBefore || ~step.requireBefore.indexOf(prevToken.type);
  };

  return {
    getStatement: function getStatement() {
      return statement;
    },
    addToken: function addToken(token) {
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

      var currentStep = steps[currentStepIndex];
      if (currentStep.preCanGoToNext(token)) {
        currentStepIndex++;
        currentStep = steps[currentStepIndex];
      }

      if (!hasRequiredBefore(currentStep)) {
        var requireds = currentStep.requireBefore.join(' or ');
        throw new Error('Expected any of these tokens ' + requireds + ' before "' + token.value + '" (currentStep=' + currentStepIndex + ').');
      }

      if (!isValidToken(currentStep, token)) {
        var expecteds = currentStep.validation.acceptTokens.map(function (accept) {
          return '(type="' + accept.type + '" value="' + accept.value + '")';
        }).join(' or ');
        throw new Error('Expected any of these tokens ' + expecteds + ' instead of type="' + token.type + '" value="' + token.value + '" (currentStep=' + currentStepIndex + ').');
      }

      currentStep.add(token);

      if (currentStep.postCanGoToNext(token)) {
        currentStepIndex++;
      }

      prevToken = token;
    }
  };
}