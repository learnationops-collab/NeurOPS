import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Bars, Button, Card, Chip, ConfirmDelete, EmptyState, HeaderActions, IconButton, LinkButton, PageHeader, Status } from './index';

describe('Button', () => {
    it('chico y secundario por defecto, type="button"', () => {
        render(<Button>Guardar</Button>);
        const b = screen.getByRole('button', { name: 'Guardar' });
        expect(b.className).toBe('ui-btn ui-btn--secondary ui-btn--sm');
        expect(b.getAttribute('type')).toBe('button');
    });

    it('cada variante usa su clase', () => {
        const casos = { primary: 'ui-btn--primary', danger: 'ui-btn--danger', dangerSolid: 'ui-btn--danger-solid' };
        Object.entries(casos).forEach(([variant, clase]) => {
            const { unmount } = render(<Button variant={variant}>x</Button>);
            expect(screen.getByRole('button').classList.contains(clase)).toBe(true);
            unmount();
        });
        render(<Button variant="ghost" size="md">x</Button>);
        expect(screen.getByRole('button').className).toBe('ui-btn');
    });

    it('pasa ref, data-nav y el resto de atributos al <button>', () => {
        const ref = createRef();
        render(<Button ref={ref} data-nav="" type="submit" disabled>Crear</Button>);
        expect(ref.current).toBe(screen.getByRole('button'));
        expect(ref.current.hasAttribute('data-nav')).toBe(true);
        expect(ref.current.getAttribute('type')).toBe('submit');
        expect(ref.current.disabled).toBe(true);
    });
});

describe('IconButton y LinkButton', () => {
    it('el label es el nombre accesible; tamaño, peligro y presionado', () => {
        render(<IconButton icon={<svg />} label="Cerrar" size="xs" danger pressed />);
        const b = screen.getByRole('button', { name: 'Cerrar' });
        expect(b.className).toBe('ui-ibtn ui-ibtn--xs ui-ibtn--danger');
        expect(b.getAttribute('aria-pressed')).toBe('true');
    });

    it('LinkButton sutil', () => {
        render(<LinkButton subtle>Usar la propuesta</LinkButton>);
        expect(screen.getByRole('button').className).toBe('ui-link ui-link--subtle');
    });
});

describe('PageHeader y HeaderActions', () => {
    it('las acciones de la sección llegan a la cabecera', () => {
        render(
            <>
                <PageHeader title="Eventos" />
                <main><HeaderActions><Button>Nuevo</Button></HeaderActions></main>
            </>,
        );
        expect(screen.getByRole('heading', { name: 'Eventos' })).toBeTruthy();
        expect(screen.getByRole('banner').contains(screen.getByRole('button', { name: 'Nuevo' }))).toBe(true);
    });

    it('size="sm" es la barra baja', () => {
        render(<PageHeader title="Inbox" size="sm" />);
        expect(screen.getByRole('banner').className).toBe('ui-header ui-header--sm');
    });

    it('sin cabecera se dibujan en su lugar', () => {
        render(<HeaderActions><Button>Nuevo</Button></HeaderActions>);
        expect(screen.getByRole('button', { name: 'Nuevo' })).toBeTruthy();
    });
});

describe('ConfirmDelete', () => {
    it('pregunta por el nombre, enfoca Cancelar y confirma', async () => {
        const onConfirm = vi.fn(), onCancel = vi.fn();
        render(<ConfirmDelete name="Juan" article="a " detail="Sale de todas las estrategias." onCancel={onCancel} onConfirm={onConfirm} />);
        expect(screen.getByRole('alertdialog', { name: 'Eliminar a Juan' }).textContent).toContain('¿Eliminar a Juan? Sale de todas las estrategias.');
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }));
        await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onCancel).not.toHaveBeenCalled();
    });
});

describe('EmptyState, Card y Chip', () => {
    it('EmptyState sin texto no deja un párrafo vacío', () => {
        const { container } = render(<EmptyState title="Cargando…" />);
        expect(container.querySelector('p')).toBeNull();
        expect(screen.getByRole('heading', { name: 'Cargando…' })).toBeTruthy();
    });

    it('Card con aura suave', () => {
        const { container } = render(<Card as="article" aura={['red']} soft className="ev-card">x</Card>);
        const card = container.querySelector('article');
        expect(card.className).toBe('ui-card ev-card');
        expect(card.querySelector('.ui-aura').className).toBe('ui-aura ui-aura--card ui-aura--soft');
    });

    it('Chip con color y versión suave', () => {
        render(<Chip color="var(--info)" subtle>Info</Chip>);
        const c = screen.getByText('Info');
        expect(c.className).toBe('ui-chip ui-chip--subtle');
        expect(c.style.getPropertyValue('--c')).toBe('var(--info)');
    });

    it('Status con su punto de color', () => {
        render(<Status color="var(--success)">Activo</Status>);
        const st = screen.getByText('Activo');
        expect(st.className).toBe('ui-status');
        expect(st.style.getPropertyValue('--c')).toBe('var(--success)');
        expect(st.querySelector('i').getAttribute('aria-hidden')).toBe('true');
    });
});

describe('Bars', () => {
    it('cada columna mide relativo al mayor y cero no dibuja barra', () => {
        render(<Bars label="Embudo" items={[{ key: 'a', value: 200, label: 'Paso 1' }, { key: 'b', value: 50, label: 'Paso 2' }, { key: 'c', value: 0, label: 'Paso 3' }]} />);
        const [a, b, c] = screen.getAllByRole('listitem');
        expect(a.style.getPropertyValue('--ui-bar')).toBe('100%');
        expect(b.style.getPropertyValue('--ui-bar')).toBe('25%');
        expect(c.querySelector('i')).toBeNull();
        expect(a.getAttribute('aria-label')).toBe('Paso 1: 200');
    });

    it('en raíz y en filas, con rótulo, número y detalle', () => {
        render(<Bars variant="rows" scale="sqrt" items={[{ key: 'a', value: 100, label: 'Leads' }, { key: 'b', value: 25, label: 'Ventas', display: '25', detail: '25 %' }]} />);
        const filas = screen.getAllByRole('listitem');
        expect(filas[1].querySelector('i').style.getPropertyValue('--ui-bar')).toBe('50%');
        expect(filas[1].textContent).toBe('Ventas2525 %');
    });

    it('con onSelect cada columna es un botón', async () => {
        const onSelect = vi.fn();
        render(<Bars onSelect={onSelect} items={[{ key: 'n1', value: 3, label: 'Paso 1' }]} />);
        await userEvent.click(screen.getByRole('listitem', { name: 'Paso 1: 3' }));
        expect(onSelect).toHaveBeenCalledWith('n1');
    });
});
