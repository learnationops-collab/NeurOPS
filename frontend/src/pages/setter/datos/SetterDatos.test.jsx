import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SetterDatos from './SetterDatos';
import { misDatosEjemplo } from './misDatosEjemplo';

/**
 * La sección «Mis datos» del espacio del setter: «Mis datos» y Comparativas con el mismo período.
 *
 * Se fija que cada pestaña pida lo suyo con el período de la URL (los parámetros del dashboard), que
 * Comparativas sea de solo lectura y que el drill-down le pase al host la tabla y la URL con el
 * filtro ya escrito, sin perder el período.
 */

const api = vi.hoisted(() => ({ misDatos: vi.fn(), comparativas: vi.fn() }));

vi.mock('../../comercial/comercialApi', () => ({
    getContexto: () => Promise.resolve({
        yo: { id: 7, nombre: 'Elias', rol: 'setter' },
        periodos: [{ key: 'mes', label: 'Este mes' }, { key: '7d', label: '7 días' }, { key: 'custom', label: 'Personalizado' }],
        comparaciones: [{ key: 'prev', label: 'Período anterior' }, { key: 'none', label: 'Sin comparar' }],
    }),
    getMisDatosSetter: (filtros) => api.misDatos(filtros),
    getComparativas: (filtros) => api.comparativas(filtros),
}));
vi.mock('../../comercial/components/Comparativas', () => ({
    default: ({ datos, irAPersona }) => (
        <div data-testid="comparativas">{datos ? `${datos.rol} · ${irAPersona ? 'abre listas' : 'solo lectura'}` : 'cargando'}</div>
    ),
}));

const montar = async (url, props = {}) => {
    render(<MemoryRouter initialEntries={[url]}><SetterDatos {...props} /></MemoryRouter>);
    await act(async () => {});
};

describe('SetterDatos', () => {
    beforeEach(() => {
        api.misDatos.mockReset().mockResolvedValue(misDatosEjemplo());
        api.comparativas.mockReset().mockResolvedValue({ rol: 'setters', filas: [] });
    });

    it('«Mis datos» pide su vista con el período de la URL', async () => {
        await montar('/setter/deck?step=datos&p=7d&vs=none');

        expect(api.misDatos).toHaveBeenCalledWith(expect.objectContaining({ period: '7d', compare: 'none', rol: 'setters' }));
        expect(api.comparativas).not.toHaveBeenCalled();
        expect(screen.getByText('Elias · 7 días')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Lo que reportaste' })).toBeInTheDocument();
    });

    it('sin período en la URL mira el mes, como el dashboard', async () => {
        await montar('/setter/deck?step=datos');

        expect(api.misDatos).toHaveBeenCalledWith(expect.objectContaining({ period: 'mes', compare: 'prev' }));
    });

    it('Comparativas es la de setters, de solo lectura', async () => {
        await montar('/setter/deck?step=datos&tab=comparativas', { tab: 'comparativas' });

        expect(api.comparativas).toHaveBeenCalledWith(expect.objectContaining({ period: 'mes', rol: 'setters' }));
        expect(api.misDatos).not.toHaveBeenCalled();
        expect(screen.getByTestId('comparativas')).toHaveTextContent('setters · solo lectura');
    });

    it('un personalizado sin sus dos fechas no pide nada: las pide', async () => {
        await montar('/setter/deck?step=datos&p=custom&d=2026-10-01');

        expect(api.misDatos).not.toHaveBeenCalled();
        expect(screen.getByText('Elegí las dos fechas del período.')).toBeInTheDocument();
    });

    it('un número del sistema le pasa al host la tabla y la URL con el filtro, sin perder el período', async () => {
        const onIrALista = vi.fn();
        await montar('/setter/deck?step=datos&p=7d&ft=4', { onIrALista });

        fireEvent.click(screen.getByRole('button', { name: 'Ver en la lista: agendas del sistema, 7' }));

        const [tabla, url] = onIrALista.mock.calls[0];
        expect(tabla).toBe('generadas');
        expect(url.get('t')).toBe('generadas');
        expect(JSON.parse(url.get('f'))).toEqual({ __de: 'Agendas generadas' });
        expect(url.get('ft')).toBe('5');
        expect(url.get('p')).toBe('7d');
        expect(url.get('step')).toBe('datos');
    });

    it('sin host que lleve a una lista, no hay drill-down', async () => {
        await montar('/setter/deck?step=datos');

        expect(screen.queryByRole('button', { name: /^Ver en la lista/ })).toBeNull();
    });
});
