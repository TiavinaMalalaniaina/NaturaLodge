
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import i18next from "eslint-plugin-i18next";

export default tseslint.config(
  // Fichiers et dossiers ignorés
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
    ],
  },

  // Environnement JavaScript et TypeScript
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },

  // Règles JavaScript recommandées
  js.configs.recommended,

  // Règles TypeScript recommandées
  ...tseslint.configs.recommended,

  // Interdiction des textes écrits en dur dans JSX / TSX
  {
    files: ["**/*.{jsx,tsx}"],

    plugins: {
      i18next,
    },

    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          framework: "react",
          mode: "jsx-only",

          message:
            "Texte écrit en dur interdit : utilise le module de traduction t().",

          // Les textes à l'intérieur de Trans sont gérés par i18next
          "jsx-components": {
            exclude: ["Trans"],
          },

          // Attributs techniques dont la valeur n'est pas un texte à traduire
          "jsx-attributes": {
            exclude: [
              "activeClassName",
              "className",
              "styleName",
              "style",
              "type",
              "key",
              "id",
              "width",
              "height",
              "data-testid",
              "data-test-id",
              "role",
              "variant",
              "layoutId",
              "mode",
              "accent",
              "kind",
              "color",
              "size",
              "value"
            ],
          },
          callees: {
            exclude: [
              "^can$",
              "^t$",
            ],
          },
          "object-properties": {
            exclude: [
              "^color$",
              "^height$",
              "^layoutId$",
              "^width$",
              "^variant$",
              "^month$",
              "^year$",
              "^day$",
              "^key$",
              "^cls$",
              "^accent$",
              "^type$",
            ],
          },
        },
      ],
    },
  },
);
