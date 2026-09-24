import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "playwright-report/**", "test-results/**"],
  },
  {
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        chrome: "readonly",
        console: "readonly",
        crypto: "readonly",
        fetch: "readonly",
        URL: "readonly",
        Blob: "readonly",
        File: "readonly",
        HTMLElement: "readonly",
        HTMLIFrameElement: "readonly",
        MessageEvent: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": "off",
    },
  },
  {
    files: ["test/unit/**/*.ts"],
    languageOptions: {
      globals: { crypto: "readonly" },
    },
  },
  {
    files: ["test/e2e/**/*.ts", "playwright.config.ts"],
    languageOptions: {
      globals: { window: "readonly", document: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
);
