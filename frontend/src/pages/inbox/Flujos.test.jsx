import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Flujos from './Flujos';
import { inboxApi } from './api';

vi.mock('./api', () => ({
    inboxApi: { flujos: vi.fn(), flujo: vi.fn(), crearFlujo: vi.fn(), guardarFlujo: vi.fn(), publicarFlujo: vi.fn() },
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
        expect(screen.getByText(/OBTENER GUIA · 1 paso · 3 en curso/)).toBeTruthy();
        expect(screen.getByText('Activo · v2')).toBeTruthy();

        fireEvent.click(screen.getByText('Guía'));

        expect(await screen.findByText('¿Cuál es tu perfil?')).toBeTruthy();
        expect(screen.getByText('Médico graduado')).toBeTruthy();
        expect(screen.getByRole('button', { name: /Publicar/ })).toBeTruthy();
    });

    it('en solo lectura no se crea ni se publica', async () => {
        render(<Flujos puedeEditar={false} />);

        expect(await screen.findByText('Guía')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Nuevo flujo/ })).toBeNull();
        fireEvent.click(screen.getByText('Guía'));
        expect(await screen.findByText('¿Cuál es tu perfil?')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Publicar/ })).toBeNull();
    });
});
