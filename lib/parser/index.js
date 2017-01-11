'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _tokenizer = require('../tokenizer');

var _tokenizer2 = _interopRequireDefault(_tokenizer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Parser = function (_Tokenizer) {
  (0, _inherits3.default)(Parser, _Tokenizer);

  function Parser(input) {
    (0, _classCallCheck3.default)(this, Parser);

    var _this = (0, _possibleConstructorReturn3.default)(this, (0, _getPrototypeOf2.default)(Parser).call(this, input));

    _this.input = input;
    return _this;
  }

  (0, _createClass3.default)(Parser, [{
    key: 'parse',
    value: function parse() {
      // let file = this.startNode();
      // let program = this.startNode();
      // this.nextToken();
      // return this.parseTopLevel(file, program);
    }
  }]);
  return Parser;
}(_tokenizer2.default);

exports.default = Parser;