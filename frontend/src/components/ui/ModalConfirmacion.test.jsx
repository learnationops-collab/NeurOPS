import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalConfirmacion from './ModalConfirmacion';

const montar = (props = {}) => {
    const onCerrar = vi.fn();
    const onConfirmar = vi.fn().mockResolvedValue({});
    render(
        <ModalConfirmacion titulo="¿Eliminar esta agenda?" confirmar="Eliminar agenda"
            onConfirmar={onConfirmar} onCerrar={onCerrar} {...props}>
            <span>Se borra con su registro de eventos.</span>
        </ModalConfirmacion>,
    );
    return { onCerrar, onConfirmar };
};

describe('ModalConfirmacion', () => {
    it('es un diálogo con nombre y descripción, y el foco arranca en «Cancelar»', () => {
        montar();
        const dialogo = screen.getByRole('alertdialog', { name: '¿Eliminar esta agenda?' });
        expect(dialogo).toHaveAccessibleDescription('Se borra con su registro de eventos.');
        expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    });

    it('Escape lo cierra y NO llega a quien escucha Escape en document (la ficha)', async () => {
        const fichaEscucha = vi.fn();
        document.addEventListener('keydown', fichaEscucha);
        const { onCerrar } = montar();
        await userEvent.setup().keyboard('{Escape}');

        expect(onCerrar).toHaveBeenCalledTimes(1);
        expect(fichaEscucha).not.toHaveBeenCalled();
        document.removeEventListener('keydown', fichaEscucha);
    });

    it('Tab no se escapa del diálogo', async () => {
        montar();
        const usuario = userEvent.setup();
        await usuario.tab();
        expect(screen.getByRole('button', { name: 'Eliminar agenda' })).toHaveFocus();
        await usuario.tab();
        expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    });

    it('confirmar corre la acción y después cierra', async () => {
        const { onConfirmar, onCerrar } = montar();
        await userEvent.setup().click(screen.getByRole('button', { name: 'Eliminar agenda' }));

        expect(onConfirmar).toHaveBeenCalledTimes(1);
        expect(onCerrar).toHaveBeenCalledTimes(1);
    });

    it('mientras la acción corre no se puede cerrar ni confirmar dos veces', async () => {
        let terminar;
        const onConfirmar = vi.fn(() => new Promise((r) => { terminar = r; }));
        const { onCerrar } = montar({ onConfirmar, confirmando: 'Eliminando…' });
        const usuario = userEvent.setup();
        await usuario.click(screen.getByRole('button', { name: 'Eliminar agenda' }));

        expect(screen.getByRole('button', { name: 'Eliminando…' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
        await usuario.keyboard('{Escape}');
        expect(onCerrar).not.toHaveBeenCalled();
        terminar({});
    });
});
