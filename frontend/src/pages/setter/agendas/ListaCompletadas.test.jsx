import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListaCompletadas from './ListaCompletadas';

const ANUNCIOS = [{ id: 7, keyword: 'PROTOCOLO', status: 'active' }, { id: 8, keyword: 'GUIA', status: 'active' }];
const AGENDA = {
    id: 41, cliente: 'Ana Lopez', reunion: '2026-10-12T14:00:00', instagram: 'ana.lopez', mes: '2026-10',
    palabra_clave: 'GUIA', por: 'manychat', asignada: null, estado: null,
};

describe('Mis agendas › Completadas › Cambiar', () => {
    it('cambia la palabra clave equivocada de una completada', async () => {
        const user = userEvent.setup();
        const onCambiar = vi.fn().mockResolvedValue({ ok: true });
        render(<ListaCompletadas agendas={[AGENDA]} mes="2026-10" anuncios={ANUNCIOS} onCambiar={onCambiar} />);

        const fila = screen.getByRole('listitem', { name: 'Completada: Ana Lopez' });
        await user.click(within(fila).getByRole('button', { name: 'Cambiar la palabra clave de Ana Lopez' }));
        await waitFor(() => expect(within(fila).getByRole('combobox')).toHaveFocus());
        await user.keyboard('proto{Enter}');

        expect(onCambiar).toHaveBeenCalledWith(AGENDA, expect.objectContaining({ id: 7 }));
        await waitFor(() => expect(within(fila).queryByRole('combobox')).not.toBeInTheDocument());
    });

    it('si falla, el error queda a la vista y el buscador sigue abierto', async () => {
        const user = userEvent.setup();
        const onCambiar = vi.fn().mockResolvedValue({ error: 'No se pudo cambiar: probá de nuevo.' });
        render(<ListaCompletadas agendas={[AGENDA]} mes="2026-10" anuncios={ANUNCIOS} onCambiar={onCambiar} />);
        await user.click(screen.getByRole('button', { name: 'Cambiar la palabra clave de Ana Lopez' }));
        await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
        await user.keyboard('proto{Enter}');
        expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cambiar');
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('sin onCambiar sigue siendo de solo lectura', () => {
        render(<ListaCompletadas agendas={[AGENDA]} mes="2026-10" />);
        expect(screen.queryByRole('button', { name: /Cambiar/ })).not.toBeInTheDocument();
    });
});
