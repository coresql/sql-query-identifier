/**
 * Helper function to make easier check the assert result
 */
export function aggregateUnknownTokens (tokens) {
  return tokens.reduce((result, token, index) => {
    const prev = result[result.length - 1];
    const next = tokens[index + 1];
    const isCurrUnknown = token.type === 'unknown';
    const isCurrWhitespace = token.type === 'whitespace';
    const isCurrString = token.type === 'string';
    const isPrevUnknown = prev && prev.type === 'unknown';
    const isNextUnknown = next && next.type === 'unknown';
    const isCurrWhitespaceAfterUnknown = isCurrWhitespace && isPrevUnknown;
    const isCurrWhitespaceBeforeUnknown = isCurrWhitespace && isNextUnknown;
    const isCurrStringAfterUnknown = isCurrString && isPrevUnknown;
    const isCurrStringBeforeUnknown = isCurrString && isNextUnknown;

    const isKnowTokenBeforeUnknown = (
      isCurrWhitespaceBeforeUnknown || isCurrStringBeforeUnknown
    ) && !isPrevUnknown;

    const isNewToken = isKnowTokenBeforeUnknown || (
      !isCurrWhitespaceAfterUnknown
      && !isCurrStringAfterUnknown
      && (!isCurrUnknown || !isPrevUnknown)
    );

    if (isNewToken) {
      result.push({
        ...token,
        type: isCurrWhitespaceBeforeUnknown ? 'unknown' : token.type,
      });
      return result;
    }

    prev.end += token.value.length;
    prev.value += token.value;
    return result;
  }, []);
}

