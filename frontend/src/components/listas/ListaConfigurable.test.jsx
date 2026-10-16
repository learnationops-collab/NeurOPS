import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ListaConfigurable, { pasaFacetas } from './ListaConfigurable';

const columnas = [
    { key: 'nombre', header: 'Nombre', valor: (f) => f.nombre, fija: true },
    { key: 'leads', header: 'Leads', valor: (f) => f.leads, alinear: 'der' },
    { key: 'ventas', header: 'Ventas', valor: (f) => f.ventas, oculta: true },
];
const facetas = [{ key: 'mes', label: 'Mes', de: (f) => f.mes }];
const filas = [
    { id: 1, nombre: 'Taller A', leads: 10, ventas: 1, mes: 'Sep' },
    { id: 2, nombre: 'Taller B', leads: 30, ventas: 2, mes: 'Oct' },
];

const armar = () => render(
    <div className="dc-shell">
        <ListaConfigurable columnas={columnas} facetas={facetas} filas={filas} clave={(f) => f.id}
            buscar={(f) => f.nombre} claveGuardado="test_cols" />
    </div>,
);

describe('ListaConfigurable', () => {
    beforeEach(() => window.localStorage.clear());

    it('arranca sin las columnas ocultas por defecto', () => {
        armar();
        expect(screen.getByText('Leads')).toBeInTheDocument();
        expect(screen.queryByText('Ventas')).not.toBeInTheDocument();
    });

    it('muestra una columna elegida en el menú y la recuerda', () => {
        const { unmount } = armar();
        fireEvent.click(screen.getByRole('button', { name: /Columnas/ }));
        fireEvent.click(within(screen.getByRole('menu', { name: 'Columnas' })).getByText('Ventas'));
        expect(screen.getByRole('columnheader', { name: /Ventas/ })).toBeInTheDocument();
        unmount();
        armar();
        expect(screen.getByRole('columnheader', { name: /Ventas/ })).toBeInTheDocument();
    });

    it('busca sin distinguir tildes ni mayúsculas', () => {
        armar();
        fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'taller b' } });
        expect(screen.queryByText('Taller A')).not.toBeInTheDocument();
        expect(screen.getByText('Taller B')).toBeInTheDocument();
        expect(screen.getByText('mostrando 1 de 2')).toBeInTheDocument();
    });

    it('ordena por una columna de mayor a menor', () => {
        armar();
        fireEvent.click(screen.getByRole('button', { name: 'Ordenar por Leads' }));
        const nombres = screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent);
        expect(nombres).toEqual(['Taller B', 'Taller A']);
    });
});

describe('pasaFacetas', () => {
    it('sin facetas elegidas deja pasar todo', () => {
        expect(pasaFacetas(filas[0], facetas, {}, 'todas')).toBe(true);
    });
    it('filtra por el valor elegido', () => {
        expect(pasaFacetas(filas[0], facetas, { mes: ['Oct'] }, 'todas')).toBe(false);
        expect(pasaFacetas(filas[1], facetas, { mes: ['Oct'] }, 'todas')).toBe(true);
    });
});

describe('ListaConfigurable · agrupar', () => {
    beforeEach(() => window.localStorage.clear());

    it('agrupa por una dimensión en grupos con su cantidad', () => {
        render(
            <div className="dc-shell">
                <ListaConfigurable columnas={columnas} facetas={facetas} filas={filas} clave={(f) => f.id}
                    agrupables={[{ key: 'mes', label: 'Mes', de: (f) => f.mes }]} />
            </div>,
        );
        fireEvent.click(screen.getByRole('button', { name: /Sin agrupar/ }));
        fireEvent.click(within(screen.getByRole('menu', { name: 'Agrupar por' })).getByText('Mes'));
        expect(screen.getByRole('button', { name: /Por mes/ })).toBeInTheDocument();
        expect(screen.getByText('Sep')).toBeInTheDocument();
        expect(screen.getByText('Oct')).toBeInTheDocument();
    });
});
