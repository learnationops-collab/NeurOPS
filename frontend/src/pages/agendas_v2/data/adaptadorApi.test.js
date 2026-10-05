// Adaptador de la API: carga, PATCH o PUT según corresponda, consulta de versión y errores.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../services/api';
import { crearAdaptadorApi } from './adaptadorApi';
import { crearAlmacen } from './almacen';

vi.mock('../../../services/api', () => ({
    default: { get: vi.fn(), put: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const ESTADO = {
    cols: { funnels: [], formularios: [{ id: 'f1', nombre: 'Diagnóstico' }], personas: [{ id: 'ana', nombre: 'Ana' }], grupos: [], eventos: [], roles: [] },
    perfil: { nombre: 'Mario' }, integ: null, reservas: [{ id: 'r1', estado: 'agendada', inicio_ms: 1, fin_ms: 2 }], version: 3,
};
const errHttp = (status, data = {}) => Object.assign(new Error('HTTP ' + status), { response: { status, data } });

// Respuestas de GET: /estado y /version (la versión del servidor se cambia con `servidor.version`).
const servidor = { version: 3 };
beforeEach(() => {
    servidor.version = 3;
    api.get.mockImplementation(async (url) => {
        if (url === '/agendas-v2/estado') return { data: { ...ESTADO, version: servidor.version } };
        if (url === '/agendas-v2/version') return { data: { version: servidor.version } };
        throw errHttp(404);
    });
    const escritura = async () => { servidor.version += 1; return { data: { doc: {}, version: servidor.version } }; };
    api.put.mockImplementation(escritura);
    api.patch.mockImplementation(escritura);
    api.delete.mockImplementation(escritura);
    api.post.mockImplementation(async () => { servidor.version += 1; return { data: { reserva: { id: 'r1', estado: 'cancelada' }, version: servidor.version } }; });
});
afterEach(() => { vi.useRealTimers(); });

describe('adaptadorApi', () => {
    it('cargar trae el estado de /agendas-v2/estado', async () => {
        const ad = crearAdaptadorApi();
        const r = await ad.cargar();
        expect(api.get).toHaveBeenCalledWith('/agendas-v2/estado');
        expect(r.cols.formularios).toEqual([{ id: 'f1', nombre: 'Diagnóstico' }]);
        expect(r.cols.grupos).toEqual([]);
        expect(r.perfil).toEqual({ nombre: 'Mario' });
        expect(r.reservas).toHaveLength(1);
    });

    it('PATCH con los campos si el documento ya está en el servidor; si no, PUT entero', async () => {
        const ad = crearAdaptadorApi();
        await ad.cargar();
        await ad.guardar('formularios', 'f1', { nombre: 'Nuevo', preguntas: [] }, { nombre: 'Nuevo' });
        expect(api.patch).toHaveBeenCalledWith('/agendas-v2/formularios/f1', { nombre: 'Nuevo' });
        expect(api.put).not.toHaveBeenCalled();

        // Documento nuevo: aunque vengan campos, va entero.
        await ad.guardar('formularios', 'f2', { nombre: 'Otro' }, { nombre: 'Otro' });
        expect(api.put).toHaveBeenCalledWith('/agendas-v2/formularios/f2', { nombre: 'Otro' });
        // Ya lo tiene: la próxima edición es PATCH.
        await ad.guardar('formularios', 'f2', { nombre: 'Otro 2' }, { nombre: 'Otro 2' });
        expect(api.patch).toHaveBeenLastCalledWith('/agendas-v2/formularios/f2', { nombre: 'Otro 2' });

        // Sin campos (alta o deshacer): PUT entero aunque exista.
        await ad.guardar('personas', 'ana', { nombre: 'Ana P.' });
        expect(api.put).toHaveBeenLastCalledWith('/agendas-v2/personas/ana', { nombre: 'Ana P.' });
    });

    it('si el PATCH da 404 (lo borró otro), manda el documento entero', async () => {
        const ad = crearAdaptadorApi();
        await ad.cargar();
        api.patch.mockRejectedValueOnce(errHttp(404));
        await ad.guardar('formularios', 'f1', { nombre: 'X', preguntas: [] }, { nombre: 'X' });
        expect(api.put).toHaveBeenCalledWith('/agendas-v2/formularios/f1', { nombre: 'X', preguntas: [] });
    });

    it('el almacén manda solo los campos editados al guardar en la pausa', async () => {
        vi.useFakeTimers();
        const alm = crearAlmacen(crearAdaptadorApi());
        await alm.iniciar();
        alm.editar('formularios', 'f1', { nombre: 'Editado' });
        alm.editar('formularios', 'f1', { desc: 'algo' });
        await vi.advanceTimersByTimeAsync(700);
        expect(api.patch).toHaveBeenCalledTimes(1);
        expect(api.patch).toHaveBeenCalledWith('/agendas-v2/formularios/f1', { nombre: 'Editado', desc: 'algo' });
        // Crear manda PUT con el documento normalizado.
        const id = alm.crear('grupos', { nombre: 'Alta' });
        await vi.advanceTimersByTimeAsync(0);
        expect(api.put).toHaveBeenCalledWith('/agendas-v2/grupos/' + id, expect.objectContaining({ nombre: 'Alta' }));
    });

    it('la consulta de versión avisa solo los cambios de otros', async () => {
        vi.useFakeTimers();
        const ad = crearAdaptadorApi();
        await ad.cargar();
        const cb = vi.fn();
        const fin = ad.alCambiar(cb);

        await vi.advanceTimersByTimeAsync(15000);
        expect(api.get).toHaveBeenCalledWith('/agendas-v2/version', expect.anything());
        expect(cb).not.toHaveBeenCalled();

        // Una escritura propia sube la versión: no es un cambio ajeno.
        await ad.guardar('formularios', 'f1', { nombre: 'Y' }, { nombre: 'Y' });
        await vi.advanceTimersByTimeAsync(15000);
        expect(cb).not.toHaveBeenCalled();

        // Otro guardó: la versión del servidor no es la conocida.
        servidor.version += 1;
        await vi.advanceTimersByTimeAsync(15000);
        expect(cb).toHaveBeenCalledTimes(1);

        // Otro guardó justo antes que nosotros: nuestra respuesta salta una versión y la próxima consulta avisa.
        servidor.version += 1;
        await ad.guardar('formularios', 'f1', { nombre: 'Z' }, { nombre: 'Z' });
        await vi.advanceTimersByTimeAsync(15000);
        expect(cb).toHaveBeenCalledTimes(2);

        fin();
        servidor.version += 5;
        await vi.advanceTimersByTimeAsync(30000);
        expect(cb).toHaveBeenCalledTimes(2);
    });

    it('traduce los errores a los códigos del almacén', async () => {
        const ad = crearAdaptadorApi();
        api.put.mockRejectedValueOnce(errHttp(403));
        await expect(ad.guardar('roles', 'r1', {})).rejects.toMatchObject({ code: 'invalid_argument' });
        api.put.mockRejectedValueOnce(errHttp(401));
        await expect(ad.guardarInteg({})).rejects.toMatchObject({ code: 'revoked' });
        api.delete.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }));
        await expect(ad.borrar('roles', 'r1')).rejects.toMatchObject({ code: 'unavailable' });
        api.get.mockRejectedValueOnce(errHttp(500));
        await expect(ad.cargar()).rejects.toMatchObject({ code: 'error' });
        // Borrar algo que ya no está no es un error.
        api.delete.mockRejectedValueOnce(errHttp(404));
        await expect(ad.borrar('roles', 'r9')).resolves.toBeNull();
    });

    it('perfil e integraciones usan sus rutas; crear o cancelar reservas no se hace desde la gestión', async () => {
        const ad = crearAdaptadorApi();
        await ad.guardarPerfil({ nombre: 'Mario' });
        expect(api.put).toHaveBeenCalledWith('/agendas-v2/perfil', { nombre: 'Mario' });
        await ad.guardarInteg({ meet: {} });
        expect(api.put).toHaveBeenCalledWith('/agendas-v2/integraciones', { meet: {} });
        await expect(ad.cancelarReserva('r1')).rejects.toMatchObject({ code: 'no_soportado' });
        expect(api.post).not.toHaveBeenCalled();
        await expect(ad.crearReserva({})).rejects.toMatchObject({ code: 'no_soportado' });
    });

    it('configuración con IA: trae el prompt, revisa e importa, y pasa los errores de validación', async () => {
        const ad = crearAdaptadorApi();
        api.get.mockResolvedValueOnce({ data: { prompt: 'Sos un asistente…' } });
        await expect(ad.promptPaquete()).resolves.toBe('Sos un asistente…');
        expect(api.get).toHaveBeenLastCalledWith('/agendas-v2/paquete/prompt');

        api.post.mockResolvedValueOnce({ data: { resumen: { funnel: 'W' } } });
        await expect(ad.importarPaquete({ a: 1 }, true)).resolves.toEqual({ resumen: { funnel: 'W' } });
        expect(api.post).toHaveBeenLastCalledWith('/agendas-v2/paquete', { paquete: { a: 1 }, simular: true });

        api.post.mockRejectedValueOnce(errHttp(400, { code: 'invalido', errores: ['funnel: falta "nombre".'] }));
        await expect(ad.importarPaquete({}, false)).rejects.toMatchObject({ errores: ['funnel: falta "nombre".'] });
    });
});
