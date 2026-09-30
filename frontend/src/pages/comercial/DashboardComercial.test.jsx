import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DashboardComercial from './DashboardComercial';

/**
 * El drill-down de "Mis datos" existe solo si hay una lista a la que llegar.
 *
 * El setter no ve Revisar (pedido del 29/09/2026): embebido en su espacio, el dashboard no recibe
 * `onIrASeccion` y cada flecha o número cliqueable llevaría a ninguna parte. El closer (que tiene
 * "Mi cartera") y la dirección (que tiene su dock) lo siguen teniendo.
 *
 * Analizar se reemplaza por un doble que dice si recibió `irA`: sin él, el real ya muestra los
 * números como números (ver `MetricaClicable` y `abrir`).
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
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 7, role: 'setter', is_impersonating: false } }),
}));
vi.mock('./components/Analizar', () => ({
    default: ({ irA }) => <div data-testid="analizar">{irA ? 'con drill-down' : 'sin drill-down'}</div>,
}));

const montar = (props) => render(
    <MemoryRouter initialEntries={['/x']}>
        <DashboardComercial {...props} />
    </MemoryRouter>,
);

describe('DashboardComercial · drill-down de Analizar', () => {
    it('embebido sin a dónde ir (el espacio del setter), no lo ofrece', async () => {
        montar({ embebido: true, seccionFija: 'analizar' });
        expect(await screen.findByTestId('analizar')).toHaveTextContent('sin drill-down');
    });

    it('embebido con Revisar en el host (el mazo del closer), lo ofrece', async () => {
        montar({ embebido: true, seccionFija: 'analizar', onIrASeccion: () => {} });
        expect(await screen.findByTestId('analizar')).toHaveTextContent('con drill-down');
    });

    it('suelto, con su propio dock (la dirección), lo ofrece', async () => {
        montar({});
        expect(await screen.findByTestId('analizar')).toHaveTextContent('con drill-down');
    });
});
