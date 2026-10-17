import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import EsqueletoLista from './EsqueletoLista';

const columnas = [
    { key: 'nombre', header: 'Nombre', width: 'minmax(180px,2fr)', fija: true },
    { key: 'leads', header: 'Leads', alinear: 'der' },
    { key: 'ventas', header: 'Ventas', oculta: true },
];

describe('EsqueletoLista', () => {
    beforeEach(() => window.localStorage.clear());

    it('anuncia la carga y escribe las columnas visibles con la grilla de la lista', () => {
        const { container } = render(<EsqueletoLista columnas={columnas} claveGuardado="t_cols" filas={3} label="Cargando los talleres…" />);
        expect(screen.getByRole('status', { name: 'Cargando los talleres…' })).toBeInTheDocument();
        expect(screen.getByText('Nombre')).toBeInTheDocument();
        expect(screen.getByText('Leads')).toBeInTheDocument();
        expect(screen.queryByText('Ventas')).not.toBeInTheDocument();
        expect(container.querySelector('.tabla-cab').style.getPropertyValue('--cols')).toBe('minmax(180px,2fr) minmax(0,1fr)');
        expect(container.querySelectorAll('.tabla-fila')).toHaveLength(3);
    });

    it('usa las columnas que la persona eligió en esa lista', () => {
        window.localStorage.setItem('t_cols', JSON.stringify(['leads']));
        render(<EsqueletoLista columnas={columnas} claveGuardado="t_cols" />);
        expect(screen.queryByText('Leads')).not.toBeInTheDocument();
        expect(screen.getByText('Ventas')).toBeInTheDocument();
    });
});
