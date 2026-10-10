import { afterEach, describe, expect, it, vi } from 'vitest';
import { TABLAS } from './tablasDef';
import { columnasExportables } from './exportarColumnas';
import { BOM, armarCsv, celdasDe, descargarCsv, escaparCampo, formatoDe, nombreDeArchivo, nombreValido,
    textoDeCelda } from './exportarCsv';

/**
 * El CSV de «Exportar»: escape, separadores, decimales, BOM y fechas.
 *
 * El archivo tiene que abrir bien en un Excel en español (`;` y coma decimal) y en Google Sheets
 * (`,` y punto decimal), con los acentos legibles y los números como números.
 */

const EXCEL = formatoDe('excel');
const SHEETS = formatoDe('internacional');

const col = (key, header, valor = (f) => f[key]) => ({ key, header, valor });

describe('exportar CSV · el texto de cada celda', () => {
    it('números crudos: sin $ ni separador de miles, con el decimal del formato', () => {
        expect(textoDeCelda(1234567.5, EXCEL)).toBe('1234567,5');
        expect(textoDeCelda(1234567.5, SHEETS)).toBe('1234567.5');
        expect(textoDeCelda(2000, EXCEL)).toBe('2000');
        expect(textoDeCelda(-500.25, EXCEL)).toBe('-500,25');
    });

    it('sin el ruido de la coma flotante', () => {
        expect(textoDeCelda(0.1 + 0.2, EXCEL)).toBe('0,3');
        expect(textoDeCelda(0.1 + 0.2, SHEETS)).toBe('0.3');
    });

    it('vacío es vacío: null, undefined y un número que no es número', () => {
        expect(textoDeCelda(null, EXCEL)).toBe('');
        expect(textoDeCelda(undefined, EXCEL)).toBe('');
        expect(textoDeCelda(Number.NaN, EXCEL)).toBe('');
    });

    it('un texto que la planilla tomaría por fórmula lleva un apóstrofo adelante', () => {
        expect(textoDeCelda('=HYPERLINK("x")', EXCEL)).toBe('\'=HYPERLINK("x")');
        expect(textoDeCelda('+54 11 5555', EXCEL)).toBe('\'+54 11 5555');
        expect(textoDeCelda('@ana', EXCEL)).toBe('\'@ana');
        expect(textoDeCelda('-', EXCEL)).toBe('\'-');
        // Un número negativo es un número, no una fórmula.
        expect(textoDeCelda(-3, EXCEL)).toBe('-3');
        expect(textoDeCelda('Ana Pérez', EXCEL)).toBe('Ana Pérez');
    });

    it('un objeto que se escapara del test de columnas no se escribe como «[object Object]»', () => {
        expect(textoDeCelda({ key: 'x', label: 'Pago completo' }, EXCEL)).toBe('Pago completo');
        expect(textoDeCelda({ a: 1 }, EXCEL)).toBe('');
    });
});

describe('exportar CSV · escape', () => {
    it('entre comillas solo lo que trae el separador, comillas o un salto de línea', () => {
        expect(escaparCampo('Pérez; Ana', ';')).toBe('"Pérez; Ana"');
        expect(escaparCampo('Pérez, Ana', ';')).toBe('Pérez, Ana');
        expect(escaparCampo('Pérez, Ana', ',')).toBe('"Pérez, Ana"');
        expect(escaparCampo('dijo "no"', ';')).toBe('"dijo ""no"""');
        expect(escaparCampo('dos\nlíneas', ';')).toBe('"dos\nlíneas"');
        expect(escaparCampo('retorno\r', ',')).toBe('"retorno\r"');
        expect(escaparCampo('', ';')).toBe('');
    });

    it('un decimal con coma, en el formato de Excel en español, no parte la celda', () => {
        const csv = armarCsv({ filas: [{ monto: 1.5 }], columnas: [col('monto', 'Monto')], formato: EXCEL });
        expect(csv).toBe(`${BOM}Monto\r\n1,5\r\n`);
    });

    it('con el formato internacional, el mismo decimal va con punto y el texto con coma entre comillas', () => {
        const csv = armarCsv({ filas: [{ n: 'Pérez, Ana', monto: 1.5 }],
            columnas: [col('n', 'Cliente'), col('monto', 'Monto')], formato: SHEETS });
        expect(csv).toBe(`${BOM}Cliente,Monto\r\n"Pérez, Ana",1.5\r\n`);
    });
});

describe('exportar CSV · el archivo', () => {
    const VENTA = {
        tipo: 'venta', fecha: '2026-09-10T10:00:00', cliente: 'Ana "La" Pérez', ig: '@ana', programa: 'ACE',
        tipo_pago: { key: 'completo', label: 'Pago completo', tone: 'success' }, metodo: 'Stripe; Link',
        monto: 1234.5, closer: 'Nerina', academia: null,
    };
    const columnas = columnasExportables(TABLAS.ventas).filter(c => TABLAS.ventas.cols.some(k => k.key === c.columna));

    it('empieza con el BOM de UTF-8 y separa las líneas con CRLF', () => {
        const csv = armarCsv({ filas: [VENTA], columnas, formato: EXCEL });
        expect(csv.startsWith(BOM)).toBe(true);
        expect(csv.charCodeAt(0)).toBe(0xFEFF);
        expect(csv.split('\r\n')).toHaveLength(3);
    });

    it('una venta real: encabezados, fecha ISO con hora, monto crudo y escape donde hace falta', () => {
        const [cabecera, linea] = armarCsv({ filas: [VENTA], columnas, formato: EXCEL }).slice(1).split('\r\n');
        expect(cabecera).toBe('Fecha de la venta;Cliente;Instagram;Programa;Pago;Método;Monto;Closer');
        expect(linea).toBe('2026-09-10 10:00;"Ana ""La"" Pérez";\'@ana;ACE;Pago completo;"Stripe; Link";1234,5;Nerina');
    });

    it('la vista previa y el archivo escriben las mismas celdas', () => {
        const [celdas] = celdasDe([VENTA], columnas, SHEETS);
        const linea = armarCsv({ filas: [VENTA], columnas, formato: SHEETS }).slice(1).split('\r\n')[1];
        expect(linea).toBe(celdas.map(t => escaparCampo(t, ',')).join(','));
        expect(celdas[6]).toBe('1234.5');
    });

    it('sin filas, solo los encabezados', () => {
        expect(armarCsv({ filas: [], columnas: [col('a', 'A'), col('b', 'B')], formato: EXCEL }))
            .toBe(`${BOM}A;B\r\n`);
    });
});

describe('exportar CSV · el nombre del archivo', () => {
    it('la tabla y el período', () => {
        expect(nombreDeArchivo('ventas', { start: '2026-10-01', end: '2026-10-31' }, '2026-10-10'))
            .toBe('ventas_2026-10-01_2026-10-31.csv');
    });

    it('la cartera es un saldo a hoy: lleva la fecha de hoy y no la del período', () => {
        expect(nombreDeArchivo('clientes', { start: '2026-10-01', end: '2026-10-31' }, '2026-10-10'))
            .toBe('clientes_2026-10-10.csv');
    });

    it('sin el período todavía, la fecha de hoy', () => {
        expect(nombreDeArchivo('agendas', undefined, '2026-10-10')).toBe('agendas_2026-10-10.csv');
    });

    it('lo que escribe el usuario: con .csv, sin caracteres prohibidos, y vacío vuelve al de siempre', () => {
        expect(nombreValido('cobranza octubre', 'x.csv')).toBe('cobranza octubre.csv');
        expect(nombreValido('cobranza.CSV', 'x.csv')).toBe('cobranza.CSV');
        expect(nombreValido('a/b:c', 'x.csv')).toBe('a-b-c.csv');
        expect(nombreValido('   ', 'x.csv')).toBe('x.csv');
    });
});

describe('exportar CSV · la descarga', () => {
    afterEach(() => { vi.useRealTimers(); });

    it('un Blob de texto CSV y un link temporal con el nombre elegido', () => {
        vi.useFakeTimers();
        const crear = vi.fn(() => 'blob:x');
        const revocar = vi.fn();
        const originales = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };
        URL.createObjectURL = crear;
        URL.revokeObjectURL = revocar;
        const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function anotar() {
            expect(this.download).toBe('ventas.csv');
            expect(this.getAttribute('href')).toBe('blob:x');
        });
        try {
            descargarCsv(`${BOM}A\r\n`, 'ventas.csv');
            expect(clic).toHaveBeenCalledTimes(1);
            const [blob] = crear.mock.calls[0];
            expect(blob.type).toBe('text/csv;charset=utf-8');
            expect(document.querySelector('a[download]')).toBeNull();
            vi.runAllTimers();
            expect(revocar).toHaveBeenCalledWith('blob:x');
        } finally {
            URL.createObjectURL = originales.crear;
            URL.revokeObjectURL = originales.revocar;
        }
    });
});
