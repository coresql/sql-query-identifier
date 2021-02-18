module.exports = {
  "parser": "@typescript-eslint/parser",
  "plugins": [
    "@typescript-eslint",
  ],
  "parserOptions": {
    "tsconfigRootDir": __dirname,
    "project": ["./tsconfig.json"]
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  "env": {
    "node": true,
    "mocha": true
  },
  "rules": {
    "max-len": 0,
    "no-continue": 0,
    "no-plusplus": 0,
    "no-use-before-define": 0,
    "space-before-function-paren": [2, {"anonymous": "always", "named": "always"}],
    "func-names": 0,
    "id-length": [1, {"exceptions": ["i", "j", "e", "a", "b", "t"]}],
    "import/prefer-default-export": 0
  }
}
