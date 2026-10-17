import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../services/api', () => ({ default: { post: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import api from '../../../../services/api';
import toast from 'react-hot-toast';
import CargarGrabaciones from './CargarGrabaciones';

const PREVIA = {
    guardado: false,
    resumen: { nueva: 1, ya_tenia: 1, error: 1 },
    filas: [
        { fila: 2, evento_id: 15, fecha: '2026-10-12', nombre: 'WEBINAR 12 DE OCTUBRE', estado: 'nueva' },
        { fila: 3, evento_id: 14, fecha: '2026-10-03', nombre: 'WEBINAR 3 DE OCTUBRE', estado: 'ya_tenia', anterior: 'https://drive.google.com/file/d/viejo/view' },
        { fila: 4, estado: 'error', motivo: 'No hay un taller con id 99' },
    ],
};

const armar = (props = {}) => render(
    <div className="dc-shell"><CargarGrabaciones onCerrar={vi.fn()} onGuardado={vi.fn()} {...props} /></div>,
);

describe('Cargar grabaciones de Drive', () => {
    beforeEach(() => { api.post.mockReset(); toast.success.mockReset(); });

    it('primero muestra la vista previa sin guardar y después guarda lo que se carga', async () => {
        const usuario = userEvent.setup();
        const onGuardado = vi.fn();
        const onCerrar = vi.fn();
        api.post.mockResolvedValueOnce({ data: PREVIA })
            .mockResolvedValueOnce({ data: { ...PREVIA, guardado: true } });
        armar({ onGuardado, onCerrar });

        await usuario.type(screen.getByRole('textbox', { name: 'CSV de grabaciones' }), 'event_id,link_drive');
        await usuario.click(screen.getByRole('button', { name: 'Revisar' }));

        expect(api.post).toHaveBeenLastCalledWith('workshop/events/grabaciones',
            { csv: 'event_id,link_drive', simular: true, sobrescribir: false });
        const lista = screen.getByRole('list', { name: 'Vista previa' });
        expect(within(lista).getByText('Se carga')).toBeInTheDocument();
        expect(within(lista).getByText('Ya tenía otra')).toBeInTheDocument();
        expect(within(lista).getByText('No hay un taller con id 99')).toBeInTheDocument();

        await usuario.click(screen.getByRole('button', { name: 'Guardar 1' }));

        expect(api.post).toHaveBeenLastCalledWith('workshop/events/grabaciones',
            { csv: 'event_id,link_drive', simular: false, sobrescribir: false });
        expect(toast.success).toHaveBeenCalledWith('1 grabación cargada');
        expect(onGuardado).toHaveBeenCalled();
        expect(onCerrar).toHaveBeenCalled();
    });

    it('el switch de reemplazar vuelve a pedir la vista previa con sobrescribir', async () => {
        const usuario = userEvent.setup();
        api.post.mockResolvedValue({ data: PREVIA });
        armar();

        await usuario.type(screen.getByRole('textbox', { name: 'CSV de grabaciones' }), 'x');
        await usuario.click(screen.getByRole('button', { name: 'Revisar' }));
        await usuario.click(screen.getByRole('switch', { name: 'Reemplazar las que ya tenían otra' }));

        expect(api.post).toHaveBeenLastCalledWith('workshop/events/grabaciones', { csv: 'x', simular: true, sobrescribir: true });
    });

    it('un CSV que no se puede leer muestra el error del backend', async () => {
        const usuario = userEvent.setup();
        api.post.mockRejectedValue({ response: { data: { error: 'Falta la columna link_drive' } } });
        armar();

        await usuario.type(screen.getByRole('textbox', { name: 'CSV de grabaciones' }), 'x');
        await usuario.click(screen.getByRole('button', { name: 'Revisar' }));

        expect(screen.getByText('Falta la columna link_drive')).toBeInTheDocument();
        expect(screen.queryByRole('list', { name: 'Vista previa' })).not.toBeInTheDocument();
    });
});
