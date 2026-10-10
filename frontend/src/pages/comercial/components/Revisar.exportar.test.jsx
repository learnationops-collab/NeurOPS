import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Revisar from './Revisar';
import { BOM, descargarCsv } from './exportarCsv';

/**
 * «Exportar» en Revisar (10/10/2026): el panel con el que se decide qué y cómo exportar, con la vista
 * previa de lo que va a quedar escrito.
 *
 * Se monta el Revisar real con ventas: lo que se prueba es que el panel lea las MISMAS filas que la
 * lista (lo filtrado, en su orden) o todo el período, y que la vista previa y el archivo digan lo
 * mismo. La descarga se reemplaza por un espía: el Blob y el link ya se prueban en `exportarCsv`.
 */

vi.mock('./exportarCsv', async (importOriginal) => ({ ...(await importOriginal()), descargarCsv: vi.fn() }));

const venta = (id, extra = {}) => ({
    tipo: 'venta', id, client_id: id, cliente: `Cliente ${id}`, ig: '', closer: id % 2 ? 'Nerina' : 'Marlon',
    programa: 'ACE', fecha: `2026-10-0${id}T10:00:00`, metodo: 'Stripe', monto: 1000 + id + 0.5,
    monto_neto: 950, es_venta: true, academia: null,
    tipo_pago: id <= 4
        ? { key: 'completo', label: 'Pago completo', tone: 'success' }
        : { key: 'parcial', label: 'Split Pay', tone: 'info' },
    ...extra,
});
// Siete ventas: cuatro de pago completo y tres split pay.
const FILAS = [1, 2, 3, 4, 5, 6, 7].map(i => venta(i));

const props = (extra = {}) => ({
    tabla: 'ventas', setTabla: () => {}, cargando: false, rol: 'closers', basis: 'meet', setBasis: () => {},
    datos: { filas: FILAS, dates: { start: '2026-10-01', end: '2026-10-31' } },
    alcance: 'Todo el equipo', onAbrirFila: () => {}, filtroInicial: null, onOlvidarFiltro: () => {},
    puedeElegirEquipo: true, puedeExportar: true, ...extra,
});

const botonExportar = () => screen.getByRole('button', { name: 'Exportar' });
const abrir = () => fireEvent.click(botonExportar());
const panel = () => screen.getByRole('dialog', { name: 'Exportar' });
const columnas = () => within(panel()).getAllByRole('checkbox');
const nombres = () => columnas().map(c => c.textContent.replace(/\d+$/, '').replace('✓', ''));
const prendidas = () => columnas().filter(c => c.getAttribute('aria-checked') === 'true')
    .map(c => c.textContent.replace(/\d+$/, '').replace('✓', ''));
const previa = () => within(panel()).getByRole('region', { name: 'Vista previa' });
const encabezadosPrevia = () => within(previa()).getAllByRole('columnheader').map(th => th.textContent);
const filasPrevia = () => within(previa()).getAllByRole('row').slice(1)
    .map(tr => within(tr).getAllByRole('cell').map(td => td.textContent));
const medida = () => within(panel()).getByText(/filas? × \d+ columnas?$/).textContent;
const exportarCsv = () => fireEvent.click(within(panel()).getByRole('button', { name: 'Exportar CSV' }));

describe('Revisar · Exportar', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.mocked(descargarCsv).mockClear();
    });

    describe('el botón y el panel', () => {
        it('sin permiso no hay botón', () => {
            render(<Revisar {...props({ puedeExportar: false })} />);
            expect(screen.queryByRole('button', { name: 'Exportar' })).toBeNull();
        });

        it('va al lado del filtro completo, con su mismo aspecto, y abre el panel', () => {
            render(<Revisar {...props()} />);
            const filtro = screen.getByRole('button', { name: /Filtro completo/ });
            expect(filtro.nextElementSibling).toBe(botonExportar());
            expect(botonExportar()).toHaveClass('pastilla');
            expect(botonExportar()).toHaveAttribute('aria-haspopup', 'dialog');

            abrir();
            expect(botonExportar()).toHaveAttribute('aria-expanded', 'true');
            expect(panel()).toHaveClass('config-panel');
        });

        it('Configurar y Exportar no están abiertos a la vez', () => {
            render(<Revisar {...props()} />);
            fireEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
            expect(screen.getByRole('dialog', { name: 'Filtro completo' })).toBeInTheDocument();

            abrir();
            expect(screen.queryByRole('dialog', { name: 'Filtro completo' })).toBeNull();
            expect(panel()).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
            expect(screen.queryByRole('dialog', { name: 'Exportar' })).toBeNull();
        });

        it('Escape lo cierra y el foco vuelve al botón', () => {
            render(<Revisar {...props()} />);
            abrir();
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(screen.queryByRole('dialog', { name: 'Exportar' })).toBeNull();
            expect(botonExportar()).toHaveFocus();
        });

        it('un clic afuera lo cierra; uno adentro, no', () => {
            render(<Revisar {...props()} />);
            abrir();
            fireEvent.mouseDown(within(panel()).getByRole('radio', { name: /Lo que estás viendo/ }));
            expect(panel()).toBeInTheDocument();
            fireEvent.mouseDown(document.body);
            expect(screen.queryByRole('dialog', { name: 'Exportar' })).toBeNull();
        });
    });

    describe('las columnas', () => {
        it('arranca con las que se ven, en su orden, y ofrece apagadas las de la Academia', () => {
            render(<Revisar {...props()} />);
            abrir();
            expect(prendidas()).toEqual(['Fecha de la venta', 'Cliente', 'Instagram', 'Programa', 'Pago', 'Método',
                'Monto', 'Closer']);
            expect(nombres()).toEqual(expect.arrayContaining(['Academia', 'Horas', 'Racha (días)']));
            expect(nombres().indexOf('Academia')).toBeGreaterThan(nombres().indexOf('Closer'));
            expect(medida()).toBe('7 filas × 8 columnas');
        });

        it('viendo las columnas de la Academia, arranca con esas', () => {
            render(<Revisar {...props()} />);
            fireEvent.click(screen.getByRole('button', { name: 'Academia' }));
            abrir();
            expect(prendidas().slice(0, 4)).toEqual(['Fecha de la venta', 'Cliente', 'Instagram', 'Academia']);
            expect(prendidas()).not.toContain('Programa');
        });

        it('apagar, prender, subir y bajar cambia la vista previa en vivo', () => {
            render(<Revisar {...props()} />);
            abrir();
            fireEvent.click(within(panel()).getByRole('checkbox', { name: /^Instagram/ }));
            fireEvent.click(within(panel()).getByRole('checkbox', { name: /^Método/ }));
            expect(encabezadosPrevia()).toEqual(['Fecha de la venta', 'Cliente', 'Programa', 'Pago', 'Monto', 'Closer']);

            // Las flechas cuentan también las apagadas: Monto pasa primero a Método (apagada) y después
            // a Pago.
            fireEvent.click(within(panel()).getByRole('button', { name: 'Subir Monto' }));
            fireEvent.click(within(panel()).getByRole('button', { name: 'Subir Monto' }));
            fireEvent.click(within(panel()).getByRole('button', { name: 'Bajar Fecha de la venta' }));
            expect(encabezadosPrevia()).toEqual(['Cliente', 'Fecha de la venta', 'Programa', 'Monto', 'Pago', 'Closer']);
            expect(medida()).toBe('7 filas × 6 columnas');
        });

        it('en las puntas, subir y bajar no se pueden', () => {
            render(<Revisar {...props()} />);
            abrir();
            expect(within(panel()).getByRole('button', { name: 'Subir Fecha de la venta' })).toBeDisabled();
            const ultima = nombres().at(-1);
            expect(within(panel()).getByRole('button', { name: `Bajar ${ultima}` })).toBeDisabled();
        });

        it('«Ninguna» deja la vista previa vacía y no deja exportar; «Todas» las prende a todas', () => {
            render(<Revisar {...props()} />);
            abrir();
            fireEvent.click(within(panel()).getByRole('button', { name: 'Ninguna' }));
            expect(prendidas()).toEqual([]);
            expect(within(previa()).getByText('Elegí al menos una columna.')).toBeInTheDocument();
            expect(within(panel()).getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();

            fireEvent.click(within(panel()).getByRole('button', { name: 'Todas' }));
            expect(prendidas()).toEqual(nombres());
        });

        it('la última elección se recuerda por tabla', () => {
            const { unmount } = render(<Revisar {...props()} />);
            abrir();
            fireEvent.click(within(panel()).getByRole('checkbox', { name: /^Instagram/ }));
            fireEvent.click(within(panel()).getByRole('button', { name: 'Subir Closer' }));
            unmount();

            render(<Revisar {...props()} />);
            abrir();
            expect(prendidas()).toEqual(['Fecha de la venta', 'Cliente', 'Programa', 'Pago', 'Método', 'Closer',
                'Monto']);
        });

        it('sin localStorage (ventana privada, bloqueado) el panel anda igual', () => {
            const leer = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
            const escribir = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
            render(<Revisar {...props()} />);
            abrir();
            fireEvent.click(within(panel()).getByRole('checkbox', { name: /^Instagram/ }));
            expect(prendidas()).not.toContain('Instagram');
            expect(leer).toHaveBeenCalled();
            expect(escribir).toHaveBeenCalled();
        });
    });

    describe('la vista previa', () => {
        it('las primeras 5 filas con el texto exacto que va al archivo', () => {
            render(<Revisar {...props()} />);
            abrir();
            const filas = filasPrevia();
            expect(filas).toHaveLength(5);
            expect(filas[0]).toEqual(['2026-10-01 10:00', 'Cliente 1', '', 'ACE', 'Pago completo', 'Stripe',
                '1001,5', 'Nerina']);
        });

        it('el formato cambia el decimal en la vista previa y en el archivo', () => {
            render(<Revisar {...props()} />);
            abrir();
            fireEvent.click(within(panel()).getByRole('radio', { name: /Google Sheets/ }));
            expect(filasPrevia()[0][6]).toBe('1001.5');

            exportarCsv();
            const [contenido] = vi.mocked(descargarCsv).mock.calls[0];
            expect(contenido.startsWith(BOM)).toBe(true);
            const lineas = contenido.slice(1).split('\r\n');
            expect(lineas[0]).toBe('Fecha de la venta,Cliente,Instagram,Programa,Pago,Método,Monto,Closer');
            expect(lineas[1]).toBe('2026-10-01 10:00,Cliente 1,,ACE,Pago completo,Stripe,1001.5,Nerina');
        });

        it('Excel en español es el de siempre, y la elección del formato se recuerda', () => {
            const { unmount } = render(<Revisar {...props()} />);
            abrir();
            expect(within(panel()).getByRole('radio', { name: /Excel en español \(;\)/ }))
                .toHaveAttribute('aria-checked', 'true');
            fireEvent.click(within(panel()).getByRole('radio', { name: /Google Sheets \/ internacional \(,\)/ }));
            unmount();

            render(<Revisar {...props()} />);
            abrir();
            expect(within(panel()).getByRole('radio', { name: /Google Sheets/ })).toHaveAttribute('aria-checked', 'true');
        });
    });

    describe('qué filas', () => {
        it('por defecto, lo que se está viendo: búsqueda, facetas y filtro rápido, en el orden de la lista', () => {
            render(<Revisar {...props()} />);
            // Split Pay: las ventas 5, 6 y 7.
            fireEvent.click(screen.getByRole('button', { name: /^Todas/ }));
            fireEvent.click(screen.getByRole('menuitemradio', { name: /^Split Pay/ }));
            // Ordenadas por monto, de mayor a menor.
            fireEvent.click(screen.getByRole('button', { name: 'Ordenar' }));
            fireEvent.click(screen.getByRole('menuitemradio', { name: /^Monto/ }));
            abrir();

            expect(within(panel()).getByRole('radio', { name: /Lo que estás viendo/ })).toHaveAttribute('aria-checked', 'true');
            expect(within(panel()).getByRole('radio', { name: /Lo que estás viendo/ })).toHaveTextContent('3');
            expect(within(panel()).getByRole('radio', { name: /Todo el período/ })).toHaveTextContent('7');
            expect(filasPrevia().map(f => f[1])).toEqual(['Cliente 7', 'Cliente 6', 'Cliente 5']);
            expect(medida()).toBe('3 filas × 8 columnas');

            exportarCsv();
            const [contenido] = vi.mocked(descargarCsv).mock.calls[0];
            expect(contenido.slice(1).trim().split('\r\n')).toHaveLength(4);
        });

        it('«Todo el período» exporta todas las filas que trajo el período, aunque haya un filtro', () => {
            render(<Revisar {...props()} />);
            fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: 'Cliente 3' } });
            abrir();
            expect(medida()).toBe('1 fila × 8 columnas');

            fireEvent.click(within(panel()).getByRole('radio', { name: /Todo el período/ }));
            expect(medida()).toBe('7 filas × 8 columnas');
            expect(filasPrevia()).toHaveLength(5);

            exportarCsv();
            const [contenido] = vi.mocked(descargarCsv).mock.calls[0];
            expect(contenido.slice(1).trim().split('\r\n')).toHaveLength(8);
        });

        it('en Clientes, el período entero se llama «Toda la cartera»', () => {
            render(<Revisar {...props({ tabla: 'clientes', datos: { filas: [] } })} />);
            abrir();
            expect(within(panel()).getByRole('radio', { name: /Toda la cartera/ })).toBeInTheDocument();
            expect(within(panel()).getByText('No hay filas para exportar.')).toBeInTheDocument();
            expect(within(panel()).getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
        });
    });

    describe('el archivo', () => {
        it('se llama como la tabla y el período, y exportar cierra el panel', async () => {
            render(<Revisar {...props()} />);
            abrir();
            expect(within(panel()).getByRole('textbox', { name: 'Nombre del archivo' }))
                .toHaveValue('ventas_2026-10-01_2026-10-31.csv');

            await act(async () => { exportarCsv(); });
            expect(vi.mocked(descargarCsv)).toHaveBeenCalledTimes(1);
            expect(vi.mocked(descargarCsv).mock.calls[0][1]).toBe('ventas_2026-10-01_2026-10-31.csv');
            expect(screen.queryByRole('dialog', { name: 'Exportar' })).toBeNull();
            expect(botonExportar()).toHaveFocus();
        });

        it('el nombre se puede cambiar; sin .csv, se le agrega', () => {
            render(<Revisar {...props()} />);
            abrir();
            fireEvent.change(within(panel()).getByRole('textbox', { name: 'Nombre del archivo' }),
                { target: { value: 'cobros de octubre' } });
            exportarCsv();
            expect(vi.mocked(descargarCsv).mock.calls[0][1]).toBe('cobros de octubre.csv');
        });
    });
});
