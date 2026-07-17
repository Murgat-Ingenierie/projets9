// Config plate ESLint 9.
//
// Le job CI « Web — lint + build » annonce un lint depuis le premier commit
// sans jamais l'avoir exécuté : il n'a pas d'étape lint, et `npm run lint`
// était de toute façon inexécutable faute de ce fichier (ESLint 9 exige une
// config plate et n'accepte plus `--ext`).
//
// `no-undef` n'est pas activé : TypeScript couvre déjà les identifiants
// inconnus, et l'activer imposerait de déclarer tous les globaux navigateur.

import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // Warning et non erreur : les 5 `any` restants sont tous à une frontière
      // non typée (corps de réponse JSON, entrées d'erreur Pydantic,
      // `catch (e: any)`). Les typer correctement demande 5 petits refactors
      // sur du code sans aucun test — à faire quand le front en aura (cf.
      // INVENTAIRE.md). En warning ils restent visibles au lieu d'être
      // masqués par des `eslint-disable` au cas par cas.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
