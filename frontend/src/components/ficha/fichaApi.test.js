import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../services/api';
import {
  ACCIONES, agendaParaVender, clienteNuevoParaVender, ejecutarAccion, ejecutarConsulta,
} from './fichaApi';
import { construirPayload, estadoInicial, responder, ventaDirecta } from './arbolResultado';

beforeEach(() => {
  vi.clearAllMocks();
  ['get', 'patch', 'post', 'put', 'delete'].forEach((m) => api[m].mockResolvedValue({ data: { ok: true } }));
});

describe('el árbol de «Resultado» habla en acciones que la ficha conoce', () => {
  // La pestaña armaba la venta como la acción `venta`, que no estaba en el mapa de rutas: cada
  // venta fallaba con «Acción de ficha desconocida» antes de salir del navegador, y los tests de
  // la pestaña no lo veían porque reemplazan `onAccion` por un doble.
  it('una venta sale por una acción del mapa de rutas', () => {
    let r = estadoInicial();
    r = responder(r, 'res', { res: 'asistio' });
    r = responder(r, 'decisor', { with_decision_maker: true });
    r = responder(r, 'oferta', { offer_presented: true });
    r = responder(r, 'cierre', { cierre: true });
    expect(ACCIONES).toContain(construirPayload(r, {}).accion);
  });

  it('un resultado sin venta también', () => {
    const r = responder(estadoInicial(), 'res', { res: 'no_asistio' });
    expect(ACCIONES).toContain(construirPayload(r, {}).accion);
  });
});

describe('la objeción desde el historial', () => {
  it('se postea en la agenda que se eligió, solo con el texto', async () => {
    await ejecutarAccion('guardar_objecion', 71, { texto: 'Lo tiene que pensar', otra: 'cosa' });
    expect(api.post).toHaveBeenCalledWith('/ficha/71/objecion', { texto: 'Lo tiene que pensar' });
  });
});

describe('rutas de la venta', () => {
  it('registrar la venta postea el payload entero en la ruta de venta de esa agenda', async () => {
    const payload = { venta: { tipo_pago: 'RR - parcial', monto: 500 }, plan_cuotas: { total: 1500 } };
    await ejecutarAccion('registrar_venta', 9012, payload);
    expect(api.post).toHaveBeenCalledWith('/ficha/9012/venta', payload);
  });

  it('el estado de pago del programa se lee de su propia ruta, con el programa como parámetro', async () => {
    api.get.mockResolvedValue({ data: { total_paid: 500, sales_count: 1 } });
    const estado = await ejecutarConsulta('estado_venta', 9012, { params: { programa: 'RR' } });
    expect(api.get).toHaveBeenCalledWith('/ficha/9012/estado-venta', { params: { programa: 'RR' } });
    expect(estado).toEqual({ total_paid: 500, sales_count: 1 });
  });

  it('a un comprador que no está se lo registra con sus datos, sin id', async () => {
    api.post.mockResolvedValue({ data: { appointment_id: 88, nuevo: true } });
    const datos = { nombre: 'Bruno', email: 'bruno@mail.com', instagram: '', telefono: '' };
    await expect(clienteNuevoParaVender(datos)).resolves.toEqual({ appointment_id: 88, nuevo: true });
    expect(api.post).toHaveBeenCalledWith('/ficha/cliente-nuevo/agenda-de-venta', datos);
  });

  it('la agenda donde vender se pide por cliente, no por agenda', async () => {
    api.post.mockResolvedValue({ data: { appointment_id: 77, creada: true } });
    await expect(agendaParaVender(5)).resolves.toEqual({ appointment_id: 77, creada: true });
    expect(api.post).toHaveBeenCalledWith('/ficha/cliente/5/agenda-de-venta');
  });

  it('una venta directa avisa que no sale de la llamada de esta agenda', () => {
    const directa = construirPayload(ventaDirecta(estadoInicial()), {}).datos;
    const deLaLlamada = construirPayload(responder(estadoInicial(), 'contacto_result', { contacto_result: 'cerro' }), {}).datos;
    expect(directa.venta_directa).toBe(true);
    expect(deLaLlamada).not.toHaveProperty('venta_directa');
  });
});
