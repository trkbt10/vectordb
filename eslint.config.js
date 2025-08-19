/**
 * @file ESLint flat config for the repository.
 */

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import jsdocPlugin from "eslint-plugin-jsdoc";
import eslintComments from "eslint-plugin-eslint-comments";
import prettierConfig from "eslint-config-prettier";

export default [
  // Ignore patterns
  { ignores: ["node_modules/**", "dist/**", "build/**", "debug/**"] },

  // JS/TS recommended sets (Flat-compatible)
  ...tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,

    // Project common rules from here
    {
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
        },
      },
      plugins: {
        import: importPlugin,
        jsdoc: jsdocPlugin,
        "eslint-comments": eslintComments,
        "@typescript-eslint": tseslint.plugin,
      },
      settings: {
        jsdoc: { mode: "typescript" },
      },
      rules: {
        /* 1. File JSDoc required/warning */
        "no-empty": ["warn", { allowEmptyCatch: false }],

        "jsdoc/require-file-overview": "warn",
        "jsdoc/require-jsdoc": [
          "warn",
          {
            publicOnly: true,
            require: { FunctionDeclaration: true, ClassDeclaration: true },
          },
        ],

        /* 2. Prohibit specific syntax */
        "no-restricted-syntax": [
          "warn",
          { selector: "ImportExpression", message: "dynamic import() is prohibited" },
          {
            selector: "TSInterfaceDeclaration",
            message: "Please use type instead of interface",
          },
          {
            selector: "ExportAllDeclaration[exported!=null]",
            message: "export * as is prohibited",
          },
          {
            selector: "ClassDeclaration",
            message: "Class implementation is not recommended. Please write as function-based as much as possible.",
          },
          {
            selector: "VariableDeclaration[kind='let']:not(ForStatement > VariableDeclaration)",
            message:
              "Use of let is prohibited. If you need to branch, create a separate function and use its return value. If absolutely necessary for performance issues, explicitly use // eslint-disable-next-line.",
          },
          // Ban `as any` and `<any>expr` assertions explicitly with guidance in English
          {
            selector: "TSAsExpression TSAnyKeyword",
            message:
              "Avoid using 'as any'. Code using 'as any' may indicate incorrect type definitions or a misunderstanding; review it carefully. Resolve this by using appropriate type guards or correct typings instead.",
          },
          {
            selector: "TSTypeAssertion TSAnyKeyword",
            message:
              "Avoid using 'as any'. Code using 'as any' may indicate incorrect type definitions or a misunderstanding; review it carefully. Resolve this by using appropriate type guards or correct typings instead.",
          },
        ],
        "@typescript-eslint/consistent-type-definitions": ["error", "type"],

        // Require a human-readable description when disabling rules (use English)
        // Note: this rule doesn't support a minimum length option.
        "eslint-comments/require-description": [
          "warn",
          {
            ignore: [],
          },
        ],

        // /* 3. Prohibit relative parent import (../../ etc.) */
        // "import/no-relative-parent-imports": "error",

        /* 4. Always add block {} to if/else/for/while */
        curly: ["warn", "all"],
      },
    },

    // Disable conflicting Prettier rules (Flat-compatible eslint-config-prettier)
    prettierConfig,
  ),
];
