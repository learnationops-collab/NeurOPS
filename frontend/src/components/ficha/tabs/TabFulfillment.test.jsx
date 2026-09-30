import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabFulfillment from './TabFulfillment';
import { AYUDA_ACCESO, METRICAS, SECCIONES } from '../fulfillment';

// La forma es la de `GET /api/ficha/<appt>/fulfillment`, con los productos y el `performance`
// tal como los manda la Academia (comprobado contra la API real el 30/09/2026). Datos inventados.
const BIENVENIDA = {
  assignment_id: 40, product_id: 4, product_name: 'Learnation Course', product_slug: 'learnation-course',
  program_name: 'Learnation Course', status: 'active', is_active: true, is_deposit: false,
  expires_at: null, days_remaining: null, assigned_at: '2026-06-01T10:00:00+00:00',
};
const ACE = {
  assignment_id: 27, product_id: 3, product_name: 'Ace Learners', product_slug: 'ace-learners',
  program_name: 'Bootcamp', status: 'active', is_active: true, is_deposit: false,
  expires_at: '2027-01-14T00:00:00+00:00', days_remaining: 106, assigned_at: '2026-09-14T21:18:38+00:00',
};

const PAYLOAD = {
  vinculado: true,
  alumno: {
    id: 900, nombre: 'Alumna de Prueba', email: 'alumna@ejemplo.com', telefono: '+59170000000',
    rol: 'student', producto_activo: { id: 3, name: 'Ace Learners', slug: 'ace-learners' },
  },
  desempeno: {
    streak_days: 0, total_study_hours: 4, pomodoro_sessions: 2, progress_percentage: 0,
    completed_lessons: 12, total_lessons: 12, lesson_views: 60, submitted_executions: 8,
    approval_rate: 0, group_sessions_attended: 4, individual_sessions_attended: 0,
    open_support_tickets: 1,
  },
  productos: [BIENVENIDA, ACE],
  email_usado: null,
  emails_probados: [],
  telefono_coincide: true,
  error: null,
  programa: { codigo: 'AL', nombre: 'Ace Learners', product_slug: 'ace-learners' },
  producto_pagado: ACE,
  otros_productos: [BIENVENIDA],
  aviso_producto: null,
  consultado_en: '2026-09-30T15:04:00+00:00',
};

// Una ficha con las pestañas de este lead, para saber a cuáles se puede mandar.
const FICHA = {
  identidad: { email: 'alumna@ejemplo.com', telefono: '+59170000000' },
  estado: { pestanas: ['resultado', 'acciones', 'ful', 'hist'] },
  permisos: { cobrar: true, reportar: true },
};

const abrir = async (payload = PAYLOAD, extra = {}) => {
  const onConsultar = vi.fn().mockResolvedValue(payload);
  const irA = vi.fn();
  render(<TabFulfillment ficha={FICHA} onConsultar={onConsultar} onAccion={vi.fn()} irA={irA} {...extra} />);
  await screen.findByText('Datos de la Academia', { exact: false });
  return { onConsultar, irA };
};

/** Los tooltips del `Tip`: un `role="note"` con «Título: explicación» en el `aria-label`. */
const tooltips = () => screen.getAllByRole('note').map((n) => n.getAttribute('aria-label'));

describe('TabFulfillment', () => {
  it('pide los datos a la Academia por su propia consulta', async () => {
    const { onConsultar } = await abrir();

    expect(onConsultar).toHaveBeenCalledWith('fulfillment');
  });

  it('pone el producto pagado como protagonista, con su estado y su vencimiento', async () => {
    await abrir();
    const acceso = screen.getByRole('region', { name: 'Lo que pagó' });

    expect(within(acceso).getByText('Ace Learners', { selector: 'p' })).toBeInTheDocument();
    expect(within(acceso).getByText('Vigente')).toBeInTheDocument();
    expect(within(acceso).getByText('106 días')).toBeInTheDocument();
    // El día del texto, sin pasarlo por el huso: a las 00:00 UTC se mostraba el día anterior.
    expect(within(acceso).getByText('14 ene 2027')).toBeInTheDocument();
    // El de bienvenida no aparece como lo que pagó.
    expect(within(acceso).queryByText('Learnation Course')).not.toBeInTheDocument();
  });

  it('deja los otros accesos aparte, cerrados y rotulados como no pagados', async () => {
    const usuario = userEvent.setup();
    await abrir();
    const cabecera = screen.getByRole('button', { name: /Otros accesos en la Academia/ });

    expect(cabecera).toHaveAttribute('aria-expanded', 'false');
    expect(cabecera).toHaveTextContent('no es lo que pagó');
    expect(screen.queryByText('Learnation Course')).not.toBeInTheDocument();

    await usuario.click(cabecera);

    expect(screen.getByText('Learnation Course')).toBeInTheDocument();
  });

  it('cada métrica y cada sección tienen su tooltip', async () => {
    await abrir();
    const textos = tooltips();

    for (const m of [...METRICAS, ...SECCIONES]) {
      const titulo = m.label || m.titulo;
      expect(textos, titulo).toContain(`${titulo}: ${m.ayuda}`);
    }
    for (const rotulo of ['Vence', 'Días restantes', 'Producto en la Academia', 'Correo', 'Teléfono']) {
      expect(textos.some((t) => t.startsWith(`${rotulo}: `)), rotulo).toBe(true);
    }
  });

  it('muestra los números de la Academia con su unidad', async () => {
    await abrir();

    expect(screen.getByText('4 h')).toBeInTheDocument();
    expect(screen.getByText('2 sesiones')).toBeInTheDocument();
    expect(screen.getByText('12 de 12')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Lecciones completadas' }))
      .toHaveAttribute('aria-valuenow', '100');
    // 0% con entregas no se presenta como que desaprobó todo.
    expect(screen.getByText('Puede que todavía no estén corregidas.')).toBeInTheDocument();
  });

  it('dice de cuándo son los datos', async () => {
    await abrir();

    expect(screen.getByText(/Datos de la Academia al 30 sep 2026/)).toBeInTheDocument();
    expect(tooltips()).toContain(`De cuándo son: ${AYUDA_ACCESO.consultado}`);
  });

  it('actualizar vuelve a pedir los datos', async () => {
    const usuario = userEvent.setup();
    const { onConsultar } = await abrir();

    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(onConsultar).toHaveBeenCalledTimes(2);
  });

  it('avisa cuando la Academia no tiene el producto pagado y ofrece darlo ahí mismo', async () => {
    await abrir({
      ...PAYLOAD, producto_pagado: null, otros_productos: [BIENVENIDA],
      aviso_producto: { codigo: 'sin_producto', motivo: 'La Academia no le tiene asignado Ace Learners.' },
    });

    expect(screen.getByText('La Academia no le tiene asignado Ace Learners.')).toBeInTheDocument();
    // Quien puede cobrar lo da acá: mandarlo a Resultado a registrar un pago era el rodeo.
    expect(screen.getByText('Asignáselo con «Dar acceso», acá abajo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dar acceso' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Ir a Resultado' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Otros accesos en la Academia/ })).toBeInTheDocument();
  });

  it('a quien no puede cobrar, el aviso del producto lo sigue mandando a Resultado', async () => {
    const usuario = userEvent.setup();
    const { irA } = await abrir({
      ...PAYLOAD, producto_pagado: null, otros_productos: [BIENVENIDA],
      aviso_producto: { codigo: 'sin_producto', motivo: 'La Academia no le tiene asignado Ace Learners.' },
    }, { ficha: { ...FICHA, permisos: { cobrar: false, reportar: true } } });

    expect(screen.queryByRole('button', { name: 'Dar acceso' })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Ir a Resultado' }));
    expect(irA).toHaveBeenCalledWith('resultado');
  });

  it('sin programa en NeurOPS lo dice, manda a Acciones y no afirma cuál pagó', async () => {
    const usuario = userEvent.setup();
    const { irA } = await abrir({
      ...PAYLOAD, programa: null, producto_pagado: null, otros_productos: [BIENVENIDA, ACE],
      aviso_producto: { codigo: 'sin_programa', motivo: 'NeurOPS no tiene cargado qué programa pagó.' },
    });

    expect(screen.getByText('Sin programa cargado')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Ir a Acciones' }));
    expect(irA).toHaveBeenCalledWith('acciones');
    expect(screen.getByRole('button', { name: /Accesos en la Academia/ }))
      .toHaveTextContent('no se sabe cuál es el que pagó');
  });

  it('no ofrece ir a una pestaña que este lead no tiene', async () => {
    const onConsultar = vi.fn().mockResolvedValue({
      ...PAYLOAD, producto_pagado: null,
      aviso_producto: { codigo: 'sin_programa', motivo: 'NeurOPS no tiene cargado qué programa pagó.' },
    });
    render(<TabFulfillment ficha={{ ...FICHA, estado: { pestanas: ['ful', 'hist'] } }}
      onConsultar={onConsultar} irA={vi.fn()} />);
    await screen.findByText('NeurOPS no tiene cargado qué programa pagó.');

    expect(screen.queryByRole('button', { name: 'Ir a Acciones' })).not.toBeInTheDocument();
  });

  it('marca la seña y el acceso que está por vencer', async () => {
    await abrir({ ...PAYLOAD, producto_pagado: { ...ACE, is_deposit: true, days_remaining: 5 } });
    const acceso = screen.getByRole('region', { name: 'Lo que pagó' });

    expect(within(acceso).getByText('Por vencer')).toBeInTheDocument();
    expect(within(acceso).getByText('Seña')).toBeInTheDocument();
    expect(tooltips()).toContain(`Seña: ${AYUDA_ACCESO.sena}`);
  });

  it('a quien todavía no es alumno le dice qué programa pagó', async () => {
    await abrir({
      ...PAYLOAD, vinculado: false, alumno: null, desempeno: null, productos: [],
      producto_pagado: null, otros_productos: [], emails_probados: ['alumna@ejemplo.com'],
    });

    expect(screen.getByText('Este cliente todavía no es alumno en la Academia')).toBeInTheDocument();
    expect(screen.getByText(/Pagó Ace Learners/)).toBeInTheDocument();
  });

  it('un error de la Academia se muestra con reintentar', async () => {
    await abrir({
      ...PAYLOAD, vinculado: false, alumno: null,
      error: { codigo: 429, motivo: 'La Academia recibió demasiadas consultas por minuto.' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('demasiadas consultas');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
