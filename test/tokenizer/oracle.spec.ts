import { expect } from 'chai';
import { scanToken } from '../../src/tokenizer';
import type { Dialect } from '../../src/defines';

describe('oracle scanning', () => {
  const initState = (input: string) => ({
    input,
    start: 0,
    end: input.length - 1,
    position: -1,
  });

  it('scans DECLARE keyword', () => {
    const actual = scanToken(initState('DECLARE'), 'oracle');
    const expected = {
      type: 'keyword',
      value: 'DECLARE',
      start: 0,
      end: 6,
    };
    expect(actual).to.eql(expected);
  });


})
