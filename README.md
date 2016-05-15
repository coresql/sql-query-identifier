sql-query-identifier
===================

[![Build Status](https://travis-ci.org/maxcnunes/sql-query-identifier.svg?branch=master)](https://travis-ci.org/sql-query-identifier)
[![npm version](https://badge.fury.io/js/sql-query-identifier.svg)](http://badge.fury.io/js/sql-query-identifier)

Identifies the types of each statement in a SQL query.

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
