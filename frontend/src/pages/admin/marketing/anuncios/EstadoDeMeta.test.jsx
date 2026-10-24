import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EstadoDeMeta, { haceCuanto } from './EstadoDeMeta';

const AHORA = new Date('2026-10-23T12:00:00Z').getTime();

describe('haceCuanto', () => {
    it('cuenta desde la hora UTC del backend', () => {
        expect(haceCuanto('2026-10-23T11:59:50', AHORA)).toBe('hace un momento');
        expect(haceCuanto('2026-10-23T11:55:00', AHORA)).toBe('hace 5 min');
        expect(haceCuanto('2026-10-23T09:00:00', AHORA)).toBe('hace 3 h');
        expect(haceCuanto('2026-10-19T12:00:00', AHORA)).toBe('hace 4 días');
        expect(haceCuanto('2026-10-23T11:55:00+00:00', AHORA)).toBe('hace 5 min');
        expect(haceCuanto(null, AHORA)).toBeNull();
        expect(haceCuanto('basura', AHORA)).toBeNull();
    });
});

describe('EstadoDeMeta', () => {
    const estado = (extra) => ({ activo: true, actualizando: false, fallo: null, actualizar: vi.fn(), ...extra });

    it('no aparece sin Meta conectado', () => {
        const { container } = render(<EstadoDeMeta meta={{}} estadoMeta={estado({ activo: false })} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('dice cuándo se trajo el estado y el botón lo trae ahora, a la fuerza', async () => {
        const actualizar = vi.fn();
        render(<EstadoDeMeta meta={{ ultima_sincronizacion: new Date(Date.now() - 5 * 60000).toISOString().replace('Z', '') }}
            estadoMeta={estado({ actualizar })} />);
        expect(screen.getByRole('status')).toHaveTextContent(/Estado de Meta: hace [45] min/);
        await userEvent.click(screen.getByRole('button', { name: 'Actualizar el estado desde Meta' }));
        expect(actualizar).toHaveBeenCalledWith({ forzar: true });
    });

    it('si falló lo avisa, y mientras corre el botón queda quieto', () => {
        render(<EstadoDeMeta meta={{}} estadoMeta={estado({ fallo: 'Token vencido', actualizando: true })} />);
        expect(screen.getByRole('status')).toHaveTextContent('No se pudo actualizar desde Meta');
        expect(screen.getByRole('button', { name: 'Actualizar el estado desde Meta' })).toBeDisabled();
    });
});
