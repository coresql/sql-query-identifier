'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.scanToken = scanToken;
/**
 * Tokenizer
 */

/* eslint no-param-reassign: 0 */
var KEYWORDS = ['SELECT', 'INSERT', 'DELETE', 'UPDATE', 'CREATE', 'DROP', 'TABLE', 'DATABASE', 'TRUNCATE'];

var INDIVIDUALS = {
  ';': 'semicolon'
};

function scanToken(state) {
  var ch = read(state);

  if (isWhitespace(ch)) {
    return scanWhitespace(state);
  }

  if (isCommentInline(ch, state)) {
    return scanCommentInline(state);
  }

  if (isCommentBlock(ch, state)) {
    return scanCommentBlock(state);
  }

  if (isString(ch, state)) {
    return scanString(state);
  }

  if (isLetter(ch)) {
    return scanWord(state);
  }

  var individual = scanIndividualCharacter(state);
  if (individual) {
    return individual;
  }

  return skipChar(state);
}

function read(state) {
  if (state.position === state.input.length - 1) {
    return null;
  }

  state.position++;
  return state.input[state.position];
}

function unread(state) {
  if (state.position === state.start) {
    return;
  }

  state.position--;
}

function isKeyword(word) {
  return ~KEYWORDS.indexOf(word.toUpperCase());
}

function resolveIndividualTokenType(ch) {
  return INDIVIDUALS[ch];
}

function scanWhitespace(state) {
  var nextChar = void 0;

  do {
    nextChar = read(state);
  } while (isWhitespace(nextChar));

  if (nextChar !== null && !isWhitespace(nextChar)) {
    unread(state);
  }

  var value = state.input.slice(state.start, state.position + 1);
  return {
    type: 'whitespace',
    value: value,
    start: state.start,
    end: state.start + value.length - 1
  };
}

function scanCommentInline(state) {
  var nextChar = void 0;

  do {
    nextChar = read(state);
  } while (nextChar !== '\n' && nextChar !== null);

  if (nextChar !== null && nextChar !== '\n') {
    unread(state);
  }

  var value = state.input.slice(state.start, state.position + 1);
  return {
    type: 'comment-inline',
    value: value,
    start: state.start,
    end: state.start + value.length - 1
  };
}

function scanString(state) {
  var nextChar = void 0;

  do {
    nextChar = read(state);
  } while (nextChar !== '\'' && nextChar !== null);

  if (nextChar !== null && nextChar !== '\'') {
    unread(state);
  }

  var value = state.input.slice(state.start, state.position + 1);
  return {
    type: 'string',
    value: value,
    start: state.start,
    end: state.start + value.length - 1
  };
}

function scanCommentBlock(state) {
  var nextChar = void 0;
  var prevChar = void 0;

  do {
    prevChar = nextChar;
    nextChar = read(state);
  } while (prevChar + nextChar !== '*/' && nextChar !== null);

  if (nextChar !== null && nextChar !== '/') {
    unread(state);
  }

  var value = state.input.slice(state.start, state.position + 1);
  return {
    type: 'comment-block',
    value: value,
    start: state.start,
    end: state.start + value.length - 1
  };
}

function scanWord(state) {
  var nextChar = void 0;

  do {
    nextChar = read(state);
  } while (isLetter(nextChar));

  if (nextChar !== null && !isLetter(nextChar)) {
    unread(state);
  }

  var value = state.input.slice(state.start, state.position + 1);
  if (!isKeyword(value)) {
    return skipWord(state, value);
  }

  return {
    type: 'keyword',
    value: value,
    start: state.start,
    end: state.start + value.length - 1
  };
}

function scanIndividualCharacter(state) {
  var value = state.input.slice(state.start, state.position + 1);
  var type = resolveIndividualTokenType(value);
  if (!type) {
    return null;
  }

  return {
    type: type,
    value: value,
    start: state.start,
    end: state.start + value.length - 1
  };
}

function skipChar(state) {
  return {
    type: 'unkown',
    value: state.input.slice(state.start, state.position + 1),
    start: state.start,
    end: state.start
  };
}

function skipWord(state, value) {
  return {
    type: 'unkown',
    value: value,
    start: state.start,
    end: state.start + value.length - 1
  };
}

function isWhitespace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n';
}

function isString(ch) {
  return ch === '\'';
}

function isCommentInline(ch, state) {
  var isComment = ch === '-';
  if (!isComment) {
    return false;
  }

  // lookahead
  var nextChar = read(state);
  isComment = nextChar === '-';
  if (!isComment) {
    unread(state);
  }

  return isComment;
}

function isCommentBlock(ch, state) {
  var isComment = ch === '/';
  if (!isComment) {
    return false;
  }

  // lookahead
  var nextChar = read(state);
  isComment = nextChar === '*';
  if (!isComment) {
    unread(state);
  }

  return isComment;
}

function isLetter(ch) {
  return ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z';
}