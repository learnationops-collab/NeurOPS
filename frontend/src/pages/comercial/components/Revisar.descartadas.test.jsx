import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import Revisar from './Revisar';
import { TABLAS, agendaEntraPorDefecto, estadoDeAgenda } from './tablasDef';

/**
 * Las agendas descartadas en la tabla Agendas: fuera del listado por defecto, en su propio filtro.
 *
 * Pedido del usuario (02/10/2026): las que el lead canceló o el closer marcó como lead perdido o
 * no lead «deben desaparecer y quedar en otro lugar aparte». Y una llamada cuya hora ya pasó no
 * puede figurar como próxima.
 */

const POST = {
    pendiente: { key: 'pendiente', label: 'Pendiente', tone: 'idle' },
    asistio: { key: 'asistio', label: 'Asistió', tone: 'success' },
    cancelo: { key: 'cancelo', label: 'Canceló', tone: 'idle' },
    lead_perdido: { key: 'lead_perdido', label: 'Lead perdido', tone: 'error' },
    no_lead: { key: 'no_lead', label: 'No lead', tone: 'idle' },
};

const agenda = (id, nombre, post, extra = {}) => ({
    tipo: 'agenda', id, client_id: id, cliente: nombre, ig: '', email: '', telefono: '',
    fecha: '2026-09-10T15:00:00', creada: '2026-09-08T15:00:00', fuente: 'Meta Ads',
    closer: 'Nerina', closer_id: 1, setter: '', setter_id: null,
    pre_call: { key: 'confirmada', label: 'Confirmada', tone: 'info' },
    post_call: POST[post], estado_libro: post, asistio: post === 'asistio', realizada: post === 'asistio',
    presento: false, retraso_dias: 0, ya_paso: true,
    descartada: ['cancelo', 'lead_perdido', 'no_lead'].includes(post),
    con_venta: false, venta_tipo: null, con_sena: false, ...extra,
});

const FILAS = [
    agenda(1, 'Ana Gomez', 'asistio'),
    agenda(2, 'Beto Diaz', 'lead_perdido'),
    agenda(3, 'Carla Ruiz', 'cancelo'),
    agenda(4, 'Dani Paz', 'no_lead'),
    agenda(5, 'Eva Sol', 'pendiente'),
];

const props = (extra = {}) => ({
    tabla: 'agendas', setTabla: () => {}, datos: { filas: FILAS }, cargando: false, rol: 'closers',
    basis: 'meet', setBasis: () => {}, alcance: 'Todo el equipo', onAbrirFila: () => {},
    filtroInicial: null, onOlvidarFiltro: () => {}, puedeElegirEquipo: true, ...extra,
});

const nombres = () => screen.queryAllByRole('button', { name: /^Abrir / })
    .map(b => b.getAttribute('aria-label').replace('Abrir ', ''));

describe('Agendas · las descartadas', () => {
    beforeEach(() => { window.localStorage.clear(); });

    it('no entran en el listado por defecto', () => {
        render(<Revisar {...props()} />);

        expect(nombres()).toEqual(['Ana Gomez', 'Eva Sol']);
    });

    it('se ven en su propio filtro, cada una con su nombre', () => {
        render(<Revisar {...props()} />);

        fireEvent.click(screen.getByRole('button', { name: /^Vigentes/ }));
        fireEvent.click(screen.getByRole('menuitemradio', { name: /^Descartadas/ }));

        expect(nombres()).toEqual(['Beto Diaz', 'Carla Ruiz', 'Dani Paz']);
        expect(screen.getAllByText('Lead perdido').length).toBeGreaterThan(0);
        expect(screen.getAllByText('No lead').length).toBeGreaterThan(0);
        expect(screen.queryByText('Otro estado')).toBeNull();
    });

    it('pedidas por estado desde un filtro se muestran aunque el rápido siga en el de por defecto', () => {
        render(<Revisar {...props({ filtroInicial: { estado: 'Lead perdido', __t: 1 } })} />);

        expect(nombres()).toEqual(['Beto Diaz']);
    });
});

describe('agendaEntraPorDefecto', () => {
    it('deja afuera la descartada salvo que el estado la pida', () => {
        expect(agendaEntraPorDefecto(FILAS[1], {})).toBe(false);
        expect(agendaEntraPorDefecto(FILAS[1], { post_call: ['Lead perdido'] })).toBe(true);
        expect(agendaEntraPorDefecto(FILAS[0], {})).toBe(true);
    });

    it('es el filtro por defecto de las dos tablas de agendas', () => {
        expect(TABLAS.agendas.chips[0].filtro).toBe(agendaEntraPorDefecto);
        expect(TABLAS.generadas.chips[0].filtro).toBe(agendaEntraPorDefecto);
        expect(TABLAS.agendas.chips.find(c => c.key === 'descartadas')?.label).toBe('Descartadas');
    });
});

describe('estadoDeAgenda', () => {
    it('una pendiente cuya hora ya pasó es "Sin reporte" aunque sea de hoy', () => {
        const hoy = agenda(9, 'Hoy', 'pendiente', { retraso_dias: 0, ya_paso: true });
        expect(estadoDeAgenda(hoy)).toBe('Sin reporte');
        expect(estadoDeAgenda({ ...hoy, ya_paso: false })).toBe('Aún no ocurrió');
    });
});
