import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Comparativas from './Comparativas';

/**
 * La bajada del ranking de show up dice sobre cuántas agendas se midió.
 *
 * En una fila de setter, `agendas` son los LEADS que agendaron con él y `generadas` las agendas
 * que generó: el show up se mide sobre las segundas. Con `agendas` primero, el ranking decía
 * "34 agendas" debajo de un show up calculado sobre 70.
 */

const SHOW_UP = { key: 'show_up', label: 'Show up', formato: 'pct', suma: false, desc: '' };

const datos = (rol, fila) => ({
    rol, yo: null, metricas: [SHOW_UP], columnas_info: [], equipo: { show_up: 50 },
    filas: [{ id: 1, nombre: 'Persona', show_up: 50, deltas: {}, ...fila }],
});

describe('Comparativas · la bajada del show up', () => {
    it('para un setter cuenta las agendas que generó', () => {
        render(<Comparativas datos={datos('setters', { agendas: 34, generadas: 70 })} irAPersona={() => {}} />);
        expect(screen.getByText('70 agendas')).toBeInTheDocument();
        expect(screen.queryByText('34 agendas')).toBeNull();
    });

    it('para un closer siguen siendo sus agendas', () => {
        render(<Comparativas datos={datos('closers', { agendas: 41 })} irAPersona={() => {}} />);
        expect(screen.getByText('41 agendas')).toBeInTheDocument();
    });
});

describe('Comparativas · mirada por un closer', () => {
    // Un closer ve a su equipo pero no puede abrir la lista de otro: sin `irAPersona` ninguna
    // fila ni celda lleva a una persona, y su propia fila se marca con "· vos".
    it('las filas son solo lectura y la suya dice "vos"', () => {
        render(<Comparativas datos={{ ...datos('closers', { agendas: 41 }), yo: 1 }} irAPersona={null} />);
        expect(screen.getByText('Persona · vos')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Ver la lista de/ })).toBeNull();
    });
});

describe('Comparativas · el líder contra el promedio', () => {
    // Con setters el equipo suma también los leads sin setter asignado, así que el promedio por
    // persona puede quedar arriba del primero. Decía «+-16.5 sobre el promedio».
    const LEADS = { key: 'leads', label: 'Leads', formato: 'num', suma: true, desc: '' };
    const conLeads = {
        rol: 'setters', yo: null, metricas: [LEADS], columnas_info: [], equipo: { leads: 300 },
        filas: [{ id: 1, nombre: 'Elias', leads: 120, deltas: {} }, { id: 2, nombre: 'Paula', leads: 80, deltas: {} }],
    };

    it('si el primero queda por debajo, lo dice', () => {
        render(<Comparativas irAPersona={null} datos={conLeads} />);

        expect(screen.getByText('Lidera Elias · −30 bajo el promedio')).toBeInTheDocument();
    });

    it('sin `irAPersona` el mapa no promete abrir listas', () => {
        render(<Comparativas irAPersona={null} datos={conLeads} />);

        expect(screen.getByText('Tocá el encabezado para rankear.')).toBeInTheDocument();
    });
});

const etapas = (ns) => ['entrantes', 'cualificados', 'dolor', 'oferta', 'link', 'agendas', 'generadas',
    'asistieron', 'ventas'].map((key, i) => ({
    key, label: key[0].toUpperCase() + key.slice(1), n: ns[i], fuente: i < 6 ? 'reporte' : 'sistema',
    tasa: null, ...(key === 'generadas' ? { cruce: true } : {}),
}));

const conEmbudos = (extra = {}) => ({
    ...datos('setters', {}),
    filas: [{ id: 1, nombre: 'Elias', show_up: 50, deltas: {} }, { id: 2, nombre: 'Paula', show_up: 40, deltas: {} }],
    embudos: {
        filas: [{ id: 1, nombre: 'Elias', etapas: etapas([100, 60, 30, 20, 15, 12, 10, 5, 2]) },
            { id: 2, nombre: 'Paula', etapas: etapas([40, 30, 20, 10, 8, 6, 6, 3, 1]) }],
        equipo: { id: 'equipo', nombre: 'Equipo', etapas: etapas([140, 90, 50, 30, 23, 18, 16, 8, 3]) },
    },
    ...extra,
});

describe('Comparativas · los embudos de los setters', () => {
    // Pedido del usuario (10/10/2026): en la comparativa de setters, el embudo de cada uno y el del
    // equipo, del reporte diario a las ventas.
    it('cada setter y el equipo tienen su embudo, y la fila propia dice "vos"', () => {
        render(<Comparativas datos={conEmbudos({ yo: 1 })} irAPersona={null} />);

        expect(screen.getByText('Embudos')).toBeInTheDocument();
        expect(screen.getAllByText('Elias · vos')).toHaveLength(2); // el ranking y su embudo
        expect(screen.getByText('100 entrantes → 2 ventas · 2%')).toBeInTheDocument();
        expect(screen.getByText('40 entrantes → 1 venta · 2.5%')).toBeInTheDocument();
        expect(screen.getByText('140 entrantes → 3 ventas · 2.1%')).toBeInTheDocument();
        // Solo lectura: un setter no abre la lista de nadie.
        expect(screen.queryByRole('button', { name: /Ver la lista:/ })).toBeNull();
    });

    it('a la dirección, las etapas del sistema le abren la lista de esa persona', () => {
        const irAPersona = vi.fn();
        render(<Comparativas datos={conEmbudos()} irAPersona={irAPersona} />);

        // Tres etapas del sistema por embudo: Elias, Paula y el equipo.
        expect(screen.getAllByRole('button', { name: /^Ver la lista: (Generadas|Asistieron|Ventas),/ })).toHaveLength(9);
        fireEvent.click(screen.getByRole('button', { name: 'Ver la lista: Asistieron, 3' }));
        expect(irAPersona).toHaveBeenCalledWith(2, {
            tabla: 'generadas', filtro: { asistio: 'Sí' }, de: 'Agendas generadas que asistieron' });
    });

    it('la comparativa de closers no trae embudos', () => {
        render(<Comparativas datos={datos('closers', { agendas: 41 })} irAPersona={() => {}} />);

        expect(screen.queryByText('Embudos')).toBeNull();
    });
});
