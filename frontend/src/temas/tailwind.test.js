// Las clases de color de Tailwind leen el tema por temas/tailwind.css, generado desde todo el
// frontend. Si alguien suma una clase de color y no regenera, con tema elegido esa clase quedaría con
// su color fijo: este test lo frena y dice cuáles faltan.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');  // vitest corre desde frontend/
function archivos(dir) {
    return readdirSync(dir).flatMap(n => {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) return n === 'temas' || n === 'node_modules' ? [] : archivos(p);
        return /\.(jsx?|tsx?)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
    });
}

const ESCALA = new Set(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']);
const FIJOS = new Set(['25d366']);  // el verde de WhatsApp es marca de otro
const FAMILIAS = 'slate|gray|zinc|neutral|stone|pink|fuchsia|violet|purple|indigo|blue|sky|cyan|emerald|green|teal|lime|amber|yellow|orange|red|rose';
const CLASE = new RegExp(`(?<![\\w:-])((?:(?:hover|focus|focus-visible|focus-within|active|disabled|group-hover|placeholder):)*(?:bg|from|via|to|text|border(?:-[trblxy])?|ring|divide|placeholder|fill|stroke|accent|caret|outline|decoration)-(?:white|black|(?:${FAMILIAS})-(\\d{2,3})|\\[#([0-9a-fA-F]{3,8})\\])(?:/(?:\\d{1,3}|\\[[0-9.]+\\]))?)(?![\\w-])`, 'g');
const escapar = (c) => c.replace(/([:/[\]#.%])/g, '\\$1');
const css = readFileSync(join(SRC, 'temas', 'tailwind.css'), 'utf8');

describe('clases de color de Tailwind y el tema', () => {
    it('cada clase de color de la app tiene su regla en temas/tailwind.css', () => {
        const faltan = new Set();
        for (const a of archivos(SRC)) {
            for (const [, clase, tono, hex] of readFileSync(a, 'utf8').matchAll(CLASE)) {
                if (tono && !ESCALA.has(tono)) continue;  // no existe en Tailwind: no pinta, con o sin tema
                if (hex && FIJOS.has(hex.toLowerCase().slice(0, 6))) continue;
                if (!css.includes(`.${escapar(clase)}`)) faltan.add(clase);
            }
        }
        expect([...faltan]).toEqual([]);
    });

    it('todas las reglas cuelgan de [data-tema]: sin tema elegido no cambia nada', () => {
        const reglas = css.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => l.trim());
        expect(reglas.length).toBeGreaterThan(900);
        expect(reglas.filter(l => !/^(html)?\[data-tema\]/.test(l))).toEqual([]);
    });
});
