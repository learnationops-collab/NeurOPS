import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Config aparte de `vite.config.js` a propósito: el build de producción no tiene por qué
// importar nada de vitest.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    css: false,
    restoreMocks: true,
    // Los 5 s por defecto no alcanzan con la suite entera en paralelo: el PRIMER test de cada
    // archivo pesado (la ficha, la cabecera, el wizard de Resultado) paga la carga del componente
    // y con la máquina ocupada pasaba de 5 s sin que nada estuviera roto. Se repitió con tres
    // tests distintos el 29/09/2026. Un test colgado de verdad sigue saltando, 10 s después.
    testTimeout: 15000,
  },
});
