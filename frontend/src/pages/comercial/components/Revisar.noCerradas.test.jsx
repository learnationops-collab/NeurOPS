import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import Revisar from './Revisar';
import { DESTINOS_CIERRES, DESTINOS_CLOSER } from './destinos';
import { cerro } from './tablasDef';
import { cargaDe } from '../../../components/dashboard/MetricaClicable';

/**
 * «No cerradas» del panel Cierre → Revisar › Agendas.
 *
 * El número cuenta las agendas con show up que no terminaron ni en venta ni en seña, por la marca
 * `no_cerrada` que el backend pone en cada fila. La lista tiene que mostrar EXACTAMENTE esas
 * filas: ni las ventas, ni las señas, ni las que no asistieron (que no "no cerraron": no ocurrieron).
 */

const agenda = (id, post, { asistio = true, noCerrada = false } = {}) => ({
    tipo: 'agenda', id, client_id: id, cliente: `Cliente ${id}`, ig: '', fecha: '2026-09-10T10:00:00',
    fuente: 'Instagram', closer: 'Nerina', realizada: true, retraso_dias: 0, ya_paso: true, asistio,
    presento: asistio, no_cerrada: noCerrada, descartada: false,
    pre_call: { key: 'confirmada', label: 'Confirmada', tone: 'success' },
    post_call: { key: post.key, label: post.label, tone: 'info' },
});

const VENTA = { key: 'venta', label: 'Venta' };
const SENA = { key: 'sena', label: 'Seña' };
const SEGUIMIENTO = { key: 'seguimiento', label: 'Seguimiento' };
const SEGUNDA = { key: 'segunda_llamada', label: '2da llamada' };
const NO_SHOW = { key: 'no_show', label: 'No show' };

const FILAS = [
    agenda(1, VENTA), agenda(2, SENA),
    agenda(3, SEGUIMIENTO, { noCerrada: true }), agenda(4, SEGUNDA, { noCerrada: true }),
    agenda(5, { key: 'asistio', label: 'Asistió' }, { noCerrada: true }),
    agenda(6, NO_SHOW, { asistio: false }),
];

const props = (extra = {}) => ({
    tabla: 'agendas', setTabla: () => {}, datos: { filas: FILAS }, cargando: false, rol: 'closers',
    basis: 'meet', setBasis: () => {}, alcance: 'Todo el equipo', onAbrirFila: () => {},
    filtroInicial: null, onOlvidarFiltro: () => {}, puedeElegirEquipo: true, ...extra,
});

const registros = () => screen.queryAllByRole('button', { name: /^Abrir / })
    .map(b => b.getAttribute('aria-label'));

describe('Revisar · las «No cerradas» del panel Cierre', () => {
    beforeEach(() => { window.localStorage.clear(); });

    it('la faceta «Cerró» solo pregunta de las que asistieron, y lee la marca del backend', () => {
        expect(FILAS.map(cerro)).toEqual(['Sí', 'Sí', 'No', 'No', 'No', null]);
    });

    it('el destino abre exactamente las filas marcadas como no cerradas', () => {
        render(<Revisar {...props({ filtroInicial: { ...cargaDe(DESTINOS_CLOSER.no_cerradas), __t: 1 } })} />);

        expect(registros()).toEqual(['Abrir Cliente 3', 'Abrir Cliente 4', 'Abrir Cliente 5']);
        expect(registros()).toHaveLength(FILAS.filter(f => f.no_cerrada).length);
        expect(screen.getByRole('button', { name: 'Quitar Cerró: No' })).toBeInTheDocument();
    });

    it('la tarjeta del dashboard del closer lleva a la misma lista', () => {
        expect(DESTINOS_CIERRES.no_cerradas).toBe(DESTINOS_CLOSER.no_cerradas);
    });
});
