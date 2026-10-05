import { describe, it, expect } from 'vitest';
import {
  estadoInicial, responder, preguntaActual, resumen, revisionVenta, CLAVES_CON_SECCION,
} from './arbolResultado';
import { PREGUNTAS } from './arbolResultado.preguntas';

function recorrer(guion, contexto = {}) {
  let r = {
    ...estadoInicial(), sold_in_call: true, enviar_webhook: true, date: '2026-10-05', num_cuotas: 1,
    dia_de_pago: 10, refs_rows: [],
  };
  for (let paso = 0; paso < 60; paso += 1) {
    const q = preguntaActual(r, contexto);
    if (!q) return r;
    expect(guion, `el guión no contesta «${q.clave}»`).toHaveProperty(q.clave);
    r = responder(r, q.clave, guion[q.clave]);
  }
  throw new Error('no terminó');
}

const BASE = {
  res: { res: 'asistio' }, decisor: { with_decision_maker: true },
  oferta: { offer_presented: true }, cierre: { cierre: true },
  venta_nombre: { nombre_cliente: 'Kevin Álvarez' },
  venta_instagram: { instagram: '@kevin' },
  venta_email: { mail_cliente: 'kevin@mail.com' },
  venta_telefono: { telefono: '+54 9 11 5555' },
  venta_documento: { documento_identidad: '30111222' },
  programa: { programa: 'RR' },
  venta_examen: { examen_lead: 'USMLE Step 1' },
  venta_fecha: { date: '2026-10-05', sold_in_call: true },
  venta_estado: { estado: 'Completada' },
  venta_notas: { notas: 'cerró rápido' },
  refs_ask: { refs_ask: 'no' },
  venta_academia: { dar_acceso_academia: true },
};
const HOY = new Date(2026, 9, 5);
const CONTADO = {
  ...BASE, tipo_pago: { tipo_pago_simple: 'completo' }, venta_montos: { monto: '2000' },
  medio_pago: { metodo_pago: 'Stripe' },
};
const EN_CUOTAS = {
  ...BASE, tipo_pago: { tipo_pago_simple: 'parcial' },
  venta_montos: { precio_total: '2000', monto: '500' }, medio_pago: { metodo_pago: 'Stripe' },
  venta_num_cuotas: { num_cuotas: 3 }, venta_modo_cuotas: { installmentMode: 'monthly' },
  venta_dia_pago: { dia_de_pago: 15 },
};
const revisar = (guion, ajustes = {}) => {
  const r = { ...recorrer(guion), ...ajustes };
  return { r, rev: revisionVenta(r, {}, resumen(r, {}), HOY) };
};

describe('revisión de la venta', () => {
  it('agrupa las filas en secciones en orden y cada fila sabe a qué paso lleva', () => {
    const { rev } = revisar(CONTADO);
    expect(rev.secciones.map((s) => s.id)).toEqual(['cliente', 'programa', 'pago', 'fechas', 'notas', 'despues', 'llamada']);
    const pagos = rev.secciones.find((s) => s.id === 'pago').filas;
    expect(pagos.find((f) => f.label === 'Monto cobrado').paso).toBe('venta_montos');
    const todas = rev.secciones.flatMap((s) => s.filas);
    expect(todas.every((f) => f.paso)).toBe(true);
    expect(todas.some((f) => f.paso === 'venta_email')).toBe(true);
  });

  it('destaca el total: en un pago completo es lo cobrado, en cuotas el precio total', () => {
    expect(revisar(CONTADO).rev.numeros).toMatchObject({ total: 2000, cobrado: 2000, saldo: 0, cuotas: 0, programa: 'Residency Roadmap' });
    expect(revisar(EN_CUOTAS).rev.numeros).toMatchObject({ total: 2000, cobrado: 500, saldo: 1500, cuotas: 3 });
  });

  it('una venta sana no trae avisos', () => {
    expect(revisar(CONTADO).rev.avisos).toEqual([]);
    expect(revisar(EN_CUOTAS).rev.avisos).toEqual([]);
  });

  it('un dato opcional vacío sale como «Sin cargar» y avisa', () => {
    const { rev } = revisar(CONTADO, { telefono: '' });
    const fila = rev.secciones.find((s) => s.id === 'cliente').filas.find((f) => f.paso === 'venta_telefono');
    expect(fila).toMatchObject({ vacia: true, valor: 'Sin cargar' });
    expect(rev.avisos).toContainEqual(expect.objectContaining({ id: 'telefono', nivel: 'aviso', paso: 'venta_telefono' }));
  });

  it('un email mal escrito es un error que lleva al paso del email', () => {
    const { rev } = revisar(CONTADO, { mail_cliente: 'kevin@' });
    expect(rev.avisos).toContainEqual(expect.objectContaining({ id: 'email', nivel: 'error', paso: 'venta_email' }));
  });

  it('cobrar más que el precio total es un error', () => {
    const { rev } = revisar(EN_CUOTAS, { monto: '2500' });
    expect(rev.avisos.map((a) => a.id)).toContain('cobrado-mayor');
  });

  it('avisa cuando las cuotas a mano dejan la última sin monto', () => {
    const { rev } = revisar(EN_CUOTAS, { cuotaMontos: { 1: '1500', 2: '400' } });
    const ids = rev.avisos.map((a) => a.id);
    expect(ids).toContain('cuota-cero');
    expect(rev.avisos.find((a) => a.id === 'cuota-cero').paso).toBe('venta_dia_pago');
  });

  it('avisa de una fecha de venta futura o muy vieja', () => {
    expect(revisar(CONTADO, { date: '2026-10-09' }).rev.avisos.map((a) => a.id)).toContain('fecha-futura');
    expect(revisar(CONTADO, { date: '2026-09-20' }).rev.avisos.map((a) => a.id)).toContain('fecha-vieja');
  });

  it('todas las preguntas de venta tienen sección asignada', () => {
    const venta = PREGUNTAS.filter((q) => q.clave.startsWith('venta_') || ['programa', 'tipo_pago', 'medio_pago', 'liquidar'].includes(q.clave));
    venta.forEach((q) => expect(CLAVES_CON_SECCION, q.clave).toContain(q.clave));
  });
});
