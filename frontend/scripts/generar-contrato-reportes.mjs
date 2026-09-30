// Regenera `src/components/ficha/__fixtures__/reportes.json`, el contrato entre el árbol de
// «Resultado» y `POST /api/ficha/<id>/resultado`, a partir de los guiones de
// `reportes.guiones.js` recorridos con el árbol de verdad.
//
// Solo después de un cambio A PROPÓSITO en lo que manda el árbol, y corriendo después los tests
// del backend (tests/api/test_ficha_reporte_arbol.py), que leen este mismo archivo:
//
//   cd frontend && npx vite-node scripts/generar-contrato-reportes.mjs
/* global console */
import { writeFileSync } from 'node:fs';
import { generarReportes } from '/src/components/ficha/__fixtures__/reportes.guiones.js';

const destino = 'src/components/ficha/__fixtures__/reportes.json';
const reportes = generarReportes();
writeFileSync(destino, `${JSON.stringify(reportes, null, 2)}\n`);
console.log(`${destino}: ${Object.keys(reportes).length} casos`);
