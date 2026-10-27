// «Resultado» de una llamada de triage: se presentó, calificó económicamente y qué pasa después.
//
// Calificado (+500 USD) → se le agenda la llamada al closer (Jean Carlo por defecto) con una nota que
// el closer ve en su ficha. Descalificado → el low ticket de 100 USD: si se pitcheó y cómo quedó.
// Todo va por `onAccion('reportar_triage')` (app/services/triage_service.py).

import { useEffect, useState } from 'react';
import { Button, Chip, FieldError, Input, Segmented, Select, TextArea } from '../../standard';
import { instanteLegible } from '../piezas/fecha';
import { mensajeDeError } from '../fichaApi';
import api from '../../../services/api';
import { datetimeLocalToUtcIso, toDatetimeLocalValue } from '../../../utils/datetime';

const ASISTENCIA = [
  { value: 'asistio', label: 'Se presentó' },
  { value: 'no_show', label: 'No se presentó' },
  { value: 'cancelo', label: 'Canceló' },
];
const CALIFICACION = [
  { value: 'calificado', label: 'Califica (+500 USD)' },
  { value: 'descalificado', label: 'No califica' },
];
const LOW_TICKET = [
  { value: 'no_pitch', label: 'No se pitcheó' },
  { value: 'cerrado', label: 'Cerró' },
  { value: 'no_cerrado', label: 'No cerró' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'descartado', label: 'Descartado' },
];
const ETIQUETA = Object.fromEntries([...ASISTENCIA, ...CALIFICACION, ...LOW_TICKET].map((o) => [o.value, o.label]));

const manana = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const Campo = ({ etiqueta, htmlFor, children }) => (
  <div style={{ display: 'grid', gap: 6 }}>
    <label className="t-sm" htmlFor={htmlFor}>{etiqueta}</label>
    {children}
  </div>
);

const diaLegible = (iso) => new Date(iso).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'numeric' });
const horaLegible = (iso) => new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

/** Los horarios libres del closer en la semana (app/agendas_v2/a_triage.py), por día. Tocar uno lo elige. */
const HorariosCloser = ({ apptId, closerId, cuando, onElegir }) => {
  const [horarios, setHorarios] = useState(null);
  useEffect(() => {
    if (!apptId || !closerId) return undefined;
    let vivo = true;
    setHorarios(null);
    api.get(`/ficha/${apptId}/triage/horarios`, { params: { closer_id: closerId } })
      .then((r) => vivo && setHorarios(r.data?.horarios || []))
      .catch(() => vivo && setHorarios([]));
    return () => { vivo = false; };
  }, [apptId, closerId]);

  if (horarios === null) return <small className="t-cap mut">Buscando sus horarios libres…</small>;
  if (!horarios.length) return <small className="t-cap mut">No tiene horarios libres en la semana: escribí el día y la hora.</small>;
  const dias = horarios.reduce((acc, iso) => {
    const d = diaLegible(iso);
    (acc[d] = acc[d] || []).push(iso);
    return acc;
  }, {});
  return (
    <div style={{ display: 'grid', gap: 'var(--s2)' }}>
      {Object.entries(dias).map(([dia, lista]) => (
        <div key={dia} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <small className="t-rotulo" style={{ minWidth: 72 }}>{dia}</small>
          {lista.map((iso) => {
            const valor = toDatetimeLocalValue(iso);
            return (
              <Chip key={iso} as="button" type="button" aria-pressed={cuando === valor} subtle={cuando !== valor}
                onClick={() => onElegir(valor)}>
                {horaLegible(iso)}
              </Chip>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** El estado del low ticket y, si queda en seguimiento, cuándo. Se usa al reportar y después. */
const LowTicket = ({ valor, fecha, onValor, onFecha }) => (
  <>
    <Campo etiqueta="Low ticket de 100 USD">
      <Segmented value={valor} onChange={onValor} options={LOW_TICKET} label="Low ticket" radio size="sm" />
    </Campo>
    {valor === 'seguimiento' && (
      <Campo etiqueta="Fecha del seguimiento" htmlFor="triage-seguimiento">
        <Input id="triage-seguimiento" variant="date" type="date" value={fecha}
          onChange={(e) => onFecha(e.target.value)} />
      </Campo>
    )}
  </>
);

const Guardar = ({ guardando, disabled, error, texto }) => (
  <>
    <div><Button variant="primary" type="submit" disabled={guardando || disabled}>{texto}</Button></div>
    {error && <FieldError>{error}</FieldError>}
  </>
);

/** Ya reportada: el resumen y, en un descalificado, cambiar cómo quedó el low ticket. */
const Reportada = ({ triage, onAccion }) => {
  const [valor, setValor] = useState(triage.low_ticket || 'no_pitch');
  const [fecha, setFecha] = useState((triage.fecha_seguimiento || '').slice(0, 10) || manana());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onAccion('reportar_triage', { low_ticket: valor, fecha_seguimiento: fecha });
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="tarjeta" style={{ display: 'grid', gap: 'var(--s3)' }} onSubmit={guardar}
      aria-label="Llamada de triage reportada">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip>{triage.asistencia}</Chip>
        {triage.calificacion && <Chip>{ETIQUETA[triage.calificacion]}</Chip>}
        {triage.low_ticket && <Chip subtle>{`Low ticket: ${ETIQUETA[triage.low_ticket]}`}</Chip>}
      </div>
      {triage.closing && (
        <small className="t-cap mut">
          {`Pasado a ${triage.closing.closer || 'closing'} para el ${instanteLegible(triage.closing.fecha)}.`}
        </small>
      )}
      {triage.nota_para_closer && (
        <small className="t-cap" style={{ whiteSpace: 'pre-wrap' }}>{`Nota para el closer: ${triage.nota_para_closer}`}</small>
      )}
      {triage.calificacion === 'descalificado' && (
        <>
          <LowTicket valor={valor} fecha={fecha} onValor={setValor} onFecha={setFecha} />
          <Guardar guardando={guardando} error={error} texto="Actualizar low ticket"
            disabled={valor === triage.low_ticket && valor !== 'seguimiento'} />
        </>
      )}
    </form>
  );
};

export default function ResultadoTriage({ ficha, onAccion, puedeEditar = true }) {
  const triage = ficha?.triage || {};
  const closers = ficha?.vocabulario?.closers || [];
  const porDefecto = closers.find((c) => /jean/i.test(c.nombre)) || closers[0];

  const [asistencia, setAsistencia] = useState(null);
  const [calificacion, setCalificacion] = useState(null);
  const [closerId, setCloserId] = useState(porDefecto ? String(porDefecto.id) : '');
  const [cuando, setCuando] = useState(`${manana()}T10:00`);
  const [notaCloser, setNotaCloser] = useState('');
  const [lowTicket, setLowTicket] = useState(null);
  const [fechaSeg, setFechaSeg] = useState(manana());
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  if (triage.reportada) return <Reportada triage={triage} onAccion={onAccion} />;

  const califica = asistencia === 'asistio' && calificacion === 'calificado';
  const descalifica = asistencia === 'asistio' && calificacion === 'descalificado';
  const listo = asistencia && (asistencia !== 'asistio' || (califica
    ? closerId && cuando && notaCloser.trim()
    : descalifica && lowTicket && (lowTicket !== 'seguimiento' || fechaSeg)));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onAccion('reportar_triage', {
        asistencia,
        nota: nota.trim(),
        ...(asistencia === 'asistio' ? { calificacion } : {}),
        ...(califica ? { closer_id: Number(closerId), fecha: datetimeLocalToUtcIso(cuando), nota_para_closer: notaCloser.trim() } : {}),
        ...(descalifica ? { low_ticket: lowTicket, fecha_seguimiento: fechaSeg } : {}),
      });
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="tarjeta" style={{ display: 'grid', gap: 'var(--s4)' }} onSubmit={guardar}
      aria-label="Reportar la llamada de triage">
      <Campo etiqueta="¿Se presentó a la llamada?">
        <Segmented value={asistencia} onChange={setAsistencia} options={ASISTENCIA} label="Asistencia" radio size="sm" />
      </Campo>

      {asistencia === 'asistio' && (
        <Campo etiqueta="¿Califica económicamente?">
          <Segmented value={calificacion} onChange={setCalificacion} options={CALIFICACION} label="Calificación" radio size="sm" />
        </Campo>
      )}

      {califica && (
        <>
          <Campo etiqueta="Pasar a">
            <Select value={closerId} onChange={setCloserId} label="Closer"
              options={closers.map((c) => ({ value: String(c.id), label: `${c.nombre} · ${c.pista}` }))} />
          </Campo>
          <Campo etiqueta="Horarios libres del closer">
            <HorariosCloser apptId={ficha?.identidad?.appointment_id} closerId={closerId} cuando={cuando} onElegir={setCuando} />
          </Campo>
          <Campo etiqueta="Día y hora de la llamada con el closer" htmlFor="triage-cuando">
            <Input id="triage-cuando" type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} />
          </Campo>
          <Campo etiqueta="Nota para el closer" htmlFor="triage-nota-closer">
            <TextArea id="triage-nota-closer" value={notaCloser} onChange={(e) => setNotaCloser(e.target.value)}
              placeholder="Lo que el closer tiene que saber antes de la llamada" />
          </Campo>
        </>
      )}

      {descalifica && (
        <LowTicket valor={lowTicket} fecha={fechaSeg} onValor={setLowTicket} onFecha={setFechaSeg} />
      )}

      {asistencia && (
        <Campo etiqueta="Nota (opcional)" htmlFor="triage-nota">
          <TextArea id="triage-nota" value={nota} onChange={(e) => setNota(e.target.value)} />
        </Campo>
      )}

      <Guardar guardando={guardando} error={error} disabled={!puedeEditar || !listo}
        texto={califica ? 'Guardar y agendar con el closer' : 'Guardar'} />
    </form>
  );
}
