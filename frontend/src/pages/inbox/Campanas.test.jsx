import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Campanas from './Campanas';
import RegistroMensaje from './editor/RegistroMensaje';
import { inboxApi } from './api';

vi.mock('./api', () => ({
    inboxApi: {
        campanas: vi.fn(), crearCampana: vi.fn(), guardarCampana: vi.fn(), borrarCampana: vi.fn(),
        campanasMeta: vi.fn(), flujos: vi.fn(), catalogo: vi.fn(), setters: vi.fn(),
    },
}));

const local = (a, m, d) => new Date(a, m - 1, d).toISOString();
const GUIA = {
    id: 1, nombre: 'Guía MIR octubre', embudo: 'setting', tipo: 'pago', flujo_id: 7, flujo: 'Obtener guía',
    desde: local(2026, 10, 1), hasta: null, vigente: true, palabras: ['GUIA MIR', 'GUIA'], campanas_meta: ['C1'], reparto: 'distribuido', solo_conectados: false, setters: [11],
    metricas: { entradas: 40, personas: 38, respondieron: 30, calificados: 20, descalificados: 8, agendas: 5, gasto: 100, costo_agenda: 20 },
};
const VIEJA = { ...GUIA, id: 2, nombre: 'Examen septiembre', desde: local(2026, 9, 1), hasta: local(2026, 10, 1), palabras: ['EXAMEN'], metricas: null };

beforeEach(() => {
    vi.clearAllMocks();
    inboxApi.campanas.mockResolvedValue({ desde: '2026-09-20', hasta: '2026-10-19', campanas: [GUIA, VIEJA] });
    inboxApi.flujos.mockResolvedValue([{ id: 7, nombre: 'Obtener guía', estado: 'activo' }]);
    inboxApi.setters.mockResolvedValue([{ id: 11, nombre: 'Paula' }, { id: 12, nombre: 'Elias' }]);
    inboxApi.campanasMeta.mockResolvedValue([{ id: 'C1', nombre: 'SPI-TRIPODE-SETTING', activa: true }, { id: 'C2', nombre: 'DMV Test', activa: false }]);
});

describe('Campañas', () => {
    it('muestra cada campaña con sus palabras, su flujo y sus métricas', async () => {
        render(<Campanas puedeEditar />);
        const tarjeta = (await screen.findByText('Guía MIR octubre')).closest('article');
        expect(within(tarjeta).getByText('#GUIA MIR')).toBeTruthy();
        expect(within(tarjeta).getByText(/Obtener guía/)).toBeTruthy();
        expect(within(tarjeta).getByText('Calificados · 50%')).toBeTruthy();
        expect(within(tarjeta).getByText('Por agenda')).toBeTruthy();
        expect(await within(tarjeta).findByText('Reparte entre Paula')).toBeTruthy();
        expect(inboxApi.campanas).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    });

    it('filtra por estado según la vigencia', async () => {
        render(<Campanas puedeEditar />);
        await screen.findByText('Guía MIR octubre');
        fireEvent.click(screen.getByRole('button', { name: /Terminadas/ }));
        expect(screen.queryByText('Guía MIR octubre')).toBeNull();
        expect(screen.getByText('Examen septiembre')).toBeTruthy();
    });

    it('crea una campaña y muestra el choque de palabras que devuelve el servidor', async () => {
        inboxApi.crearCampana.mockRejectedValue({ response: { data: { message: 'Estas palabras ya están en otra campaña vigente en esas fechas: GUIA (Guía MIR octubre)' } } });
        render(<Campanas puedeEditar />);
        await screen.findByText('Guía MIR octubre');
        fireEvent.click(screen.getByRole('button', { name: 'Nueva campaña' }));

        fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Guía noviembre' } });
        const palabra = screen.getByLabelText('Nueva palabra clave');
        fireEvent.change(palabra, { target: { value: 'guia' } });
        fireEvent.keyDown(palabra, { key: 'Enter' });
        fireEvent.click(screen.getByRole('button', { name: 'Crear campaña' }));

        expect(await screen.findByText(/GUIA \(Guía MIR octubre\)/)).toBeTruthy();
        expect(inboxApi.crearCampana).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Guía noviembre', palabras: ['guia'], hasta: null }));
    });

    it('sin reparto no manda setters', async () => {
        inboxApi.crearCampana.mockResolvedValue({ ...GUIA, id: 3 });
        render(<Campanas puedeEditar />);
        await screen.findByText('Guía MIR octubre');
        fireEvent.click(screen.getByRole('button', { name: 'Nueva campaña' }));
        fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Orgánica' } });
        const palabra = screen.getByLabelText('Nueva palabra clave');
        fireEvent.change(palabra, { target: { value: 'APUNTES' } });
        fireEvent.keyDown(palabra, { key: 'Enter' });
        fireEvent.click(await screen.findByRole('button', { name: 'Paula' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sin reparto' }));
        expect(screen.queryByText('Solo entre conectados')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Crear campaña' }));
        await waitFor(() => expect(inboxApi.crearCampana).toHaveBeenCalledWith(expect.objectContaining({ reparto: 'sin_reparto', setters: [] })));
    });

    it('no manda una campaña sin palabras clave', async () => {
        render(<Campanas puedeEditar />);
        await screen.findByText('Guía MIR octubre');
        fireEvent.click(screen.getByRole('button', { name: 'Nueva campaña' }));
        fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Sin palabras' } });
        fireEvent.click(screen.getByRole('button', { name: 'Crear campaña' }));
        expect(screen.getByText('Agregá al menos una palabra clave.')).toBeTruthy();
        expect(inboxApi.crearCampana).not.toHaveBeenCalled();
    });

    it('edita una existente: guarda y recarga', async () => {
        inboxApi.guardarCampana.mockResolvedValue({ ...GUIA, nombre: 'Guía MIR' });
        render(<Campanas puedeEditar />);
        const tarjeta = (await screen.findByText('Guía MIR octubre')).closest('article');
        fireEvent.click(within(tarjeta).getByRole('button', { name: 'Editar' }));
        expect(screen.getByText('SPI-TRIPODE-SETTING')).toBeTruthy(); // su campaña de Meta, por nombre
        fireEvent.click(screen.getByRole('button', { name: 'Quitar GUIA' }));
        fireEvent.click(screen.getByRole('button', { name: 'Elias' })); // suma a Elias al reparto
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
        await waitFor(() => expect(inboxApi.guardarCampana).toHaveBeenCalledWith(1, expect.objectContaining({
            palabras: ['GUIA MIR'], flujo_id: 7, reparto: 'distribuido', setters: [11, 12],
        })));
        await waitFor(() => expect(inboxApi.campanas).toHaveBeenCalledTimes(2));
    });

    it('en solo lectura no deja crear ni guardar', async () => {
        render(<Campanas puedeEditar={false} />);
        const tarjeta = (await screen.findByText('Guía MIR octubre')).closest('article');
        expect(screen.queryByRole('button', { name: 'Nueva campaña' })).toBeNull();
        fireEvent.click(within(tarjeta).getByRole('button', { name: 'Ver' }));
        expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    });
});

describe('RegistroMensaje', () => {
    it('elegir un mensaje del catálogo deja el registro en el nodo, y «No registra» lo saca', async () => {
        inboxApi.catalogo.mockResolvedValue([{ id: '8', titulo: '¿Qué quiere mejorar?', rama: 'descalificados', activo: true }]);
        const cambiar = vi.fn();
        const nodo = { id: 'n1', tipo: 'mensaje', contenido: [] };
        const { rerender } = render(<RegistroMensaje nodo={nodo} cambiar={cambiar} lectura={false} />);

        fireEvent.click(screen.getByRole('button', { name: 'Mensaje del catálogo' }));
        fireEvent.click(await screen.findByText('8 · ¿Qué quiere mejorar?'));
        expect(cambiar).toHaveBeenLastCalledWith({ id: 'n1', tipo: 'mensaje', contenido: [], registro: { mensaje_id: '8' } }, true);

        rerender(<RegistroMensaje nodo={{ ...nodo, registro: { mensaje_id: '8' } }} cambiar={cambiar} lectura={false} />);
        expect(screen.getByText(/toma la rama de descalificados/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Mensaje del catálogo' }));
        fireEvent.click(screen.getByText('No registra'));
        expect(cambiar).toHaveBeenLastCalledWith({ id: 'n1', tipo: 'mensaje', contenido: [] }, true);
    });
});
