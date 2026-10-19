import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import Flujos from './Flujos';
import { inboxApi } from './api';

vi.mock('./api', () => ({
    inboxApi: {
        flujos: vi.fn(), flujo: vi.fn(), crearFlujo: vi.fn(), guardarFlujo: vi.fn(), publicarFlujo: vi.fn(), borrarFlujo: vi.fn(),
        pausarFlujo: vi.fn(), activarFlujo: vi.fn(), catalogo: vi.fn(() => Promise.resolve([])),
    },
}));

const GRAFO = {
    disparadores: [{ id: 'd1', canal: 'dm', palabras: ['OBTENER GUIA'], coincidencia: 'exacta' }],
    inicio: 'perfil',
    nodos: [
        { id: 'perfil', tipo: 'mensaje', nombre: 'Apertura', posicion: { x: 0, y: 0 }, contenido: [{ tipo: 'texto', texto: '¿Cuál es tu perfil?' }],
          botones: [{ id: 'medico', titulo: 'Médico graduado' }] },
        { id: 'examen', tipo: 'mensaje', posicion: { x: 300, y: 0 }, contenido: [{ tipo: 'texto', texto: '¿Qué examen?' }] },
    ],
    conexiones: [{ id: 'c1', desde: 'perfil', salida: 'medico', hacia: 'examen' }],
};
const METRICAS = {
    dias: 7, entradas: 40, completan: 0.39, suficiente: true,
    embudo: [{ id: 'perfil', numero: 1, alcance: 40 }, { id: 'examen', numero: 2, alcance: 25 }],
    mayor_caida: { id: 'perfil', numero: 1, nombre: 'Apertura', caida: 0.375 },
};
const RESUMEN = { id: 1, nombre: 'Guía', estado: 'activo', version: 2, cambios_sin_publicar: false, palabras_clave: ['OBTENER GUIA'],
    nodos: 2, ejecuciones_abiertas: 3, actualizado_en: '2026-10-15T13:00:00Z', metricas: METRICAS };

// React Flow mide el lienzo: jsdom no trae ResizeObserver ni DOMMatrix.
beforeAll(() => {
    global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    global.DOMMatrixReadOnly = class { constructor() { this.m22 = 1; } };
});

beforeEach(() => {
    vi.clearAllMocks();
    inboxApi.flujos.mockResolvedValue([RESUMEN]);
    inboxApi.flujo.mockResolvedValue({ ...RESUMEN, grafo: GRAFO, errores: [],
        metricas: { ...METRICAS, nodos: { perfil: { numero: 1, alcance: 40, base: 40, caida: 0.375, salidas: { medico: 1 } } } } });
});

describe('Inbox › Flujos', () => {
    it('cada tarjeta muestra su resultado, su embudo y la mayor caída', async () => {
        render(<Flujos puedeEditar />);

        expect(await screen.findByText('Guía')).toBeTruthy();
        expect(screen.getByText('#OBTENER GUIA · v2')).toBeTruthy();
        expect(screen.getByText('Entradas 7 d').previousSibling.textContent).toBe('40');
        expect(screen.getByText('Completan').previousSibling.textContent).toBe('39%');
        expect(screen.getByText('En curso').previousSibling.textContent).toBe('3');
        expect(screen.getByText(/Caída de 38% en/).textContent).toBe('Caída de 38% en Paso 1 · Apertura');
        expect(within(screen.getByRole('list', { name: 'Embudo de Guía por paso' })).getAllByRole('listitem')).toHaveLength(2);
    });

    it('con pocas entradas no da porcentajes', async () => {
        inboxApi.flujos.mockResolvedValue([{ ...RESUMEN, metricas: { ...METRICAS, entradas: 11, suficiente: false, mayor_caida: null } }]);
        render(<Flujos puedeEditar />);

        expect(await screen.findByText('Muestra insuficiente: 11 entradas en 7 días.')).toBeTruthy();
        expect(screen.getByText('Completan').previousSibling.textContent).toBe('–');
    });

    it('abre el lienzo con las cajas numeradas, el copy y el % por salida', async () => {
        render(<Flujos puedeEditar />);

        fireEvent.click(await screen.findByText('Guía'));

        expect(await screen.findByText('“¿Cuál es tu perfil?”')).toBeTruthy();
        expect(screen.getByText('paso 1')).toBeTruthy();
        expect(screen.getByText('paso 2')).toBeTruthy();
        expect(screen.getByText('mayor caída')).toBeTruthy();
        expect(screen.getByText('38% no responde este paso')).toBeTruthy();
        expect(screen.getByText('Médico graduado').nextSibling.textContent).toBe('100%');
        expect(screen.getByRole('button', { name: /Publicar v3/ })).toBeTruthy();
        // Sin nada elegido, el inspector resume el flujo.
        expect(screen.getByText('Sin avisos: se puede publicar.')).toBeTruthy();
    });

    it('tocar una barra del embudo abre el lienzo en ese paso', async () => {
        render(<Flujos puedeEditar />);

        fireEvent.click(await screen.findByRole('listitem', { name: 'Paso 2: 25' }));

        expect(await screen.findByRole('textbox', { name: 'Nombre del paso' })).toBeTruthy();
        expect(inboxApi.flujo).toHaveBeenCalledWith(1);
    });

    it('en solo lectura no se crea ni se publica', async () => {
        render(<Flujos puedeEditar={false} />);

        expect(await screen.findByText('Guía')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Crear flujo/ })).toBeNull();
        expect(screen.queryByText('Empezar desde plantilla')).toBeNull();
        expect(screen.getByRole('button', { name: /Ver/ })).toBeTruthy();
        fireEvent.click(screen.getByText('Guía'));
        expect(await screen.findByText('“¿Cuál es tu perfil?”')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Publicar/ })).toBeNull();
    });

    it('filtra por estado y busca por palabra clave', async () => {
        render(<Flujos puedeEditar />);

        expect(await screen.findByText('Guía')).toBeTruthy();
        fireEvent.change(screen.getByRole('textbox', { name: 'Buscar flujo o palabra clave' }), { target: { value: 'obtener' } });
        expect(screen.getByText('Guía')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Pausados/ }));
        expect(screen.queryByText('Guía')).toBeNull();
        expect(screen.getByText(/No hay flujos en «Pausados»/)).toBeTruthy();
    });

    it('crea un flujo desde una plantilla', async () => {
        inboxApi.crearFlujo.mockResolvedValue({ ...RESUMEN, id: 2, nombre: 'Nuevo', grafo: GRAFO, errores: [] });
        render(<Flujos puedeEditar />);

        fireEvent.click(await screen.findByRole('button', { name: /Invitación a llamada/ }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), { target: { value: 'Llamada' } });
        fireEvent.click(screen.getByRole('button', { name: /Crear y abrir/ }));

        await screen.findByText('“¿Cuál es tu perfil?”');
        const [nombre, grafo] = inboxApi.crearFlujo.mock.calls[0];
        expect(nombre).toBe('Llamada');
        expect(grafo.inicio).toBe('invitacion');
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

    it('un publicado se pausa desde la tarjeta', async () => {
        inboxApi.pausarFlujo.mockResolvedValue({});
        render(<Flujos puedeEditar />);

        fireEvent.click(await screen.findByRole('button', { name: /Pausar/ }));
        expect(inboxApi.pausarFlujo).toHaveBeenCalledWith(1);
    });
});
