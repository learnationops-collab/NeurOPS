import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
    },
}));

import api from '../../services/api';
import FichaLeadModal from './FichaLeadModal';
import { enSoloLectura, leerEstado } from './estadoFicha';
import { fichaIncompleta, fichaPrecall } from './__fixtures__/ficha';

/**
 * La ficha de solo lectura (10/10/2026): el Revisar del setter abre la ficha de cada fila para
 * MIRAR. Aunque su rol confirme sus propias agendas en otra pantalla, acá ninguna acción de la
 * dirección o del closer queda a mano —reprogramar, cancelar, descartar, eliminar, corregir los
 * datos—; dejar una nota al equipo sí, si el servidor lo permite.
 */

const abrir = async (props = {}) => {
    api.get.mockResolvedValue({ data: fichaPrecall });
    render(<FichaLeadModal appointmentId={9012} onCerrar={vi.fn()} {...props} />);
    // Con margen: con la suite entera en paralelo la primera pintura de la ficha tarda más del
    // segundo por defecto (ver PRIMERA_CARGA en FichaLeadModal.test.jsx).
    await waitFor(() => expect(screen.getByRole('tab', { selected: true })).toBeInTheDocument(),
        { timeout: 8000 });
};

beforeEach(() => { vi.clearAllMocks(); });

describe('ficha de solo lectura', () => {
    it('todos los permisos en false menos la nota, que queda como la dio el servidor', () => {
        expect(enSoloLectura(fichaPrecall).permisos).toEqual({
            confirmar: false, reportar: false, cobrar: false, reasignar: false, comentar: true,
            eliminar: false, editar_datos: false,
        });
        // Sin permisos del servidor, la ficha se abriría editable: acá quedan todos en false.
        expect(leerEstado(enSoloLectura(fichaIncompleta)).puedeEditar).toBe(false);
        expect(enSoloLectura(null)).toBeNull();
    });

    it('la confirmación se ve, pero sin ninguna acción a mano', async () => {
        await abrir({ soloLectura: true });

        expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Confirmación');
        ['Reprogramar', 'Canceló', 'Descartar lead', 'Eliminar lead'].forEach(nombre => {
            expect(screen.getByRole('button', { name: new RegExp(nombre) })).toBeDisabled();
        });
        // Ni la pestaña Resultado (reportar), ni el lápiz de los datos, ni pasar el lead a otro closer.
        expect(screen.queryByRole('tab', { name: /Resultado/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Editar los datos del lead' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Pasar el lead a' })).toBeNull();
    });

    it('sin la prop, la misma ficha sigue siendo editable', async () => {
        await abrir();

        expect(screen.getByRole('button', { name: /Reprogramar/ })).toBeEnabled();
        expect(screen.getByRole('tab', { name: /Resultado/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Editar los datos del lead' })).toBeInTheDocument();
    });
});
