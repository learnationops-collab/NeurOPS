import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ModalNoCerradas from './ModalNoCerradas';
import Analizar from './Analizar';
import Revisar from './Revisar';
import { DESTINOS_CIERRES } from './destinos';
import { cargaDe } from '../../../components/dashboard/MetricaClicable';

/**
 * «No cerradas» del panel Cierre (pedido del usuario, 09/10/2026): el dato abre un modal con cada lead
 * y la objeción registrada, desde el que se va a la lista de esas agendas en Revisar.
 *
 * Que la lista del modal sea la de Revisar lo garantiza el backend (las dos salen de la marca
 * `no_cerrada`, ver tests/api/test_comercial_no_cerradas.py); acá se comprueba que el modal dibuje lo
 * que llega y que su «Ver en Revisar» deje en la lista exactamente esas filas.
 */

const agenda = (id, nombre, post, { noCerrada = true, asistio = true, objecion = null } = {}) => ({
    tipo: 'agenda', id, client_id: 100 + id, cliente: nombre, ig: '', fecha: `2026-09-1${id}T15:30:00`,
    fuente: 'Setter', closer: 'Marlon', realizada: true, retraso_dias: 0, ya_paso: true, asistio,
    presento: asistio, no_cerrada: noCerrada, descartada: false,
    pre_call: { key: 'confirmada', label: 'Confirmada', tone: 'info' },
    post_call: { key: post.key, label: post.label, tone: 'warning' },
    objecion,
});

const SEGUIMIENTO = { key: 'seguimiento', label: 'Seguimiento' };
const SEGUNDA = { key: 'segunda_llamada', label: '2da llamada' };

const NO_CERRADAS = [
    agenda(1, 'Luciana Paredes', SEGUIMIENTO, {
        objecion: { texto: 'Lo tiene que hablar con la pareja', autor: 'Marlon', fecha: '2026-09-11T16:00:00' },
    }),
    agenda(2, 'Tomás Ibarra', SEGUNDA),
];

/** Las mismas dos más lo que Revisar también trae del período y el modal no muestra. */
const TABLA = [
    ...NO_CERRADAS.map(({ objecion: _o, ...f }) => f),
    agenda(3, 'Compró', { key: 'venta', label: 'Venta' }, { noCerrada: false }),
    agenda(4, 'Dejó seña', { key: 'sena', label: 'Seña' }, { noCerrada: false }),
    agenda(5, 'No vino', { key: 'no_show', label: 'No show' }, { noCerrada: false, asistio: false }),
];

// Las fechas viajan en UTC y sin Z (`isoformat()`). La expectativa se arma con la misma cuenta en la
// zona del proceso, así el test no depende del huso de la máquina.
const dos = (n) => String(n).padStart(2, '0');
const enLocal = (iso, conHora) => {
    const d = new Date(`${iso}Z`);
    const dia = `${dos(d.getDate())}/${dos(d.getMonth() + 1)}`;
    return conHora ? `${dia} ${dos(d.getHours())}:${dos(d.getMinutes())}` : dia;
};

/** Espera a que la promesa de `cargar` se resuelva y React pinte. */
const esperarCarga = () => act(() => new Promise((listo) => { setTimeout(listo, 0); }));

const montar = async (props = {}) => {
    const cargar = props.cargar || vi.fn(() => Promise.resolve({ filas: NO_CERRADAS }));
    const r = render(<ModalNoCerradas cargar={cargar} total={2} onCerrar={vi.fn()} {...props} />);
    await esperarCarga();
    return { ...r, cargar };
};

const dialogo = () => screen.getByRole('dialog', { name: 'No cerradas' });

describe('ModalNoCerradas', () => {
    beforeEach(() => { document.body.style.overflow = ''; });

    it('lista cada lead con su closer, la fecha de la llamada, su estado y la objeción', async () => {
        await montar({ onAbrir: vi.fn() });

        const lista = within(dialogo()).getByRole('list', { name: 'Agendas no cerradas' });
        const filas = within(lista).getAllByRole('listitem');
        expect(filas).toHaveLength(2);

        expect(filas[0]).toHaveTextContent('Luciana Paredes');
        // En el reloj de quien mira, como la ficha que abre la fila: no el ISO en UTC recortado.
        expect(filas[0]).toHaveTextContent(`Marlon · ${enLocal('2026-09-11T15:30:00', true)}`);
        expect(filas[0]).toHaveTextContent('Seguimiento');
        expect(filas[0]).toHaveTextContent('Lo tiene que hablar con la pareja');
        expect(filas[0]).toHaveTextContent(`Marlon · ${enLocal('2026-09-11T16:00:00', false)}`);
        expect(dialogo()).toHaveTextContent('2 llamadas con show up sin venta ni seña');
    });

    it('una agenda sin objeción lo dice y dice dónde se carga', async () => {
        await montar({ onAbrir: vi.fn() });

        const [, sin] = within(dialogo()).getAllByRole('listitem');
        expect(sin).toHaveTextContent('Sin objeción registrada');
        expect(sin).toHaveTextContent('Abrí la ficha del lead y cargala desde el Historial.');
    });

    it('tocar un lead abre su ficha con la fila tal como vino', async () => {
        const onAbrir = vi.fn();
        await montar({ onAbrir });

        fireEvent.click(screen.getByRole('button', { name: 'Abrir la ficha de Tomás Ibarra' }));

        expect(onAbrir).toHaveBeenCalledWith(NO_CERRADAS[1]);
    });

    it('sin quien abra la ficha las filas no son botones', async () => {
        await montar();

        expect(screen.queryByRole('button', { name: /Abrir la ficha/ })).toBeNull();
        expect(within(dialogo()).getAllByRole('listitem')[1])
            .toHaveTextContent('Se carga desde el Historial de la ficha del lead.');
    });

    it('«Ver en Revisar» cierra el modal y lleva a las agendas no cerradas', async () => {
        const irA = vi.fn();
        const onCerrar = vi.fn();
        await montar({ irA, destino: DESTINOS_CIERRES.no_cerradas, onCerrar });

        fireEvent.click(screen.getByRole('button', { name: /Ver en Revisar/ }));

        expect(onCerrar).toHaveBeenCalled();
        expect(irA).toHaveBeenCalledWith('agendas', expect.objectContaining({ cerro: 'No', __de: 'No cerradas' }));
    });

    it('donde no hay Revisar no hay botón', async () => {
        await montar({ irA: null, destino: DESTINOS_CIERRES.no_cerradas });

        expect(screen.queryByRole('button', { name: /Ver en Revisar/ })).toBeNull();
    });

    it('la lista de Revisar a la que lleva tiene las mismas filas que el modal', async () => {
        const irA = vi.fn();
        const { unmount } = await montar({ irA, destino: DESTINOS_CIERRES.no_cerradas });
        const enModal = within(dialogo()).getAllByRole('listitem').length;
        fireEvent.click(screen.getByRole('button', { name: /Ver en Revisar/ }));
        const [tabla, filtro] = irA.mock.calls[0];
        unmount();

        render(<Revisar tabla={tabla} setTabla={() => {}} datos={{ filas: TABLA }} cargando={false}
            rol="closers" basis="meet" setBasis={() => {}} alcance="Marlon" onAbrirFila={() => {}}
            filtroInicial={{ ...filtro, __t: 1 }} onOlvidarFiltro={() => {}} puedeElegirEquipo={false} />);

        const enRevisar = screen.getAllByRole('button', { name: /^Abrir / }).map(b => b.getAttribute('aria-label'));
        expect(enRevisar).toEqual(['Abrir Luciana Paredes', 'Abrir Tomás Ibarra']);
        expect(enRevisar).toHaveLength(enModal);
    });

    it('sin no cerradas lo dice en vez de dejar una lista vacía', async () => {
        await montar({ cargar: () => Promise.resolve({ filas: [] }) });
        expect(dialogo()).toHaveTextContent('Ninguna llamada con show up quedó sin cerrar en el período.');
    });

    it('un error deja reintentar y el reintento vuelve a pedir la lista', async () => {
        const cargar = vi.fn()
            .mockRejectedValueOnce(new Error('red'))
            .mockResolvedValueOnce({ filas: NO_CERRADAS });
        await montar({ cargar });

        expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la lista.');
        fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
        await esperarCarga();

        expect(cargar).toHaveBeenCalledTimes(2);
        expect(within(dialogo()).getAllByRole('listitem')).toHaveLength(2);
    });
});

/* ---------------------------------------------------------------------------------------------- */

const CIERRES = {
    ventas: 3, ventas_completo: 2, ventas_split: 1, senas: 1, asistieron: 6, presentaciones: 5,
    presentacion: { num: 5, den: 6, pct: 83.3 },
    sin_senas: { por_llamada: { num: 3, den: 6, pct: 50 }, por_presentacion: { num: 3, den: 5, pct: 60 } },
    solo_senas: { por_llamada: { num: 1, den: 6, pct: 16.7 }, por_presentacion: { num: 1, den: 5, pct: 20 } },
    no_cerradas: { num: 2, den: 6, pct: 33.3 },
};

const BLOQUE = {
    agendas: 7, realizadas: 7, asistieron: 6, show_up: 85.7, cerradas: 3, close_rate: 50,
    presentaciones: 5, presentacion_rate: 83.3, close_presentacion: 60, cierres: CIERRES, estados: [],
    cash: 0, cash_neto: 0, ventas: 3, ticket: null, comision: 0, cash_por_dia: [], mejor_dia: null,
    programas: [], funnel: [], payment_types: [],
    senas: { total: 0, completo: 0, parcial: 0, espera: 0, caida: 0, conversion: null, cobrado: 0,
        ticket: null, desbloqueado: 0 },
};

const DATOS = { rol: 'closers', actual: BLOQUE, deltas: {}, por_cobrar: null, fuentes: null };

describe('Analizar › Cierre › No cerradas', () => {
    beforeEach(() => { document.body.style.overflow = ''; });

    const tira = () => screen.getByRole('group', { name: 'No cerradas' });

    const abrirLista = () => fireEvent.click(
        within(tira()).getByRole('button', { name: /^Ver los leads: No cerradas · 2 de 6/ }));

    it('la cifra abre el modal; sin cargador, la cifra va a Revisar', async () => {
        const irA = vi.fn();
        const cargar = vi.fn(() => Promise.resolve({ filas: NO_CERRADAS }));
        const { rerender } = render(<Analizar datos={DATOS} rol="closers" irA={irA}
            cargarNoCerradas={cargar} onAbrirFila={vi.fn()} />);

        // Un solo botón en la tira: la cantidad con su base y la flecha.
        expect(within(tira()).getAllByRole('button')).toHaveLength(1);
        expect(within(tira()).getByRole('button')).toHaveTextContent('2de 6 · 33.3%');
        abrirLista();
        await esperarCarga();
        expect(dialogo()).toBeInTheDocument();
        expect(cargar).toHaveBeenCalledTimes(1);
        expect(irA).not.toHaveBeenCalled();

        fireEvent.click(within(dialogo()).getByRole('button', { name: 'Cerrar' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        rerender(<Analizar datos={DATOS} rol="closers" irA={irA} />);
        fireEvent.click(within(tira()).getByRole('button', { name: /No cerradas · 2 de 6/ }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(irA).toHaveBeenCalledWith('agendas', expect.objectContaining({ cerro: 'No' }));
    });

    it('un lead cierra el modal, abre la ficha, y al cerrarla se vuelve a la lista', async () => {
        const onAbrirFila = vi.fn();
        const cargar = vi.fn(() => Promise.resolve({ filas: NO_CERRADAS }));
        render(<Analizar datos={DATOS} rol="closers" irA={vi.fn()} cargarNoCerradas={cargar}
            onAbrirFila={onAbrirFila} />);

        abrirLista();
        await esperarCarga();
        fireEvent.click(screen.getByRole('button', { name: 'Abrir la ficha de Luciana Paredes' }));

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(onAbrirFila).toHaveBeenCalledWith(NO_CERRADAS[0], { alCerrar: expect.any(Function) });

        // La ficha se cierra: el host llama a `alCerrar` y la lista vuelve, pedida de nuevo por si
        // en la ficha se cargó una objeción.
        await act(async () => { onAbrirFila.mock.calls[0][1].alCerrar(); });
        await esperarCarga();
        expect(dialogo()).toBeInTheDocument();
        expect(cargar).toHaveBeenCalledTimes(2);
    });

    it('el destino de «Ver en Revisar» es el mismo de la tarjeta', () => {
        expect(cargaDe(DESTINOS_CIERRES.no_cerradas)).toEqual(
            expect.objectContaining({ cerro: 'No', __de: 'No cerradas' }));
    });
});
