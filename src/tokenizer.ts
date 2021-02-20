/**
 * Tokenizer
 */

import type { Token, State } from './defines';

type Char = string | null;

const KEYWORDS = [
  'SELECT',
  'INSERT',
  'DELETE',
  'UPDATE',
  'CREATE',
  'DROP',
  'TABLE',
  'TRIGGER',
  'FUNCTION',
  'DATABASE',
  'TRUNCATE',
  'WITH',
  'AS',
];

const INDIVIDUALS: Record<string, string> = {
  ';': 'semicolon',
};

export function scanToken (state: State): Token {
  const ch = read(state);

  if (isWhitespace(ch)) {
    return scanWhitespace(state);
  }

  if (isCommentInline(ch, state)) {
    return scanCommentInline(state);
  }

  if (isCommentBlock(ch, state)) {
    return scanCommentBlock(state);
  }

  if (isString(ch)) {
    return scanString(state);
  }

  if (isDollarQuotedString(state)) {
    return scanDollarQuotedString(state);
  }

  if (isLetter(ch)) {
    return scanWord(state);
  }

  const individual = scanIndividualCharacter(state);
  if (individual) {
    return individual;
  }

  return skipChar(state);
}

function read (state: State): Char {
  if (state.position === state.input.length - 1) {
    return null;
  }

  state.position++;
  return state.input[state.position];
}

function unread (state: State): void {
  if (state.position === state.start) {
    return;
  }

  state.position--;
}

function isKeyword (word: string): boolean {
  return KEYWORDS.includes(word.toUpperCase());
}

function resolveIndividualTokenType (ch: string): string | undefined {
  return INDIVIDUALS[ch];
}

function scanWhitespace (state: State): Token {
  let nextChar: string | null;

  do {
    nextChar = read(state);
  } while (isWhitespace(nextChar));

  if (nextChar !== null && !isWhitespace(nextChar)) {
    unread(state);
  }

  const value = state.input.slice(state.start, state.position + 1);
  return {
    type: 'whitespace',
    value,
    start: state.start,
    end: state.start + value.length - 1,
  };
}

function scanCommentInline (state: State): Token {
  let nextChar: Char;

  do {
    nextChar = read(state);
  } while (nextChar !== '\n' && nextChar !== null);

  if (nextChar !== null && nextChar !== '\n') {
    unread(state);
  }

  const value = state.input.slice(state.start, state.position + 1);
  return {
    type: 'comment-inline',
    value,
    start: state.start,
    end: state.start + value.length - 1,
  };
}

function scanDollarQuotedString (state: State): Token {
  const match = /^(\$[a-zA-Z0-9_]*\$)/.exec(state.input.slice(state.start));
  if (!match) {
    throw new Error('Could not find dollar quoted string opener');
  }
  const label = match[1];
  for (let i = 0; i < (label.length - 1); i++) {
    read(state);
  }

  let nextChar: Char = '';
  while (state.input.slice(state.position, state.position + label.length) !== label && nextChar !== null) {
    do {
      nextChar = read(state);
    } while (nextChar !== '$' && nextChar !== null);

    if (nextChar !== '$' && nextChar !== null) {
      unread(state);
    }
  }

  for (let i = 0; i < (label.length - 1); i++) {
    read(state);
  }

  const value = state.input.slice(state.start, state.position + 1);
  return {
    type: 'string',
    value,
    start: state.start,
    end: state.start + value.length - 1,
  };
}

function scanString (state: State): Token {
  let nextChar: Char;

  do {
    nextChar = read(state);
  } while (nextChar !== '\'' && nextChar !== null);

  if (nextChar !== null && nextChar !== '\'') {
    unread(state);
  }

  const value = state.input.slice(state.start, state.position + 1);
  return {
    type: 'string',
    value,
    start: state.start,
    end: state.start + value.length - 1,
  };
}

function scanCommentBlock (state: State): Token {
  let nextChar: Char = '';
  let prevChar: Char;

  do {
    prevChar = nextChar;
    nextChar = read(state);
  } while (((prevChar || '') + (nextChar || '') !== '*/') && nextChar !== null);

  if (nextChar !== null && nextChar !== '/') {
    unread(state);
  }

  const value = state.input.slice(state.start, state.position + 1);
  return {
    type: 'comment-block',
    value,
    start: state.start,
    end: state.start + value.length - 1,
  };
}

function scanWord (state: State): Token {
  let nextChar: Char;

  do {
    nextChar = read(state);
  } while (isLetter(nextChar));

  if (nextChar !== null && !isLetter(nextChar)) {
    unread(state);
  }

  const value = state.input.slice(state.start, state.position + 1);
  if (!isKeyword(value)) {
    return skipWord(state, value);
  }

  return {
    type: 'keyword',
    value,
    start: state.start,
    end: state.start + value.length - 1,
  };
}

function scanIndividualCharacter (state: State): Token | null {
  const value = state.input.slice(state.start, state.position + 1);
  const type = resolveIndividualTokenType(value);
  if (!type) {
    return null;
  }

  return {
    type,
    value,
    start: state.start,
    end: state.start + value.length - 1,
  };
}

function skipChar (state: State): Token {
  return {
    type: 'unknown',
    value: state.input.slice(state.start, state.position + 1),
    start: state.start,
    end: state.start,
  };
}

function skipWord (state: State, value: string): Token {
  return {
    type: 'unknown',
    value,
    start: state.start,
    end: state.start + value.length - 1,
  };
}

function isWhitespace (ch: Char): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n';
}

function isString (ch: Char): boolean {
  return ch === "'";
}

function isDollarQuotedString (state: State): boolean {
  return /^\$[\w]*\$/.exec(state.input.slice(state.start)) !== null;
}

function isCommentInline (ch: Char, state: State): boolean {
  let isComment = ch === '-';
  if (!isComment) {
    return false;
  }

  // lookahead
  const nextChar = read(state);
  isComment = nextChar === '-';
  if (!isComment) {
    unread(state);
  }

  return isComment;
}

function isCommentBlock (ch: Char, state: State): boolean {
  let isComment = ch === '/';
  if (!isComment) {
    return false;
  }

  // lookahead
  const nextChar = read(state);
  isComment = nextChar === '*';
  if (!isComment) {
    unread(state);
  }

  return isComment;
}

function isLetter (ch: Char): boolean {
  return ch !== null
    && (
      (ch >= 'a' && ch <= 'z')
      || (ch >= 'A' && ch <= 'Z')
      || ch === '_'
    );
}
