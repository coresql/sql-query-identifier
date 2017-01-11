'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.identify = identify;

var _parser = require('./parser');

/**
 * Identifier
 */
function identify(query) {
  var result = (0, _parser.parse)(query);

  return result.body.map(function (statement) {
    return {
      start: statement.start,
      end: statement.end,
      text: query.substring(statement.start, statement.end + 1),
      type: statement.type
    };
  });
}