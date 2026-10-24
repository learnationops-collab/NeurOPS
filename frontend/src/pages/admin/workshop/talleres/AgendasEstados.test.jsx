import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../../../../services/api';
import { olvidarDatosTaller } from './datosTaller';
import AgendasEstados from './AgendasEstados';

const ESTADOS = [
    { key: 'show_up', label: 'Asistió', color: '#2FBF8F', desc: 'Show up.', grupo: 'asistieron' },
    { key: 'no_show', label: 'No show', color: '#E85C4A', desc: 'No se presentó.', grupo: 'no_show' },
    { key: 'sin_reportar', label: 'Sin reportar', color: '#FF3FA4', desc: 'Sin reporte.', grupo: 'sin_reporte' },
    { key: 'cancelada', label: 'Cancelada', color: '#94A3B8', desc: 'Cancelada.', grupo: 'se_cayeron' },
];
const GRUPOS = [
    { key: 'asistieron', label: 'Asistieron', tono: 'success', desc: 'Hicieron la llamada.' },
    { key: 'no_asistieron', label: 'No show', tono: 'error', desc: 'No se presentaron.' },
    { key: 'sin_reporte', label: 'Sin reporte', tono: 'warning', desc: 'Nadie reportó.' },
    { key: 'se_cayeron', label: 'Se cayeron', tono: 'info', desc: 'Reprogramaron o cancelaron.' },
    { key: 'por_ocurrir', label: 'Por ocurrir', tono: 'muted', desc: 'Aún no llegó.' },
];

// n por estado y por grupo, en el mismo orden de ESTADOS y GRUPOS.
const reparto = (estados, grupos) => ({
    total: grupos.reduce((a, n) => a + n, 0),
    estados: ESTADOS.map((e, i) => ({ ...e, n: estados[i] })),
    grupos: GRUPOS.map((g, i) => ({ ...g, n: grupos[i] })),
});

const DATOS = {
    ...reparto([6, 2, 1, 1], [6, 2, 1, 1, 0]),
    total: 10,
    llamadas: 12,
    por_entrada: {
        vivo: reparto([4, 2, 0, 1], [4, 2, 0, 1, 0]),
        landing: reparto([2, 0, 1, 0], [2, 0, 1, 0, 0]),
    },
};

const armar = () => render(<div className="dc-shell"><AgendasEstados evento={{ id: 14 }} /></div>);
const tile = (nombre) => screen.getByText(nombre, { selector: 'dt' }).closest('div');

describe('Workshop › Talleres › Agendas del taller', () => {
    beforeEach(() => { api.get.mockReset(); olvidarDatosTaller(); });

    it('pide el reparto del taller y muestra cada grupo con su % de las personas', async () => {
        api.get.mockResolvedValue({ data: DATOS });
        armar();

        expect(await screen.findByText('Asistieron', { selector: 'dt' })).toBeInTheDocument();
        expect(api.get.mock.calls[0][0]).toBe('workshop/events/14/agendas-estados');
        expect(within(tile('Asistieron')).getByText('6')).toBeInTheDocument();
        expect(within(tile('Asistieron')).getByText('60%')).toBeInTheDocument();
        expect(within(tile('No show')).getByText('20%')).toBeInTheDocument();
        expect(screen.getByText(/10 personas · 12 llamadas/)).toBeInTheDocument();
    });

    it('el detalle lista solo los estados que tienen gente', async () => {
        api.get.mockResolvedValue({ data: { ...DATOS, estados: [...DATOS.estados.slice(0, 3), { ...ESTADOS[3], n: 0 }] } });
        armar();

        const lista = await screen.findByRole('list', { name: 'Detalle por estado' });
        expect(within(lista).getByText(/Asistió/)).toBeInTheDocument();
        expect(within(lista).getByText(/Sin reportar/)).toBeInTheDocument();
        expect(within(lista).queryByText(/Cancelada/)).not.toBeInTheDocument();
    });

    it('con grabación se puede ver cada entrada por separado', async () => {
        api.get.mockResolvedValue({ data: DATOS });
        armar();
        await screen.findByText('Asistieron', { selector: 'dt' });

        await userEvent.click(screen.getByRole('tab', { name: 'En vivo' }));

        expect(within(tile('Asistieron')).getByText('4')).toBeInTheDocument();
        expect(screen.getByText(/7 personas/)).toBeInTheDocument();
    });

    it('sin nadie en la grabación no ofrece el selector', async () => {
        api.get.mockResolvedValue({ data: { ...DATOS, por_entrada: { vivo: DATOS, landing: reparto([0, 0, 0, 0], [0, 0, 0, 0, 0]) } } });
        armar();
        await screen.findByText('Asistieron', { selector: 'dt' });

        expect(screen.queryByRole('tab', { name: 'En vivo' })).not.toBeInTheDocument();
    });

    it('un taller sin agendas lo dice, y un error también', async () => {
        api.get.mockResolvedValueOnce({ data: { ...reparto([0, 0, 0, 0], [0, 0, 0, 0, 0]), llamadas: 0, por_entrada: {} } });
        const { unmount } = armar();
        expect(await screen.findByText(/Nadie agendó/)).toBeInTheDocument();
        unmount();

        olvidarDatosTaller();
        api.get.mockRejectedValueOnce(new Error('boom'));
        armar();
        expect(await screen.findByText(/No se pudieron traer las agendas/)).toBeInTheDocument();
    });
});
