// Los menús y popovers de toda la app: opacos en cada tema y en la capa superior. Si uno vuelve a ser
// translúcido o a dibujarse con un z-index atrapado en su padre (las tarjetas KPI del Resumen de
// Workshop se leían a través del menú de la pastilla), esto falla.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');
const leer = (ruta) => readFileSync(join(SRC, ruta), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const archivos = (dir, ext) => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'node_modules' ? [] : archivos(p, ext);
    return p.endsWith(ext) && !/\.test\.jsx?$/.test(p) ? [p] : [];
});

/** Un color sin transparencia: #rgb, #rrggbb o rgb()/rgba() con alfa 1. */
const opaco = (valor) => {
    const v = valor.trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return true;
    const m = v.match(/^rgba?\(([^)]*)\)$/i);
    if (!m) return false;
    const partes = m[1].split(/[\s,/]+/).filter(Boolean);
    return partes.length === 3 || Number(partes[3]) === 1;
};

/** El valor de respaldo de `var(--x, respaldo)` (o el valor tal cual si no es un var). */
const respaldo = (valor) => {
    const m = valor.trim().match(/^var\(--[\w-]+,\s*(.+)\)$/);
    return m ? respaldo(m[1]) : valor.trim();
};

const declaracion = (css, selector, prop) => {
    const i = css.indexOf(selector + '{') >= 0 ? css.indexOf(selector + '{') : css.indexOf(selector + ' {');
    expect(i, `no está la regla ${selector}`).toBeGreaterThanOrEqual(0);
    const cuerpo = css.slice(i, css.indexOf('}', i));
    const m = cuerpo.match(new RegExp(`(?:^|[;{\\s])${prop}:([^;}]+)`));
    expect(m, `${selector} no declara ${prop}`).not.toBeNull();
    return m[1].trim();
};

describe('los fondos de los menús son opacos', () => {
    it('en los cuatro temas (classic y modern, claro y oscuro)', () => {
        const temas = leer('temas/temas.css');
        const valores = [...temas.matchAll(/--ln-popover-bg:([^;]+);/g)].map((m) => m[1]);
        expect(valores).toHaveLength(4);
        valores.forEach((v) => expect(opaco(v), v).toBe(true));
    });

    it('sin tema elegido, cada token de menú cae a un color opaco', () => {
        const tokens = [
            [leer('pages/comercial/comercial.css'), '--bg-flotante'],
            [leer('pages/agendas_v2/thalamus.css'), '--bg-flotante'],
            [leer('pages/agendas_v2/thalamus.css'), '--rv-pop'],
            [leer('components/standard/standard.css'), '--ui-popover-bg'],
        ];
        tokens.forEach(([css, token]) => {
            const valores = [...css.matchAll(new RegExp(`${token}:([^;}]+)`, 'g'))].map((m) => m[1]);
            expect(valores.length, token).toBeGreaterThan(0);
            valores.forEach((v) => expect(opaco(respaldo(v)), `${token}: ${v}`).toBe(true));
        });
    });

    it('cada menú pinta su fondo con un token opaco', () => {
        const casos = [
            ['pages/comercial/comercial.css', '.dc-shell .menu', 'var(--bg-flotante)'],
            ['pages/comercial/comercial.css', '.dc-shell .config-panel,.thalamus .config-panel', 'var(--bg-flotante)'],
            ['components/standard/standard.css', '.ui-select__pop.ui-select__pop', 'var(--ui-popover-bg)'],
            ['components/ficha/ficha.css', '.dc-shell .fi-pop', 'var(--bg-flotante)'],
            ['pages/agendas_v2/thalamus.css', '.thalamus .vis-pop', 'var(--bg-flotante)'],
            ['pages/agendas_v2/thalamus.css', '.thalamus .msel-pop', 'var(--bg-flotante)'],
            ['pages/agendas_v2/thalamus.css', '.thalamus .ec-pop', 'var(--bg-flotante)'],
            ['pages/agendas_v2/thalamus.css', '.thalamus .rv-paises,.thalamus .rv-zpop', 'var(--rv-pop)'],
            ['pages/admin/hiring/talent.css', '.tl-capa .tl-menu', 'var(--bg-flotante)'],
            ['pages/setter/agendas/misAgendas.css', '.mis-agendas .ma-lista-op', 'var(--bg-flotante)'],
            ['pages/setter/reporte/reporteDiario.css', '.rd .rd-cal', 'var(--bg-flotante)'],
        ];
        casos.forEach(([archivo, selector, fondo]) => {
            expect(declaracion(leer(archivo), selector, 'background'), selector).toBe(fondo);
        });
    });

    it('las paletas viejas (vidrio) traen su `--popover` sólido junto a cada `--bg-card`', () => {
        const css = leer('index.css');
        const bloques = [...css.matchAll(/([^{}]+)\{([^{}]*--bg-card:[^{}]*)\}/g)];
        expect(bloques.length).toBeGreaterThan(5);
        bloques.forEach(([, selector, cuerpo]) => {
            const m = cuerpo.match(/--popover:([^;]+);/);
            expect(m, `${selector.trim()} cambia --bg-card sin un --popover`).not.toBeNull();
            const v = m[1].trim();
            const permitido = opaco(respaldo(v)) || v === 'var(--brand-navy)' || v === 'var(--color-surface)';
            expect(permitido, `${selector.trim()}: --popover ${v}`).toBe(true);
        });
        expect(leer('temas/puente.css')).toMatch(/--popover:\s*var\(--ln-popover-bg\)/);
    });

    it('ningún desplegable de Tailwind usa la superficie de vidrio (bg-surface, bg-main o /NN)', () => {
        const malos = archivos(SRC, '.jsx').flatMap((p) => [...readFileSync(p, 'utf8').matchAll(/className="([^"]*\babsolute\b[^"]*\btop-full\b[^"]*)"/g)]
            .map((m) => m[1])
            .filter((c) => !/\bopacity-0\b/.test(c)) // los tooltips de hover no son menús
            .filter((c) => /\bbg-(surface|main)\b|\bbg-[a-z]+-\d+\/\d+/.test(c))
            .map((c) => `${relative(SRC, p)}: ${c.slice(0, 80)}`));
        expect(malos).toEqual([]);
    });
});

describe('los menús van en la capa superior', () => {
    it('el reset de la capa existe y pesa cero', () => {
        expect(leer('components/standard/standard.css')).toMatch(/:where\(\[data-ui-capa\]\)\{[^}]*inset:auto[^}]*margin:0[^}]*color:inherit/);
    });

    it('todo archivo que dibuja un menú o popover lo sube con useEnPantalla, usePopover o subirACapa', () => {
        const clases = ['menu', 'config-panel', 'fi-pop', 'vis-pop', 'msel-pop', 'ec-pop', 'rv-paises', 'rv-zpop', 'tl-menu', 'ma-lista-op', 'rd-cal', 'ui-select__pop'];
        const patron = new RegExp(`className=(?:"|\\{\`)(?:[^"\`]*\\s)?(${clases.join('|')})(?=[\\s"\`$])`);
        const sinCapa = archivos(SRC, '.jsx')
            .filter((p) => patron.test(readFileSync(p, 'utf8')))
            .filter((p) => !/useEnPantalla|usePopover\(\)|subirACapa/.test(readFileSync(p, 'utf8')))
            .map((p) => relative(SRC, p));
        expect(sinCapa).toEqual([]);
    });

    it('las entradas de los contenedores no dejan un transform en efecto (atrapaba a los menús)', () => {
        const casos = [
            ['pages/comercial/comercial.css', '.dc-shell .vista > *'],
            ['pages/comercial/comercial.css', '.dc-shell .modal'],
            ['pages/admin/hiring/talent.css', '.talent .tl-vista > *'],
            ['pages/agendas_v2/thalamus.css', '.thalamus .modal'],
        ];
        casos.forEach(([archivo, selector]) => {
            const anim = declaracion(leer(archivo), selector, 'animation');
            expect(anim, selector).toMatch(/\bbackwards\b/);
            expect(anim, selector).not.toMatch(/\b(both|forwards)\b/);
        });
    });
});
