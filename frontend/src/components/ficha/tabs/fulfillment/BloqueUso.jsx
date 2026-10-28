// 4. Uso (ADR-W016): si entra y qué hace. La franja del Pulso de la Academia, los días activos (14 y 30), las horas y
// las entregas, la tira de los últimos 14 días y la bitácora de lo que hizo, con filtros.

import { useState } from 'react';
import { Segmented } from '../../../standard';
import { diaLegible } from '../../piezas';
import { horas } from '../../fulfillment';
import { FILTROS_USO, FRANJAS, TONO_FRANJA, ultimaVez } from './lectura';

const A_LA_VISTA = 12;

/** La hora de un instante de la Academia (ISO con su zona), en el reloj de quien mira. */
const hora = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toTimeString().slice(0, 5);
};

const Cifra = ({ rotulo, valor, detalle }) => (
  <div className="ful-cifra">
    <small className="ln-t-caption ln-muted">{rotulo}</small>
    <b>{valor}</b>
    {detalle && <em>{detalle}</em>}
  </div>
);

function Bitacora({ entradas }) {
  const [filtro, setFiltro] = useState('todo');
  const [todas, setTodas] = useState(false);
  const elegidas = entradas.filter((e) => filtro === 'todo' || e.grupo === filtro);
  const visibles = todas ? elegidas : elegidas.slice(0, A_LA_VISTA);
  let diaAnterior = null;
  return (
    <>
      <Segmented size="sm" value={filtro} options={FILTROS_USO} onChange={setFiltro} label="Qué mostrar" />
      {!visibles.length && <p className="t-sm mut" style={{ margin: 0 }}>Nada de este tipo en la bitácora.</p>}
      <ul className="ful-feed">
        {visibles.map((e, i) => {
          const dia = diaLegible(e.fecha);
          const sep = dia !== diaAnterior;
          diaAnterior = dia;
          return (
            <li key={`${e.fecha}-${i}`} data-grupo={e.grupo}>
              {sep && <span className="ful-feed-dia">{dia}</span>}
              <span className="ful-feed-fila">
                <span className="mut">{hora(e.fecha)}</span>
                <i aria-hidden="true" />
                <span>{e.que}{e.detalle ? <small className="mut">{` · ${e.detalle}`}</small> : null}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {elegidas.length > A_LA_VISTA && (
        <button type="button" className="btn btn--linea btn--sm" onClick={() => setTodas(!todas)}>
          {todas ? 'Ver menos' : `Ver las ${elegidas.length}`}
        </button>
      )}
    </>
  );
}

export default function BloqueUso({ uso, bitacora, desempeno }) {
  const tono = TONO_FRANJA[uso?.franja] || 'idle';
  const dias = uso?.dias || [];
  const activos14 = dias.filter((d) => d.activo).length;
  return (
    <section className="ln-panel ln-panel--sm ful-seccion" aria-labelledby="ful-uso">
      <small id="ful-uso" className="ln-t-eyebrow ln-muted">Uso</small>
      {uso && (
        <>
          <div className="ful-pulso" style={{ '--c': `var(--${tono})` }}>
            <span className="ful-franja"><i aria-hidden="true" />{uso.franja}</span>
            <span className="t-sm mut">{ultimaVez(uso)}</span>
            <span className="ful-escala" aria-hidden="true">
              {FRANJAS.map((f) => <span key={f} className={f === uso.franja ? 'on' : ''}>{f}</span>)}
            </span>
          </div>
          <div className="ful-cifras">
            <Cifra rotulo="Días activos" valor={activos14} detalle="de los últimos 14" />
            <Cifra rotulo="En 30 días" valor={uso.activos_30} detalle="días activos" />
            <Cifra rotulo="Estudió" valor={horas(desempeno?.total_study_hours)} detalle="en total" />
            <Cifra rotulo="Entregas" valor={uso.entregas} detalle={`${uso.corregidas} corregidas`} />
          </div>
          {dias.length > 0 && (
            <div>
              <div className="ful-dias">
                {dias.map((d) => (
                  <span key={d.fecha} title={`${diaLegible(d.fecha)}: ${d.activo ? `activo · ${d.cuenta} vistas y entregas` : 'sin actividad'}`}
                    className={`ful-dia${d.activo ? ' on' : ''}${d.cuenta > 2 ? ' mucho' : ''}`} />
                ))}
              </div>
              <div className="ful-dias-pie mut"><span>hace 2 semanas</span><span>hoy</span></div>
            </div>
          )}
        </>
      )}
      <Bitacora entradas={bitacora} />
    </section>
  );
}
