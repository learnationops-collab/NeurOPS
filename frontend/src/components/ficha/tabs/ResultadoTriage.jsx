// «Resultado» de una llamada de triage, con la forma del reporte del closer (`TabResultado`): el
// progreso a la izquierda, las cuatro tarjetas de «¿Qué pasó con esta llamada?», una pregunta por
// pantalla y la revisión con «Editar» antes de guardar.
//
// Calificado (+500 USD) → el closer, su horario y la nota que ve en su ficha. Descalificado → el
// low ticket de 100 USD: cómo quedó y, si cerró, la venta. Debajo de las tarjetas, «Registrar el
// low ticket» (la venta sin reporte) y «Pasar a seguimiento» (la llamada sin resultado, como el
// closer). El recorrido vive en `triage/recorrido.js`; todo se guarda por `onAccion`.

import { useCallback, useMemo, useState } from 'react';
import { CalendarClock, CalendarX, CheckCircle2, DollarSign, XCircle } from 'lucide-react';
import { StepperFicha, TarjetaAccion } from '../acciones/piezas';
import PasarARecuperacion from './PasarARecuperacion';
import { mensajeDeError } from '../fichaApi';
import { instanteLegible } from '../piezas/fecha';
import { Button } from '../../standard';
import { localDateFromNow } from '../../../utils/datetime';
import {
  CALIFICACION, LOW_TICKET, RAICES, actual, califica, filas, hastaAntesDe, hitos, inicial, payload,
  secuencia, textoGuardar, vende,
} from '../triage/recorrido';
import {
  Fecha, Horario, Nota, Opciones, Revision, Titulo, Venta,
} from '../triage/PantallasTriage';
import './resultado.css';

const ICONOS = { asistio: CheckCircle2, no_asistio: XCircle, cancelo: CalendarX, reagenda: CalendarClock };
const ATAJOS_SEGUIMIENTO = [
  { dias: 1, label: 'Mañana' }, { dias: 3, label: 'En 3 días' }, { dias: 7, label: 'En una semana' },
];
// Con `tz`, la hora en esa zona y su nombre (la llamada con el closer, en la hora del lead).
const legible = (v, tz) => (v ? new Date(v).toLocaleString('es', {
  weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
  ...(tz ? { timeZone: tz, timeZoneName: 'short' } : {}),
}) : '');
const etiqueta = (lista, valor) => lista.find((o) => o.valor === valor)?.label;

/** Lo que ya quedó reportado, en filas como la revisión. */
const filasReportadas = (t) => [
  { label: 'Asistencia', valor: t.asistencia },
  t.calificacion && { label: 'Calificación', valor: etiqueta(CALIFICACION, t.calificacion) },
  t.closing && { label: 'Pasa a', valor: `${t.closing.closer || 'closing'} · ${instanteLegible(t.closing.fecha)}` },
  t.nota_para_closer && { label: 'Nota para el closer', valor: t.nota_para_closer },
  t.low_ticket && { label: 'Low ticket', valor: etiqueta(LOW_TICKET, t.low_ticket) },
  t.low_ticket === 'seguimiento' && t.fecha_seguimiento && { label: 'Seguimiento', valor: String(t.fecha_seguimiento).slice(0, 10) },
].filter(Boolean);

export default function ResultadoTriage({ ficha, onAccion, puedeEditar = true }) {
  const triage = ficha?.triage || {};
  const vocab = ficha?.vocabulario || {};
  const closers = vocab.closers || [];
  const porDefecto = closers.find((c) => /jean/i.test(c.nombre)) || closers[0];
  const contexto = {
    closers, medios: vocab.medios_pago_venta || [], personas: vocab.transferido_a || [], legible,
  };

  const [r, setR] = useState(() => ({ ...inicial(), closerId: porDefecto ? String(porDefecto.id) : '' }));
  const [hechos, setHechos] = useState([]);
  const [guardado, setGuardado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const paso = actual(r, hechos);
  const closer = useMemo(() => closers.find((c) => String(c.id) === String(r.closerId)), [closers, r.closerId]);
  const reportada = triage.reportada && r.modo === 'llamada' && !guardado;

  const empezar = (modo) => { setR({ ...inicial(modo), closerId: r.closerId }); setHechos([]); setError(null); };
  const cambiar = useCallback((cambios) => setR((prev) => ({ ...prev, ...cambios })), []);
  const elegir = (p, cambios) => {
    const nuevo = { ...r, ...cambios };
    setR(nuevo);
    setHechos([...hastaAntesDe(nuevo, hechos, p), p]);
  };
  const continuar = () => setHechos((h) => [...h, paso]);
  const anterior = () => {
    const s = secuencia(r);
    const i = s.indexOf(paso);
    if (i <= 0) return empezar('llamada');
    return setHechos(hastaAntesDe(r, hechos, s[i - 1]));
  };
  const nav = { onAnterior: anterior, onReiniciar: () => empezar(r.modo) };
  const navCampos = { ...nav, onContinuar: continuar };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await onAccion('reportar_triage', payload(r));
      setGuardado({ filas: filas(r, contexto), titulo: r.res === 'reagenda' ? 'Sesión reagendada'
        : vende(r) ? 'Venta del low ticket registrada' : 'Llamada reportada' });
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const pantalla = () => {
    switch (paso) {
      case 'raices': return (
        <section aria-label="¿Qué pasó con esta llamada?">
          <Titulo texto="¿Qué pasó con esta llamada?" />
          <div className="ln-grid ln-grid-4 fi-raices" style={{ marginTop: 'var(--space-4)' }}>
            {RAICES.map((o) => (
              <TarjetaAccion key={o.valor} color={o.color} icono={ICONOS[o.valor]} label={o.label}
                deshabilitado={!puedeEditar} onClick={() => elegir('raices', { res: o.valor })} />
            ))}
          </div>
          {puedeEditar && (
            <PasarARecuperacion llamadaIso={ficha?.identidad?.llamada?.iso} onAccion={onAccion}
              antes={(
                <button type="button" className="fi-otra" onClick={() => empezar('venta')}>
                  <DollarSign aria-hidden="true" /> Registrar el low ticket
                </button>
              )} />
          )}
        </section>
      );
      case 'cal': return <Opciones texto="¿Califica económicamente?" ayuda="Puede invertir 500 USD o más en el programa."
        opciones={CALIFICACION} elegida={r.cal} onElegir={(v) => elegir('cal', { cal: v })} nav={nav} />;
      case 'closer': return <Opciones texto="¿A qué closer se lo pasás?" ayuda="Se le agenda una Sesión de Aceleración."
        opciones={closers.map((c) => ({ valor: String(c.id), label: c.nombre, sub: c.pista }))}
        elegida={r.closerId} onElegir={(v) => elegir('closer', { closerId: v, cuando: null })} nav={nav} />;
      case 'horario': return <Horario apptId={ficha?.identidad?.appointment_id} closer={closer} r={r}
        onElegir={(v) => elegir('horario', { cuando: v })} onCambiar={cambiar} nav={navCampos} />;
      case 'nota_closer': return <Nota paso={paso} r={r} campo="notaCloser" onCambiar={cambiar} nav={navCampos}
        texto={`¿Qué tiene que saber ${closer?.nombre || 'el closer'}?`}
        ayuda="Le aparece arriba de la ficha cuando abra la llamada."
        placeholder="Cuánto puede invertir, quién decide, qué busca…" />;
      case 'lt': return <Opciones texto="¿Cómo quedó el low ticket?" ayuda="El programa LT: 100 USD, un mes de acceso a la Academia."
        opciones={LOW_TICKET} elegida={r.lt} onElegir={(v) => elegir('lt', { lt: v })} nav={nav} />;
      case 'venta': return <Venta r={r} medios={contexto.medios} personas={contexto.personas}
        onCambiar={cambiar} nav={navCampos} />;
      case 'fecha_seg': return <Fecha paso={paso} r={r} campo="fechaSeg" onCambiar={cambiar} nav={navCampos}
        texto="¿Cuándo lo volvés a hablar?" ayuda="Te aparece en «Seguir» ese día."
        atajos={ATAJOS_SEGUIMIENTO.map((a) => ({ valor: localDateFromNow(a.dias), label: a.label }))} />;
      case 'por_que': return <Nota paso={paso} r={r} campo="nota" onCambiar={cambiar} nav={navCampos}
        texto="¿Por qué no califica?" ayuda="Qué dijo del dinero, qué le ofreciste y cómo quedó." />;
      case 'reagenda': return <Fecha paso={paso} r={r} campo="nueva" conHora onCambiar={cambiar} nav={navCampos}
        texto="¿Para cuándo la pasa?" ayuda="La Sesión diagnóstica se mueve a la nueva fecha y vuelve a Confirmar." />;
      case 'nota': return <Nota paso={paso} r={r} campo="nota" minimo={false} onCambiar={cambiar} nav={navCampos}
        texto={r.res === 'no_asistio' ? '¿Qué pasó?' : r.res === 'cancelo' ? '¿Qué dijo al cancelar?' : '¿Algo para dejar anotado?'}
        ayuda="Opcional." />;
      default: return (
        <Revision texto={vende(r) ? 'Revisá la venta antes de registrarla' : 'Revisá el resultado antes de guardarlo'}
          filas={filas(r, contexto)} error={error} guardando={guardando} textoGuardar={textoGuardar(r)}
          aviso={califica(r) ? `Al guardar se crea la agenda con ${closer?.nombre || 'el closer'} y tu nota le aparece arriba de su ficha.`
            : vende(r) ? 'Se registra como «LT - completo» en las ventas del mes y se le da un mes de acceso a la Academia.' : null}
          onEditar={(p) => setHechos(hastaAntesDe(r, hechos, p))} onGuardar={puedeEditar ? guardar : null} nav={nav} />
      );
    }
  };

  const listo = guardado || reportada;
  const pasos = reportada ? hitos({ modo: 'llamada', res: 'asistio' }, [], true) : hitos(r, hechos, !!guardado);
  return (
    <div className="fi-res">
      <aside className="fi-res-hitos" aria-label="Progreso del reporte">
        <small className="fi-res-hitos-tit">Progreso</small>
        <StepperFicha pasos={pasos} onPaso={null} vertical />
      </aside>
      <div className="fi-res-main">
        {listo ? (
          <section aria-label="Guardado" style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <Revision texto={guardado ? guardado.titulo : 'Llamada reportada'} filas={guardado ? guardado.filas : filasReportadas(triage)} />
            {/* El seguimiento del low ticket que después cerró o se perdió. */}
            {puedeEditar && triage.calificacion === 'descalificado' && triage.low_ticket !== 'cerrado' && (
              <div><Button onClick={() => { setGuardado(null); empezar('actualizar'); }}>Actualizar el low ticket</Button></div>
            )}
          </section>
        ) : pantalla()}
      </div>
    </div>
  );
}
