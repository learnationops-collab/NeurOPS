// Las pantallas del reporte de triage: una pregunta por pantalla, con las piezas y las clases del
// reporte del closer (`TabResultado`, resultado.css): opciones grandes con humo, «Falta» en una
// línea, la barrita del mínimo de un texto y la revisión con «Editar» en cada fila.

import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Clock, CreditCard, DollarSign, EyeOff, Landmark, Pencil,
  RotateCcw, ThumbsDown, ThumbsUp, Trash2,
} from 'lucide-react';
import { Button, Chip, Input, Select, TextArea } from '../../standard';
import api from '../../../services/api';
import { browserTimezone } from '../../../utils/datetime';
import { zonedToUtc } from '../../../pages/agendas_v2/core/tiempo';
import { MINIMO_NOTA, faltan as faltanDe } from './recorrido';

const ICONOS = {
  calificado: ThumbsUp, descalificado: ThumbsDown,
  cerrado: DollarSign, no_cerrado: ThumbsDown, seguimiento: Clock, descartado: Trash2, no_pitch: EyeOff,
};

export const Titulo = ({ texto, ayuda }) => (
  <>
    <h3 className="ln-t-h3">{texto}</h3>
    {ayuda && <p className="ln-t-body-sm ln-muted">{ayuda}</p>}
  </>
);

/** Una opción grande, como `OpcionGrande` del reporte del closer. */
const Opcion = ({ label, sub, Icono, activa, onClick }) => (
  <button type="button" className="fi-op" aria-pressed={activa} onClick={onClick}>
    <span className="fi-humo" aria-hidden="true"><i /><i /><i /></span>
    {Icono && <span className="fi-op-ico"><Icono aria-hidden="true" /></span>}
    <b className="ln-t-body">{label}</b>
    {sub && <small className="ln-t-caption ln-muted">{sub}</small>}
  </button>
);

/** «Anterior», «Empezar de nuevo» y, en una pantalla de campos, «Continuar». */
export const Botonera = ({ onAnterior, onReiniciar, onContinuar = null, puede = true, children = null }) => (
  <div className="fi-botonera" style={{ marginTop: 'var(--space-6)' }}>
    <span className="fi-atras">
      {onAnterior && <Button icon={<ArrowLeft />} onClick={onAnterior}>Anterior</Button>}
      {onReiniciar && <Button icon={<RotateCcw />} onClick={onReiniciar}>Empezar de nuevo</Button>}
    </span>
    {children}
    {onContinuar && (
      <Button variant="primary" disabled={!puede} onClick={onContinuar}>
        Continuar <ArrowRight aria-hidden="true" />
      </Button>
    )}
  </div>
);

/** Lo que falta para seguir, en una línea: un punto que late y cada faltante como chip. */
const Falta = ({ lista }) => (lista.length ? (
  <div className="fi-faltan" role="status">
    <i aria-hidden="true" /><span>Falta</span>
    {lista.map((f) => <b key={f}>{f}</b>)}
  </div>
) : null);

const Minimo = ({ texto }) => {
  const n = (texto || '').trim().length;
  const listo = n >= MINIMO_NOTA;
  return (
    <div className={`fi-minimo${listo ? ' fi-minimo--listo' : ''}`}>
      <span className="fi-minimo-riel"><i style={{ width: `${Math.min(100, (n / MINIMO_NOTA) * 100)}%` }} /></span>
      <small>{listo ? 'Listo' : `${n}/${MINIMO_NOTA}`}</small>
    </div>
  );
};

/** Pantalla de opciones: tocar una la elige y pasa a la siguiente. */
export const Opciones = ({ texto, ayuda, opciones, elegida, onElegir, nav }) => (
  <>
    <Titulo texto={texto} ayuda={ayuda} />
    <div role="group" style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-4)',
      gridTemplateColumns: `repeat(auto-fit, minmax(${opciones.length > 2 ? 180 : 220}px, 1fr))` }}>
      {opciones.map((o) => (
        <Opcion key={o.valor} label={o.label} sub={o.sub} Icono={o.Icono || ICONOS[o.valor]}
          activa={elegida === o.valor} onClick={() => onElegir(o.valor)} />
      ))}
    </div>
    <Botonera {...nav} />
  </>
);

/** Pantalla de campos: los campos, «Falta» y «Continuar». */
const Campos = ({ paso, r, texto, ayuda, nav, children }) => {
  const lista = faltanDe(paso, r);
  return (
    <>
      <Titulo texto={texto} ayuda={ayuda} />
      <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>{children}</div>
      <Falta lista={lista} />
      <Botonera {...nav} puede={!lista.length} />
    </>
  );
};

export const Nota = ({ paso, r, campo, texto, ayuda, placeholder, minimo = true, onCambiar, nav }) => (
  <Campos paso={paso} r={r} texto={texto} ayuda={ayuda} nav={nav}>
    <TextArea autoFocus value={r[campo] || ''} placeholder={placeholder}
      onChange={(e) => onCambiar({ [campo]: e.target.value })} />
    {minimo && <Minimo texto={r[campo]} />}
  </Campos>
);

export const Fecha = ({ paso, r, campo, texto, ayuda, conHora = false, atajos = [], onCambiar, nav }) => (
  <Campos paso={paso} r={r} texto={texto} ayuda={ayuda} nav={nav}>
    {atajos.length > 0 && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {atajos.map((a) => (
          <Chip key={a.valor} as="button" type="button" aria-pressed={r[campo] === a.valor}
            subtle={r[campo] !== a.valor} onClick={() => onCambiar({ [campo]: a.valor })}>{a.label}</Chip>
        ))}
      </div>
    )}
    <Input variant="date" type={conHora ? 'datetime-local' : 'date'} value={r[campo] || ''}
      style={{ maxWidth: 260 }} onChange={(e) => onCambiar({ [campo]: e.target.value })} />
  </Campos>
);

export const Monto = ({ r, onCambiar, nav }) => (
  <Campos paso="monto" r={r} texto="¿Cuánto pagó?" ayuda="En dólares. El low ticket es de 100 USD." nav={nav}>
    <Input autoFocus variant="number" type="number" min="1" step="any" value={r.monto}
      style={{ maxWidth: 200 }} onChange={(e) => onCambiar({ monto: e.target.value })} />
  </Campos>
);

export const medioIcono = (clave) => (/transferencia/i.test(clave) ? Landmark : CreditCard);

const enZona = (iso, tz, o) => new Date(iso).toLocaleString('es', { timeZone: tz, ...o });
const DIA = { weekday: 'short', day: 'numeric', month: 'numeric' };
const HORA = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };

/** «AAAA-MM-DDTHH:MM» en la zona `tz` → ISO UTC. */
const localAIso = (valor, tz) => {
  const [f, h] = (valor || '').split('T');
  if (!f || !h) return null;
  const [y, m, d] = f.split('-').map(Number);
  const [hh, mi] = h.split(':').map(Number);
  return new Date(zonedToUtc(y, m - 1, d, hh, mi, tz)).toISOString();
};

/** Los horarios libres del closer en la semana (app/agendas_v2/a_triage.py), en la hora del lead
 *  (la zona de su WhatsApp, `zona_del_lead`), que se puede cambiar. Tocar uno lo elige. */
export const Horario = ({ apptId, closer, r, onElegir, onCambiar, nav }) => {
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    if (!apptId || !closer) return undefined;
    let vivo = true;
    setDatos(null);
    api.get(`/ficha/${apptId}/triage/horarios`, { params: { closer_id: closer.id } })
      .then((res) => vivo && setDatos(res.data || {}))
      .catch(() => vivo && setDatos({}));
    return () => { vivo = false; };
  }, [apptId, closer]);
  const tzLead = datos?.zona_lead?.tz;
  useEffect(() => { if (tzLead && !r.tz) onCambiar({ tz: tzLead }); }, [tzLead, r.tz, onCambiar]);

  const texto = `¿Cuándo con ${closer?.nombre || 'el closer'}?`;
  if (datos === null) return <><Titulo texto={texto} /><small className="t-cap mut">Buscando sus horarios libres…</small></>;
  const tz = r.tz || tzLead || browserTimezone();
  const zonas = datos.zonas || [];
  const selector = zonas.length > 0 && (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-3)' }}>
      <small className="t-cap mut">{`En la hora de ${tz === tzLead ? `${datos.zona_lead.pais} (la del lead)` : 'la zona elegida'}`}</small>
      <Select size="sm" label="Zona horaria" value={tz} onChange={(v) => onCambiar({ tz: v, cuando: null })}
        options={[...(zonas.some((z) => z.tz === tz) ? [] : [{ value: tz, label: tz }]),
          ...zonas.map((z) => ({ value: z.tz, label: `${z.nombre}${z.tz === tzLead ? ' · del lead' : ''}` }))]} />
    </div>
  );
  const horarios = datos.horarios || [];
  if (!horarios.length) {
    return (
      <>
        {selector}
        <Fecha paso="horario" r={r} campo="cuandoLocal" conHora texto={texto} nav={nav}
          ayuda="No tiene horarios libres en la semana: escribí el día y la hora, en la zona de arriba."
          onCambiar={({ cuandoLocal }) => onCambiar({ cuandoLocal, cuando: localAIso(cuandoLocal, tz) })} />
      </>
    );
  }
  const dias = horarios.reduce((acc, iso) => {
    const dia = enZona(iso, tz, DIA);
    (acc[dia] = acc[dia] || []).push(iso);
    return acc;
  }, {});
  return (
    <>
      <Titulo texto={texto} ayuda="Sus horarios libres de la semana. Tocá uno." />
      {selector}
      <div style={{ display: 'grid', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
        {Object.entries(dias).map(([dia, lista]) => (
          <div key={dia} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <small className="t-rotulo" style={{ minWidth: 72 }}>{dia}</small>
            {lista.map((iso) => (
              <Chip key={iso} as="button" type="button" aria-pressed={r.cuando === iso}
                subtle={r.cuando !== iso} onClick={() => onElegir(iso)}>
                {enZona(iso, tz, HORA)}
              </Chip>
            ))}
          </div>
        ))}
      </div>
      <Botonera {...nav} />
    </>
  );
};

/** La revisión: cada dato con «Editar», que vuelve a su pantalla. */
export const Revision = ({ texto, filas, aviso, error, guardando, textoGuardar, onEditar, onGuardar, nav }) => (
  <div className="fi-rev">
    <header className="fi-rev-cab">
      <h3 className="ln-t-h3">{texto}</h3>
      <p className="ln-t-body-sm ln-muted">Tocá «Editar» en cualquier dato para corregirlo.</p>
    </header>
    <section className="fi-rev-sec" aria-label="Lo que reportaste">
      <small className="fi-rev-sec-tit">Lo que reportaste</small>
      <div className="fi-rev-filas">
        {filas.map((f) => (
          <div key={f.label} className={`fi-rev-fila${String(f.valor).length > 40 ? ' fi-rev-fila--ancha' : ''}`}>
            <span className="fi-rev-rotulo">{f.label}</span>
            <span className="fi-rev-valor" style={{ whiteSpace: 'pre-wrap' }}>{f.valor}</span>
            {onEditar && (
              <button type="button" className="fi-rev-editar" aria-label={`Editar: ${f.label}`} onClick={() => onEditar(f.paso)}>
                <Pencil size={12} aria-hidden="true" /> Editar
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
    {aviso && <div className="ln-alert ln-alert--info" role="note"><span className="ln-alert-body"><span className="ln-alert-title">{aviso}</span></span></div>}
    {error && <div className="ln-alert ln-alert--error" role="alert"><span className="ln-alert-body"><span className="ln-alert-title">{error}</span></span></div>}
    {onGuardar && (
      <Botonera {...nav}>
        <Button variant="primary" icon={<CheckCircle2 />} disabled={guardando} onClick={onGuardar}>{textoGuardar}</Button>
      </Botonera>
    )}
  </div>
);
