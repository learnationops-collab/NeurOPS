import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MODOS_REGISTROS, VerRegistros, useVerRegistros } from './index';

const Pantalla = () => {
    const { abrir, panel } = useVerRegistros();
    return (
        <>
            <button type="button" onClick={() => abrir({ titulo: 'Agendas', subtitulo: '3 en el período', contenido: <p>lista</p> })}>
                abrir
            </button>
            {panel}
        </>
    );
};

describe('VerRegistros · modo completa', () => {
    beforeEach(() => window.localStorage.clear());

    it('suma «completa» a los modos', () => {
        expect(MODOS_REGISTROS).toEqual(['lateral', 'central', 'completa']);
    });

    it('en completa es un diálogo propio que cierra con Escape', async () => {
        const onClose = vi.fn();
        render(<VerRegistros titulo="Agendas" modo="completa" onModo={() => {}} onClose={onClose}><p>lista</p></VerRegistros>);
        const dialogo = screen.getByRole('dialog');
        expect(dialogo.classList.contains('ui-reg--completa')).toBe(true);
        expect(screen.getByRole('button', { name: /Completa/ })).toBeTruthy();
        await userEvent.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('elegir «Completa» lo recuerda para la próxima vez', async () => {
        const { unmount } = render(<Pantalla />);
        await userEvent.click(screen.getByRole('button', { name: 'abrir' }));
        await userEvent.click(screen.getByRole('button', { name: /Completa/ }));
        expect(window.localStorage.getItem('ui_registros_modo')).toBe('completa');
        unmount();

        render(<Pantalla />);
        await userEvent.click(screen.getByRole('button', { name: 'abrir' }));
        expect(screen.getByRole('dialog').classList.contains('ui-reg--completa')).toBe(true);
    });
});
