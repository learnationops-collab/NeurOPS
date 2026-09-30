// Qué muestra la pestaña Fulfillment y cómo se lee cada número, sin JSX.
//
// Vive aparte de `TabFulfillment.jsx` por el mismo motivo que `datosCliente.js`: las
// explicaciones de los tooltips son contenido, y cambiarlas (o sumar una métrica cuando la
// Academia agregue un dato) no debería obligar a leer el componente.
//
// Las métricas salen de `GET /users/{id}/summary` de la Academia (`performance`), que el backend
// pasa tal cual en `desempeno`. La forma se comprobó contra la API real el 30/09/2026: los doce
// campos de abajo son TODOS los que manda; no trae fechas (ni último ingreso ni última
// actividad) ni avance por módulo. Lo que falta está pedido en
// `docs/integracion_learnation_api.md`, «Pedidos a la Academia».

const numero = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export const porcentaje = (v) => (numero(v) === null ? '—' : `${Math.round(numero(v))}%`);
export const horas = (v) => (numero(v) === null ? '—' : `${Math.round(numero(v) * 10) / 10} h`);
export const cuenta = (v) => (numero(v) === null ? '—' : String(Math.round(numero(v))));

/** Lecciones completadas sobre el total, en %; `null` si la Academia no dice el total. */
export const avanceLecciones = (d) => {
  const hechas = numero(d?.completed_lessons);
  const total = numero(d?.total_lessons);
  if (hechas === null || !total) return null;
  return Math.min(100, Math.round((hechas / total) * 100));
};

/**
 * Las secciones del desempeño, en el orden en que se leen: primero si entra, después cuánto
 * avanzó, después cómo le va en lo que entrega y por último qué acompañamiento usa.
 *
 * Cada métrica trae su `ayuda`: qué mide, en qué unidad y quién la calcula. Es lo que dice el
 * tooltip, y el test de la pestaña comprueba que ninguna quede sin él.
 */
export const SECCIONES = [
  {
    id: 'actividad',
    titulo: 'Actividad',
    ayuda: 'Si el alumno entra y estudia. Todo lo cuenta la Academia desde que tiene cuenta; no trae fechas, así que no dice CUÁNDO fue la última vez.',
    metricas: [
      {
        clave: 'total_study_hours', label: 'Horas de estudio', formato: horas,
        ayuda: 'Horas de estudio acumuladas que registró la Academia desde que tiene cuenta. Es un total: no dice si estudió esta semana o hace un mes.',
      },
      {
        clave: 'pomodoro_sessions', label: 'Pomodoros',
        formato: (v) => (numero(v) === null ? '—' : plural(Math.round(numero(v)), 'sesión', 'sesiones')),
        ayuda: 'Bloques de estudio cronometrados (técnica pomodoro) que completó con el temporizador de la Academia. Cuenta sesiones, no minutos.',
      },
      {
        clave: 'streak_days', label: 'Racha',
        formato: (v) => (numero(v) === null ? '—' : plural(Math.round(numero(v)), 'día', 'días')),
        ayuda: 'Días seguidos con actividad de estudio hasta hoy, según la Academia. En 0 quiere decir que cortó la racha, no que nunca estudió.',
      },
      {
        clave: 'lesson_views', label: 'Vistas de lecciones', formato: cuenta,
        ayuda: 'Cuántas veces abrió una lección. Cuenta repeticiones: ver la misma dos veces suma dos. Sirve para ver si entra aunque todavía no complete.',
      },
    ],
  },
  {
    id: 'avance',
    titulo: 'Avance',
    ayuda: 'Cuánto del programa lleva hecho.',
    metricas: [
      {
        clave: 'completed_lessons', label: 'Lecciones completadas', barra: avanceLecciones,
        formato: (v, d) => (numero(v) === null ? '—'
          : `${Math.round(numero(v))} de ${numero(d?.total_lessons) ?? '—'}`),
        ayuda: 'Lecciones que la Academia da por terminadas, sobre el total de lecciones de su programa. El porcentaje de la barra lo calcula NeurOPS con esos dos números.',
      },
      {
        clave: 'progress_percentage', label: 'Progreso según la Academia', formato: porcentaje,
        barra: (d) => numero(d?.progress_percentage),
        nota: (d) => (numero(d?.progress_percentage) === 0 && numero(d?.completed_lessons) > 0
          ? 'No acompaña a las lecciones hechas: es el cálculo de la Academia.' : null),
        ayuda: 'Porcentaje de avance que calcula la propia Academia sobre su camino de aprendizaje, de 0 a 100. No siempre coincide con las lecciones completadas: si ves 0% con lecciones hechas, el número viene así de la Academia.',
      },
    ],
  },
  {
    id: 'calidad',
    titulo: 'Ejecuciones',
    ayuda: 'Si aplica lo que estudia: los ejercicios prácticos que entrega para corrección.',
    metricas: [
      {
        clave: 'submitted_executions', label: 'Ejecuciones entregadas', formato: cuenta,
        ayuda: 'Ejercicios prácticos («ejecuciones») que el alumno entregó para que se los corrijan en la Academia. Es la mejor señal de que está aplicando y no solo mirando.',
      },
      {
        clave: 'approval_rate', label: 'Tasa de aprobación', formato: porcentaje,
        nota: (d) => (numero(d?.approval_rate) === 0 && numero(d?.submitted_executions) > 0
          ? 'Puede que todavía no estén corregidas.' : null),
        ayuda: 'De las ejecuciones corregidas, qué porcentaje se aprobó. La Academia no informa cuántas están corregidas, así que un 0% con entregas puede querer decir que todavía no le corrigieron ninguna.',
      },
    ],
  },
  {
    id: 'soporte',
    titulo: 'Acompañamiento y soporte',
    ayuda: 'Qué parte del acompañamiento en vivo usa y si tiene algún problema abierto.',
    metricas: [
      {
        clave: 'group_sessions_attended', label: 'Sesiones grupales', formato: cuenta,
        ayuda: 'Clases o salas en vivo grupales a las que asistió, según la Academia.',
      },
      {
        clave: 'individual_sessions_attended', label: 'Sesiones 1 a 1', formato: cuenta,
        ayuda: 'Sesiones individuales en vivo a las que asistió, según la Academia.',
      },
      {
        // Corto: con «de soporte» ocupaba dos líneas y su número quedaba más abajo que los de al
        // lado. La sección ya se llama «Acompañamiento y soporte».
        clave: 'open_support_tickets', label: 'Tickets abiertos', formato: cuenta,
        alerta: (v) => numero(v) > 0,
        ayuda: 'Pedidos de soporte que abrió en la Academia y siguen sin resolver. Si hay alguno, conviene preguntarle antes de hablar de cobro o renovación.',
      },
    ],
  },
];

/** Todas las métricas en una lista, para el test y para quien quiera recorrerlas. */
export const METRICAS = SECCIONES.flatMap((s) => s.metricas);

/** Los datos del acceso pagado. Cada uno con su tooltip, igual que las métricas. */
export const AYUDA_ACCESO = {
  programa: 'El programa que pagó según NeurOPS: el mismo que ves en Acciones → Programa. Sale del prefijo (AL, RR o SI) del tipo de pago de su última venta.',
  producto: 'El producto de la Academia vinculado a ese programa. El vínculo lo configura un admin en Configuración de Ventas → Integraciones.',
  vence: 'Día en que la Academia le corta el acceso a este producto. NeurOPS lo fija al darle el acceso: 7 días para una seña, 4 meses para un pago completo o parcial, o la fecha que ponga el closer.',
  dias: 'Días de acceso que le quedan, contados por la Academia. Con 15 o menos se marca «Por vencer»: es la ventana para renovar, no cuando ya venció.',
  asignado: 'Cuándo se le asignó este producto en la Academia, desde NeurOPS o a mano allá.',
  sena: 'La Academia tiene este acceso marcado como reserva (seña): un acceso de cortesía corto hasta que complete el pago.',
  correo: 'El correo con el que entra a la Academia. Es la única forma de cruzarlo con NeurOPS: la Academia no busca por teléfono.',
  telefono: 'El teléfono que tiene cargado la Academia. No sirve para encontrarlo, pero conviene que coincida con el de acá: es por donde se le escribe.',
  consultado: 'Estos datos se le piden a la Academia en vivo cada vez que abrís esta pestaña (o tocás Actualizar). NeurOPS guarda una copia para poder filtrar y ordenar la tabla Clientes por la actividad en la Academia.',
  gestionar: 'Dar o renovar le asigna en la Academia el producto que pagó, con el vencimiento que elijas; la asignación anterior queda en su historial. Quitar lo hace vencer hoy: la Academia no permite borrar un acceso, y así deja de entrar. Se puede renovar después.',
  dar: 'Todavía no tiene cuenta en la Academia: se le crea con este correo y le llega un mail para activar su contraseña. Es el correo con el que va a entrar, así que tiene que ser el real.',
};

/** 'AAAA-MM-DD' más `n` meses. Un 31 que no existe cae en el último día del mes, como `_add_months`
 *  del backend (así la sugerencia y los atajos cuentan igual). Trabaja sobre el texto: es un día,
 *  no un instante, y pasarlo por el huso de quien mira lo correría. */
export const sumarMeses = (iso, n) => {
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const total = (m - 1) + n;
  const anio = a + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const dos = (x) => String(x).padStart(2, '0');
  return `${anio}-${dos(mes + 1)}-${dos(Math.min(d, ultimo))}`;
};

/** El día desde el que se cuenta una renovación: el vencimiento que tiene si todavía no pasó, o hoy. */
export const baseDeRenovacion = (pagado, hoy) => {
  const vence = String(pagado?.expires_at || '').slice(0, 10);
  return vence > hoy ? vence : hoy;
};

/** Vigente, por vencer o vencido: el semáforo del acceso, con el tono del design system. */
export const estadoAcceso = (p) => {
  if (!p) return null;
  const activo = p.is_active ?? (p.status === 'active');
  if (!activo) return { etiqueta: 'Vencido', tono: 'error' };
  const dias = numero(p.days_remaining);
  if (dias !== null && dias <= 15) return { etiqueta: 'Por vencer', tono: 'warning' };
  return { etiqueta: 'Vigente', tono: 'success' };
};

export const diasRestantes = (p) => {
  const dias = numero(p?.days_remaining);
  if (dias === null) return p?.expires_at ? '—' : 'Sin vencimiento';
  return plural(Math.max(0, Math.round(dias)), 'día', 'días');
};

export const nombreProducto = (p) => p?.product_name || p?.product_slug || 'Producto sin nombre';
