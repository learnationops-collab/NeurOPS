import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { TABLAS, defDe } from './tablasDef';
import { PARTES_POR_COLUMNA, alternarColumna, columnasElegidas, columnasExportables, eleccionInicial,
    fechaDeFila, marcarTodas, moverColumna } from './exportarColumnas';
import { cuandoDe } from './Shared';

/**
 * Cada columna de Revisar sabe escribirse en el CSV de «Exportar» con un valor plano.
 *
 * Las columnas dibujan JSX (chips, «$1,234», una bajada debajo del dato) y el archivo necesita el
 * texto o el número que hay detrás. Este test recorre TODAS las tablas y TODAS sus columnas —las
 * de siempre y las de la Academia— con filas completas y con filas vacías: si alguien agrega una
 * columna y no dice cómo se exporta, o la dice devolviendo un objeto, falla acá y no en la planilla
 * de alguien.
 */

const chip = (key, label) => ({ key, label, tone: 'info' });

const ACADEMIA = {
    estado: chip('activo', 'Activo'), horas: 12.5, progreso: 33.3, lecciones: 7, lecciones_total: 40,
    ejecuciones: 3, racha: 4, ultima_actividad: '2026-10-08T14:00:00Z', sincronizado: '2026-10-09T09:15:00Z',
    intentado: '2026-10-09T09:15:00Z', error: null,
};

const AGENDA = {
    tipo: 'agenda', id: 1, client_id: 3, fecha: '2026-10-02T20:30:00', creada: '2026-09-30T12:00:00',
    cliente: 'Ana Pérez', ig: '@ana', email: 'ana@x.com', telefono: '+54 11', fuente: 'Workshop',
    closer: 'Nerina', setter: 'Elias', pre_call: chip('confirmada', 'Confirmada'),
    post_call: chip('pendiente', 'Pendiente'), retraso_dias: 2, asistio: false,
};

const COMPLETAS = {
    agenda: AGENDA,
    venta: {
        tipo: 'venta', id: 2, client_id: 3, fecha: '2026-09-10T10:00:00', cliente: 'Ana Pérez', ig: '@ana',
        programa: 'ACE', tipo_pago: chip('completo', 'Pago completo'), metodo: 'Stripe', monto: 1234.5,
        monto_neto: 1190, closer: 'Nerina', academia: ACADEMIA,
        // Solo en las filas de quien opera (`operar=1`).
        estado: chip('reembolsada', 'Reembolsada'), completada: false, tiene_agenda: false,
    },
    lead: {
        tipo: 'lead', id: 4, fecha: '2026-10-01T03:10:00', cliente: 'Juan', ig: '@juan', fuente: 'ManyChat',
        setter: 'Elias', estado: chip('en_conversacion', 'En conversación'), mensajes: 5,
    },
    cliente: {
        tipo: 'cliente', id: 3, client_id: 3, cliente: 'Ana Pérez', ig: '@ana', programa: 'ACE',
        closer: 'Nerina', pagado: 2000, cobros: 2, deuda: 500.25, estado: chip('vencida', 'Cuota vencida'),
        cuota_monto: 250, cuota_fecha: '2026-10-05', cuota_vencida: true,
        baja: { fecha: '2026-10-06', fecha_legible: '06/10', motivo: 'No puede pagar' }, academia: ACADEMIA,
    },
};

// Lo mínimo con lo que una fila puede llegar: sin chips, sin Academia, sin fechas.
const VACIAS = {
    agenda: { tipo: 'agenda', id: 1 },
    venta: { tipo: 'venta', id: 2, academia: null },
    lead: { tipo: 'lead', id: 4 },
    cliente: { tipo: 'cliente', id: 3, academia: null, baja: null },
};

const TIPO_DE_TABLA = { agendas: 'agenda', generadas: 'agenda', ventas: 'venta', leads: 'lead', clientes: 'cliente' };

const esPlano = (v) => v === null || v === undefined || typeof v === 'string'
    || (typeof v === 'number' && Number.isFinite(v));

// Cada tabla como la ve la dirección y, si quien opera la ve con otras columnas (Ventas, `defDe`),
// también así: una columna de quien opera tiene que poder exportarse igual.
const DEFINICIONES = Object.keys(TABLAS).flatMap(tabla => [
    [tabla, tabla, TABLAS[tabla]],
    ...(defDe(tabla, true) !== TABLAS[tabla] ? [[`${tabla} (quien opera)`, tabla, defDe(tabla, true)]] : []),
]);

describe('exportar · cada columna de cada tabla da un valor plano', () => {
    it('las cinco tablas están cubiertas por los fixtures', () => {
        expect(Object.keys(TABLAS).sort()).toEqual(Object.keys(TIPO_DE_TABLA).sort());
    });

    it('Ventas de quien opera está en el recorrido', () => {
        expect(DEFINICIONES.map(([nombre]) => nombre)).toContain('ventas (quien opera)');
    });

    DEFINICIONES.forEach(([nombre, tabla, def]) => {
        const columnas = [...def.cols, ...(def.colsAcademia || [])];

        it(`${nombre}: toda columna dice cómo se exporta`, () => {
            const sinDefinir = columnas.map(c => c.key).filter(k => !(k in PARTES_POR_COLUMNA));
            expect(sinDefinir).toEqual([]);
        });

        it(`${nombre}: toda columna que es un dato tiene al menos una parte, sin claves repetidas`, () => {
            const exportables = columnasExportables(def);
            const conPartes = new Set(exportables.map(c => c.columna));
            columnas.filter(c => c.key !== 'ver').forEach(c => expect(conPartes.has(c.key)).toBe(true));
            const claves = exportables.map(c => c.key);
            expect(new Set(claves).size).toBe(claves.length);
            exportables.forEach(c => expect(c.header, c.key).toMatch(/\S/));
        });

        it(`${nombre}: cada parte da texto, número o vacío, nunca un objeto ni JSX`, () => {
            const tipo = TIPO_DE_TABLA[tabla];
            [COMPLETAS[tipo], VACIAS[tipo]].forEach(fila => {
                columnasExportables(def).forEach(c => {
                    const v = c.valor(fila);
                    expect(isValidElement(v), `${nombre}.${c.key}`).toBe(false);
                    expect(esPlano(v), `${nombre}.${c.key} dio ${JSON.stringify(v)}`).toBe(true);
                });
            });
        });

        it(`${nombre}: con una fila completa, ninguna parte principal sale vacía`, () => {
            const fila = COMPLETAS[TIPO_DE_TABLA[tabla]];
            columnasExportables(def).filter(c => c.key === c.columna).forEach(c => {
                expect(c.valor(fila), `${nombre}.${c.key}`).not.toBeNull();
            });
        });
    });
});

describe('exportar · qué escribe cada columna', () => {
    const valores = (tabla, fila) => Object.fromEntries(
        columnasExportables(TABLAS[tabla]).map(c => [c.key, c.valor(fila)]));
    const encabezados = (tabla) => Object.fromEntries(
        columnasExportables(TABLAS[tabla]).map(c => [c.key, c.header]));

    it('Ventas: el monto crudo, el pago y su método por separado, la fecha en ISO con su hora', () => {
        const v = valores('ventas', COMPLETAS.venta);
        expect(v.monto).toBe(1234.5);
        expect(v.tipo_pago).toBe('Pago completo');
        expect(v['tipo_pago.metodo']).toBe('Stripe');
        expect(v.fecha).toBe('2026-09-10 10:00');
        expect(v.cliente).toBe('Ana Pérez');
        expect(v['cliente.ig']).toBe('@ana');
        // «Venta» suelto en una planilla no dice que es una fecha.
        expect(encabezados('ventas').fecha).toBe('Fecha de la venta');
    });

    it('Ventas de quien opera: el estado de la venta y si tiene agenda, cada uno en su columna', () => {
        const partes = Object.fromEntries(columnasExportables(defDe('ventas', true)).map(c => [c.key, c]));
        expect(partes.estado_venta.header).toBe('Estado de la venta');
        expect(partes.estado_venta.valor(COMPLETAS.venta)).toBe('Reembolsada');
        expect(partes['estado_venta.agenda'].valor(COMPLETAS.venta)).toBe('Sin agenda');
        expect(partes['estado_venta.agenda'].valor({ ...COMPLETAS.venta, tiene_agenda: true })).toBe('Con agenda');
        // La dirección no tiene esas columnas: su Exportar no ofrece nada vacío.
        expect(columnasExportables(TABLAS.ventas).some(c => c.columna === 'estado_venta')).toBe(false);
    });

    it('una fecha sin hora sale solo con el día', () => {
        expect(fechaDeFila({ tipo: 'venta', fecha: '2026-09-10' })).toBe('2026-09-10');
    });

    it('agendas y leads: la fecha en hora local, la MISMA que muestra la lista', () => {
        [COMPLETAS.agenda, COMPLETAS.lead].forEach(fila => {
            const { dia, hora } = cuandoDe(fila);
            const [d, m] = dia.split('/');
            expect(fechaDeFila(fila)).toMatch(new RegExp(`^\\d{4}-${m}-${d} ${hora}$`));
        });
    });

    it('Clientes: la celda de la próxima cuota se abre en estado, fecha, monto y baja', () => {
        const v = valores('clientes', COMPLETAS.cliente);
        expect(v['cuota']).toBe('Cuota vencida');
        expect(v['cuota.fecha']).toBe('2026-10-05');
        expect(v['cuota.monto']).toBe(250);
        expect(v['cuota.baja']).toBe('2026-10-06');
        expect(v['cuota.motivo']).toBe('No puede pagar');
        expect(v.pagado).toBe(2000);
        expect(v['pagado.cobros']).toBe(2);
        expect(v.deuda).toBe(500.25);
        expect(encabezados('clientes').cuota).toBe('Estado');
    });

    it('la Academia: el estado, los números crudos y las lecciones en dos columnas', () => {
        const v = valores('clientes', COMPLETAS.cliente);
        expect(v.academia).toBe('Activo');
        expect(v.ac_horas).toBe(12.5);
        expect(v.ac_progreso).toBe(33.3);
        expect(v.ac_lecciones).toBe(7);
        expect(v['ac_lecciones.total']).toBe(40);
        expect(v.ac_racha).toBe(4);
        expect(v['academia.actividad']).toMatch(/^2026-10-0\d \d{2}:\d{2}$/);
        expect(encabezados('clientes').ac_racha).toBe('Racha (días)');
    });

    it('un dato que falta es una celda vacía, no un 0 ni un «—»', () => {
        const v = valores('clientes', VACIAS.cliente);
        expect(v.ac_horas).toBeNull();
        expect(v['cuota.monto']).toBeNull();
        expect(v.academia).toBeNull();
    });

    it('los días sin reportar solo donde la lista los muestra', () => {
        expect(valores('agendas', COMPLETAS.agenda)['post_call.retraso']).toBe(2);
        expect(valores('agendas', { ...COMPLETAS.agenda, retraso_dias: 0 })['post_call.retraso']).toBeNull();
    });

    it('la flecha que abre la fila no se ofrece', () => {
        expect(columnasExportables(TABLAS.agendas).some(c => c.columna === 'ver')).toBe(false);
    });

    it('Ventas ofrece también las columnas de la Academia, sin repetir fecha ni cliente', () => {
        const claves = columnasExportables(TABLAS.ventas).map(c => c.key);
        expect(claves).toContain('ac_horas');
        expect(claves.filter(k => k === 'fecha')).toHaveLength(1);
        expect(claves.filter(k => k === 'cliente')).toHaveLength(1);
    });
});

describe('exportar · la elección de columnas del panel', () => {
    const def = TABLAS.clientes;
    const exportables = columnasExportables(def);
    const prendidas = (e) => e.filter(c => c.on).map(c => c.key);

    it('sin memoria: las de la pantalla, en su orden y prendidas; el otro juego después, apagado', () => {
        const e = eleccionInicial(exportables, def.cols);
        expect(prendidas(e)).toEqual(['cliente', 'cliente.ig', 'programa', 'closer', 'pagado', 'pagado.cobros',
            'deuda', 'cuota', 'cuota.fecha', 'cuota.monto', 'cuota.baja', 'cuota.motivo']);
        expect(e.slice(prendidas(e).length).every(c => !c.on)).toBe(true);
        expect(e).toHaveLength(exportables.length);
    });

    it('viendo las columnas de la Academia, arranca con esas y en ESE orden', () => {
        const e = eleccionInicial(exportables, def.colsAcademia);
        expect(prendidas(e).slice(0, 4)).toEqual(['cliente', 'cliente.ig', 'closer', 'academia']);
        expect(prendidas(e)).not.toContain('programa');
    });

    it('con memoria: su orden y lo elegido; lo nuevo al final apagado, lo que ya no existe afuera', () => {
        const guardada = { orden: ['deuda', 'cliente', 'ya_no_existe'], elegidas: ['deuda', 'ya_no_existe'] };
        const e = eleccionInicial(exportables, def.cols, guardada);
        expect(e.slice(0, 2)).toEqual([{ key: 'deuda', on: true }, { key: 'cliente', on: false }]);
        expect(e.map(c => c.key)).not.toContain('ya_no_existe');
        expect(prendidas(e)).toEqual(['deuda']);
        expect(e).toHaveLength(exportables.length);
    });

    it('una memoria rota no rompe: arranca con lo que se ve', () => {
        expect(eleccionInicial(exportables, def.cols, { orden: 'x' }))
            .toEqual(eleccionInicial(exportables, def.cols));
    });

    it('subir y bajar cambian el orden; en las puntas no hacen nada', () => {
        const e = eleccionInicial(exportables, def.cols);
        expect(moverColumna(e, 'programa', -1).slice(0, 3).map(c => c.key)).toEqual(['cliente', 'programa', 'cliente.ig']);
        expect(moverColumna(e, 'cliente', 1).slice(0, 2).map(c => c.key)).toEqual(['cliente.ig', 'cliente']);
        expect(moverColumna(e, 'cliente', -1)).toBe(e);
        expect(moverColumna(e, e.at(-1).key, 1)).toBe(e);
    });

    it('alternar, todas y ninguna cambian qué va, no el orden', () => {
        const e = eleccionInicial(exportables, def.cols);
        expect(prendidas(alternarColumna(e, 'programa'))).not.toContain('programa');
        expect(prendidas(marcarTodas(e, true))).toEqual(e.map(c => c.key));
        expect(prendidas(marcarTodas(e, false))).toEqual([]);
        expect(marcarTodas(e, true).map(c => c.key)).toEqual(e.map(c => c.key));
    });

    it('las columnas que se escriben son las prendidas, en el orden elegido', () => {
        const e = moverColumna(eleccionInicial(exportables, def.cols), 'programa', -1);
        expect(columnasElegidas(e, exportables).slice(0, 3).map(c => c.header))
            .toEqual(['Cliente', 'Programa', 'Instagram']);
    });
});
