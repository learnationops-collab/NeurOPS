// «Guardado en el servidor» de la ficha: cada cambio se escribe al instante y la ficha se vuelve a leer de la base,
// pero nada lo decía. «Verificar guardado» la vuelve a leer y dice lo que quedó, para que quien reporta compruebe
// que no quedó pendiente. La hora de la última lectura va en el tooltip del botón.

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const hora = (d) => d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const CALIFICACION = { calificado: 'Califica (+500 USD)', descalificado: 'No califica', seguimiento: 'Lo va a pensar' };

/** Lo que la base tiene de este lead, en pares [rótulo, valor]. Lo que no existe no se lista. */
export function resumenDeLaFicha(ficha) {
  if (!ficha) return [];
  const filas = [];
  const triage = ficha.triage?.es_triage ? ficha.triage : null;
  if (triage) {
    filas.push(['Reporte', triage.reportada ? 'Completo' : 'Sin completar']);
    filas.push(['Asistencia', triage.asistencia || 'Pendiente']);
    if (triage.calificacion) filas.push(['Calificación', CALIFICACION[triage.calificacion] || triage.calificacion]);
    if (triage.closing) filas.push(['Pasó a', triage.closing.closer || 'closing']);
    if (triage.low_ticket) filas.push(['Low ticket', triage.low_ticket]);
  } else if (ficha.resultado?.post_call?.label) {
    filas.push(['Resultado', ficha.resultado.post_call.label]);
  }
  const conf = ficha.confirmacion || {};
  if (conf.etapa) filas.push(['Confirmación', conf.cerrada ? 'Confirmada' : conf.etapa]);
  if (conf.como_viene?.label) filas.push(['Cómo viene', conf.como_viene.label]);
  if (conf.dolores?.length) filas.push(['Dolores', String(conf.dolores.length)]);
  const llamada = ficha.identidad?.llamada;
  if (llamada?.fecha) filas.push(['Llamada', `${llamada.fecha}${llamada.hora ? ` · ${llamada.hora}` : ''}`]);
  return filas;
}

/** «Verificar guardado» (27/11/2026, compacto): relee la ficha y dice en un aviso lo que quedó en la base. */
export default function BarraGuardado({ leidaEn, onVerificar, className = 'fi-mini' }) {
  const [verificando, setVerificando] = useState(false);

  const verificar = async () => {
    setVerificando(true);
    try {
      const datos = await onVerificar();
      if (!datos) {
        toast.error('No se pudo leer el servidor. Revisá tu conexión y volvé a intentar.');
        return;
      }
      const filas = resumenDeLaFicha(datos).map(([rotulo, valor]) => `${rotulo}: ${valor}`).join(' · ');
      toast.success(`Guardado a las ${hora(new Date())}. ${filas}`, { duration: 6000 });
    } finally {
      setVerificando(false);
    }
  };

  if (!leidaEn) return null;
  return (
    <button type="button" className={className} onClick={verificar} disabled={verificando}
      title={`Última lectura del servidor: ${hora(leidaEn)}`}>
      <RefreshCw aria-hidden="true" size={13} className={verificando ? 'fi-girando' : undefined} />
      {verificando ? 'Verificando…' : 'Verificar guardado'}
    </button>
  );
}
