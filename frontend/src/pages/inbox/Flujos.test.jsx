import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Flujos from './Flujos';
import { inboxApi } from './api';

vi.mock('./api', () => ({
    inboxApi: { flujos: vi.fn(), flujo: vi.fn(), crearFlujo: vi.fn(), guardarFlujo: vi.fn(), publicarFlujo: vi.fn(), borrarFlujo: vi.fn() },
}));

const GRAFO = {
    disparadores: [{ id: 'd1', canal: 'dm', palabras: ['OBTENER GUIA'], coincidencia: 'exacta' }],
    inicio: 'perfil',
    nodos: [{ id: 'perfil', tipo: 'mensaje', posicion: { x: 0, y: 0 }, contenido: [{ tipo: 'texto', texto: '¿Cuál es tu perfil?' }],
        botones: [{ id: 'medico', titulo: 'Médico graduado' }] }],
    conexiones: [],
};
const RESUMEN = { id: 1, nombre: 'Guía', estado: 'activo', version: 2, cambios_sin_publicar: false, palabras_clave: ['OBTENER GUIA'],
    nodos: 1, ejecuciones_abiertas: 3, actualizado_en: '2026-10-15T13:00:00Z' };

// React Flow mide el lienzo: jsdom no trae ResizeObserver ni DOMMatrix.
beforeAll(() => {
    global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    global.DOMMatrixReadOnly = class { constructor() { this.m22 = 1; } };
});

beforeEach(() => {
    inboxApi.flujos.mockResolvedValue([RESUMEN]);
    inboxApi.flujo.mockResolvedValue({ ...RESUMEN, grafo: GRAFO, errores: [] });
});

describe('Inbox › Flujos', () => {
    it('lista los flujos con su estado y abre el lienzo con sus cajas', async () => {
        render(<Flujos puedeEditar />);

        expect(await screen.findByText('Guía')).toBeTruthy();
        expect(screen.getByText('OBTENER GUIA')).toBeTruthy();
        expect(screen.getByText('En curso').previousSibling.textContent).toBe('3');
        expect(screen.getByText('Activo · v2')).toBeTruthy();

        fireEvent.click(screen.getByText('Guía'));

        expect(await screen.findByText('¿Cuál es tu perfil?')).toBeTruthy();
        expect(screen.getByText('Médico graduado')).toBeTruthy();
        expect(screen.getByRole('button', { name: /Publicar/ })).toBeTruthy();
    });

    it('en solo lectura no se crea ni se publica', async () => {
        render(<Flujos puedeEditar={false} />);

        expect(await screen.findByText('Guía')).toBeTruthy();
        expect(screen.queryByRole('textbox', { name: 'Nuevo flujo' })).toBeNull();
        expect(screen.getByRole('button', { name: /Ver/ })).toBeTruthy();
        fireEvent.click(screen.getByText('Guía'));
        expect(await screen.findByText('¿Cuál es tu perfil?')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Publicar/ })).toBeNull();
    });

    it('filtra por estado', async () => {
        render(<Flujos puedeEditar />);

        expect(await screen.findByText('Guía')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Pausados/ }));
        expect(screen.queryByText('Guía')).toBeNull();
        expect(screen.getByText(/No hay flujos en «Pausados»/)).toBeTruthy();
    });

    it('un borrador se elimina después de confirmar', async () => {
        inboxApi.flujos.mockResolvedValue([{ ...RESUMEN, estado: 'borrador', version: null }]);
        inboxApi.borrarFlujo.mockResolvedValue({});
        render(<Flujos puedeEditar />);

        fireEvent.click(await screen.findByRole('button', { name: 'Eliminar Guía' }));
        expect(inboxApi.borrarFlujo).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
        expect(inboxApi.borrarFlujo).toHaveBeenCalledWith(1);
    });
});
