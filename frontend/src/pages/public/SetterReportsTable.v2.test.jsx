import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SetterReportsTable from './SetterReportsTable';

/**
 * Registros (/admin/ventas › Setters) con un reporte del formulario por canal (v2): muestra de qué
 * canal vinieron los entrantes y las bienvenidas, y se edita por canal (el PUT rechaza tocar sus
 * totales sueltos). Las filas v1 se editan como siempre, y ahora guardan todas sus columnas.
 */

const red = vi.hoisted(() => ({ reports: [], puts: [] }));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, role: 'director_comercial' } }) }));
vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: { reports: red.reports, pages: 1 } })),
        put: vi.fn((url, datos) => { red.puts.push([url, datos]); return Promise.resolve({ data: {} }); }),
        delete: vi.fn(), post: vi.fn(),
    },
}));

const V2 = {
    id: 9, date: '2026-10-10', setter_name: 'Elias', version: 2, entrantes: 16, leads: 14, op_sub: 12, op_res: 0,
    fun_agenda: 3, qualification_fu: 9, qualification_fur: 0,
    v2: {
        version: 2,
        canales: {
            anuncios: { entrantes: 10, no_lead: 1, inabribles: 0, ap_entrantes: 3, ap_dolor: 5, agendas: 2 },
            inbound: { entrantes: 6, no_lead: 0, inabribles: 1, ap_entrantes: 1, ap_dolor: 3, agendas: 1 },
        },
        bienvenidas: { hechas: 12, respondidas: 5, aperturas: 4 },
        embudo: { cualificados: 14, dolor: 10, oferta: 7, link: 5, agendas: 3 },
        followups: { entrantes: 9, dolor: 5, oferta: 3, link: 3 },
    },
};
const V1 = { id: 8, date: '2026-10-08', setter_name: 'Elias', version: 1, v2: null, entrantes: 20, leads: 13,
    op_sub: 20, op_res: 10, link_fu: 4, link_fur: 1, qualification_opening_submitted: 6 };

const montar = async () => {
    render(<SetterReportsTable setters={[]} />);
    await act(async () => {});
};

beforeEach(() => {
    red.reports = [V2, V1];
    red.puts = [];
});

describe('Registros · reportes por canal', () => {
    it('un v2 dice de qué canal vinieron sus entrantes y sus bienvenidas', async () => {
        await montar();

        expect(screen.getByText('Por canal')).toBeInTheDocument();
        const celdas = screen.getByText('A 10 · I 6').closest('tr').querySelectorAll('td');
        // La columna Bienv.: hechas arriba, respondidas abajo. Un v1 no tiene.
        expect(celdas[13]).toHaveTextContent('125');
        expect(screen.getByText('2026-10-08').closest('tr').querySelectorAll('td')[13]).toHaveTextContent('—');
    });

    it('un v2 se edita por canal y manda el PUT v2', async () => {
        await montar();

        fireEvent.click(screen.getAllByTitle('Editar Reporte Completo')[0]);
        fireEvent.change(screen.getByLabelText('Inbound: Agendas'), { target: { value: '0' } });
        fireEvent.change(screen.getByLabelText('Bienvenidas: Resp.'), { target: { value: '7' } });
        // Guardar (el botón verde de la fila).
        await act(async () => { fireEvent.click(document.querySelector('button.bg-emerald-50')); });

        const [url, datos] = red.puts[0];
        expect(url).toBe('/public/setter-reports/9');
        expect(datos.version).toBe(2);
        expect(datos.inbound).toEqual({ entrantes: 6, no_lead: 0, inabribles: 1, ap_entrantes: 1, ap_dolor: 3, agendas: 0 });
        expect(datos.bienvenidas).toEqual({ hechas: 12, respondidas: 7, aperturas: 4 });
        expect(datos.embudo).toEqual({ dolor: 10, oferta: 7, link: 5 });
        expect(datos).not.toHaveProperty('entrantes');
    });

    it('un v1 se edita por sus columnas y manda todas las que muestra', async () => {
        await montar();

        fireEvent.click(screen.getAllByTitle('Editar Reporte Completo')[1]);
        await act(async () => { fireEvent.click(document.querySelector('button.bg-emerald-50')); });

        const [url, datos] = red.puts[0];
        expect(url).toBe('/public/setter-reports/8');
        expect(datos).toMatchObject({ entrantes: 20, link_fu: 4, link_fur: 1, qualification_opening_submitted: 6 });
        expect(datos).not.toHaveProperty('version');
    });
});
