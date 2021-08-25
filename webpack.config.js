const TerserPlugin = require('terser-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const path = require('path');

const libraryName = 'SQLQueryIdentifier';

const plugins = [new ESLintPlugin()];
let outputFile;

if (process.env.NODE_ENV === 'production') {
  outputFile = `${libraryName}.min.js`;
} else {
  outputFile = `${libraryName}.js`;
}

const config = {
  entry: path.join(__dirname, '/src/index.ts'),
  output: {
    path: path.join(__dirname, '/webpack'),
    filename: outputFile,
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts'],
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  plugins,
};

module.exports = config;
