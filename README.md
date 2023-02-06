sql-query-identifier
===================

[![Build Status](https://github.com/sqlectron/sql-query-identifier/workflows/Test/badge.svg?branch=main)](https://github.com/sqlectron/sql-query-identifier/actions?query=workflow%3ATest+branch%3Amain)
[![npm version](https://badge.fury.io/js/sql-query-identifier.svg)](https://npmjs.com/package/sql-query-identifier)
[![view demo](https://img.shields.io/badge/view-demo-blue.svg)](https://sqlectron.github.io/sql-query-identifier/)

Identifies the types of each statement in a SQL query (also provide the start, end and the query text).

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

For the show statements, please refer to the [MySQL Docs about SHOW Statements](https://dev.mysql.com/doc/refman/8.0/en/show.html).

* INSERT
* UPDATE
* DELETE
* SELECT
* TRUNCATE
* CREATE_DATABASE
* CREATE_SCHEMA
* CREATE_TABLE
* CREATE_VIEW
* CREATE_TRIGGER
* CREATE_FUNCTION
* CREATE_INDEX
* CREATE_PROCEDURE
* DROP_DATABASE
* DROP_SCHEMA
* DROP_TABLE
* DROP_VIEW
* DROP_TRIGGER
* DROP_FUNCTION
* DROP_INDEX
* DROP_PROCEDURE
* ALTER_DATABASE
* ALTER_SCHEMA
* ALTER_TABLE
* ALTER_VIEW
* ALTER_TRIGGER
* ALTER_FUNCTION
* ALTER_INDEX
* ALTER_PROCEDURE
* ANON_BLOCK (BigQuery and Oracle dialects only)
* SHOW_BINARY (MySQL and generic dialects only)
* SHOW_BINLOG (MySQL and generic dialects only)
* SHOW_CHARACTER (MySQL and generic dialects only)
* SHOW_COLLATION (MySQL and generic dialects only)
* SHOW_COLUMNS (MySQL and generic dialects only)
* SHOW_CREATE (MySQL and generic dialects only)
* SHOW_DATABASES (MySQL and generic dialects only)
* SHOW_ENGINE (MySQL and generic dialects only)
* SHOW_ENGINES (MySQL and generic dialects only)
* SHOW_ERRORS (MySQL and generic dialects only)
* SHOW_EVENTS (MySQL and generic dialects only)
* SHOW_FUNCTION (MySQL and generic dialects only)
* SHOW_GRANTS (MySQL and generic dialects only)
* SHOW_INDEX (MySQL and generic dialects only)
* SHOW_MASTER (MySQL and generic dialects only)
* SHOW_OPEN (MySQL and generic dialects only)
* SHOW_PLUGINS (MySQL and generic dialects only)
* SHOW_PRIVILEGES (MySQL and generic dialects only)
* SHOW_PROCEDURE (MySQL and generic dialects only)
* SHOW_PROCESSLIST (MySQL and generic dialects only)
* SHOW_PROFILE (MySQL and generic dialects only)
* SHOW_PROFILES (MySQL and generic dialects only)
* SHOW_RELAYLOG (MySQL and generic dialects only)
* SHOW_REPLICAS (MySQL and generic dialects only)
* SHOW_SLAVE (MySQL and generic dialects only)
* SHOW_REPLICA (MySQL and generic dialects only)
* SHOW_STATUS (MySQL and generic dialects only)
* SHOW_TABLE (MySQL and generic dialects only)
* SHOW_TABLES (MySQL and generic dialects only)
* SHOW_TRIGGERS (MySQL and generic dialects only)
* SHOW_VARIABLES (MySQL and generic dialects only)
* SHOW_WARNINGS (MySQL and generic dialects only)
* UNKNOWN (only available if strict mode is disabled)

## Execution types

Execution types allow to know what is the query behavior

* `LISTING:` is when the query list the data
* `MODIFICATION:` is when the query modificate the database somehow (structure or data)
* `INFORMATION:` is show some data information such as a profile data
* `ANON_BLOCK: ` is for an anonymous block query which may contain multiple statements of unknown type (BigQuery and Oracle dialects only)
* `UNKNOWN`: (only available if strict mode is disabled)

## Installation

Install via npm:

```bash
$ npm install sql-query-identifier
```

## Usage

```js
import { identify } from 'sql-query-identifier';

const statements = identify(`
  INSERT INTO Persons (PersonID, Name) VALUES (1, 'Jack');
  SELECT * FROM Persons;
`);

console.log(statements);
[
  {
    start: 9,
    end: 64,
    text: 'INSERT INTO Persons (PersonID, Name) VALUES (1, \'Jack\');',
    type: 'INSERT',
    executionType: 'MODIFICATION',
    parameters: []
  },
  {
    start: 74,
    end: 95,
    text: 'SELECT * FROM Persons;',
    type: 'SELECT',
    executionType: 'LISTING',
    parameters: []
  }
]
```

## API

`identify` arguments:

1. `input (string)`: the whole SQL script text to be processed
1. `options (object)`: allow to set different configurations
    1. `strict (bool)`: allow disable strict mode which will ignore unknown types *(default=true)*
    2. `dialect (string)`: Specify your database dialect, values: `generic`, `mysql`, `oracle`, `psql`, `sqlite` and `mssql`. *(default=generic)*

## Contributing

It is required to use [editorconfig](https://editorconfig.org/) and please write and run specs before pushing any changes:

```js
npm test
```

## License

Copyright (c) 2016-2021 The SQLECTRON Team.
This software is licensed under the [MIT License](https://github.com/sqlectron/sql-query-identifier/blob/master/LICENSE).
