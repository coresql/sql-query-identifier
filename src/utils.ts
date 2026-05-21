import { Dialect, Token } from './defines';

export function getStartQuotes(dialect: Dialect): string[] {
  if (dialect === 'mssql') {
    return ['"', '['];
  } else {
    return ['"', '`'];
  }
}

function endQuoteFor(char: string): string {
  if (char === '[') {
    return ']';
  }
  return char;
}

export function maybeIdentifier(token: Token, dialect: Dialect): boolean {
  const ch = token.value[0];
  const startChars = getStartQuotes(dialect);
  return token.type !== 'string' && (startChars.includes(ch) || /[a-zA-Z_]/.test(ch));
}

export function maybeStripQuotes(value: string, dialect: Dialect): string {
  if (value.length < 2) {
    return value;
  }

  const start = value[0];
  const end = value[value.length - 1];

  if (!getStartQuotes(dialect).includes(start)) {
    return value;
  }

  const expectedEnd = endQuoteFor(start);
  if (end !== expectedEnd) {
    return value;
  }

  const inner = value.slice(1, -1);

  if (dialect === 'bigquery' && start === '`') {
    return inner.replace(/\\`/g, '`');
  }

  return inner.split(expectedEnd + expectedEnd).join(expectedEnd);
}
