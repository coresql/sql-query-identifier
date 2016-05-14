/**
 * Helper function to make easier check the assert result
 */
export function aggregateUnkownTokens (tokens) {
  return tokens.reduce((result, token, index) => {
    const prev = result[result.length - 1];
    const next = tokens[index + 1];
    const isCurrUnkown = token.type === 'unkown';
    const isCurrWhitespace = token.type === 'whitespace';
    const isCurrString = token.type === 'string';
    const isPrevUnkown = prev && prev.type === 'unkown';
    const isNextUnkown = next && next.type === 'unkown';
    const isCurrWhitespaceAfterUnkown = isCurrWhitespace && isPrevUnkown;
    const isCurrWhitespaceBeforeUnkown = isCurrWhitespace && isNextUnkown;
    const isCurrStringAfterUnkown = isCurrString && isPrevUnkown;
    const isCurrStringBeforeUnkown = isCurrString && isNextUnkown;

    const isKnowTokenBeforeUnkown = (
      isCurrWhitespaceBeforeUnkown || isCurrStringBeforeUnkown
    ) && !isPrevUnkown;

    const isNewToken = isKnowTokenBeforeUnkown || (
      !isCurrWhitespaceAfterUnkown
      && !isCurrStringAfterUnkown
      && (!isCurrUnkown || !isPrevUnkown)
    );

    if (isNewToken) {
      result.push({
        ...token,
        type: isCurrWhitespaceBeforeUnkown ? 'unkown' : token.type,
      });
      return result;
    }

    prev.end += token.value.length;
    prev.value += token.value;
    return result;
  }, []);
}

