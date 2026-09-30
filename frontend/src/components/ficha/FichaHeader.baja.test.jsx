import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Por el cascarón, como `FichaHeader.test.jsx`: lo que importa es el recorrido entero —la marca en
// la cabecera, la acción, la ruta y el aviso—, no la franja suelta.
vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
    },
}));

import api from '../../services/api';
import FichaLeadModal from './FichaLeadModal';
import { fichaConDeuda } from './__fixtures__/ficha';

const BAJA = { fecha: '2026-09-12T10:00:00', fecha_legible: '12 sep 2026', motivo: 'No puede pagar', por: 'lucia' };

const fichaDeBaja = {
    ...fichaConDeuda,
    identidad: { ...fichaConDeuda.identidad, baja: BAJA },
    estado: { ...fichaConDeuda.estado, clave: 'dado_de_baja', etiqueta: 'Dado de baja', tono: 'idle' },
    cobro: { ...fichaConDeuda.cobro, deuda: 0, proxima_cuota: null,
        etapa: { clave: 'baja', titulo: 'Dado de baja el 12 sep 2026', tono: 'idle' } },
};

const abrir = async (ficha) => {
    api.get.mockResolvedValue({ data: ficha });
    api.post.mockResolvedValue({ data: { id: 9012, deuda: 1000 } });
    render(<FichaLeadModal appointmentId={9012} onCerrar={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('tab', { selected: true })).toBeInTheDocument());
};

beforeEach(() => { vi.clearAllMocks(); });

describe('la cabecera de un cliente dado de baja', () => {
    it('dice cuándo, por qué y quién, desde cualquier pestaña', async () => {
        await abrir(fichaDeBaja);

        const marca = screen.getByRole('note', { name: 'Cliente dado de baja' });
        expect(marca).toHaveTextContent('Dado de baja el 12 sep 2026');
        expect(marca).toHaveTextContent('No puede pagar · por lucia');
    });

    it('sin baja no hay marca', async () => {
        await abrir(fichaConDeuda);

        expect(screen.queryByRole('note', { name: 'Cliente dado de baja' })).toBeNull();
    });
});

describe('revertir la baja desde Acciones', () => {
    it('pega en su ruta y avisa que vuelve a deber', async () => {
        const usuario = userEvent.setup();
        await abrir(fichaDeBaja);

        await usuario.click(await screen.findByRole('button', { name: 'Revertir baja' }));
        await usuario.click(screen.getByRole('button', { name: 'Revertir baja' }));

        expect(api.post).toHaveBeenCalledWith('/ficha/9012/revertir-baja', {});
        expect(await screen.findByText(/Baja revertida: vuelve a deber \$1\.000/)).toBeInTheDocument();
    });
});
