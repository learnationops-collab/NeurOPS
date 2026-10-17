import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, Card, Chip, ConfirmDelete, EmptyState, HeaderActions, IconButton, LinkButton, PageHeader, Status } from './index';

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
