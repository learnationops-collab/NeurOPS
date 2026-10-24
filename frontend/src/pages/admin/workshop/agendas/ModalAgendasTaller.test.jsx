import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: vi.fn() }));
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
// La ficha es otro componente (pide su propia API): acá solo importa a quién se abre.
vi.mock('../../../../components/ficha/FichaLeadModal', () => ({
    default: ({ appointmentId, soloLectura }) => (
        <div role="dialog" aria-label="Ficha">ficha {appointmentId} {soloLectura ? 'solo lectura' : 'editable'}</div>
    ),
}));

import api from '../../../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../../../contexts/AuthContext';
import ModalAgendasTaller from './ModalAgendasTaller';
import AgendasDelTaller from './AgendasDelTaller';

const chip = (key, label, tone = 'idle') => ({ key, label, tone });

const fila = (id, cliente, post, extra = {}) => ({
    id, tipo: 'agenda', cliente, ig: '', email: '', telefono: '', client_id: id, person_uuid: `p${id}`,
    fecha: '2026-10-20T15:00:00', creada: '2026-10-18T10:00:00', fuente: 'Workshop', palabra_clave: '',
    closer: 'Marlon', closer_id: 1, setter: '', setter_id: null,
    pre_call: chip('confirmada', 'Confirmada', 'info'),
    post_call: post, asistio: post.key === 'asistio' || post.key === 'venta',
    no_cerrada: post.key === 'asistio', realizada: ['asistio', 'venta', 'no_show'].includes(post.key),
    presento: false, retraso_dias: 0, ya_paso: true, descartada: post.key === 'cancelo',
    con_venta: post.key === 'venta', venta_tipo: post.key === 'venta' ? 'completo' : null, con_sena: false,
    estado_libro: post.key, embudo: 'vivo', taller_id: 7, taller: 'WEBINAR 17', ...extra,
});

const DATOS = {
    total: 4,
    filas: [
        fila(1, 'Ana Pérez', chip('venta', 'Venta', 'success')),
        fila(2, 'Beto Ríos', chip('no_show', 'No show', 'error')),
        fila(3, 'Elena Soto', chip('cancelo', 'Canceló')),
        fila(-9, 'Gus Mora', chip('pendiente', 'Pendiente'), { sin_cita: true, client_id: null }),
    ],
    talleres: [{ id: 7, name: 'WEBINAR 17', date: '2026-10-17', agendas: 4, vivo: 3, landing: 1,
        ventana: { desde: '2026-10-17', hasta: '2026-10-23', abierta: false } }],
};

const abrirModal = (props = {}) => render(
    <ModalAgendasTaller tallerIds={[7]} titulo="WEBINAR 17" subtitulo="17 oct. 2026" onCerrar={() => {}} {...props} />);

describe('ModalAgendasTaller', () => {
    beforeEach(() => {
        window.localStorage.clear();
        api.get.mockReset().mockResolvedValue({ data: DATOS });
        toast.mockReset();
        useAuth.mockReturnValue({ user: { role: 'admin' } });
    });

    it('pide las agendas de los talleres y lista a cada persona con su estado y closer', async () => {
        abrirModal({ tallerIds: [7, 8] });

        expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('workshop/agendas', { params: { ids: '7,8' } });
        expect(screen.getByText('Beto Ríos')).toBeInTheDocument();
        expect(screen.getByText('Gus Mora')).toBeInTheDocument();
        expect(screen.getAllByText('Marlon').length).toBeGreaterThan(0);
        expect(screen.getByText('Venta')).toBeInTheDocument();
        expect(screen.getByText('No show')).toBeInTheDocument();
    });

    it('arranca en «Todas»: cuenta también a quien canceló, para que cierre con el número del taller', async () => {
        abrirModal();

        await screen.findByText('Ana Pérez');
        expect(screen.getByText('Elena Soto')).toBeInTheDocument();
        expect(screen.getByText(/mostrando 4 de 4/)).toBeInTheDocument();
        expect(screen.getByText('4 personas agendadas')).toBeInTheDocument();
        expect(screen.getByText(/3 del taller en vivo/)).toBeInTheDocument();
        expect(screen.getByText('1 persona sin cita con un closer')).toBeInTheDocument();
    });

    it('se filtra por estado con el filtro rápido de Revisar', async () => {
        abrirModal();
        await screen.findByText('Ana Pérez');

        await userEvent.click(screen.getByRole('button', { name: /^Todas/ }));
        await userEvent.click(screen.getByRole('menuitemradio', { name: /^No show/ }));

        expect(screen.getByText('Beto Ríos')).toBeInTheDocument();
        expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
        expect(screen.getByText(/mostrando 1 de 4/)).toBeInTheDocument();
    });

    it('es de lectura: no ofrece exportar ni cambiar la fecha base', async () => {
        abrirModal();
        await screen.findByText('Ana Pérez');

        expect(screen.queryByRole('button', { name: /Exportar/ })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
        expect(screen.queryByText('F. creación')).not.toBeInTheDocument();
    });

    it('al tocar una persona con cita abre su ficha en solo lectura', async () => {
        abrirModal();

        await userEvent.click(await screen.findByRole('button', { name: /Abrir Ana Pérez/ }));

        expect(await screen.findByText('ficha 1 solo lectura')).toBeInTheDocument();
    });

    it('quien no tiene cita con un closer no abre ficha: avisa', async () => {
        abrirModal();

        await userEvent.click(await screen.findByRole('button', { name: /Abrir Gus Mora/ }));

        expect(toast).toHaveBeenCalledWith(expect.stringMatching(/no tiene cita con un closer/));
        expect(screen.queryByRole('dialog', { name: 'Ficha' })).not.toBeInTheDocument();
    });

    it('el director de marketing ve la lista pero su rol no abre la ficha', async () => {
        useAuth.mockReturnValue({ user: { role: 'director_marketing' } });
        abrirModal();

        await userEvent.click(await screen.findByRole('button', { name: /Abrir Ana Pérez/ }));

        expect(toast).toHaveBeenCalledWith(expect.stringMatching(/Tu rol no abre la ficha/));
        expect(screen.queryByRole('dialog', { name: 'Ficha' })).not.toBeInTheDocument();
    });

    it('avisa si el número del taller no coincide con la lista', async () => {
        abrirModal({ esperado: 9 });

        expect(await screen.findByText(/El taller guarda 9/)).toBeInTheDocument();
    });

    it('si falla la carga ofrece reintentar', async () => {
        api.get.mockReset().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ data: DATOS });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        abrirModal();

        await userEvent.click(await screen.findByRole('button', { name: /Reintentar/ }));

        expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    });
});

describe('AgendasDelTaller', () => {
    beforeEach(() => {
        api.get.mockReset().mockResolvedValue({ data: DATOS });
        useAuth.mockReturnValue({ user: { role: 'admin' } });
    });

    it('el número abre el modal de ese taller sin disparar el clic de la fila que lo contiene', async () => {
        const alFila = vi.fn();
        render(
            <div onClick={alFila}>
                <AgendasDelTaller evento={{ id: 7, name: 'WEBINAR 17', date: '2026-10-17', agendas_exitosas: 4 }} />
            </div>,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Ver las 4 agendas de WEBINAR 17' }));

        expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('workshop/agendas', { params: { ids: '7' } });
        expect(alFila).not.toHaveBeenCalled();
        const modal = screen.getByRole('dialog', { name: /WEBINAR 17/ });
        await userEvent.click(within(modal).getByRole('button', { name: 'Cerrar' }));
        await waitFor(() => expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument());
    });
});
