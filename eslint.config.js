/**
 * @file ESLint flat config for the repository.
 */

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import jsdocPlugin from "eslint-plugin-jsdoc";
import eslintComments from "eslint-plugin-eslint-comments";
import prettierConfig from "eslint-config-prettier";
import ternaryLength from "./eslint-rules/ternary-length.js";
import noAndAsTernary from "./eslint-rules/no-and-as-ternary.js";

export default [
  // Ignore patterns
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "debug/**",
      "coverage/**",
      "bin/**",
      "*.config.ts",
      "eslint-rules/**",
      "scripts/**",
    ],
  },

  // JS/TS recommended sets (Flat-compatible)
  ...tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    // Disable conflicting Prettier rules (Flat-compatible eslint-config-prettier)
    prettierConfig,

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
        custom: {
          rules: {
            "ternary-length": ternaryLength,
            "no-and-as-ternary": noAndAsTernary,
          },
        },
      },
      settings: {
        jsdoc: { mode: "typescript" },
      },
      rules: {
        "custom/ternary-length": "error",
        "custom/no-and-as-ternary": "error",
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
          { selector: "TSImportType", message: "type import() (TS import type expression) is prohibited" },

          {
            selector: "TSInterfaceDeclaration",
            message: "Please use type instead of interface",
          },
          {
            selector: "ExportAllDeclaration[exported!=null]",
            message: "export * as is prohibited",
          },
          {
            selector: "ExportAllDeclaration",
            message: "export * from ... は使用禁止です。明示的に export してください。",
          },

          {
            selector: "ClassDeclaration",
            message: "Class implementation is not recommended. Please write as function-based as much as possible.",
          },
          {
            selector:
              "VariableDeclaration[kind='let']" +
              ":not(ForStatement > VariableDeclaration)" +
              ":not(ForInStatement > VariableDeclaration)" +
              ":not(ForOfStatement > VariableDeclaration)",
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
          // Forbid mocking APIs from Vitest/Jest/Bun at AST level
          {
            selector:
              "CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|fn|spyOn|restoreAllMocks|resetAllMocks)$/]",
            message: "Mock APIs (vi.mock/fn/spyOn/...) are prohibited. Prefer DI or simple fakes instead.",
          },
          {
            selector:
              "CallExpression[callee.object.name='jest'][callee.property.name=/^(mock|fn|spyOn|restoreAllMocks|resetAllMocks)$/]",
            message: "Mock APIs (jest.mock/fn/spyOn/...) are prohibited. Prefer DI or simple fakes instead.",
          },
          // Bun's bun:test mock helper (import { mock } from 'bun:test')
          {
            selector:
              "CallExpression[callee.object.name='mock'][callee.property.name=/^(module|object|replace|restore|reset)$/]",
            message: "Mock APIs (bun:test mock.*) are prohibited. Prefer DI or simple fakes instead.",
          },
          // Discourage else / else-if; prefer guard clause and separate function with early return
          {
            selector: "IfStatement[alternate]",
            message:
              "Avoid else / else if blocks. Prefer guard clauses with early return and extract complex conditions into separate functions.",
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

        /* 4. Always add block {} to if/else/for/while */
        curly: ["warn", "all"],
        // Prefer guard clauses to else/else-if
        "no-else-return": ["warn", { allowElseIf: false }],

        /* 5. Forbid loading specific test libraries */
        // ES Module imports
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "bun:test",
                message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect).",
              },
              {
                name: "vitest",
                message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect).",
              },
              {
                name: "@jest/globals",
                message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect).",
              },
              {
                name: "jest",
                message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect).",
              },
              {
                name: "mocha",
                message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect).",
              },
            ],
            patterns: [
              {
                group: ["vitest/*", "jest/*", "mocha/*"],
                message: "Do not import test libraries. Use globals injected by the test runner (describe/it/expect).",
              },
            ],
          },
        ],
        // CommonJS requires
        "no-restricted-modules": [
          "error",
          {
            paths: ["bun:test", "vitest", "@jest/globals", "jest", "mocha"],
            patterns: ["vitest/*", "jest/*", "mocha/*"],
          },
        ],

        /* 6. Forbid mocking APIs from common test libraries */
        // Ban global access to jest / vi (Vitest)
        "no-restricted-globals": [
          "error",
          { name: "jest", message: "Using Jest global is prohibited in this repository." },
          { name: "vi", message: "Using Vitest global is prohibited in this repository." },
        ],
        // Ban specific mocking helpers
        "no-restricted-properties": [
          "error",
          { object: "jest", property: "mock", message: "Mock APIs are prohibited. Prefer DI or simple fakes instead." },
          { object: "jest", property: "fn", message: "Mock APIs are prohibited. Prefer DI or simple fakes instead." },
          {
            object: "jest",
            property: "spyOn",
            message: "Mock APIs are prohibited. Prefer DI or simple fakes instead.",
          },
          { object: "vi", property: "mock", message: "Mock APIs are prohibited. Prefer DI or simple fakes instead." },
          { object: "vi", property: "fn", message: "Mock APIs are prohibited. Prefer DI or simple fakes instead." },
          { object: "vi", property: "spyOn", message: "Mock APIs are prohibited. Prefer DI or simple fakes instead." },
          // Bun's bun:test mock helpers
          {
            object: "mock",
            property: "module",
            message: "Mock APIs are prohibited. Prefer DI or simple fakes instead.",
          },
        ],

        // Warn on @ts-expect-error outside tests
        "@typescript-eslint/ban-ts-comment": ["warn", { "ts-expect-error": true }],
      },
    },

    // Allow vitest config to import from `vitest/config`
    {
      files: ["vitest.config.ts", "vitest.config.js"],
      rules: {
        "no-restricted-imports": "off",
        "no-restricted-modules": "off",
      },
    },

    // Tests-only: allow global test APIs so imports are unnecessary
    {
      files: [
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/*.test.ts",
        "**/*.test.tsx",
        "spec/**/*.ts",
        "spec/**/*.tsx",
        "spec/**/*.js",
        "spec/**/*.jsx",
      ],
      languageOptions: {
        globals: {
          // Core
          describe: "readonly",
          it: "readonly",
          test: "readonly",
          expect: "readonly",
          // Lifecycle
          beforeAll: "readonly",
          afterAll: "readonly",
          beforeEach: "readonly",
          afterEach: "readonly",
          // Suites/bench (Vitest-compatible)
          suite: "readonly",
          bench: "readonly",
        },
      },
      rules: {
        "@typescript-eslint/ban-ts-comment": "off",
      },
    },
  ),
];
