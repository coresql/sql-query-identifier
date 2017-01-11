const webpack = require('webpack');
const UglifyJsPlugin = webpack.optimize.UglifyJsPlugin;
const path = require('path');
const env = require('yargs').argv.mode;

const libraryName = 'SQLQueryIdentifier';

const plugins = [];
let outputFile;

if (env === 'build') {
  plugins.push(new UglifyJsPlugin({ minimize: true }));
  outputFile = `${libraryName}.min.js`;
} else {
  outputFile = `${libraryName}.js`;
}

const config = {
  entry: path.join(__dirname, '/src/index.js'),
  devtool: 'source-map',
  output: {
    path: path.join(__dirname, '/lib'),
    filename: outputFile,
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true,
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel',
        exclude: /(node_modules|bower_components)/,
      },
      {
        test: /\.js$/,
        loader: 'eslint-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    root: path.resolve('./src'),
    extensions: ['', '.js'],
  },
  plugins,
};

module.exports = config;
