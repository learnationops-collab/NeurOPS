// El mazo del closer lee el tema por temas/deck.css, generado desde las clases de color de estos
// archivos. Si alguien suma una clase de color y no regenera, con tema elegido esa clase quedaría con
// su color fijo: este test lo frena.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ARCHIVOS = [
    '../pages/closer/CloserWorkflowPage.jsx',
    '../pages/triage/components/TriageFollowUpModal.jsx',
    '../components/modals/OperatorControls.jsx',
    '../pages/closer/audit/CloserLeadsAudit.jsx',
    '../pages/closer/components/SeguimientosPane.jsx',
    '../pages/closer/components/ProcrastinarModal.jsx',
    '../pages/closer/components/ClienteNuevoVenta.jsx',
    '../pages/closer/components/DiaDelReporte.jsx',
];
const leer = (r) => readFileSync(new URL(r, import.meta.url), 'utf8');

const ESCALA = new Set(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']);
const FAMILIAS = 'slate|gray|zinc|neutral|stone|pink|fuchsia|violet|purple|indigo|blue|sky|cyan|emerald|green|teal|lime|amber|yellow|orange|red|rose';
const CLASE = new RegExp(`(?<![\\w:-])((?:(?:hover|focus|focus-visible|focus-within|active|disabled|group-hover|placeholder):)*(?:bg|from|via|to|text|border(?:-[trblxy])?|ring|divide|placeholder|fill|stroke|accent|caret|outline|decoration)-(?:white|black|(?:${FAMILIAS})-(\\d{2,3})|\\[#[0-9a-fA-F]{3,8}\\])(?:/(?:\\d{1,3}|\\[[0-9.]+\\]))?)(?![\\w-])`, 'g');
const escapar = (c) => c.replace(/([:/[\]#.%])/g, '\\$1');

describe('tema del mazo del closer', () => {
    it('cada clase de color del mazo tiene su regla en temas/deck.css', () => {
        const css = leer('./deck.css');
        const faltan = new Set();
        for (const a of ARCHIVOS) {
            for (const [, clase, tono] of leer(a).matchAll(CLASE)) {
                if (tono && !ESCALA.has(tono)) continue;  // no existe en Tailwind: no pinta nada, con o sin tema
                if (!css.includes(`.${escapar(clase)}`)) faltan.add(clase);
            }
        }
        expect([...faltan]).toEqual([]);
    });

    it('todas las reglas cuelgan de [data-tema]: sin tema elegido no cambia nada', () => {
        const reglas = leer('./deck.css').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => l.trim());
        expect(reglas.length).toBeGreaterThan(100);
        expect(reglas.filter(l => !l.startsWith('[data-tema] '))).toEqual([]);
    });
});
