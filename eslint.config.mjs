import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "public/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends("next/core-web-vitals"),
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
      "react/no-unescaped-entities": "off",
    },
  },
];
