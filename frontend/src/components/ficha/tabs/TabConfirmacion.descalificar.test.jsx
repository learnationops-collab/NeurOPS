import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TabConfirmacion from './TabConfirmacion';
import { enSoloLectura } from '../estadoFicha';
import { fichaPrecall } from '../__fixtures__/ficha';

/**
 * «Descalificado» en la confirmación (23/10/2026): el closer ve antes de la llamada que el lead no
 * califica y lo marca. Es una cancelación por decisión suya con su propio estado, para que la
 * dirección cuente cuántas agendas descalifican los closers.
 */

const props = (ficha = fichaPrecall, extra = {}) => ({
    ficha, onAccion: vi.fn().mockResolvedValue({ status: 'Descalificado' }), irA: vi.fn(), puedeEditar: true,
    ...extra,
});

const abrirSubvista = async (usuario) => {
    await usuario.click(screen.getByRole('button', { name: /Descalificado/ }));
    return screen.getByRole('heading', { name: 'Descalificar lead' });
};

describe('TabConfirmacion · Descalificado', () => {
    it('está en la barra de la confirmación y reemplaza a «Descartar lead» (era el «No Lead»)', () => {
        render(<TabConfirmacion {...props()} />);

        const nombres = screen.getAllByRole('button')
            .map(b => b.textContent.trim())
            .filter(t => ['Reprogramar', 'Canceló', 'Descalificado', 'Descartar lead', 'Eliminar lead'].includes(t));
        expect(nombres).toEqual(['Reprogramar', 'Canceló', 'Descalificado', 'Eliminar lead']);
        expect(screen.queryByRole('button', { name: /Descartar lead/ })).toBeNull();
        expect(screen.getByRole('button', { name: /Descalificado/ })).toBeEnabled();
    });

    it('abre su sub-vista y no deja descalificar sin motivo', async () => {
        const usuario = userEvent.setup();
        render(<TabConfirmacion {...props()} />);
        await abrirSubvista(usuario);

        expect(screen.getByText(/La llamada se cancela y se libera tu agenda/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Descalificar lead' })).toBeDisabled();
    });

    it('con el motivo elegido manda `descalificar` con su clave y vuelve al menú', async () => {
        const usuario = userEvent.setup();
        const p = props();
        render(<TabConfirmacion {...p} />);
        await abrirSubvista(usuario);

        await usuario.click(screen.getByRole('button', { expanded: false }));
        await usuario.click(within(screen.getByRole('listbox')).getByRole('option', { name: /No es médico/ }));
        await usuario.click(screen.getByRole('button', { name: 'Descalificar lead' }));

        expect(p.onAccion).toHaveBeenCalledWith('descalificar', { motivo: 'no_es_medico' });
        // La acción salió bien: la pestaña vuelve al menú de la confirmación.
        expect(await screen.findByRole('button', { name: /Reprogramar/ })).toBeInTheDocument();
    });

    it('sin permiso para reportar o en solo lectura, queda deshabilitado', () => {
        const { rerender } = render(<TabConfirmacion {...props({
            ...fichaPrecall, permisos: { ...fichaPrecall.permisos, reportar: false } })} />);
        expect(screen.getByRole('button', { name: /Descalificado/ })).toBeDisabled();

        rerender(<TabConfirmacion {...props(enSoloLectura(fichaPrecall))} />);
        expect(screen.getByRole('button', { name: /Descalificado/ })).toBeDisabled();
    });
});
