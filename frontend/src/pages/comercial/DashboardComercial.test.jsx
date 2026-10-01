import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DashboardComercial from './DashboardComercial';

/**
 * El drill-down de "Mis datos" existe solo si hay una lista a la que llegar.
 *
 * Embebido, la lista es del host: sin `onIrASeccion` cada flecha o número cliqueable llevaría a
 * ninguna parte. El closer ("Mi cartera"), el setter (Reporte · Registros) y la dirección (su
 * dock) lo tienen.
 *
 * Analizar se reemplaza por un doble que dice si recibió `irA` y, si lo recibió, lo usa con un
 * destino de verdad: sin él, el real ya muestra los números como números (ver `MetricaClicable` y
 * `abrir`).
 */

vi.mock('./comercialApi', () => ({
    getContexto: vi.fn(() => Promise.resolve({
        puede_elegir_equipo: false, puede_reportar: false, rol: 'setters',
        yo: { id: 7, rol: 'setter', nombre: 'Ana Setter' }, miembros: [], estados: [],
        periodos: [{ key: 'mes', label: 'Este mes' }],
        comparaciones: [{ key: 'prev', label: 'Período anterior' }],
    })),
    getResumen: vi.fn(() => Promise.resolve({})),
    getComparativas: vi.fn(() => Promise.resolve({})),
    getVariabilidad: vi.fn(() => Promise.resolve({})),
    getTabla: vi.fn(() => Promise.resolve({ filas: [] })),
    corregirAgenda: vi.fn(),
    marcarAgendaDuplicada: vi.fn(),
    eliminarAgenda: vi.fn(),
    sincronizarAcademia: vi.fn(() => Promise.resolve({ mensaje: 'ok', corte: null })),
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 7, role: 'setter', is_impersonating: false } }),
}));
vi.mock('./components/Analizar', () => ({
    default: ({ irA }) => (
        <div data-testid="analizar">
            {irA ? 'con drill-down' : 'sin drill-down'}
            {irA && (
                <button type="button"
                    onClick={() => irA('leads', { respondio: 'Sí', __de: 'Tasa de respuesta', __aviso: null })}>
                    respuesta
                </button>
            )}
        </div>
    ),
}));

const montar = (props, url = '/x') => render(
    <MemoryRouter initialEntries={[url]}>
        <DashboardComercial {...props} />
    </MemoryRouter>,
);

describe('DashboardComercial · drill-down de Analizar', () => {
    it('embebido sin a dónde ir, no lo ofrece', async () => {
        montar({ embebido: true, seccionFija: 'analizar' });
        expect(await screen.findByTestId('analizar')).toHaveTextContent('sin drill-down');
    });

    it('embebido con una lista en el host (mazo del closer, espacio del setter), lo ofrece', async () => {
        montar({ embebido: true, seccionFija: 'analizar', onIrASeccion: () => {} });
        expect(await screen.findByTestId('analizar')).toHaveTextContent('con drill-down');
    });

    it('suelto, con su propio dock (la dirección), lo ofrece', async () => {
        montar({});
        expect(await screen.findByTestId('analizar')).toHaveTextContent('con drill-down');
    });

    it('embebido, le pasa al host la query string con la tabla y el filtro ya escritos', async () => {
        // El host del setter navega por la URL en el mismo clic: si armara la suya desde la URL
        // del render, pisaría `t`/`f`/`ft` y la lista abriría sin condiciones.
        const onIrASeccion = vi.fn();
        montar({ embebido: true, seccionFija: 'analizar', onIrASeccion }, '/x?step=datos&p=mes');

        fireEvent.click(await screen.findByRole('button', { name: 'respuesta' }));

        expect(onIrASeccion).toHaveBeenCalledTimes(1);
        const [seccion, query] = onIrASeccion.mock.calls[0];
        expect(seccion).toBe('revisar');
        expect(query.get('t')).toBe('leads');
        expect(JSON.parse(query.get('f'))).toEqual({ respondio: 'Sí', __de: 'Tasa de respuesta' });
        expect(query.get('ft')).toBe('1');
        // Lo que ya estaba en la URL (la sección del host, el período) sigue ahí.
        expect(query.get('step')).toBe('datos');
        expect(query.get('p')).toBe('mes');
        // Embebido, la sección la elige el host: el dashboard no escribe la suya.
        expect(query.get('s')).toBeNull();
    });
});
