import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RevisarLista from './RevisarLista';
import LeadModal from './LeadModal';
import { cuandoDe } from './Shared';

/**
 * La fecha y la hora de Revisar, en el reloj de quien mira (pedido del usuario, 09/10/2026).
 *
 * `start_time` y `created_at` viajan en UTC y sin Z, como los manda `isoformat()`. Las
 * expectativas se arman con la misma cuenta en la zona del proceso, para que el test no dependa
 * del huso de la máquina.
 */
globalThis.IntersectionObserver ??= class {
    observe() {}

    unobserve() {}

    disconnect() {}
};

const dos = (n) => String(n).padStart(2, '0');
const enLocal = (iso) => {
    const d = new Date(`${iso}Z`);
    return { dia: `${dos(d.getDate())}/${dos(d.getMonth() + 1)}`, hora: `${dos(d.getHours())}:${dos(d.getMinutes())}` };
};

const LLAMADA_UTC = '2026-10-02T13:00:00';
const CREADA_UTC = '2026-09-30T02:15:00.218225';
const AGENDA = {
    tipo: 'agenda', id: 6824, cliente: 'Oristin', fecha: LLAMADA_UTC, creada: CREADA_UTC,
    post_call: { key: 'pendiente', label: 'Pendiente', tone: 'idle' }, closer: 'Jean Carlo',
};

describe('cuandoDe', () => {
    it('una agenda y un lead pasan de UTC a la hora local', () => {
        expect(cuandoDe(AGENDA)).toEqual(enLocal(LLAMADA_UTC));
        expect(cuandoDe(AGENDA, 'creada')).toEqual(enLocal(CREADA_UTC));
        expect(cuandoDe({ tipo: 'lead', fecha: CREADA_UTC })).toEqual(enLocal(CREADA_UTC));
    });

    it('una venta y un cliente se muestran como vienen: su fecha es un día, no un instante', () => {
        expect(cuandoDe({ tipo: 'venta', fecha: '2026-09-25T00:00:00' })).toEqual({ dia: '25/09', hora: '00:00' });
        expect(cuandoDe({ tipo: 'cliente', fecha: '2026-09-25T18:40:00' })).toEqual({ dia: '25/09', hora: '18:40' });
    });

    it('sin fecha no inventa una', () => {
        expect(cuandoDe({ tipo: 'agenda', fecha: null })).toEqual({ dia: '—', hora: '' });
    });
});

describe('la columna Fecha de Revisar', () => {
    it('dice el día y la hora de la llamada en hora local', () => {
        render(<RevisarLista def={{ cols: [{ key: 'fecha', header: 'Fecha', width: '1fr' },
            { key: 'cliente', header: 'Cliente', width: '2fr' }] }}
            visibles={[AGENDA]} plantilla="1fr 2fr" onAbrirFila={() => {}} dimension={null} modo="lista" />);

        const { dia, hora } = enLocal(LLAMADA_UTC);
        expect(screen.getByText(hora)).toBeInTheDocument();
        expect(screen.getByText(dia, { exact: false })).toBeInTheDocument();
    });
});

describe('el modal de la fila', () => {
    it('la reunión y el ingreso dicen la misma hora local que la lista', () => {
        render(<LeadModal fila={AGENDA} estados={{}} puedeCorregir={false} onCerrar={vi.fn()} />);

        const llamada = enLocal(LLAMADA_UTC);
        expect(screen.getByText(`${llamada.dia} · ${llamada.hora}`)).toBeInTheDocument();
        expect(screen.getByText(enLocal(CREADA_UTC).dia)).toBeInTheDocument();
    });
});
