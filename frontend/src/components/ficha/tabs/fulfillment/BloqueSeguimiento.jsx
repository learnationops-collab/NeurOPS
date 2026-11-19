// 3. Seguimiento del equipo (ADR-W016): cómo trabaja el equipo de la Academia con el alumno. No son comentarios:
// objetivos (para qué, quién lo lleva) con su próximo paso, protocolos de contacto, y los últimos registros —acciones
// con si el alumno respondió y observaciones—. Solo lectura: se registra en Contacto de la Academia.
// Las victorias van primero y aparte (ADR-W180): todas, con por qué cuentan, quién y la prueba, para usarlas al cobrar.

import { Chip } from '../../../standard';
import { diaLegible } from '../../piezas';
import { PASO, RESPUESTA } from './lectura';

function Objetivo({ o }) {
  const paso = o.proximo && PASO[o.proximo.tipo];
  return (
    <div className={`ful-obj${o.protocolo ? ' prot' : ''}`}>
      <div className="ful-obj-cab">
        <span>
          <b>{o.para_que}</b>
          <small className="mut">
            {[o.ambito, o.lleva && `lo lleva ${o.lleva}`, o.desde && `desde el ${diaLegible(o.desde)}`].filter(Boolean).join(' · ')}
          </small>
        </span>
        {o.protocolo
          ? <Chip color="var(--brand-secondary)" subtle>{`Protocolo · ${o.protocolo}`}</Chip>
          : <Chip color="var(--info)" subtle>Objetivo</Chip>}
      </div>
      {o.proximo ? (
        <div className={`ful-paso ${o.proximo.tipo}`}>
          <Chip color={`var(--${paso.tono})`}>{paso.etiqueta}</Chip>
          <span>{o.proximo.texto}</span>
          <small className="mut">
            {[o.proximo.quien, o.proximo.vence && (o.proximo.tipo === 'observacion' ? `hasta el ${diaLegible(o.proximo.vence)}` : diaLegible(o.proximo.vence))]
              .filter(Boolean).join(' · ') || 'sin fecha'}
          </small>
        </div>
      ) : (
        <small className="mut">Sin próximo paso planeado.</small>
      )}
    </div>
  );
}

const CLASE = { accion: 'Acción', observacion: 'Observación', victoria: 'Victoria' };

function Registro({ r }) {
  const resp = r.clase === 'accion' && RESPUESTA[r.respuesta];
  return (
    <li className={`ful-reg ${r.clase}`}>
      <span className="ful-reg-fecha">{diaLegible(r.fecha)}</span>
      <i aria-hidden="true" />
      <span>
        <small className="mut">
          {[r.protocolo ? `${CLASE[r.clase]} · ${r.protocolo}` : CLASE[r.clase], r.por].filter(Boolean).join(' · ')}
        </small>
        <span className="ln-t-body-sm" style={{ display: 'block', whiteSpace: 'pre-line' }}>
          {r.texto}
          {r.detalle ? ` — ${r.detalle}` : ''}
        </span>
        {resp && (
          <Chip color={`var(--${resp.tono})`} subtle>
            {[resp.etiqueta, r.tipo_respuesta, r.dijo && `«${r.dijo}»`].filter(Boolean).join(' · ')}
          </Chip>
        )}
      </span>
    </li>
  );
}

function Victoria({ v }) {
  return (
    <li className="ful-reg victoria">
      <span className="ful-reg-fecha">{diaLegible(v.fecha)}</span>
      <i aria-hidden="true" />
      <span>
        {v.por && <small className="mut">{v.por}</small>}
        <span className="ln-t-body-sm" style={{ display: 'block', whiteSpace: 'pre-line' }}>
          <b>{v.texto}</b>
          {v.detalle ? ` — ${v.detalle}` : ''}
        </span>
        {(v.link || v.captura) && (
          <small className="t-cap">
            {v.link && <a href={v.link} target="_blank" rel="noreferrer">Prueba</a>}
            {v.link && v.captura && ' · '}
            {v.captura && <a href={v.captura} target="_blank" rel="noreferrer">Captura</a>}
          </small>
        )}
      </span>
    </li>
  );
}

export default function BloqueSeguimiento({ seguimiento, registros, victorias = [] }) {
  const objetivos = seguimiento?.objetivos || [];
  return (
    <section className="ln-panel ln-panel--sm ful-seccion" aria-labelledby="ful-seguimiento">
      <small id="ful-seguimiento" className="ln-t-eyebrow ln-muted">Seguimiento del equipo</small>
      {victorias.length > 0 && (
        <>
          <small className="ful-sub">{`Victorias · ${victorias.length}`}</small>
          <ul className="ful-regs">{victorias.map((v, i) => <Victoria key={`${v.fecha}-${i}`} v={v} />)}</ul>
        </>
      )}
      {objetivos.length ? (
        <>
          <small className="ful-sub">{`Objetivos abiertos · ${objetivos.length}`}</small>
          {objetivos.map((o) => <Objetivo key={o.id} o={o} />)}
        </>
      ) : (
        <p className="t-sm mut" style={{ margin: 0 }}>El equipo no tiene objetivos abiertos con este alumno.</p>
      )}
      {registros.length > 0 && (
        <>
          <small className="ful-sub">Últimos registros</small>
          <ul className="ful-regs">{registros.map((r, i) => <Registro key={`${r.fecha}-${i}`} r={r} />)}</ul>
        </>
      )}
    </section>
  );
}
