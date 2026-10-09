import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Diferencias, { pasaFiltro, resumenDeCarga } from './Diferencias';

/**
 * Finanzas › Diferencias (09/10/2026): los CSV de Stripe y Hotmart contra lo reportado. Los KPIs de
 * arriba, los filtros por pasarela y estado, el buscador, las correcciones rápidas («Usar $X», pasar
 * la venta a la otra pasarela, editar a mano), marcar revisada, subir un CSV y los estados vacíos.
 */

const api = vi.hoisted(() => ({
    getConciliacion: vi.fn(),
    subirCsv: vi.fn(),
    borrarCarga: vi.fn(),
    corregirVenta: vi.fn(),
    marcarRevisada: vi.fn(),
}));
vi.mock('./finanzasApi', () => api);
vi.mock('../../../../components/ficha/FichaLeadModal', () => ({
    default: ({ clientId, seccionInicial, pestanaInicial }) => (
        <div data-testid="ficha">{`${clientId} · ${pestanaInicial} · ${seccionInicial || 'sin sección'}`}</div>
    ),
}));

const SEPTIEMBRE = { desde: '2026-09-01', hasta: '2026-09-30', mes: '2026-09' };

const venta = (id, nombre, monto, extra = {}) => ({
    id, nombre, monto, fecha: '2026-09-26T10:00:00', email: `${nombre.split(' ')[0].toLowerCase()}@prueba.com`,
    tipo_pago: 'AL - Cuota', metodo_pago: 'Stripe', cliente_id: null, en_periodo: true, ...extra,
});
const cobro = (id, nombre, bruto, extra = {}) => ({
    id, nombre, bruto, neto: Math.round(bruto * 95.5) / 100, comision: Math.round(bruto * 4.5) / 100,
    fecha: '2026-09-26T23:29:57', email: `${nombre.split(' ')[0].toLowerCase()}@prueba.com`, nota: null,
    bruto_desconocido: false, carga_id: 1, cliente_id: null, cliente_nombre: null, pasarela: 'stripe',
    en_periodo: true, ...extra,
});
const fila = (clave, estado, ventaFila, cobros, extra = {}) => {
    const reportado = ventaFila ? ventaFila.monto : null;
    const ingresado = cobros.length ? cobros.reduce((s, c) => s + c.bruto, 0) : null;
    return {
        clave, estado, pasarela: 'stripe', identidad: ventaFila && cobros.length ? 'correo' : null,
        fecha: (cobros[0] || ventaFila).fecha, venta: ventaFila, movimientos: cobros, reportado, ingresado,
        diferencia: Math.round(((ingresado || 0) - (reportado || 0)) * 100) / 100, aporte: 0,
        cliente_id: null, revisada: null, candidatos: [], sugerencia: null, ...extra,
    };
};

const ANA = fila('v1+maaaaaaaaaa', 'coincide', venta(1, 'Ana Prueba', 250), [cobro(11, 'Ana Prueba', 250)]);
const KERVIN = fila('v2+mbbbbbbbbbb', 'monto_distinto', venta(2, 'Kervin Calderón', 480, { cliente_id: 9 }),
    [cobro(12, 'Kervin Calderon', 480.77, { fecha: '2026-09-27T02:29:57' })], {
        cliente_id: 9, identidad: 'nombre',
        candidatos: [{ tipo: 'venta', id: 7, pasarela: 'stripe', motivo: 'misma_persona', identidad: 'nombre',
            fecha: '2026-09-27T00:00:00', monto: 20, nombre: 'Kervin Calderón', email: null, ocupado: true }],
    });
const ADRIAN = fila('mcccccccccc', 'sin_reportar', null,
    [cobro(13, 'Adrian Prueba', 100, { fecha: '2026-09-05T20:41:05', nota: 'No esta en los reportes' })]);
const LUZ = fila('mdddddddddd', 'sin_reportar', null, [cobro(14, 'Luz Prueba', 50, { pasarela: 'hotmart', cliente_id: 33 })],
    { pasarela: 'hotmart', cliente_id: 33 });
const GRETA = fila('v5', 'sin_ingreso', venta(5, 'Greta Castro', 250), [],
    { sugerencia: { venta_id: 5, metodo_pago: 'Hotmart' } });

const kpis = (extra = {}) => ({
    reportado: 980, ventas: 3, ingresado: 880.77, movimientos: 3, neto: 841.14, comision: 39.63,
    comision_estimada: 44.1, diferencia: -99.23, diferencia_por: { pendientes: -99.23, revisadas: 0, otro_periodo: 0 },
    pendientes: { monto_distinto: 1, sin_reportar: 1, sin_ingreso: 1, total: 3 }, coinciden: 1, revisadas: 0,
    con_csv: true, ...extra,
});

const datos = (filas = [ANA, KERVIN, ADRIAN, LUZ, GRETA], extra = {}) => ({
    desde: '2026-09-01', hasta: '2026-09-30', mes: '2026-09', filas,
    kpis: {
        todas: kpis({ pendientes: { monto_distinto: 1, sin_reportar: 2, sin_ingreso: 1, total: 4 } }),
        stripe: kpis(),
        hotmart: kpis({ reportado: 0, ventas: 0, ingresado: 50, neto: 45.55, comision: 4.45, movimientos: 1, diferencia: 50,
            diferencia_por: { pendientes: 50, revisadas: 0, otro_periodo: 0 },
            pendientes: { monto_distinto: 0, sin_reportar: 1, sin_ingreso: 0, total: 1 }, coinciden: 0 }),
    },
    pasarelas: {
        stripe: { con_csv: true, desde: '2026-09-01T00:05:06', hasta: '2026-09-30T21:25:29', movimientos: 3 },
        hotmart: { con_csv: true, desde: '2026-09-03T09:08:01', hasta: '2026-09-30T19:53:14', movimientos: 1 },
    },
    cargas: [{ id: 1, pasarela: 'stripe', archivo: 'stripe.csv', filas: 3, nuevas: 3, repetidas: 0, omitidas: 0,
        subido_por: 'kerwin', subido_at: '2026-10-09T10:00:00', desde: '2026-09-01T00:05:06',
        hasta: '2026-09-30T21:25:29', movimientos: 3, en_periodo: 3 }],
    opciones: {
        medios: [{ clave: 'Stripe', label: 'Stripe' }, { clave: 'Hotmart', label: 'Hotmart' },
            { clave: 'Transferencia Bancaria', label: 'Transferencia bancaria' }],
        transferido_a: [{ clave: 'pedro', label: 'Pedro' }, { clave: 'jean_carlo', label: 'Jean Carlo' }],
    },
    ...extra,
});

// Las cifras cuentan hasta su valor (`Cifra`): se espera con `waitFor`.
const cifra = (rotulo) => screen.getByText(rotulo, { selector: '.t-eyebrow' }).closest('.kpi').querySelector('.kpi-n');
const montar = async (respuesta = datos()) => {
    api.getConciliacion.mockResolvedValue(respuesta);
    render(<Diferencias periodo={SEPTIEMBRE} />);
    await screen.findByText('Lo reportado contra lo ingresado');
};
const nombres = () => [...document.querySelectorAll('.fz-dif-fila .fz-dif-nom b')].map(b => b.textContent);

beforeEach(() => {
    vi.clearAllMocks();
    api.corregirVenta.mockResolvedValue({ cambios: ['monto'] });
    api.marcarRevisada.mockResolvedValue({ revisada: true });
});

describe('Diferencias · KPIs y filtros', () => {
    it('arriba van lo reportado, lo ingresado, la diferencia con signo y los pendientes', async () => {
        await montar();

        await waitFor(() => expect(cifra('Reportado').textContent).toBe('$980.00'));
        // Lo ingresado en neto, con el bruto y la comisión debajo (09/10/2026); la diferencia es la
        // del bruto.
        await waitFor(() => expect(cifra('Ingresado').textContent).toBe('$841.14'));
        expect(screen.getByText('bruto $880.77 · comisión $39.63')).toBeInTheDocument();
        await waitFor(() => expect(cifra('Diferencia').textContent).toBe('-$99.23'));
        expect(cifra('Diferencia').style.color).toBe('var(--error)');
        await waitFor(() => expect(cifra('Pendientes').textContent).toBe('4'));
        expect(screen.getByText('1 monto · 2 sin reportar · 1 sin ingreso')).toBeInTheDocument();
        expect(api.getConciliacion).toHaveBeenCalledWith(SEPTIEMBRE);
    });

    it('arranca en las pendientes; los chips filtran por estado y la pasarela cambia filas y KPIs', async () => {
        await montar();

        expect(nombres()).toEqual(['Kervin Calderón', 'Adrian Prueba', 'Luz Prueba', 'Greta Castro']);
        fireEvent.click(screen.getByRole('tab', { name: /^Coinciden/ }));
        expect(nombres()).toEqual(['Ana Prueba']);
        fireEvent.click(screen.getByRole('tab', { name: /^Sin reportar/ }));
        expect(nombres()).toEqual(['Adrian Prueba', 'Luz Prueba']);

        fireEvent.click(screen.getByRole('tab', { name: 'Hotmart' }));
        expect(nombres()).toEqual(['Luz Prueba']);
        await waitFor(() => expect(cifra('Ingresado').textContent).toBe('$45.55'));
        // Esperada como la de arriba: las cifras cuentan hasta su valor y, con la máquina cargada, la
        // diferencia todavía estaba en $0.00 cuando se leía de una.
        await waitFor(() => expect(cifra('Diferencia').textContent).toBe('+$50.00'));
    });

    it('«Todas» dice cuánto de lo reportado y lo ingresado fue por transferencia; una pasarela, no', async () => {
        // Pedido del 09/10/2026: las transferencias no vienen en ningún CSV, pero son plata que entró.
        const base = datos();
        await montar({ ...base, kpis: { ...base.kpis,
            todas: { ...base.kpis.todas, transferencias: { total: 150, ventas: 1 } } } });

        expect(screen.getAllByText('incluye $150.00 por transferencia')).toHaveLength(2);
        fireEvent.click(screen.getByRole('tab', { name: 'Stripe' }));
        expect(screen.queryByText('incluye $150.00 por transferencia')).not.toBeInTheDocument();
    });

    it('el buscador encuentra por nombre, correo o monto, sin tildes', async () => {
        await montar();
        const buscar = screen.getByRole('searchbox', { name: 'Buscar en las diferencias' });

        fireEvent.change(buscar, { target: { value: 'calderon' } });
        expect(nombres()).toEqual(['Kervin Calderón']);
        fireEvent.change(buscar, { target: { value: '480.77' } });
        expect(nombres()).toEqual(['Kervin Calderón']);
        fireEvent.change(buscar, { target: { value: 'nadie' } });
        expect(screen.getByText('Ninguna fila coincide con «nadie».')).toBeInTheDocument();
    });

    it('pasaFiltro: las revisadas salen de pendientes y de su estado, y se ven en «Revisadas»', () => {
        const revisada = { ...KERVIN, revisada: { por: 'kerwin', at: '2026-10-09T10:00:00', nota: null } };

        expect(pasaFiltro(revisada, 'pendientes')).toBe(false);
        expect(pasaFiltro(revisada, 'monto_distinto')).toBe(false);
        expect(pasaFiltro(revisada, 'revisadas')).toBe(true);
        expect(pasaFiltro(ANA, 'pendientes')).toBe(false);
        expect(pasaFiltro(ANA, 'todas')).toBe(true);
    });
});

describe('Diferencias · correcciones rápidas', () => {
    it('«Usar $X» pregunta en su lugar y pone el bruto real en la venta; después vuelve a pedir la conciliación', async () => {
        await montar();

        fireEvent.click(screen.getByRole('button', { name: 'Usar $480.77' }));
        const pregunta = screen.getByRole('group', { name: '¿Poner $480.77?' });
        await act(async () => { fireEvent.click(within(pregunta).getByRole('button', { name: 'Sí' })); });

        expect(api.corregirVenta).toHaveBeenCalledWith(2, { monto: 480.77 });
        expect(api.getConciliacion).toHaveBeenCalledTimes(2);
    });

    it('«No» cancela sin tocar nada', async () => {
        await montar();

        fireEvent.click(screen.getByRole('button', { name: 'Usar $480.77' }));
        fireEvent.click(within(screen.getByRole('group', { name: '¿Poner $480.77?' })).getByRole('button', { name: 'No' }));

        expect(api.corregirVenta).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Usar $480.77' })).toBeInTheDocument();
    });

    it('una venta que entró por la otra pasarela se pasa con un clic confirmado', async () => {
        await montar();

        fireEvent.click(screen.getByRole('button', { name: 'Pasar la venta a Hotmart' }));
        await act(async () => {
            fireEvent.click(within(screen.getByRole('group', { name: '¿La venta fue por Hotmart?' }))
                .getByRole('button', { name: 'Sí' }));
        });

        expect(api.corregirVenta).toHaveBeenCalledWith(5, { metodo_pago: 'Hotmart' });
    });

    it('marcar como revisada guarda la fila con su estado', async () => {
        await montar();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Marcar como revisada la diferencia de Kervin Calderón' }));
        });

        expect(api.marcarRevisada).toHaveBeenCalledWith('v2+mbbbbbbbbbb', true, { estado: 'monto_distinto', nota: '' });
        expect(api.getConciliacion).toHaveBeenCalledTimes(2);
    });

    it('una revisada se ve apagada en «Revisadas» y vuelve a pendientes con un clic', async () => {
        const revisada = { ...KERVIN, revisada: { por: 'kerwin', at: '2026-10-09T10:00:00', nota: 'redondeo' } };
        await montar(datos([ANA, revisada]));

        expect(screen.getByText('Nada pendiente: lo reportado y lo ingresado cierran.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: /^Revisadas/ }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Volver a pendientes la diferencia de Kervin Calderón' }));
        });

        expect(api.marcarRevisada).toHaveBeenCalledWith('v2+mbbbbbbbbbb', false, {});
    });

    it('el detalle muestra el aviso de identidad débil, los candidatos y corrige a mano', async () => {
        await montar();

        fireEvent.click(screen.getByRole('button', { name: 'Ver el detalle de Kervin Calderón' }));
        const detalle = screen.getByRole('region', { name: 'Detalle de la diferencia' });
        expect(within(detalle).getByText(/Por el nombre: el correo del cobro es otro/)).toBeInTheDocument();
        expect(within(detalle).getByText(/ya está en otra fila/)).toBeInTheDocument();

        const editor = within(detalle).getByRole('group', { name: 'Corregir la venta de Kervin Calderón' });
        const guardar = within(editor).getByRole('button', { name: 'Guardar corrección' });
        expect(guardar).toBeDisabled();
        fireEvent.change(within(editor).getByLabelText('Monto reportado'), { target: { value: '470' } });
        fireEvent.click(within(editor).getByRole('button', { name: 'Fecha del cobro' }));
        await act(async () => { fireEvent.click(guardar); });

        expect(api.corregirVenta).toHaveBeenCalledWith(2, { monto: 470, fecha: '2026-09-27' });
    });

    it('un cobro sin reportar de un cliente abre su ficha en Pagos; sin cliente, lo dice', async () => {
        await montar();

        expect(screen.getByText('Sin cliente')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Agregar pago' }));

        expect(screen.getByTestId('ficha').textContent).toBe('33 · hist · pagos');
    });
});

describe('Diferencias · subir CSV', () => {
    const archivo = (nombre) => new File(['Fecha,Monto\n2026-09-02,75\n'], nombre, { type: 'text/csv' });

    it('sube el archivo, avisa lo que entró y, si no se sabe de qué pasarela es, la pregunta', async () => {
        await montar();
        api.subirCsv
            .mockRejectedValueOnce({ response: { data: { codigo: 'pasarela', error: 'No se reconoce', columnas: ['Fecha'] } } })
            .mockResolvedValueOnce({ archivo: 'cobros.csv', pasarela: 'stripe', nuevas: 1, repetidas: 0, omitidas: 0 });
        const cobros = archivo('cobros.csv');

        await act(async () => {
            fireEvent.change(screen.getByLabelText('Archivos CSV'), { target: { files: [cobros] } });
        });
        const elegir = await screen.findByRole('group', { name: 'Pasarela de cobros.csv' });
        await act(async () => { fireEvent.click(within(elegir).getByRole('button', { name: 'Es de Stripe' })); });

        expect(api.subirCsv).toHaveBeenNthCalledWith(1, cobros, null);
        expect(api.subirCsv).toHaveBeenNthCalledWith(2, cobros, 'stripe');
        expect(screen.queryByRole('group', { name: 'Pasarela de cobros.csv' })).toBeNull();
    });

    it('el resumen de una carga dice cuántos cobros entraron, cuántos ya estaban y cuántas filas se omitieron', () => {
        expect(resumenDeCarga({ archivo: 'stripe.csv', pasarela: 'stripe', nuevas: 38, repetidas: 2, omitidas: 1 }))
            .toBe('stripe.csv: 38 cobros nuevos de Stripe · 2 ya estaban · 1 fila omitida');
        expect(resumenDeCarga({ archivo: 'stripe.csv', pasarela: 'stripe', nuevas: 0, repetidas: 38, omitidas: 0 }))
            .toBe('stripe.csv: ya estaba subido (38 cobros repetidos)');
    });
});

describe('Diferencias · estados vacíos', () => {
    it('sin CSV en el período: la zona para soltarlos y los KPIs sin lo ingresado', async () => {
        const sinCsv = datos([], {
            kpis: { todas: kpis({ con_csv: false, ingresado: null, diferencia: null, diferencia_por: null,
                pendientes: { monto_distinto: 0, sin_reportar: 0, sin_ingreso: 0, total: 0 } }),
            stripe: kpis({ con_csv: false }), hotmart: kpis({ con_csv: false }) },
            pasarelas: { stripe: { con_csv: false, movimientos: 0 }, hotmart: { con_csv: false, movimientos: 0 } },
            cargas: [],
        });
        await montar(sinCsv);

        expect(screen.getByText('Subí los CSV de Stripe y Hotmart del período para ver qué no cierra.')).toBeInTheDocument();
        expect(cifra('Ingresado').textContent).toBe('—');
        expect(cifra('Pendientes').textContent).toBe('—');
        expect(screen.getByText('Falta el CSV del período')).toBeInTheDocument();
        expect(screen.getByText('Todavía no se subió ningún CSV.')).toBeInTheDocument();
        expect(screen.queryByRole('searchbox')).toBeNull();
    });

    it('con el CSV de una sola pasarela, «Todas» dice cuál falta', async () => {
        const base = datos([ANA]);
        await montar({ ...base, kpis: { ...base.kpis, todas: { ...base.kpis.todas, pasarelas: ['stripe'] } } });

        expect(screen.getByText('3 ventas · solo Stripe, falta el CSV de Hotmart')).toBeInTheDocument();
    });

    it('con todo conciliado, «Nada pendiente»', async () => {
        await montar(datos([ANA]));

        expect(screen.getByText('Nada pendiente: lo reportado y lo ingresado cierran.')).toBeInTheDocument();
    });
});
