import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

/**
 * Primera configuración de linter del repo. Hasta ahora el script `lint` existía pero no
 * podía correr: ni eslint estaba instalado ni había config.
 *
 * Son ~700 archivos JSX que nunca pasaron por un linter, así que el conjunto arranca chico
 * y apunta a errores de verdad —lo que rompe en ejecución— y no a estilo. Lo que hoy tira
 * mucho ruido queda en `warn`: así `npm run lint` sirve para mirar, y una regla nueva se
 * puede subir a `error` cuando su deuda esté saldada.
 */
export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "src/test-output.css"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: "18.2" } },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Errores: cosas que rompen en ejecución o que son un bug seguro.
      ...reactHooks.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react/jsx-key": "error",
      "react/jsx-no-undef": "error",
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "no-undef": "error",

      // Deuda heredada: real, pero demasiada para arreglarla en el mismo cambio que la
      // config. Queda visible como aviso.
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "react-hooks/exhaustive-deps": "warn",

      // El plugin de hooks v6 trae las reglas del React Compiler, que son mucho mas
      // estrictas que `rules-of-hooks`: solas explican 298 de los 312 errores de la
      // primera corrida. No son falsos positivos, pero tampoco son "esto se rompe hoy":
      // quedan como aviso y se van saldando por archivo.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",

      // Ruido sin valor en este repo.
      "no-irregular-whitespace": "off",
    },
  },
  {
    // Los tests corren en vitest con `globals: true`.
    files: ["**/*.{test,spec}.{js,jsx}", "src/test/**"],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
  {
    // Config y scripts de build: entorno de Node, no de navegador.
    files: ["*.config.js", "vite.config.js", "vitest.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
