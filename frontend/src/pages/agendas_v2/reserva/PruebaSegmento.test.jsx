// Prueba por segmento: se elige la segmentación, se saltea el formulario y se ve lo que vería el lead.

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLECCIONES, NORM } from '../core/normalizar';
import { useUi } from '../data/hooks';
import { ui } from '../ui/estadoUi';
import PruebaSegmento from './PruebaSegmento';
import { segmentosDe } from './segmentos';

// Lunes 5 de octubre de 2026, 08:00 en La Paz (UTC-4).
const LUNES = Date.UTC(2026, 9, 5, 12, 0);
const LV9a12 = { 1: [['09:00', '12:00']], 2: [['09:00', '12:00']], 3: [['09:00', '12:00']], 4: [['09:00', '12:00']], 5: [['09:00', '12:00']] };

function armar(extra = {}) {
    const crudo = {
        personas: [
            { id: 'ana', nombre: 'Ana Paz', rol: 'closer', tz: 'America/La_Paz', horario: LV9a12, orden: 1 },
            { id: 'beto', nombre: 'Beto Ruiz', rol: 'closer', tz: 'America/La_Paz', horario: LV9a12, orden: 2 },
        ],
        grupos: [
            { id: 'ga', nombre: 'Prioridad A', estrategia: 'llenar', miembros: ['ana'], orden: 1 },
            { id: 'gb', nombre: 'Prioridad B', estrategia: 'llenar', miembros: ['beto'], orden: 2 },
        ],
        formularios: [{
            id: 'f1', nombre: 'Diagnóstico', contacto: { nombre: true, telefono: true, email: true, instagram: false },
            preguntas: [{
                id: 'q1', tipo: 'opciones', titulo: '¿Cuánto podés invertir?',
                opciones: [{ id: 'o1', texto: 'Mucho' }, { id: 'o2', texto: 'Nada', descalifica: true }, { id: 'o3', texto: 'Poco' }],
            }],
            reglas: [
                { id: 'r1', grupo: 'ga', cond: [{ q: 'q1', ops: ['o1'] }] },
                { id: 'r2', url: 'https://academy.thelearnation.com/', cond: [{ q: 'q1', ops: ['o3'] }] },
            ],
            resto: 'gb',
        }],
        eventos: [{
            id: 'e1', nombre: 'Llamada de diagnóstico', slug: 'diagnostico', formulario: 'f1', duracion: 45,
            antel: { n: 0, u: 'h' }, paso: { n: 60, u: 'min' }, reservas: { modo: 'dias', n: 14 },
        }],
        ...extra,
    };
    const d = {};
    COLECCIONES.forEach(c => { d[c] = (crudo[c] || []).map(x => NORM[c](x.id, x)); });
    return d;
}

// Como en Thalamus: la prueba vive en ui.prueba.
function Probar({ d }) {
    const { prueba } = useUi();
    return prueba ? <PruebaSegmento prueba={prueba} d={d} reservas={[]} cargando={false} prevModo="escritorio" onSalir={() => ui.set({ prueba: null })} /> : null;
}
const abrir = (segmento = '', evento = 'e1') => act(() => { ui.set({ prueba: { evento, segmento, porSegmento: true } }); });

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(LUNES);
});
afterEach(() => { act(() => { ui.set({ prueba: null }); }); vi.useRealTimers(); });

describe('segmentosDe', () => {
    it('lista cada destino en el orden de las reglas, con «Todo lo demás» y el que no califica', () => {
        const d = armar();
        const s = segmentosDe(d, d.eventos[0], d.formularios[0]);
        expect(s.map(x => [x.k, x.n, x.sub])).toEqual([
            ['g-ga', 'Prioridad A', 'Regla 1'],
            ['r1', 'Redirige a academy.thelearnation.com/', 'Regla 2 · no agenda'],
            ['g-gb', 'Prioridad B', 'Todo lo demás'],
            ['no', 'No califica', 'Eligió una respuesta que descalifica'],
        ]);
    });

    it('junta las reglas que mandan a la misma prioridad', () => {
        const d = armar();
        const fo = { ...d.formularios[0], reglas: [...d.formularios[0].reglas, { id: 'r3', grupo: 'gb', cond: [{ q: 'q1', ops: ['o1'] }] }] };
        expect(segmentosDe(d, d.eventos[0], fo).find(x => x.k === 'g-gb').sub).toBe('Regla 3 · Todo lo demás');
    });

    it('las reglas y «Todo lo demás» que mandan a «No califica» se juntan con el que no califica', () => {
        const d = armar();
        const fo = { ...d.formularios[0], reglas: [{ ...d.formularios[0].reglas[0], grupo: '__no' }], resto: '__no' };
        expect(segmentosDe(d, d.eventos[0], fo).map(x => [x.k, x.sub])).toEqual([
            ['no', 'Regla 1 · Todo lo demás · Eligió una respuesta que descalifica'],
        ]);
    });

    it('un evento con closer fijo no segmenta', () => {
        const d = armar();
        expect(segmentosDe(d, { ...d.eventos[0], persona: 'ana' }, d.formularios[0]).map(x => x.n)).toEqual(['Llamada con Ana Paz']);
    });
});

describe('PruebaSegmento', () => {
    it('saltea el formulario y muestra los horarios de la prioridad elegida, con su closer', () => {
        const { container } = render(<Probar d={armar()} />);
        abrir();
        expect(screen.getByRole('heading', { name: '¿Con qué segmentación llega el lead?' })).toBeInTheDocument();
        expect(screen.getByText(/se prueba el borrador/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('radio', { name: /Prioridad B/ }));

        expect(screen.getByRole('heading', { name: 'Lead, elegí día y horario' })).toBeInTheDocument();
        expect(screen.getByText(/Prioridad B · no se agenda nada/)).toBeInTheDocument();
        fireEvent.click(container.querySelector('.rv-dia:not(:disabled)'));
        fireEvent.click(container.querySelector('.rv-hora'));
        fireEvent.click(container.querySelector('[data-rv="confirmar"]'));
        // La vista del closer: el horario es de Beto (la regla de Ana no cuenta: se forzó Prioridad B).
        expect(screen.getByText('Vista del closer (solo prueba)')).toBeInTheDocument();
        expect(screen.getAllByText(/Beto Ruiz/).length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: /Probar de nuevo/ }));
        expect(screen.getByRole('heading', { name: '¿Con qué segmentación llega el lead?' })).toBeInTheDocument();
    });

    it('el enlace con &seg= va directo, y una regla con url muestra a dónde iría el lead', () => {
        const { container } = render(<Probar d={armar()} />);
        abrir('r1');
        expect(screen.getByRole('heading', { name: 'Gracias, Lead.' })).toBeInTheDocument();
        expect(screen.getByText('En el link real, el lead va a academy.thelearnation.com/.')).toBeInTheDocument();
        expect(container.querySelector('.rv-dia')).toBeNull();
    });

    it('el que no califica ve el cierre', () => {
        render(<Probar d={armar()} />);
        abrir('no');
        expect(screen.getByRole('heading', { name: 'Gracias por tu sinceridad' })).toBeInTheDocument();
    });

    it('un evento que no existe lo avisa y Escape cierra el selector', () => {
        render(<Probar d={armar()} />);
        abrir('', 'nada');
        expect(screen.getByRole('heading', { name: 'Ese evento ya no existe' })).toBeInTheDocument();
        abrir();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(ui.getState().prueba).toBeNull();
    });
});
