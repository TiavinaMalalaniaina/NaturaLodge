import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
    ],
  },

  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,
);