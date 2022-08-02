"use strict";
/**
 * Tokenizer
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanToken = void 0;
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
    'PROCEDURE',
];
const INDIVIDUALS = {
    ';': 'semicolon',
};
const ENDTOKENS = {
    '"': '"',
    "'": "'",
    '`': '`',
    '[': ']',
};
function scanToken(state, dialect = 'generic') {
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
    if (isParameter(ch, state, dialect)) {
        return scanParameter(state, dialect);
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
exports.scanToken = scanToken;
function read(state, skip = 0) {
    if (state.position + skip === state.input.length - 1) {
        return null;
    }
    state.position += 1 + skip;
    return state.input[state.position];
}
function unread(state) {
    if (state.position === state.start) {
        return;
    }
    state.position--;
}
function peek(state) {
    if (state.position >= state.input.length - 1) {
        return null;
    }
    return state.input[state.position + 1];
}
function isKeyword(word) {
    return KEYWORDS.includes(word.toUpperCase());
}
function resolveIndividualTokenType(ch) {
    return INDIVIDUALS[ch];
}
function scanWhitespace(state) {
    let nextChar;
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
function scanCommentInline(state) {
    let nextChar;
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
function scanDollarQuotedString(state) {
    const match = /^(\$[a-zA-Z0-9_]*\$)/.exec(state.input.slice(state.start));
    if (!match) {
        throw new Error('Could not find dollar quoted string opener');
    }
    const label = match[1];
    for (let i = 0; i < label.length - 1; i++) {
        read(state);
    }
    let nextChar = '';
    while (state.input.slice(state.position, state.position + label.length) !== label &&
        nextChar !== null) {
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
function scanString(state, endToken) {
    let nextChar;
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
function scanParameter(state, dialect) {
    if (['mysql', 'generic', 'sqlite'].includes(dialect)) {
        return {
            type: 'parameter',
            value: state.input.slice(state.start, state.position + 1),
            start: state.start,
            end: state.start,
        };
    }
    if (dialect === 'psql') {
        let nextChar;
        do {
            nextChar = read(state);
        } while (!isNaN(Number(nextChar)) && !isWhitespace(nextChar) && nextChar !== null);
        if (isWhitespace(nextChar))
            unread(state);
        const value = state.input.slice(state.start, state.position + 1);
        return {
            type: 'parameter',
            value,
            start: state.start,
            end: state.start + value.length - 1,
        };
    }
    if (dialect === 'mssql') {
        let nextChar;
        do {
            nextChar = read(state);
        } while (!isWhitespace(nextChar) && nextChar !== null);
        if (isWhitespace(nextChar))
            unread(state);
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
function scanCommentBlock(state) {
    let nextChar = '';
    let prevChar;
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
function scanQuotedIdentifier(state, endToken) {
    let nextChar;
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
function scanWord(state) {
    let nextChar;
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
function scanIndividualCharacter(state) {
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
function skipChar(state) {
    return {
        type: 'unknown',
        value: state.input.slice(state.start, state.position + 1),
        start: state.start,
        end: state.start,
    };
}
function skipWord(state, value) {
    return {
        type: 'unknown',
        value,
        start: state.start,
        end: state.start + value.length - 1,
    };
}
function isWhitespace(ch) {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}
function isString(ch, dialect) {
    const stringStart = dialect === 'mysql' ? ["'", '"'] : ["'"];
    return stringStart.includes(ch);
}
function isParameter(ch, state, dialect) {
    let pStart = '?'; // ansi standard - sqlite, mysql
    if (dialect === 'psql') {
        pStart = '$';
        const nextChar = peek(state);
        if (nextChar === null || isNaN(Number(nextChar))) {
            return false;
        }
    }
    if (dialect === 'mssql')
        pStart = ':';
    return ch === pStart;
}
function isDollarQuotedString(state) {
    return /^\$[\w]*\$/.exec(state.input.slice(state.start)) !== null;
}
function isQuotedIdentifier(ch, dialect) {
    const startQuoteChars = dialect === 'mssql' ? ['"', '['] : ['"', '`'];
    return startQuoteChars.includes(ch);
}
function isCommentInline(ch, state) {
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
function isCommentBlock(ch, state) {
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
function isLetter(ch) {
    return ch !== null && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_');
}
