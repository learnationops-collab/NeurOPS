import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import YaTieneAgenda from './YaTieneAgenda';

const AVISO = { inicio: '2026-10-20T18:00:00Z', closer: 'Facundo' };

describe('YaTieneAgenda', () => {
    it('no dibuja nada sin aviso', () => {
        const { container } = render(<YaTieneAgenda aviso={null} onElegir={vi.fn()} onCancelar={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('dice con quién es la agenda que ya tiene y deja reprogramarla o sumar otra', async () => {
        const user = userEvent.setup();
        const onElegir = vi.fn();
        const onCancelar = vi.fn();
        render(<YaTieneAgenda aviso={AVISO} onElegir={onElegir} onCancelar={onCancelar} />);

        expect(screen.getByRole('alert')).toHaveTextContent('con Facundo');
        await user.click(screen.getByRole('button', { name: 'Reprogramar esa' }));
        await user.click(screen.getByRole('button', { name: 'Crear adicional' }));
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(onElegir.mock.calls).toEqual([['reprogramar'], ['adicional']]);
        expect(onCancelar).toHaveBeenCalledOnce();
    });

    it('bloquea los botones mientras se crea', () => {
        render(<YaTieneAgenda aviso={AVISO} onElegir={vi.fn()} onCancelar={vi.fn()} cargando />);
        expect(screen.getByRole('button', { name: 'Reprogramar esa' })).toBeDisabled();
    });
});
