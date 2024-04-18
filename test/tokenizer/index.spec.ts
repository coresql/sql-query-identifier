import { expect } from 'chai';
import { scanToken } from '../../src/tokenizer';
import type { Dialect, ParamTypes } from '../../src/defines';

describe('scan', () => {
  const initState = (input: string) => ({
    input,
    start: 0,
    end: input.length - 1,
    position: -1,
  });

  it('scans inline comments', () => {
    const actual = scanToken(initState('-- my comment'));
    const expected = {
      type: 'comment-inline',
      value: '-- my comment',
      start: 0,
      end: 12,
    };
    expect(actual).to.eql(expected);
  });

  it('scans block comments', () => {
    const commentBlock = '/*\n * This is my comment block\n */';
    const actual = scanToken(initState(commentBlock));
    const expected = {
      type: 'comment-block',
      value: commentBlock,
      start: 0,
      end: 33,
    };
    expect(actual).to.eql(expected);
  });

  it('scans white spaces', () => {
    const actual = scanToken(initState('   \n\t\r  '));
    const expected = {
      type: 'whitespace',
      value: '   \n\t\r  ',
      start: 0,
      end: 7,
    };
    expect(actual).to.eql(expected);
  });

  it('scans SELECT keyword', () => {
    const actual = scanToken(initState('SELECT'));
    const expected = {
      type: 'keyword',
      value: 'SELECT',
      start: 0,
      end: 5,
    };
    expect(actual).to.eql(expected);
  });

  it('scans quoted keyword', () => {
    const actual = scanToken(initState('"ta;\'`ble"'));
    const expected = {
      type: 'keyword',
      value: '"ta;\'`ble"',
      start: 0,
      end: 9,
    };
    expect(actual).to.eql(expected);
  });

  it('scans quoted string', () => {
    const actual = scanToken(initState('\'some string; I "love it"\''), 'mysql');
    const expected = {
      type: 'string',
      value: '\'some string; I "love it"\'',
      start: 0,
      end: 25,
    };
    expect(actual).to.eql(expected);
  });

  it('scans quoted string', () => {
    const actual = scanToken(initState("'''foo'' bar'"), 'mysql');
    const expected = {
      type: 'string',
      value: "'''foo'' bar'",
      start: 0,
      end: 12,
    };
    expect(actual).to.eql(expected);
  });

  it('scans INSERT keyword', () => {
    const actual = scanToken(initState('INSERT'));
    const expected = {
      type: 'keyword',
      value: 'INSERT',
      start: 0,
      end: 5,
    };
    expect(actual).to.eql(expected);
  });

  it('scans DELETE keyword', () => {
    const actual = scanToken(initState('DELETE'));
    const expected = {
      type: 'keyword',
      value: 'DELETE',
      start: 0,
      end: 5,
    };
    expect(actual).to.eql(expected);
  });

  it('scans UPDATE keyword', () => {
    const actual = scanToken(initState('UPDATE'));
    const expected = {
      type: 'keyword',
      value: 'UPDATE',
      start: 0,
      end: 5,
    };
    expect(actual).to.eql(expected);
  });

  it('scans CREATE keyword', () => {
    const actual = scanToken(initState('CREATE'));
    const expected = {
      type: 'keyword',
      value: 'CREATE',
      start: 0,
      end: 5,
    };
    expect(actual).to.eql(expected);
  });

  it('scans DROP keyword', () => {
    const actual = scanToken(initState('DROP'));
    const expected = {
      type: 'keyword',
      value: 'DROP',
      start: 0,
      end: 3,
    };
    expect(actual).to.eql(expected);
  });

  it('scans TABLE keyword', () => {
    const actual = scanToken(initState('TABLE'));
    const expected = {
      type: 'keyword',
      value: 'TABLE',
      start: 0,
      end: 4,
    };
    expect(actual).to.eql(expected);
  });

  it('scans VIEW keyword', () => {
    const actual = scanToken(initState('VIEW'));
    const expected = {
      type: 'keyword',
      value: 'VIEW',
      start: 0,
      end: 3,
    };
    expect(actual).to.eql(expected);
  });

  it('scans DATABASE keyword', () => {
    const actual = scanToken(initState('DATABASE'));
    const expected = {
      type: 'keyword',
      value: 'DATABASE',
      start: 0,
      end: 7,
    };
    expect(actual).to.eql(expected);
  });

  it('scans TRUNCATE keyword', () => {
    const actual = scanToken(initState('TRUNCATE'));
    const expected = {
      type: 'keyword',
      value: 'TRUNCATE',
      start: 0,
      end: 7,
    };
    expect(actual).to.eql(expected);
  });

  it('scans ALTER keyword', () => {
    const actual = scanToken(initState('ALTER'));
    const expected = {
      type: 'keyword',
      value: 'ALTER',
      start: 0,
      end: 4,
    };
    expect(actual).to.eql(expected);
  });

  it("scans 'Hello World' as string value", () => {
    const actual = scanToken(initState("'Hello World'"));
    const expected = {
      type: 'string',
      value: "'Hello World'",
      start: 0,
      end: 12,
    };
    expect(actual).to.eql(expected);
  });

  it('skips unknown tokens', () => {
    const actual = scanToken(initState('*'));
    const expected = {
      type: 'unknown',
      value: '*',
      start: 0,
      end: 0,
    };
    expect(actual).to.eql(expected);
  });

  it('scans ; individual identifier', () => {
    const actual = scanToken(initState(';'));
    const expected = {
      type: 'semicolon',
      value: ';',
      start: 0,
      end: 0,
    };
    expect(actual).to.eql(expected);
  });

  it('scans string with underscore as one token', () => {
    const actual = scanToken(initState('end_date'));
    const expected = {
      type: 'unknown',
      value: 'end_date',
      start: 0,
      end: 7,
    };
    expect(actual).to.eql(expected);
  });

  it('scans dollar quoted string', () => {
    const actual = scanToken(initState('$$test$$'));
    const expected = {
      type: 'string',
      value: '$$test$$',
      start: 0,
      end: 7,
    };
    expect(actual).to.eql(expected);
  });

  it('scans dollar quoted string with label', () => {
    const actual = scanToken(initState('$aaa$test$aaa$'));
    const expected = {
      type: 'string',
      value: '$aaa$test$aaa$',
      start: 0,
      end: 13,
    };
    expect(actual).to.eql(expected);
  });

  describe('tokenizing parameters', () => {
    describe('tokenizing just parameter starting character', () => {
      [
        ['?', 'generic'],
        ['?', 'mysql'],
        ['?', 'sqlite'],
        [':', 'mssql'],
      ].forEach(([ch, dialect]) => {
        it(`scans just ${ch} as parameter for ${dialect}`, () => {
          const input = `${ch}`;
          const actual = scanToken(initState(input), dialect as Dialect);
          const expected = {
            type: 'parameter',
            value: input,
            start: 0,
            end: 0,
          };
          expect(actual).to.eql(expected);
        });
      });
      it('does not scan just $ as parameter for psql', () => {
        const input = '$';
        const actual = scanToken(initState(input), 'psql');
        const expected = {
          type: 'unknown',
          value: input,
          start: 0,
          end: 0,
        };
        expect(actual).to.eql(expected);
      });
    });
    describe('tokenizing parameter with following characters', () => {
      [
        ['?', 'generic'],
        ['?', 'mysql'],
        ['?', 'sqlite'],
      ].forEach(([ch, dialect]) => {
        it(`should only scan ${ch} from ${ch}1 for ${dialect}`, () => {
          const input = `${ch}1`;
          const actual = scanToken(initState(input), dialect as Dialect);
          const expected = {
            type: 'parameter',
            value: ch,
            start: 0,
            end: 0,
          };
          expect(actual).to.eql(expected);
        });
      });
      [
        ['$', 'psql'],
        [':', 'mssql'],
      ].forEach(([ch, dialect]) => {
        it(`should scan ${ch}1 for ${dialect}`, () => {
          const input = `${ch}1`;
          const actual = scanToken(initState(input), dialect as Dialect);
          const expected = {
            type: 'parameter',
            value: input,
            start: 0,
            end: 1,
          };
          expect(actual).to.eql(expected);
        });
      });

      it('should not scan $a for psql', () => {
        const input = '$a';
        const actual = scanToken(initState(input), 'psql');
        const expected = {
          type: 'unknown',
          value: '$',
          start: 0,
          end: 0,
        };
        expect(actual).to.eql(expected);
      });

      it('should not include trailing non-numbers for psql', () => {
        const actual = scanToken(initState('$1,'), 'psql');
        const expected = {
          type: 'parameter',
          value: '$1',
          start: 0,
          end: 1,
        };
        expect(actual).to.eql(expected);
      });

      it('should not include trailing non-alphanumerics for mssql', () => {
        [
          {
            actual: scanToken(initState(':one,'), 'mssql'),
            expected: {
              type: 'parameter',
              value: ':one',
              start: 0,
              end: 3,
            },
          },
          {
            actual: scanToken(initState(':two)'), 'mssql'),
            expected: {
              type: 'parameter',
              value: ':two',
              start: 0,
              end: 3,
            },
          },
        ].forEach(({ actual, expected }) => expect(actual).to.eql(expected));
      });

      describe('custom parameters', () => {
        it('should allow positional parameters for all dialects', () => {
          const paramTypes: ParamTypes = {
            positional: true
          };

          const expected = {
            type: 'parameter',
            value: '?',
            start: 0,
            end: 0
          };


          (['mssql', 'psql', 'oracle', 'bigquery', 'sqlite', 'mysql', 'generic'] as Array<Dialect>).forEach((dialect) => {
            [
              {
                actual: scanToken(initState('?'), dialect, paramTypes),
                expected,
              },
            ].forEach(({ actual, expected }) => expect(actual).to.eql(expected));
          });
        });

        it('should allow numeric parameters for all dialects', () => {
          const paramTypes: ParamTypes = {
            numbered: ["$", "?", ":"]
          };

          const expected = [
            {
              type: 'parameter',
              value: '$1',
              start: 0,
              end: 1
            },
            {
              type: 'parameter',
              value: '?1',
              start: 0,
              end: 1
            },
            {
              type: 'parameter',
              value: ':1',
              start: 0,
              end: 1
            },
            {
              type: 'parameter',
              value: 'unknown',
              start: 0,
              end: 8
            }
          ];

          (['mssql', 'psql', 'oracle', 'bigquery', 'sqlite', 'mysql', 'generic'] as Array<Dialect>).forEach((dialect) => {
            [
              {
                actual: scanToken(initState('$1'), dialect, paramTypes),
                expected: expected[0],
              },
              {
                actual: scanToken(initState('?1'), dialect, paramTypes),
                expected: expected[1],
              },
              {
                actual: scanToken(initState(':1'), dialect, paramTypes),
                expected: expected[2],
              },
              {
                actual: scanToken(initState('$123hello'), dialect, paramTypes), // won't recognize
                expected: expected[3]
              }
            ].forEach(({ actual, expected }) => expect(actual).to.eql(expected));
          });
        });

        it('should allow named parameters for all dialects', () => {
          const paramTypes: ParamTypes = {
            named: ["$", "@", ":"]
          };

          const expected = [
            {
              type: 'parameter',
              value: '$namedParam',
              start: 0,
              end: 10
            },
            {
              type: 'parameter',
              value: '@namedParam',
              start: 0,
              end: 10
            },
            {
              type: 'parameter',
              value: ':namedParam',
              start: 0,
              end: 10
            },
            {
              type: 'parameter',
              value: '$123hello', // allow starting with a number
              start: 0,
              end: 8
            }
          ];

          (['mssql', 'psql', 'oracle', 'bigquery', 'sqlite', 'mysql', 'generic'] as Array<Dialect>).forEach((dialect) => {
            [
              {
                actual: scanToken(initState('$namedParam'), dialect, paramTypes),
                expected: expected[0],
              },
              {
                actual: scanToken(initState('@namedParam'), dialect, paramTypes),
                expected: expected[1],
              },
              {
                actual: scanToken(initState(':namedParam'), dialect, paramTypes),
                expected: expected[2],
              },
              {
                actual: scanToken(initState('$123hello'), dialect, paramTypes),
                expected: expected[3]
              }
            ].forEach(({ actual, expected }) => expect(actual).to.eql(expected));
          })
        });

        // this test will need a refactor depending on how we want to implement quotes
        it('should allow quoted parameters for all dialects', () => {
          const paramTypes: ParamTypes = {
            quoted: ["$", "@", ":"]
          };

          const expected = [
            {
              type: 'parameter',
              value: '$',
              start: 0,
              end: 14
            },
            {
              type: 'parameter',
              value: '@',
              start: 0,
              end: 14
            },
            {
              type: 'parameter',
              value: ':',
              start: 0,
              end: 14
            }
          ];

          ([
            { dialect: 'mssql', quotes: ['""', '[]'] },
            { dialect: 'psql', quotes: ['""', '``'] },
            { dialect: 'oracle', quotes: ['""', '``']},
            { dialect: 'bigquery', quotes: ['""', '``']},
            { dialect: 'sqlite', quotes: ['""', '``']},
            { dialect: 'mysql', quotes: ['""', '``']},
            { dialect: 'generic', quotes: ['""', '``']},
          ] as Array<{dialect: Dialect, quotes: Array<string>}>).forEach(({dialect, quotes}) => {
            const dialectExpected = expected.map((exp) => {
              return quotes.map((quote) => {
                return {
                  ...exp,
                  value: `${exp.value}${quote[0]}quoted param${quote[1]}`
                }
              })
            }).flat();
            dialectExpected.map((expected) => ({
              actual: scanToken(initState(expected.value), dialect, paramTypes),
              expected
            })).forEach(({ actual, expected }) => expect(actual).to.eql(expected));
          })
        });

        it('should allow custom parameters for all dialects', () => {
          const paramTypes: ParamTypes = {
            custom: [ '\\{[a-zA-Z0-9_]+\\}' ]
          };

          const expected = {
            type: 'parameter',
            value: '{namedParam}',
            start: 0,
            end: 11
          };

          (['mssql', 'psql', 'oracle', 'bigquery', 'sqlite', 'mysql', 'generic'] as Array<Dialect>).forEach((dialect) => {
            expect(scanToken(initState('{namedParam}'), dialect, paramTypes)).to.eql(expected);
          })
        });

        it('should not have collision between param types', () => {
          const paramTypes: ParamTypes = {
            positional: true,
            numbered: [':'],
            named: [':'],
            quoted: [':'],
            custom: []
          };

          const expected = [
            {
              type: 'parameter',
              value: '?',
              start: 0,
              end: 0
            },
            {
              type: 'parameter',
              value: ':123',
              start: 0,
              end: 3
            },
            {
              type: 'parameter',
              value: ':123hello',
              start: 0,
              end: 8
            },
            {
              type: 'parameter',
              value: ':"named param"',
              start: 0,
              end: 13
            }
          ];

          expected.forEach((expected) => {
            expect(scanToken(initState(expected.value), 'mssql', paramTypes)).to.eql(expected);
          })
        })
      });
    });
  });
});
