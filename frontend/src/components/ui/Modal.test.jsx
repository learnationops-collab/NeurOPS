import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

const Botones = ({ onCancelar }) => (
    <>
        <button type="button" onClick={onCancelar}>Cancelar</button>
        <button type="submit">Guardar cambios</button>
    </>
);

const montar = (props = {}) => {
    const onCerrar = vi.fn();
    const utils = render(
        // El contenedor imita el de las páginas: un `space-y-*` adentro de un `z-10`.
        <div className="relative z-10"><div className="space-y-10" data-testid="pagina">
            <p>Contenido de la página</p>
            <Modal titulo="Editar miembro" subtitulo="Configuración técnica de acceso"
                onCerrar={onCerrar} pie={<Botones onCancelar={onCerrar} />} {...props}>
                <label>Nombre<input defaultValue="Mario" /></label>
            </Modal>
        </div></div>,
    );
    return { onCerrar, ...utils };
};

describe('Modal', () => {
    it('se dibuja en un portal a body, fuera del contenedor de la página', () => {
        montar();
        const dialogo = screen.getByRole('dialog', { name: 'Editar miembro' });
        expect(screen.getByTestId('pagina')).not.toContainElement(dialogo);
        expect(dialogo.closest('[data-modal-velo]').parentElement).toBe(document.body);
    });

    it('tiene cabecera con la X y un pie con las acciones', () => {
        montar();
        const dialogo = screen.getByRole('dialog', { name: 'Editar miembro' });
        expect(dialogo).toContainElement(screen.getByRole('button', { name: 'Cerrar' }));
        expect(dialogo).toContainElement(screen.getByRole('button', { name: 'Cancelar' }));
        expect(dialogo).toContainElement(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(screen.getByText('Configuración técnica de acceso')).toBeInTheDocument();
    });

    it('Escape lo cierra', async () => {
        const { onCerrar } = montar();
        await userEvent.setup().keyboard('{Escape}');
        expect(onCerrar).toHaveBeenCalledTimes(1);
    });

    it('la X y el fondo lo cierran; un clic adentro no', async () => {
        const { onCerrar } = montar();
        const usuario = userEvent.setup();
        await usuario.click(screen.getByLabelText('Nombre'));
        expect(onCerrar).not.toHaveBeenCalled();
        await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));
        expect(onCerrar).toHaveBeenCalledTimes(1);
        await usuario.click(document.querySelector('[data-modal-fondo]'));
        expect(onCerrar).toHaveBeenCalledTimes(2);
    });

    it('arrastrar desde un campo y soltar en el fondo no lo cierra', () => {
        const { onCerrar } = montar();
        fireEvent.mouseDown(screen.getByLabelText('Nombre'));
        // El clic de un arrastre cae en el ancestro común (el velo), no en el fondo.
        fireEvent.click(document.querySelector('[data-modal-velo]'));
        expect(onCerrar).not.toHaveBeenCalled();
    });

    it('con cerrable={false} no se cierra por ningún lado', async () => {
        const { onCerrar } = montar({ cerrable: false });
        const usuario = userEvent.setup();
        await usuario.keyboard('{Escape}');
        await usuario.click(document.querySelector('[data-modal-fondo]'));
        expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled();
        expect(onCerrar).not.toHaveBeenCalled();
    });

    it('con onSubmit, el botón submit del pie envía el formulario', async () => {
        const onSubmit = vi.fn((e) => e.preventDefault());
        montar({ onSubmit });
        await userEvent.setup().click(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('traba el scroll de body mientras está abierto y lo suelta al cerrar', () => {
        const { unmount } = montar();
        expect(document.body.style.overflow).toBe('hidden');
        unmount();
        expect(document.body.style.overflow).toBe('');
    });

    it('con dos abiertos, Escape cierra solo el de arriba', async () => {
        const Doble = () => {
            const [abajo, setAbajo] = useState(true);
            const [arriba, setArriba] = useState(true);
            return (
                <>
                    {abajo && <Modal titulo="Abajo" onCerrar={() => setAbajo(false)}>a</Modal>}
                    {arriba && <Modal titulo="Arriba" onCerrar={() => setArriba(false)}>b</Modal>}
                </>
            );
        };
        render(<Doble />);
        const usuario = userEvent.setup();
        await usuario.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', { name: 'Arriba' })).not.toBeInTheDocument();
        expect(screen.getByRole('dialog', { name: 'Abajo' })).toBeInTheDocument();
        await usuario.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', { name: 'Abajo' })).not.toBeInTheDocument();
    });

    it('Tab no se escapa del diálogo', async () => {
        montar();
        const usuario = userEvent.setup();
        screen.getByRole('button', { name: 'Guardar cambios' }).focus();
        await usuario.tab();
        expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    });
});
