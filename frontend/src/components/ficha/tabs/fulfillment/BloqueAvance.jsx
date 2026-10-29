// 2. Avance (ADR-W016): el recorrido de sesiones contra la meta de 30 días, como lo arma Sesiones en la Academia.
// Las Momentum las da el closer: se marcan aparte.

import { Check, CircleDollarSign } from 'lucide-react';
import { Chip } from '../../../standard';
import { diaLegible } from '../../piezas';
import { ritmo } from './lectura';

function Sesion({ s }) {
  const tono = s.hecha ? 'ok' : s.proxima ? 'prox' : s.momentum ? 'closer' : '';
  const detalle = s.hecha
    ? [s.con && `Con ${s.con}`, s.hecha_el && diaLegible(s.hecha_el)].filter(Boolean).join(' · ')
    : s.agendada_para
      ? `${s.estado}${s.con ? ` con ${s.con}` : ''} · ${diaLegible(s.agendada_para)}`
      : s.proxima ? s.estado : s.momentum ? 'La da el closer' : null;
  return (
    <li className={`ful-ses ${tono}`}>
      <i aria-hidden="true">{s.hecha ? <Check size={12} /> : s.momentum ? <CircleDollarSign size={12} /> : null}</i>
      <span>
        <b>{s.nombre}</b>
        {detalle && <small>{detalle}</small>}
      </span>
      {s.proxima && <Chip color="var(--brand-secondary)" subtle>Próxima</Chip>}
    </li>
  );
}

export default function BloqueAvance({ recorrido: r }) {
  const ri = ritmo(r);
  return (
    <section className="ln-panel ln-panel--sm ful-seccion" aria-labelledby="ful-avance">
      <div className="ful-bloque-cab">
        <small id="ful-avance" className="ln-t-eyebrow ln-muted">Avance</small>
        {ri && <Chip color={`var(--${ri.tono})`}>{ri.texto}</Chip>}
      </div>
      {!r ? (
        <p className="t-sm mut" style={{ margin: 0 }}>No está en un proceso de sesiones de la Academia.</p>
      ) : (
        <>
          <div className="ful-ritmo">
            <b>{`${r.hechas} de ${r.total} sesiones`}</b>
            <small className="mut">
              {`Día ${Math.min(r.dias_en_proceso + 1, 999)} de ${r.meta_dias} · inscripto el ${diaLegible(r.inscripto)}`}
            </small>
          </div>
          <ol className="ful-recorrido">
            {r.sesiones.map((s, i) => <Sesion key={`${s.nombre}-${i}`} s={s} />)}
          </ol>
        </>
      )}
    </section>
  );
}
