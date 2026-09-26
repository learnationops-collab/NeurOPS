import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Las piezas compartidas las escribe el agente del modal: acá se inyectan los dobles mínimos.
vi.mock('../acciones/piezas', () => import('../acciones/piezasStub.jsx'));

import TabResultado from './TabResultado';
import TabAcciones from './TabAcciones';
import { fichaAgendaVencida, fichaConDeuda, fichaEnSeguimiento } from '../resultado.fixtures';

const props = (ficha, extra = {}) => ({
  ficha,
  onAccion: vi.fn().mockResolvedValue({ status: 'ok' }),
  onRecargar: vi.fn().mockResolvedValue(undefined),
  irA: vi.fn(),
  puedeEditar: true,
  ...extra,
});

describe('TabResultado', () => {
  let p;
  beforeEach(() => { p = props(fichaAgendaVencida); });

  it('muestra el stepper de 5 hitos y las 4 tarjetas grandes', () => {
    render(<TabResultado {...p} />);
    const stepper = screen.getByRole('list');
    expect(within(stepper).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('heading', { name: '¿Qué pasó con esta llamada?' })).toBeInTheDocument();
    ['Asistió', 'No asistió', 'Canceló', 'Reagenda'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('«Empezar de nuevo» aparece recién cuando el árbol arrancó y vuelve al inicio', async () => {
    const user = userEvent.setup();
    render(<TabResultado {...p} />);
    expect(screen.queryByRole('button', { name: /empezar de nuevo/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Asistió' }));
    expect(screen.getByRole('heading', { name: '¿Estuvo el decisor?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /empezar de nuevo/i }));
    expect(screen.getByRole('heading', { name: '¿Qué pasó con esta llamada?' })).toBeInTheDocument();
  });

  it('avanza pregunta por pregunta y el stepper se va poniendo al día', async () => {
    const user = userEvent.setup();
    render(<TabResultado {...p} />);
    await user.click(screen.getByRole('button', { name: 'Asistió' }));
    const stepper = screen.getByRole('list');
    expect(within(stepper).getAllByRole('listitem')[1]).toHaveAttribute('data-estado', 'hecho');
    await user.click(screen.getByRole('button', { name: /Sí, con decisor/ }));
    await user.click(screen.getByRole('button', { name: /No se presentó/ }));
    expect(screen.getByRole('heading', { name: 'No se le presentó la oferta. ¿Siguiente paso?' })).toBeInTheDocument();
    // «Sin oferta» es un desenlace malo del hito Cierre
    expect(within(screen.getByRole('list')).getAllByRole('listitem')[2]).toHaveAttribute('data-estado', 'alerta');
  });

  it('un formulario no deja continuar sin los campos obligatorios y dice qué falta', async () => {
    const user = userEvent.setup();
    render(<TabResultado {...p} />);
    await user.click(screen.getByRole('button', { name: 'No asistió' }));
    await user.click(screen.getByRole('button', { name: 'Se arrepintió' }));
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    await user.click(screen.getByRole('button', { name: /Descartar lead/ }));
    expect(screen.getByRole('heading', { name: '¿Por qué se descarta?' })).toBeInTheDocument();
    expect(screen.getByText(/mínimo 3 caracteres/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Continuar$/ })).toBeDisabled();
    await user.type(screen.getByLabelText('Motivo'), 'no show reiterado');
    expect(screen.getByRole('button', { name: /^Continuar$/ })).toBeEnabled();
  });

  it('al completar el árbol muestra la revisión y dispara onAccion con reportar_resultado', async () => {
    const user = userEvent.setup();
    render(<TabResultado {...p} />);
    await user.click(screen.getByRole('button', { name: 'Reagenda' }));
    await user.click(screen.getByRole('button', { name: 'No dio motivo' }));
    await user.click(screen.getByRole('button', { name: /No dejó fecha/ }));
    await user.type(screen.getByLabelText('Ángulo del seguimiento / Notas'), 'le pido fecha nueva');
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));

    expect(screen.getByRole('heading', { name: /Revisá el resultado/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Guardar el resultado/ }));

    expect(p.onAccion).toHaveBeenCalledTimes(1);
    const [accion, datos] = p.onAccion.mock.calls[0];
    expect(accion).toBe('reportar_resultado');
    expect(datos.deck).toMatchObject({ seguimiento_sub: 'Reprogramó sin fecha', seguimiento_tipo: 'no_tomada' });
    expect(p.onRecargar).toHaveBeenCalled();
    expect(p.irA).not.toHaveBeenCalled();
  });

  it('una venta con deuda dispara la acción `venta` y lleva a la pestaña Acciones', async () => {
    const user = userEvent.setup();
    render(<TabResultado {...p} />);
    await user.click(screen.getByRole('button', { name: 'Asistió' }));
    await user.click(screen.getByRole('button', { name: /Sí, con decisor/ }));
    await user.click(screen.getByRole('button', { name: /Sí, se presentó/ }));
    await user.click(screen.getByRole('button', { name: /Sí, cerró/ }));
    await user.click(screen.getByRole('button', { name: /Queda deuda/ }));
    await user.click(screen.getByRole('button', { name: /Ninguno/ }));
    await user.click(screen.getByRole('button', { name: /Residency Roadmap/ }));
    await user.click(screen.getByRole('button', { name: /Parcial/ }));

    // los datos del lead vienen precargados de la ficha
    expect(screen.getByLabelText('Nombre')).toHaveValue('Kevin Álvarez');
    expect(screen.getByLabelText('Email')).toHaveValue('kevin@mail.com');
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));

    await user.type(screen.getByLabelText('Precio total del programa'), '2000');
    await user.type(screen.getByLabelText('Cobrado hoy'), '500');
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    await user.click(screen.getByRole('button', { name: 'Stripe' }));

    // el cronograma aparece y cuadra contra el saldo
    expect(screen.getByText(/Saldo a financiar/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cuadra con el total');
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    await user.click(screen.getByRole('button', { name: /^Continuar$/ })); // venta_meta (fecha precargada)
    await user.click(screen.getByRole('button', { name: /^Continuar$/ })); // venta_extras
    await user.click(screen.getByRole('button', { name: 'Se lo pedí, no dejó' }));
    await user.click(screen.getByRole('button', { name: /^Continuar$/ })); // referidos

    expect(screen.getByRole('heading', { name: /Revisá la venta/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Registrar la venta/ }));

    const [accion, datos] = p.onAccion.mock.calls[0];
    expect(accion).toBe('venta');
    expect(datos.venta).toMatchObject({ tipo_pago: 'RR - parcial', monto: 500, precio_total: 2000, metodo_pago: 'Stripe' });
    expect(datos.plan_cuotas).toMatchObject({ total: 2000, num_cuotas: 1 });
    expect(p.irA).toHaveBeenCalledWith('acciones');
  });

  it('en modo seguimiento arranca por la cadencia y no por la llamada', () => {
    render(<TabResultado {...props(fichaEnSeguimiento)} />);
    expect(screen.getByRole('heading', { name: '¿Qué pasó con este contacto?' })).toBeInTheDocument();
    expect(screen.getByRole('list').textContent).toContain('Seguimiento 2 de 4');
  });

  it('un aviso del backend se muestra aunque el guardado haya salido bien', async () => {
    const user = userEvent.setup();
    const conAviso = props(fichaAgendaVencida, {
      onAccion: vi.fn().mockResolvedValue({ status: 'success', warning: 'El cliente ya tenía una seña sin plan' }),
    });
    render(<TabResultado {...conAviso} />);
    await user.click(screen.getByRole('button', { name: 'Reagenda' }));
    await user.click(screen.getByRole('button', { name: 'No dio motivo' }));
    await user.click(screen.getByRole('button', { name: /No dejó fecha/ }));
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    await user.click(screen.getByRole('button', { name: /Guardar el resultado/ }));
    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent('El cliente ya tenía una seña sin plan');
    await user.click(screen.getByRole('button', { name: 'Descartar el aviso' }));
    expect(screen.queryByText(/seña sin plan/)).toBeNull();
  });

  it('con `prefers-reduced-motion` el árbol sigue siendo usable', async () => {
    // framer-motion lee esta media query: si el usuario pidió menos movimiento, las opciones
    // tienen que aparecer igual (sin desplazamiento ni cascada), no quedarse invisibles.
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }));
    const user = userEvent.setup();
    render(<TabResultado {...p} />);
    await user.click(screen.getByRole('button', { name: 'Asistió' }));
    expect(screen.getByRole('button', { name: /Sí, con decisor/ })).toBeVisible();
  });

  it('sin permiso de reportar no muestra el árbol', () => {
    const ficha = { ...fichaAgendaVencida, permisos: { ...fichaAgendaVencida.permisos, reportar: false } };
    render(<TabResultado {...props(ficha)} />);
    expect(screen.getByText(/no reportarlo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asistió' })).toBeNull();
  });

  it('un error al guardar se muestra y no cambia de pestaña', async () => {
    const user = userEvent.setup();
    const rotas = props(fichaAgendaVencida, { onAccion: vi.fn().mockRejectedValue(new Error('el backend dijo no')) });
    render(<TabResultado {...rotas} />);
    await user.click(screen.getByRole('button', { name: 'Reagenda' }));
    await user.click(screen.getByRole('button', { name: 'No dio motivo' }));
    await user.click(screen.getByRole('button', { name: /No dejó fecha/ }));
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    await user.click(screen.getByRole('button', { name: /Guardar el resultado/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('el backend dijo no');
    expect(rotas.irA).not.toHaveBeenCalled();
  });
});

describe('TabAcciones', () => {
  it('muestra la deuda y las cuatro acciones', () => {
    render(<TabAcciones {...props(fichaConDeuda)} />);
    expect(screen.getByText('$1,500')).toBeInTheDocument();
    expect(screen.getByText('$500')).toBeInTheDocument();
    ['Armar plan de cuotas', 'Registrar pago', 'Registrar seguimiento', 'Dar de baja'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('un cliente al día no muestra un monto en rojo', () => {
    render(<TabAcciones {...props(fichaAgendaVencida)} />);
    expect(screen.getByText('Al día')).toBeInTheDocument();
  });

  it('cada acción abre una sub-vista con «Volver», no un modal', async () => {
    const user = userEvent.setup();
    render(<TabAcciones {...props(fichaConDeuda)} />);
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(screen.getByRole('heading', { name: 'Registrar pago' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByRole('button', { name: 'Armar plan de cuotas' })).toBeInTheDocument();
  });

  it('registrar un pago valida el monto y manda registrar_pago', async () => {
    const user = userEvent.setup();
    const p = props(fichaConDeuda);
    render(<TabAcciones {...p} />);
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(screen.getByText('Cargá Monto')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Monto'), '500');
    await user.click(screen.getByRole('button', { name: 'Stripe' }));
    await user.click(screen.getByRole('button', { name: /^Registrar pago$/ }));
    expect(p.onAccion).toHaveBeenCalledWith('registrar_pago', expect.objectContaining({
      monto: 500, medio: 'Stripe', programa_code: 'AL',
    }));
    expect(screen.getByRole('status')).toHaveTextContent('Pago registrado.');
  });

  it('el plan de cuotas arranca del plan existente y avisa cuando no cuadra', async () => {
    const user = userEvent.setup();
    const p = props(fichaConDeuda);
    render(<TabAcciones {...p} />);
    await user.click(screen.getByRole('button', { name: 'Armar plan de cuotas' }));
    expect(screen.getByLabelText('Total del plan')).toHaveValue(1500);
    expect(screen.getByRole('status')).toHaveTextContent('Cuadra con el total');

    await user.clear(screen.getByLabelText('Monto de la cuota 1'));
    await user.type(screen.getByLabelText('Monto de la cuota 1'), '100');
    expect(screen.getByRole('status')).toHaveTextContent('Faltan $400 por asignar');

    await user.click(screen.getByRole('button', { name: 'Repartir en partes iguales' }));
    expect(screen.getByRole('status')).toHaveTextContent('Cuadra con el total');

    await user.click(screen.getByRole('button', { name: /Guardar plan de 3 cuotas/ }));
    expect(p.onAccion).toHaveBeenCalledWith('guardar_plan', expect.objectContaining({ total: 1500, programa_code: 'AL' }));
    expect(p.onAccion.mock.calls[0][1].cuotas).toHaveLength(3);
  });

  it('cambiar la cantidad de cuotas reparte de nuevo el total', async () => {
    const user = userEvent.setup();
    render(<TabAcciones {...props(fichaConDeuda)} />);
    await user.click(screen.getByRole('button', { name: 'Armar plan de cuotas' }));
    await user.click(screen.getByRole('button', { name: '6' }));
    expect(screen.getByLabelText('Monto de la cuota 1')).toHaveValue(250);
    expect(screen.getByRole('status')).toHaveTextContent('Cuadra con el total');
  });

  it('dar de baja exige motivo y fecha cuando se agenda seguimiento', async () => {
    const user = userEvent.setup();
    const p = props(fichaConDeuda);
    render(<TabAcciones {...p} />);
    await user.click(screen.getByRole('button', { name: 'Dar de baja' }));
    expect(screen.getByText('Elegí el motivo de la baja')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'No puede pagar' }));
    expect(screen.getByText('Completá Contactar el')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: /^Dar de baja$/ }));
    expect(p.onAccion).toHaveBeenCalledWith('dar_de_baja', {
      motivo: 'No puede pagar', agenda_seguimiento: false, fecha_seguimiento: null,
    });
  });

  it('sin permiso de cobrar no se pueden abrir las sub-vistas', async () => {
    const user = userEvent.setup();
    const ficha = { ...fichaConDeuda, permisos: { ...fichaConDeuda.permisos, cobrar: false } };
    render(<TabAcciones {...props(ficha)} />);
    expect(screen.getByText(/no registrarlo/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(screen.queryByRole('heading', { name: 'Registrar pago' })).toBeNull();
  });
});
