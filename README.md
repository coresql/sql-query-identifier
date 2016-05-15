sql-query-identifier
===================

[![Build Status](https://travis-ci.org/maxcnunes/sql-query-identifier.svg?branch=master)](https://travis-ci.org/sql-query-identifier)
[![npm version](https://badge.fury.io/js/sql-query-identifier.svg)](http://badge.fury.io/js/sql-query-identifier)

Identifies the types of each statement in a SQL query.

This uses AST and parser techniques to identify the SQL query type.
Although it will not validate the whole query as a fully implemented AST+parser would do.
Instead, it validates only the required tokens to identify the SQL query type. In summary it identifies the type by:

1. Scanning the tokens:
  * Comments
  * The initial keywords that identify the query type (e.g. INSERT, DELETE)
  * White spaces
  * String
  * Semicolon
1. Parsing the tokens to identify the query:
  * Comments are ignored since they could include words that will give false positive to identify the type
  * Keywords are expected to be at the beginning of the query statement
  * White spaces are only required to identify keywords with multiple words (e.g. CREATE TABLE)
  * String values are ignored since they also could include false positive words
  * Semicolon identifies the end of the statement

So the best approach using this module is only applying it after executing the query over the SQL client.
This way you have sure is a valid query before trying to identify the types.

## Current Available Types

* Insert
* Update
* Delete
* Select
* CreateTable
* CreateDatabase

## Installation

Install via npm:

```bash
$ npm install sql-query-identifier
```

## Usage

```js
import { identify } from 'sql-query-identifier';

const types = identify(`
  INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');
  SELECT * FROM Persons';
`);

console.log(types);
// [ 'Insert', 'Select' ]
```

## Contributing

It is required to use [editorconfig](http://editorconfig.org/) and please write and run specs before pushing any changes:

```js
npm test
```

## License

Copyright (c) 2016 Max Claus Nunes. This software is licensed under the [MIT License](http://raw.github.com/maxcnunes/sql-query-identifier/master/LICENSE).
