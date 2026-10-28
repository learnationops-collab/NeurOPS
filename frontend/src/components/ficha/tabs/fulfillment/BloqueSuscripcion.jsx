// 1. Suscripción (ADR-W016): la entidad de Work que da el acceso, no la venta. Producto, hasta cuándo, qué la abrió
// o la extendió, si la Academia la tiene igual y lo que se puede hacer con ella (prórroga, mail, quitar, reenviar).
// Sale de Work: se ve aunque la Academia no conteste.

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button, Chip } from '../../../standard';
import { localToday } from '../../../../utils/datetime';
import { diaLegible } from '../../piezas';
import { mensajeDeError } from '../../fichaApi';
import MotivoDelFallo from '../../historial/MotivoDelFallo';
import AccesoAcademia from '../AccesoAcademia';
import SuscripcionWork from '../SuscripcionWork';
import { estadoSuscripcion, origen, sincronia } from './lectura';

/** Los días que le quedan, en un anillo que se vacía. */
const Anillo = ({ quedan, parte }) => (
  <div className="ful-anillo" style={{ '--p': Math.round(parte * 100) }} aria-hidden="true">
    <span><b>{quedan}</b><small>{quedan === 1 ? 'día' : 'días'}</small></span>
  </div>
);

function Reenviar({ onAccion, onHecho }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const reenviar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await onAccion('reenviar_academia', {});
      onHecho?.();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <>
      <Button variant="primary" icon={<Send />} onClick={reenviar} disabled={enviando}
        title="Le asigna en la Academia el producto con la fecha de Work">
        {enviando ? 'Reenviando…' : 'Reenviar a la Academia'}
      </Button>
      <MotivoDelFallo motivo={error} />
    </>
  );
}

export default function BloqueSuscripcion({ s, datos, ficha, programas, onAccion, onHecho }) {
  const hoy = localToday();
  const estado = estadoSuscripcion(s, hoy);
  const sync = sincronia(s, datos);
  const nombre = programas.find((p) => p.clave === s.program_code)?.label || datos?.programa?.nombre || s.product_slug;
  const correo = datos?.alumno?.email;
  const titulo = estado.etiqueta === 'Vencida' ? `venció el ${diaLegible(s.expires_at)}`
    : `${s.is_deposit ? 'seña' : 'vigente'} hasta el ${diaLegible(s.expires_at)}`;
  return (
    <section className="ln-panel ln-panel--sm ful-susc" aria-labelledby="ful-susc"
      style={{ '--c': `var(--${estado.tono})` }}>
      <div className="ful-susc-top">
        <Anillo quedan={estado.quedan} parte={estado.parte} />
        <div className="ful-susc-cuerpo">
          <p id="ful-susc" className="ln-t-h3" style={{ margin: 0 }}>
            {`${nombre} · ${titulo}`}
          </p>
          <div className="ful-chips">
            <Chip color={`var(--${estado.tono})`}>{estado.etiqueta}</Chip>
            {s.is_deposit && <Chip color="var(--warning)">Seña</Chip>}
            <Chip color={`var(--${sync.tono})`} subtle>{sync.texto}</Chip>
          </div>
          <p className="t-sm mut" style={{ margin: 0 }}>
            {[s.starts_at && `Desde el ${diaLegible(s.starts_at)}.`, origen(s), correo && `Entra con ${correo}.`]
              .filter(Boolean).join(' ')}
          </p>
          {s.is_deposit && estado.etiqueta !== 'Vencida' && (
            <p className="t-sm" style={{ margin: 0 }}>
              Cuando complete el pago, la seña se convierte y la suscripción pasa a 4 meses.
            </p>
          )}
          {estado.etiqueta === 'Por vencer' && !s.is_deposit && (
            <p className="t-sm" style={{ margin: 0 }}>
              {`Para seguir después del ${diaLegible(s.expires_at)} necesita una renovación: la Momentum de cierre.`}
            </p>
          )}
        </div>
        {sync.reenviar && ficha?.permisos?.cobrar && onAccion && datos?.vinculado && (
          <div className="ful-susc-cta"><Reenviar onAccion={onAccion} onHecho={onHecho} /></div>
        )}
      </div>
      <AccesoAcademia datos={datos} ficha={ficha} onAccion={onAccion} onHecho={onHecho} />
      <SuscripcionWork suscripciones={[s]} programas={programas} />
    </section>
  );
}
