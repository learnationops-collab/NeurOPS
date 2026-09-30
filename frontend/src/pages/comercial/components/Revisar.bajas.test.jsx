import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import Revisar from './Revisar';
import { ESTADO_CARTERA, TABLAS, entraPorDefecto } from './tablasDef';

/**
 * Los dados de baja en la tabla Clientes: fuera del listado por defecto, en su propio filtro.
 *
 * Pedido del usuario (30/09/2026): «que dejen de aparecer en las listas [...] y que se vea en otro
 * filtro». La fila llega igual del backend —lo que pagó es de la cartera—: es la tabla la que la
 * deja afuera por defecto y la muestra en «Dados de baja».
 */

const cliente = (id, nombre, extra = {}) => ({
    tipo: 'cliente', id, client_id: id, cliente: nombre, ig: '', email: '', telefono: '',
    fecha: '2026-08-01T00:00:00', closer: 'Nerina', programa: 'Residency Roadmap',
    pagado: 400, deuda: 0, cobros: 1, cuota_monto: null, cuota_fecha: null, cuota_vencida: false,
    cuota_numero: null, baja: null, estado: { key: 'al_dia', label: 'Al día', tone: 'success' },
    ...extra,
});

const FILAS = [
    cliente(1, 'Ana Gomez', {
        estado: { key: 'baja', label: 'Dado de baja', tone: 'idle' },
        baja: { fecha: '2026-09-12T10:00:00', fecha_legible: '12 sep 2026', motivo: 'No puede pagar', por: 'lucia' },
    }),
    cliente(2, 'Beto Diaz', {
        deuda: 900, cuota_monto: 300, cuota_fecha: '2026-09-20', cuota_vencida: true,
        estado: { key: 'vencida', label: 'Cuota vencida', tone: 'error' },
    }),
    cliente(3, 'Carla Ruiz'),
];

const props = (extra = {}) => ({
    tabla: 'clientes', setTabla: () => {}, datos: { filas: FILAS }, cargando: false, rol: 'closers',
    basis: 'meet', setBasis: () => {}, alcance: 'Todo el equipo', onAbrirFila: () => {},
    filtroInicial: null, onOlvidarFiltro: () => {}, puedeElegirEquipo: true, ...extra,
});

const nombres = () => screen.queryAllByRole('button', { name: /^Abrir / })
    .map(b => b.getAttribute('aria-label').replace('Abrir ', ''));

const elegirRapido = (etiqueta) => {
    fireEvent.click(screen.getByRole('button', { name: /^Vigentes/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: new RegExp(`^${etiqueta}`) }));
};

describe('Clientes · los dados de baja', () => {
    beforeEach(() => { window.localStorage.clear(); });

    it('no entran en el listado por defecto', () => {
        render(<Revisar {...props()} />);

        expect(nombres()).toEqual(['Beto Diaz', 'Carla Ruiz']);
        expect(screen.getByText('mostrando 2 de 3')).toBeInTheDocument();
    });

    it('se ven en su propio filtro, con cuándo y por qué se fueron', () => {
        render(<Revisar {...props()} />);

        elegirRapido('Dados de baja');

        expect(nombres()).toEqual(['Ana Gomez']);
        const fila = screen.getByRole('button', { name: 'Abrir Ana Gomez' });
        expect(within(fila).getByText('12 sep 2026 · No puede pagar')).toBeInTheDocument();
        expect(within(fila).getAllByText('Dado de baja').length).toBeGreaterThan(0);
    });

    it('«Al día» no los cuenta: no terminaron de pagar', () => {
        render(<Revisar {...props()} />);

        elegirRapido('Al día');

        expect(nombres()).toEqual(['Carla Ruiz']);
    });

    it('pedidos por estado desde un filtro se muestran aunque el rápido siga en el de por defecto', () => {
        render(<Revisar {...props({ filtroInicial: { estado: ESTADO_CARTERA.baja, __t: 1 } })} />);

        expect(nombres()).toEqual(['Ana Gomez']);
    });

    it('la tira de totales los cuenta aparte y no como al día', () => {
        render(<Revisar {...props()} />);

        expect(screen.getByText(/1 al día · 1 de baja/)).toBeInTheDocument();
    });
});

describe('entraPorDefecto', () => {
    it('deja afuera la baja salvo que el estado la pida', () => {
        const baja = FILAS[0];
        expect(entraPorDefecto(baja, {})).toBe(false);
        expect(entraPorDefecto(baja, undefined)).toBe(false);
        expect(entraPorDefecto(baja, { estado: [ESTADO_CARTERA.baja] })).toBe(true);
        expect(entraPorDefecto(FILAS[1], {})).toBe(true);
    });

    it('es el filtro de por defecto de Clientes y existe el de las bajas', () => {
        const chips = TABLAS.clientes.chips;
        expect(chips[0].filtro).toBe(entraPorDefecto);
        expect(chips.find(c => c.key === 'bajas')?.label).toBe('Dados de baja');
    });
});
