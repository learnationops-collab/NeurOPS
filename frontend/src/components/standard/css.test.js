// standard.css: cada componente que dibuja con variables --ui-* tiene que estar en el bloque que las
// define. Si falta, sus var(--ui-…) quedan vacías (sin color, sin gap) sin ningún error a la vista.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest corre desde frontend/ y reemplaza los imports de CSS, así que se lee el archivo.
const css = readFileSync(resolve(process.cwd(), 'src/components/standard/standard.css'), 'utf8');

describe('standard.css', () => {
    it('todo componente con base propia está en el bloque de variables', () => {
        const bloque = css.match(/:where\(([^)]*)\)\{/)[1];
        const conVariables = new Set(bloque.split(',').map(s => s.trim().slice(1)));
        const bases = [...css.matchAll(/^\.(ui-[a-z]+)\.\1\{/gm)].map(m => m[1]);
        expect(bases.length).toBeGreaterThan(10);
        expect(bases.filter(b => !conVariables.has(b))).toEqual([]);
    });

    it('la entrada del modal no queda en efecto, así los menús fixed de adentro van contra la pantalla', () => {
        const modal = css.match(/\.ui-modal\.ui-modal\{[^}]*\}/)[0];
        expect(modal).toMatch(/animation:ui-modal-in [^;}]*backwards/);
        expect(modal).not.toMatch(/animation:[^;}]*\b(both|forwards)\b/);
    });
});
