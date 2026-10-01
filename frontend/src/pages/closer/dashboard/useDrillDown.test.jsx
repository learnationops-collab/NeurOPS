import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDrillDown } from './useDrillDown';

/**
 * Del dashboard de performance a la lista del dashboard comercial. El rango libre antes no viajaba
 * (allá no había dónde poner fechas) y la lista abría con el mes en curso y un aviso; ahora viaja
 * con las fechas que el dashboard está mostrando.
 */

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 4, role: 'closer' } }),
}));

let irA;
const Disparador = (props) => {
    irA = useDrillDown(props);
    return <output data-testid="url">{`${useLocation().pathname}${useLocation().search}`}</output>;
};

const destino = (props, tabla = 'agendas', filtro = { asistio: 'Sí', __de: 'Show up' }) => {
    render(<MemoryRouter initialEntries={['/closer/dashboard']}><Disparador {...props} /></MemoryRouter>);
    act(() => irA(tabla, filtro));
    const [ruta, query] = screen.getByTestId('url').textContent.split('?');
    return { ruta, q: new URLSearchParams(query) };
};

describe('useDrillDown · el período viaja a la lista', () => {
    it('el rango libre lleva sus fechas, sin aviso de mes en curso', () => {
        const { ruta, q } = destino({ period: 'custom', closerId: 'all',
            fechas: { start: '2026-09-08', end: '2026-09-14' } });

        expect(ruta).toBe('/closer/mis-datos');
        expect([q.get('p'), q.get('d'), q.get('h')]).toEqual(['custom', '2026-09-08', '2026-09-14']);
        expect(JSON.parse(q.get('f'))).toEqual({ asistio: 'Sí', __de: 'Show up' });
    });

    it('un período de los de siempre viaja tal cual, sin fechas', () => {
        const { q } = destino({ period: '7d', closerId: 'all', fechas: { start: '2026-09-11', end: '2026-09-17' } });

        expect([q.get('p'), q.get('d'), q.get('h')]).toEqual(['7d', null, null]);
    });

    it('el aviso propio del dato se conserva', () => {
        const { q } = destino({ period: 'mes', closerId: 'all' }, 'ventas', { __de: 'Cash', __aviso: 'Ojo' });

        expect(JSON.parse(q.get('f'))).toEqual({ __de: 'Cash', __aviso: 'Ojo' });
    });
});
