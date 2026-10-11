import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pencil, Trash2, Users } from 'lucide-react';
import Revisar from './Revisar';
import { operacionDe } from './operar/operacion';

/**
 * Operar desde Revisar (10/10/2026): la base sobre la que se montan la edición masiva, los duplicados
 * y las acciones por venta de Operaciones. Se prueba con acciones de mentira: lo que importa es que
 * cada clase de acción abra su panel con las filas que corresponden y que sin `operacion` Revisar se
 * vea exactamente como siempre.
 */

const venta = (id) => ({
    tipo: 'venta', id, client_id: id, cliente: `Cliente ${id}`, ig: '', closer: 'Nerina', programa: 'ACE',
    fecha: `2026-10-0${id}T10:00:00`, metodo: 'Stripe', monto: 1000, monto_neto: 950, es_venta: true,
    academia: null, tipo_pago: { key: 'completo', label: 'Pago completo', tone: 'success' },
});
const FILAS = [1, 2, 3].map(venta);

// Un panel de mentira que deja ver con qué lo abrieron y deja terminar la acción.
const Panel = ({ filas, fila, onCerrar, onHecho }) => (
    <div role="dialog" aria-label="Panel">
        <span data-testid="filas">{filas.map(f => f.id).join(',')}</span>
        <span data-testid="fila">{fila ? fila.id : ''}</span>
        <button type="button" onClick={() => { onHecho(); onCerrar(); }}>Listo</button>
    </div>
);
const MODULO = {
    ventas: {
        lote: [{ id: 'editar', label: 'Editar en lote', Icono: Pencil, Panel }],
        herramientas: [{ id: 'duplicados', label: 'Duplicados', Icono: Users, Panel }],
        fila: (f) => (f.id === 2 ? [] : [{ id: 'borrar', label: 'Borrar', Icono: Trash2, Panel }]),
    },
};

const props = (extra = {}) => ({
    tabla: 'ventas', setTabla: () => {}, cargando: false, rol: 'closers', basis: 'meet', setBasis: () => {},
    datos: { filas: FILAS, dates: { start: '2026-10-01', end: '2026-10-31' } },
    alcance: 'Todo el equipo', onAbrirFila: vi.fn(), filtroInicial: null, onOlvidarFiltro: () => {},
    puedeElegirEquipo: true, ...extra,
});
const montar = (extra) => render(<Revisar {...props({ operacion: operacionDe('ventas', [MODULO]), ...extra })} />);

describe('Revisar · operar', () => {
    it('sin acciones (la dirección, los closers) no hay casillas, ni menú, ni herramientas', () => {
        render(<Revisar {...props()} />);
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
        expect(screen.queryByRole('button', { name: /Acciones de/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Duplicados' })).toBeNull();
        expect(operacionDe('ventas', [])).toBeNull();
    });

    it('tildar filas muestra cuántas y las acciones de lote, que se abren con lo tildado', () => {
        montar();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar Cliente 1' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar Cliente 3' }));

        const barra = screen.getByRole('region', { name: 'Filas seleccionadas' });
        expect(barra).toHaveTextContent('2 seleccionadas');
        fireEvent.click(within(barra).getByRole('button', { name: 'Editar en lote' }));
        expect(screen.getByTestId('filas')).toHaveTextContent('1,3');
    });

    it('tildar una fila no abre su ficha', () => {
        const onAbrirFila = vi.fn();
        montar({ onAbrirFila });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar Cliente 1' }));
        expect(onAbrirFila).not.toHaveBeenCalled();
    });

    it('la casilla del encabezado tilda y destilda todo lo que muestra la lista', () => {
        montar();
        const todas = screen.getByRole('checkbox', { name: 'Seleccionar todas las filas de la lista' });
        fireEvent.click(todas);
        expect(screen.getByRole('region', { name: 'Filas seleccionadas' })).toHaveTextContent('3 seleccionadas');
        fireEvent.click(todas);
        expect(screen.queryByRole('region', { name: 'Filas seleccionadas' })).toBeNull();
    });

    it('una herramienta se abre con las filas que muestra la lista', () => {
        montar();
        fireEvent.click(screen.getByRole('button', { name: 'Duplicados' }));
        expect(screen.getByTestId('filas')).toHaveTextContent('1,2,3');
    });

    it('el «⋯» de una fila trae sus acciones y la abre con esa fila; sin acciones no hay botón', () => {
        montar();
        expect(screen.queryByRole('button', { name: 'Acciones de Cliente 2' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Acciones de Cliente 3' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Borrar' }));
        expect(screen.getByTestId('fila')).toHaveTextContent('3');
    });

    it('al terminar una acción se recarga la tabla y se suelta lo tildado', () => {
        const onRecargar = vi.fn();
        montar({ onRecargar });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar Cliente 1' }));
        fireEvent.click(screen.getByRole('button', { name: 'Editar en lote' }));
        fireEvent.click(screen.getByRole('button', { name: 'Listo' }));

        expect(onRecargar).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog', { name: 'Panel' })).toBeNull();
        expect(screen.queryByRole('region', { name: 'Filas seleccionadas' })).toBeNull();
    });
});
