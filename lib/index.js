"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExecutionType = exports.identify = void 0;
const parser_1 = require("./parser");
const defines_1 = require("./defines");
/**
 * Identifier
 */
function identify(query, options = {}) {
    const isStrict = typeof options.strict === 'undefined' ? true : options.strict === true;
    const dialect = typeof options.dialect === 'undefined' ? 'generic' : options.dialect;
    if (!defines_1.DIALECTS.includes(dialect)) {
        throw new Error(`Unknown dialect. Allowed values: ${defines_1.DIALECTS.join(', ')}`);
    }
    const result = (0, parser_1.parse)(query, isStrict, dialect);
    return result.body.map((statement) => {
        const result = {
            start: statement.start,
            end: statement.end,
            text: query.substring(statement.start, statement.end + 1),
            type: statement.type,
            executionType: statement.executionType,
            // we want to sort the postgres params: $1 $2 $3, regardless of the order they appear
            parameters: dialect === 'psql' ? statement.parameters.sort() : statement.parameters,
        };
        return result;
    });
}
exports.identify = identify;
function getExecutionType(command) {
    return parser_1.EXECUTION_TYPES[command] || 'UNKNOWN';
}
exports.getExecutionType = getExecutionType;
