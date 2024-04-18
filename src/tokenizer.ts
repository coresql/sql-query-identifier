/**
 * Tokenizer
 */

import type { Token, State, Dialect, ParamTypes } from './defines';

type Char = string | null;

const KEYWORDS = [
  'SELECT',
  'INSERT',
  'DELETE',
  'UPDATE',
  'CREATE',
  'DROP',
  'DATABASE',
  'SCHEMA',
  'TABLE',
  'VIEW',
  'TRIGGER',
  'FUNCTION',
  'INDEX',
  'ALTER',
  'TRUNCATE',
  'WITH',
  'AS',
  'MATERIALIZED',
  'BEGIN',
  'DECLARE',
  'CASE',
  'LOOP',
  'IF',
  'REPEAT',
  'WHILE',
  'FOR',
  'PROCEDURE',
  'SHOW',
  'DATABASES',
  'KEYS',
  'TABLES',
  'COLUMNS',
  'STATUS',
  'BINARY',
  'BINLOG',
  'CHARACTER',
  'COLLATION',
  'ENGINE',
  'ENGINES',
  'ERRORS',
  'EVENTS',
  'GRANTS',
  'MASTER',
  'OPEN',
  'PLUGINS',
  'PRIVILEGES',
  'PROCESSLIST',
  'PROFILE',
  'PROFILES',
  'RELAYLOG',
  'REPLICAS',
  'SLAVE',
  'REPLICA',
  'TRIGGERS',
  'VARIABLES',
  'WARNINGS',
];

const INDIVIDUALS: Record<string, Token['type']> = {
  ';': 'semicolon',
};

const ENDTOKENS: Record<string, Char> = {
  '"': '"',
  "'": "'",
  '`': '`',
  '[': ']',
};

export function scanToken(
  state: State,
  dialect: Dialect = 'generic',
  paramTypes?: ParamTypes,
): Token {
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

  if (isString(ch, dialect) && ch !== null) {
    return scanString(state, ENDTOKENS[ch]);
  }

  if (isParameter(ch, state, dialect, paramTypes)) {
    return scanParameter(state, dialect, paramTypes);
  }

  if (isDollarQuotedString(state)) {
    return scanDollarQuotedString(state);
  }

  if (isQuotedIdentifier(ch, dialect) && ch !== null) {
    return scanQuotedIdentifier(state, ENDTOKENS[ch]);
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

function read(state: State, skip = 0): Char {
  if (state.position + skip === state.input.length - 1) {
    return null;
  }

  state.position += 1 + skip;
  return state.input[state.position];
}

function unread(state: State): void {
  if (state.position === state.start) {
    return;
  }

  state.position--;
}

function peek(state: State): Char {
  if (state.position >= state.input.length - 1) {
    return null;
  }
  return state.input[state.position + 1];
}

function isKeyword(word: string): boolean {
  return KEYWORDS.includes(word.toUpperCase());
}

function resolveIndividualTokenType(ch: string): Token['type'] | undefined {
  return INDIVIDUALS[ch];
}

function scanWhitespace(state: State): Token {
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

function scanCommentInline(state: State): Token {
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

function scanDollarQuotedString(state: State): Token {
  const match = /^(\$[a-zA-Z0-9_]*\$)/.exec(state.input.slice(state.start));
  if (!match) {
    throw new Error('Could not find dollar quoted string opener');
  }
  const label = match[1];
  for (let i = 0; i < label.length - 1; i++) {
    read(state);
  }

  let nextChar: Char = '';
  while (
    state.input.slice(state.position, state.position + label.length) !== label &&
    nextChar !== null
  ) {
    do {
      nextChar = read(state);
    } while (nextChar !== '$' && nextChar !== null);

    if (nextChar !== '$' && nextChar !== null) {
      unread(state);
    }
  }

  for (let i = 0; i < label.length - 1; i++) {
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

function scanString(state: State, endToken: Char): Token {
  let nextChar: Char;
  do {
    nextChar = read(state);
    // supporting double quote escaping: 'str''ing'
    if (nextChar === endToken) {
      if (peek(state) === endToken) {
        nextChar = read(state, 1);
      }
    }
  } while (nextChar !== endToken && nextChar !== null);

  if (nextChar !== null && endToken !== nextChar) {
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

function getCustomParam(state: State, paramTypes: ParamTypes): string | null | undefined {
  const matches = paramTypes?.custom
    ?.map((regex) => {
      const reg = new RegExp(`^(?:${regex})`, 'u');
      return reg.exec(state.input.slice(state.start));
    })
    .filter((value) => !!value)[0];

  return matches ? matches[0] : null;
}

function scanCustomParameter(state: State, dialect: Dialect, paramTypes: ParamTypes): Token {
  const curCh: any = state.input[state.start];
  const nextChar = peek(state);
  let matched = false;

  if (paramTypes.numbered && paramTypes.numbered.length && paramTypes.numbered.includes(curCh)) {
    const endIndex = state.input
      .slice(state.start)
      .split('')
      .findIndex((val) => isWhitespace(val));
    const maybeNumbers = state.input.slice(
      state.start + 1,
      endIndex > 0 ? state.start + endIndex : state.end + 1,
    );
    if (nextChar !== null && !isNaN(Number(nextChar)) && /^\d+$/.test(maybeNumbers)) {
      let nextChar: Char = null;
      do {
        nextChar = read(state);
      } while (nextChar !== null && !isNaN(Number(nextChar)) && !isWhitespace(nextChar));

      if (nextChar !== null) unread(state);
      matched = true;
    }
  }

  if (!matched && paramTypes.named && paramTypes.named.length && paramTypes.named.includes(curCh)) {
    if (!isQuotedIdentifier(nextChar, dialect)) {
      while (isAlphaNumeric(peek(state))) read(state);
      matched = true;
    }
  }

  if (
    !matched &&
    paramTypes.quoted &&
    paramTypes.quoted.length &&
    paramTypes.quoted.includes(curCh)
  ) {
    if (isQuotedIdentifier(nextChar, dialect)) {
      const quoteChar = read(state) as string;
      // end when we reach the end quote
      while (
        (isAlphaNumeric(peek(state)) || peek(state) === ' ') &&
        peek(state) != ENDTOKENS[quoteChar]
      )
        read(state);

      // read the end quote
      read(state);

      matched = true;
    }
  }

  if (!matched && paramTypes.custom && paramTypes.custom.length) {
    const custom = getCustomParam(state, paramTypes);

    if (custom) {
      read(state, custom.length);
      matched = true;
    }
  }

  if (!matched && !paramTypes.positional) {
    // not positional, panic
    return {
      type: 'parameter',
      value: 'unknown',
      start: state.start,
      end: state.end,
    };
  }

  const value = state.input.slice(state.start, state.position + 1);
  return {
    type: 'parameter',
    value,
    start: state.start,
    end: state.start + value.length - 1,
  };
}

function scanParameter(state: State, dialect: Dialect, paramTypes?: ParamTypes): Token {
  // user has defined wanted param types, so we only evaluate them
  if (paramTypes) {
    return scanCustomParameter(state, dialect, paramTypes);
  }

  if (['mysql', 'generic', 'sqlite'].includes(dialect)) {
    return {
      type: 'parameter',
      value: state.input.slice(state.start, state.position + 1),
      start: state.start,
      end: state.start,
    };
  }

  if (dialect === 'psql') {
    let nextChar: Char;

    do {
      nextChar = read(state);
    } while (nextChar !== null && !isNaN(Number(nextChar)) && !isWhitespace(nextChar));

    if (nextChar !== null) unread(state);

    const value = state.input.slice(state.start, state.position + 1);

    return {
      type: 'parameter',
      value,
      start: state.start,
      end: state.start + value.length - 1,
    };
  }

  if (dialect === 'mssql') {
    while (isAlphaNumeric(peek(state))) read(state);

    const value = state.input.slice(state.start, state.position + 1);
    return {
      type: 'parameter',
      value,
      start: state.start,
      end: state.start + value.length - 1,
    };
  }

  return {
    type: 'parameter',
    value: 'unknown',
    start: state.start,
    end: state.end,
  };
}

function scanCommentBlock(state: State): Token {
  let nextChar: Char = '';
  let prevChar: Char;

  do {
    prevChar = nextChar;
    nextChar = read(state);
  } while ((prevChar || '') + (nextChar || '') !== '*/' && nextChar !== null);

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

function scanQuotedIdentifier(state: State, endToken: Char): Token {
  let nextChar: Char;
  do {
    nextChar = read(state);
  } while (endToken !== nextChar && nextChar !== null);

  if (nextChar !== null && endToken !== nextChar) {
    unread(state);
  }

  const value = state.input.slice(state.start, state.position + 1);
  return {
    type: 'keyword',
    value,
    start: state.start,
    end: state.start + value.length - 1,
  };
}

function scanWord(state: State): Token {
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

function scanIndividualCharacter(state: State): Token | null {
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

function skipChar(state: State): Token {
  return {
    type: 'unknown',
    value: state.input.slice(state.start, state.position + 1),
    start: state.start,
    end: state.start,
  };
}

function skipWord(state: State, value: string): Token {
  return {
    type: 'unknown',
    value,
    start: state.start,
    end: state.start + value.length - 1,
  };
}

function isWhitespace(ch: Char): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

function isAlphaNumeric(ch: Char): boolean {
  return ch !== null && /\w/.test(ch);
}

function isString(ch: Char, dialect: Dialect): boolean {
  const stringStart: Char[] = dialect === 'mysql' ? ["'", '"'] : ["'"];
  return stringStart.includes(ch);
}

function isCustomParam(state: State, paramTypes: ParamTypes): boolean | undefined {
  return paramTypes?.custom?.some((regex) => {
    const reg = new RegExp(`^(?:${regex})`, 'uy');
    return reg.test(state.input.slice(state.start));
  });
}

function isParameter(ch: Char, state: State, dialect: Dialect, paramTypes?: ParamTypes): boolean {
  if (paramTypes && ch !== null) {
    const curCh: any = ch;
    const nextChar = peek(state);
    if (paramTypes.positional && ch === '?' && (nextChar === null || isWhitespace(nextChar)))
      return true;

    if (paramTypes.numbered && paramTypes.numbered.length && paramTypes.numbered.includes(curCh)) {
      if (nextChar !== null && !isNaN(Number(nextChar))) {
        return true;
      }
    }

    if (
      (paramTypes.named && paramTypes.named.length && paramTypes.named.includes(curCh)) ||
      (paramTypes.quoted && paramTypes.quoted.length && paramTypes.quoted.includes(curCh))
    ) {
      return true;
    }

    if (paramTypes.custom && paramTypes.custom.length && isCustomParam(state, paramTypes)) {
      return true;
    }

    return false;
  }

  let pStart = '?'; // ansi standard - sqlite, mysql
  if (dialect === 'psql') {
    pStart = '$';
    const nextChar = peek(state);
    if (nextChar === null || isNaN(Number(nextChar))) {
      return false;
    }
  }
  if (dialect === 'mssql') pStart = ':';

  return ch === pStart;
}

function isDollarQuotedString(state: State): boolean {
  return /^\$[\w]*\$/.exec(state.input.slice(state.start)) !== null;
}

function isQuotedIdentifier(ch: Char, dialect: Dialect): boolean {
  const startQuoteChars: Char[] = dialect === 'mssql' ? ['"', '['] : ['"', '`'];
  return startQuoteChars.includes(ch);
}

function isCommentInline(ch: Char, state: State): boolean {
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

function isCommentBlock(ch: Char, state: State): boolean {
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

function isLetter(ch: Char): boolean {
  return ch !== null && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_');
}
