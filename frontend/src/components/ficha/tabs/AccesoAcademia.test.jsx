import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import AccesoAcademia from './AccesoAcademia';
import { sumarMeses, baseDeRenovacion } from '../fulfillment';

// Dar, renovar y quitar el acceso a la Academia desde Fulfillment (pedido del 30/09/2026).
// La forma de `datos` es la de `GET /api/ficha/<appt>/fulfillment`. Datos inventados.
const PAGADO = {
  assignment_id: 27, product_slug: 'ace-learners', product_name: 'Ace Learners', is_active: true,
  expires_at: '2026-10-14T00:00:00+00:00', days_remaining: 14,
};
const ALUMNO = {
  vinculado: true, error: null, alumno: { id: 900 }, producto_pagado: PAGADO,
  programa: { codigo: 'AL', nombre: 'Ace Learners', product_slug: 'ace-learners' },
  vence_sugerido: '2027-02-14', email_sugerido: 'alumna@ejemplo.com',
};
const SIN_CUENTA = {
  ...ALUMNO, vinculado: false, alumno: null, producto_pagado: null, vence_sugerido: '2027-01-30',
};
const FICHA = { permisos: { cobrar: true } };

const montar = (datos, extra = {}) => {
  const onAccion = vi.fn().mockResolvedValue({});
  const onHecho = vi.fn();
  render(<AccesoAcademia datos={datos} ficha={FICHA} onAccion={onAccion} onHecho={onHecho} {...extra} />);
  return { onAccion, onHecho };
};

describe('AccesoAcademia', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-09-30T15:00:00'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('quien no puede cobrar no ve nada, y con la Academia caída tampoco se ofrece', () => {
    const { container } = render(
      <AccesoAcademia datos={ALUMNO} ficha={{ permisos: { cobrar: false } }} onAccion={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();

    const caida = render(<AccesoAcademia datos={{ ...ALUMNO, error: { motivo: 'caída' } }} ficha={FICHA}
      onAccion={vi.fn()} />);
    expect(caida.container).toBeEmptyDOMElement();
  });

  it('a un alumno con acceso se le ofrece renovar y quitar', () => {
    montar(ALUMNO);
    expect(screen.getByRole('button', { name: 'Renovar acceso' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Quitar acceso/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dar acceso' })).not.toBeInTheDocument();
  });

  it('renovar arranca con la sugerencia, los plazos cuentan desde su vencimiento y no pide correo', async () => {
    const { onAccion, onHecho } = montar(ALUMNO);
    fireEvent.click(screen.getByRole('button', { name: 'Renovar acceso' }));

    const fecha = screen.getByLabelText('Tiene acceso hasta el');
    expect(fecha).toHaveValue('2027-02-14');
    expect(screen.queryByLabelText('Correo con el que va a entrar')).not.toBeInTheDocument();
    // Le quedan dos semanas: renovar no se las puede recortar.
    expect(screen.getByText('Hasta el 14 feb 2027. Los plazos se cuentan desde su vencimiento actual, el 14 oct 2026.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+1 año' }));
    expect(fecha).toHaveValue('2027-10-14');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Renovar acceso' })); });

    expect(onAccion).toHaveBeenCalledWith('acceso_academia', { vence: '2027-10-14' });
    expect(onHecho).toHaveBeenCalled();
  });

  it('dar a quien no tiene cuenta pide el correo, arrancando por el sugerido', async () => {
    const { onAccion } = montar(SIN_CUENTA);
    fireEvent.click(screen.getByRole('button', { name: 'Dar acceso' }));

    const correo = screen.getByLabelText('Correo con el que va a entrar');
    expect(correo).toHaveValue('alumna@ejemplo.com');
    fireEvent.change(correo, { target: { value: ' real@ejemplo.com ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Dar acceso' })); });

    expect(onAccion).toHaveBeenCalledWith('acceso_academia', { vence: '2027-01-30', email: 'real@ejemplo.com' });
  });

  it('si el backend lo rechaza, el formulario se queda abierto y dice por qué al lado del botón', async () => {
    const { onAccion, onHecho } = montar(SIN_CUENTA);
    onAccion.mockRejectedValue({ response: { data: { message: 'El email ingresado no es válido.' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Dar acceso' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Dar acceso' })); });

    expect(screen.getByRole('alert')).toHaveTextContent('El email ingresado no es válido.');
    expect(screen.getByLabelText('Tiene acceso hasta el')).toBeInTheDocument();
    expect(onHecho).not.toHaveBeenCalled();
  });

  it('sin programa cargado no se puede dar: el botón explica qué falta', () => {
    montar({ ...SIN_CUENTA, programa: null });
    const boton = screen.getByRole('button', { name: 'Dar acceso' });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('title', 'Falta cargar en Acciones qué programa pagó.');
  });

  it('quitar pide confirmación y manda el pedido recién cuando se agota el deshacer', async () => {
    const { onAccion, onHecho } = montar(ALUMNO);
    fireEvent.click(screen.getByRole('button', { name: /Quitar acceso/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, quitar/ }));
    expect(onAccion).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(6000); });

    expect(onAccion).toHaveBeenCalledWith('quitar_acceso_academia', { confirmo: true });
    expect(onHecho).toHaveBeenCalled();
  });
});

describe('fechas del acceso', () => {
  it('sumar meses topea en el último día del mes, como el backend', () => {
    expect(sumarMeses('2026-10-31', 4)).toBe('2027-02-28');
    expect(sumarMeses('2026-09-30', 12)).toBe('2027-09-30');
    expect(sumarMeses('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('se renueva desde el vencimiento si todavía no pasó, si no desde hoy', () => {
    expect(baseDeRenovacion({ expires_at: '2026-10-14T00:00:00+00:00' }, '2026-09-30')).toBe('2026-10-14');
    expect(baseDeRenovacion({ expires_at: '2026-09-01T00:00:00+00:00' }, '2026-09-30')).toBe('2026-09-30');
    expect(baseDeRenovacion(null, '2026-09-30')).toBe('2026-09-30');
  });
});
