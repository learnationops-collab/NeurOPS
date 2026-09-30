import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Las piezas compartidas las escribe el agente del modal: acá se inyectan los dobles mínimos.
vi.mock('../acciones/piezas', () => import('../acciones/piezasStub.jsx'));

import TabResultado from './TabResultado';
import TabAcciones from './TabAcciones';
import { fichaAgendaVencida, fichaConDeuda, fichaEnSeguimiento, fichaEnCobro } from '../resultado.fixtures';

const enDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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

  it('«Anterior» vuelve a la pregunta de antes con lo elegido marcado, también desde la revisión', async () => {
    const user = userEvent.setup();
    render(<TabResultado {...p} />);
    expect(screen.queryByRole('button', { name: /Anterior/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Reagenda' }));
    await user.click(screen.getByRole('button', { name: 'No dio motivo' }));
    await user.click(screen.getByRole('button', { name: /No dejó fecha/ }));
    await user.type(screen.getByLabelText('Ángulo del seguimiento / Notas'), 'le pido fecha nueva');
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    expect(screen.getByRole('heading', { name: /Revisá el resultado/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Anterior/ }));
    expect(screen.getByRole('heading', { name: '¿Cuándo lo vas a seguir?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Ángulo del seguimiento / Notas')).toHaveValue('le pido fecha nueva');

    await user.click(screen.getByRole('button', { name: /Anterior/ }));
    expect(screen.getByRole('heading', { name: '¿Dejó una fecha nueva?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No dejó fecha/ })).toHaveAttribute('aria-pressed', 'true');

    // Contestar lo mismo no obliga a rehacer lo que seguía: el formulario sigue lleno.
    await user.click(screen.getByRole('button', { name: /No dejó fecha/ }));
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    expect(screen.getByRole('heading', { name: /Revisá el resultado/ })).toBeInTheDocument();
  });

  it('«Anterior» desde la primera pregunta vuelve a las cuatro tarjetas', async () => {
    const user = userEvent.setup();
    render(<TabResultado {...p} />);
    await user.click(screen.getByRole('button', { name: 'Asistió' }));
    await user.click(screen.getByRole('button', { name: /Anterior/ }));
    expect(screen.getByRole('heading', { name: '¿Qué pasó con esta llamada?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Registrar una venta/ }));
    expect(screen.getByRole('heading', { name: '¿Quién compró?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Anterior/ }));
    expect(screen.getByRole('heading', { name: '¿Qué pasó con esta llamada?' })).toBeInTheDocument();
  });

  it('«Registrar una venta» entra al wizard de venta sin reportar la llamada', async () => {
    // Era «Registrar venta / pago» del historial del cliente, que abría el wizard en otro modal.
    const user = userEvent.setup();
    render(<TabResultado {...p} />);
    await user.click(screen.getByRole('button', { name: /Registrar una venta/ }));

    expect(screen.getByRole('heading', { name: '¿Quién compró?' })).toBeInTheDocument();
    expect(screen.getByText('Venta · paso 1 de 15')).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')[1]).toHaveTextContent('Venta directa');

    await user.click(screen.getByRole('button', { name: /empezar de nuevo/i }));
    expect(screen.getByRole('heading', { name: '¿Qué pasó con esta llamada?' })).toBeInTheDocument();
  });

  it.each(['no-email-3f2a9c01@neurops.com', 'priscilajacome_172616@neurops.temp'])('un correo inventado por NeurOPS (%s) no se precarga como el del cliente', async (email) => {
    // Llegaba confirmado a la venta y al acceso de la Academia, a una casilla que no existe.
    const user = userEvent.setup();
    const ficha = { ...fichaAgendaVencida, identidad: { ...fichaAgendaVencida.identidad, email } };
    render(<TabResultado {...props(ficha)} />);
    await user.click(screen.getByRole('button', { name: /Registrar una venta/ }));
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    expect(screen.getByRole('heading', { name: '¿Su email?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByRole('button', { name: /^Continuar$/ })).toBeDisabled();
  });

  it('en la cadencia de seguimiento no se ofrece la venta directa: ahí está «Cerró la venta»', () => {
    render(<TabResultado {...props(fichaEnSeguimiento)} />);
    expect(screen.queryByRole('button', { name: /Registrar una venta/ })).toBeNull();
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
    // `onAccion` ya recarga la ficha: la pestaña no la vuelve a pedir.
    expect(p.onRecargar).not.toHaveBeenCalled();
    expect(p.irA).not.toHaveBeenCalled();
  });

  it('después de guardar no queda un botón para registrar lo mismo otra vez', async () => {
    const user = userEvent.setup();
    render(<TabResultado {...p} />);
    await user.click(screen.getByRole('button', { name: 'Reagenda' }));
    await user.click(screen.getByRole('button', { name: 'No dio motivo' }));
    await user.click(screen.getByRole('button', { name: /No dejó fecha/ }));
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    await user.click(screen.getByRole('button', { name: /Guardar el resultado/ }));

    expect(await screen.findByText('Resultado guardado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Guardar el resultado/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Empezar de nuevo/ })).toBeNull();
  });

  it('una venta con deuda recorre el wizard entero dentro de la pestaña y lleva a Acciones', async () => {
    const user = userEvent.setup();
    const onConsultar = vi.fn().mockResolvedValue({
      program_price: 1500, total_paid: 0, balance_remaining: 1500, sales_count: 0,
      allowed_types: { cuota: { ok: false, reason: 'No tiene un Parcial previo' } },
    });
    render(<TabResultado {...p} onConsultar={onConsultar} />);
    await user.click(screen.getByRole('button', { name: 'Asistió' }));
    await user.click(screen.getByRole('button', { name: /Sí, con decisor/ }));
    await user.click(screen.getByRole('button', { name: /Sí, se presentó/ }));
    await user.click(screen.getByRole('button', { name: /Sí, cerró/ }));

    // Cada dato del comprador en su pantalla: el de la agenda viene precargado y se confirma.
    expect(screen.getByRole('heading', { name: '¿Quién compró?' })).toBeInTheDocument();
    expect(screen.getByText('Venta · paso 1 de 15')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre y apellido')).toHaveValue('Kevin Álvarez');
    expect(screen.getByText('✓ Traído de la agenda')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Continuar/ }));
    expect(screen.getByLabelText('Instagram')).toHaveValue('kevinalvarez');
    await user.click(screen.getByRole('button', { name: /^Continuar/ }));
    // Enter confirma el paso, como «Siguiente» en el wizard.
    expect(screen.getByLabelText('Email')).toHaveValue('kevin@mail.com');
    await user.type(screen.getByLabelText('Email'), '{Enter}');
    expect(screen.getByRole('heading', { name: '¿Su teléfono?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Continuar/ }));
    expect(screen.getByRole('heading', { name: '¿Su documento de identidad?' })).toBeInTheDocument();
    expect(screen.getByText('● Este lo cargás vos')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Documento de identidad'), '30111222');
    await user.click(screen.getByRole('button', { name: /^Continuar/ }));

    await user.click(screen.getByRole('button', { name: /Residency Roadmap/ }));
    expect(onConsultar).toHaveBeenCalledWith('estado_venta', { params: { programa: 'RR' } });
    // El historial del cliente avisa sobre el tipo que no sigue la secuencia, sin esconderlo.
    expect(await screen.findByText('No tiene un Parcial previo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Parcial \(primer pago\)/ }));

    // El precio del programa se propone solo y el saldo se ve mientras se tipea.
    expect(screen.getByLabelText('Precio total')).toHaveValue(1500);
    await user.type(screen.getByLabelText('Cobrado hoy'), '500');
    expect(screen.getByText('$1,000')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Continuar/ }));
    await user.click(screen.getByRole('button', { name: 'Stripe' }));

    expect(screen.getByRole('heading', { name: 'Te deben $1,000. ¿En cuántas cuotas?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '2 cuotas' }));
    await user.click(screen.getByRole('button', { name: /^Continuar/ }));
    await user.click(screen.getByRole('button', { name: /Sí, todos los meses el mismo día/ }));
    await user.click(screen.getByRole('button', { name: '15' }));
    expect(screen.getByRole('status')).toHaveTextContent('Cuadra con el total');
    await user.click(screen.getByRole('button', { name: /^Continuar/ }));

    await user.click(screen.getByRole('button', { name: /^Continuar/ })); // examen, precargado
    await user.click(screen.getByRole('button', { name: /^Continuar/ })); // fecha, hoy
    await user.click(screen.getByRole('button', { name: /^Completada/ }));
    await user.click(screen.getByRole('button', { name: /^Continuar/ })); // notas
    await user.click(screen.getByRole('button', { name: /Sí le pedí, no me dio/ }));
    expect(screen.getByRole('heading', { name: '¿Le das acceso a la Academia?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Sí, darle acceso/ }));

    expect(screen.getByRole('heading', { name: /Revisá la venta/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Avisar por la automatización/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: /Registrar la venta/ }));

    const [accion, datos] = p.onAccion.mock.calls[0];
    expect(accion).toBe('registrar_venta');
    expect(datos.venta).toMatchObject({
      tipo_pago: 'RR - parcial', monto: 500, precio_total: 1500, metodo_pago: 'Stripe',
      documento_identidad: '30111222', mail_cliente: 'kevin@mail.com', instagram: 'kevinalvarez',
    });
    expect(datos.plan_cuotas).toMatchObject({ total: 1500, cobrado_hoy: 500, num_cuotas: 2, montos: [500, 500] });
    expect(datos.plan_cuotas.fechas.every((f) => f.endsWith('-15'))).toBe(true);
    expect(datos.acceso_academia).toEqual({ programa_code: 'RR', tipo_venta: 'parcial', email: 'kevin@mail.com' });
    expect(p.irA).toHaveBeenCalledWith('acciones');
    // Recorre el wizard de venta ENTERO: una treintena de clics y dos campos tipeados letra por
    // letra. Con la suite completa en paralelo (y más con pytest corriendo al lado) pasaba los
    // 5 s por defecto y fallaba sin que nada estuviera roto. El tope es de este test, no global,
    // para que un test corto que se cuelgue siga saltando rápido.
  }, 30000);

  it('un aviso posterior a la venta queda a la vista y no salta de pestaña', async () => {
    const user = userEvent.setup();
    const conAvisos = props(fichaAgendaVencida, {
      onAccion: vi.fn().mockResolvedValue({ status: 'success', avisos: ['La venta se guardó, pero el plan de cuotas no: ya tiene cuotas pagadas'] }),
    });
    render(<TabResultado {...conAvisos} />);
    await user.click(screen.getByRole('button', { name: 'Asistió' }));
    await user.click(screen.getByRole('button', { name: /Sí, con decisor/ }));
    await user.click(screen.getByRole('button', { name: /Sí, se presentó/ }));
    await user.click(screen.getByRole('button', { name: /Sí, cerró/ }));
    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getByRole('button', { name: /^Continuar/ }));
    }
    await user.click(screen.getByRole('button', { name: /Ace Learner/ }));
    await user.click(screen.getByRole('button', { name: /Seña/ }));
    await user.type(screen.getByLabelText('Precio total'), '1000');
    await user.type(screen.getByLabelText('Cobrado hoy'), '100');
    await user.click(screen.getByRole('button', { name: /^Continuar/ }));
    await user.click(screen.getByRole('button', { name: 'PayPal' }));
    await user.click(screen.getByRole('button', { name: /^Continuar/ })); // 1 cuota
    await user.click(screen.getByRole('button', { name: /No, fechas distintas/ }));
    await user.click(screen.getByRole('button', { name: /^Continuar/ })); // fechas
    await user.click(screen.getByRole('button', { name: /^Continuar/ })); // examen
    await user.click(screen.getByRole('button', { name: /^Continuar/ })); // fecha
    await user.click(screen.getByRole('button', { name: /^Pendiente/ }));
    await user.click(screen.getByRole('button', { name: /^Continuar/ })); // notas
    await user.click(screen.getByRole('button', { name: /No le pedí/ }));
    await user.click(screen.getByRole('button', { name: /No por ahora/ }));
    await user.click(screen.getByRole('button', { name: /Registrar la venta/ }));

    expect(await screen.findByText(/el plan de cuotas no/)).toBeInTheDocument();
    expect(screen.getByText('Queda un saldo de $900')).toBeInTheDocument();
    expect(conAvisos.irA).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Ir a Acciones/ }));
    expect(conAvisos.irA).toHaveBeenCalledWith('acciones');
  }, 30000);

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
    expect(await screen.findByText('El cliente ya tenía una seña sin plan')).toBeInTheDocument();
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

describe('TabResultado · seguimiento de cobro', () => {
  // El `segventa` del mazo de main: el cliente ya compró y el seguimiento es para cobrarle.
  it('abre en «¿Qué pasó con el cobro?» con el programa, la deuda y el plan de cuotas', () => {
    render(<TabResultado {...props(fichaEnCobro)} />);
    expect(screen.getByRole('heading', { name: '¿Qué pasó con el cobro?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asistió' })).toBeNull();
    expect(screen.getByText('Ace Learner')).toBeInTheDocument();
    expect(screen.getByText('$1,500')).toBeInTheDocument();
    const plan = screen.getByRole('list', { name: 'Plan de cuotas' });
    expect(within(plan).getAllByRole('listitem')).toHaveLength(3);
    expect(within(plan).getAllByRole('button', { name: 'Pagó esta' })).toHaveLength(3);
  });

  it('«No respondió» propone el próximo intento a 3 días y lo guarda como seguimiento de cobro', async () => {
    const user = userEvent.setup();
    const p = props(fichaEnCobro);
    render(<TabResultado {...p} />);
    await user.click(screen.getByRole('button', { name: /No respondió/ }));
    expect(screen.getByRole('heading', { name: '¿Qué sucedió exactamente?' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Qué sucedió exactamente'), 'Le recordé la cuota, no contestó');
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    expect(screen.getByRole('heading', { name: '¿Cuándo es el siguiente seguimiento de cobro?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    await user.click(screen.getByRole('button', { name: /Guardar el resultado/ }));

    const [accion, datos] = p.onAccion.mock.calls[0];
    expect(accion).toBe('reportar_resultado');
    expect(datos.contacto_result).toBe('no_resp');
    expect(datos.deck).toMatchObject({
      seguimiento_tipo: 'cerrada', seguimiento_intento: 2, fecha_seguimiento_cobro: enDias(3),
      followup_reminder_enabled: true, followup_reminder_time: '09:00',
    });
    expect(await screen.findByText('Seguimiento guardado')).toBeInTheDocument();
  });

  it('«No va a pagar» avisa antes que da de baja, y al guardar dice que quedó de baja', async () => {
    // Pedido del 30/09/2026: el backend lo da de baja (deuda en 0, fuera de las listas de cobro).
    const user = userEvent.setup();
    const p = props(fichaEnCobro);
    render(<TabResultado {...p} />);
    expect(screen.getByRole('button', { name: /No va a pagar/ })).toHaveTextContent('Se da de baja: deja de deber');
    await user.click(screen.getByRole('button', { name: /No va a pagar/ }));
    await user.type(screen.getByLabelText('Qué sucedió exactamente'), 'No sigue y no paga el resto');
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    await user.click(screen.getByRole('button', { name: /Guardar el resultado/ }));

    expect(p.onAccion.mock.calls[0][1].contacto_result).toBe('no_paga');
    expect(await screen.findByText('Cliente dado de baja')).toBeInTheDocument();
    expect(screen.getByText(/Si vuelve, la baja se revierte desde Acciones/)).toBeInTheDocument();
  });

  it('«Pagó esta» en una cuota sigue a la venta con esa cuota ya elegida', async () => {
    const user = userEvent.setup();
    render(<TabResultado {...props(fichaEnCobro)} />);
    await user.click(within(screen.getByRole('list', { name: 'Plan de cuotas' })).getAllByRole('button', { name: 'Pagó esta' })[1]);
    await user.type(screen.getByLabelText('Qué sucedió exactamente'), 'Me pasó el comprobante de la cuota 2');
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }));
    expect(screen.getByRole('heading', { name: '¿Quién compró?' })).toBeInTheDocument();
  });

  it('el mazo pide el cobro aunque la agenda no tenga el seguimiento vivo', () => {
    render(<TabResultado {...props(fichaConDeuda)} seguimientoPedido="cobro" />);
    expect(screen.getByRole('heading', { name: '¿Qué pasó con el cobro?' })).toBeInTheDocument();
  });

  it('abierto desde un seguimiento sin cobrar, entra por la cadencia y no por las tarjetas', () => {
    render(<TabResultado {...props(fichaAgendaVencida)} seguimientoPedido="contacto" />);
    expect(screen.getByRole('heading', { name: '¿Qué pasó con este contacto?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asistió' })).toBeNull();
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

  it('registrar un pago valida el monto y lo manda en el idioma de la ruta de venta', async () => {
    // Las claves NO son las del formulario (monto/fecha/medio) sino las de
    // `POST /ficha/<id>/venta`, que pasa por `SheetsService.post_to_sheets`: `tipo_pago`,
    // `monto`, `metodo_pago` y `marca_temporal`. Este test pedía las del formulario, que es
    // justamente el contrato que no existía — sin `tipo_pago` la ruta respondía
    // «Falta tipo_pago (ej. "RR - Parcial")» y el cobro no se registraba nunca.
    const user = userEvent.setup();
    const p = props(fichaConDeuda);
    render(<TabAcciones {...p} />);
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(screen.getByText('Cargá Monto')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Monto'), '500');
    await user.click(screen.getByRole('button', { name: 'Stripe' }));
    await user.click(screen.getByRole('button', { name: /^Registrar pago$/ }));
    expect(p.onAccion).toHaveBeenCalledWith('registrar_pago', {
      tipo_pago: 'AL - Cuota',
      monto: 500,
      metodo_pago: 'Stripe',
      // La fecha arranca en hoy: se comprueba la forma, no el día, o el test caduca mañana.
      marca_temporal: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    // El aviso de «Pago registrado.» lo pone el cascarón (`MENSAJES` en `FichaLeadModal`), no
    // esta pestaña: cuando lo ponían los dos salían dos avisos idénticos apilados. Lo que sí le
    // toca a la pestaña es volver al menú de las cuatro acciones.
    expect(await screen.findByRole('button', { name: 'Armar plan de cuotas' })).toBeInTheDocument();
  });

  it('sin programa no se ofrece el formulario de pago, y se dice por qué', async () => {
    // Un cobro se declara como «programa – Cuota»: sin el prefijo no hay `tipo_pago` que mandar.
    // Se avisa acá en vez de dejar que la ruta lo rechace después de cargar todo.
    const user = userEvent.setup();
    const sinPrograma = {
      ...fichaConDeuda,
      cobro: { ...fichaConDeuda.cobro, programa_code: null, programa_nombre: null },
    };
    render(<TabAcciones {...props(sinPrograma)} />);
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(screen.getByText(/no tiene programa asignado/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Monto')).toBeNull();
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
