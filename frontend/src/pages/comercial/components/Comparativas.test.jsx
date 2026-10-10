import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
