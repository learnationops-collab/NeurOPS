// «Guardado en el servidor» de la ficha: cada cambio se escribe al instante y la ficha se vuelve a leer de la base,
// pero nada lo decía. Esta franja muestra a qué hora se leyó por última vez y «Verificar guardado» la vuelve a leer
// y lista lo que quedó, para que quien reporta compruebe que no quedó pendiente.

import { useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '../../standard';

const hora = (d) => d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const CALIFICACION = { calificado: 'Califica (+500 USD)', descalificado: 'No califica' };

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

export default function BarraGuardado({ leidaEn, onVerificar }) {
  const [verificando, setVerificando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const verificar = async () => {
    setVerificando(true);
    try {
      const datos = await onVerificar();
      setResultado(datos ? { hora: new Date(), filas: resumenDeLaFicha(datos) } : { falla: true });
    } finally {
      setVerificando(false);
    }
  };

  if (!leidaEn) return null;
  return (
    <div role="status" aria-label="Estado del guardado"
      style={{ display: 'grid', gap: 6, padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border-subtle)', fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
          <CheckCircle2 aria-hidden="true" size={14} style={{ color: 'var(--success)' }} />
          Los cambios se guardan al instante. Última lectura del servidor: {hora(leidaEn)}
        </span>
        <Button size="sm" variant="secondary" onClick={verificar} disabled={verificando}>
          <RefreshCw aria-hidden="true" size={13} /> {verificando ? 'Verificando…' : 'Verificar guardado'}
        </Button>
      </div>
      {resultado?.falla && (
        <span style={{ color: 'var(--error)' }}>No se pudo leer el servidor. Revisá tu conexión y volvé a intentar.</span>
      )}
      {resultado?.filas && (
        <span style={{ color: 'var(--text-on-surface)' }}>
          <b style={{ color: 'var(--success)' }}>Verificado a las {hora(resultado.hora)}.</b> Esto es lo que está guardado:{' '}
          {resultado.filas.map(([rotulo, valor]) => `${rotulo}: ${valor}`).join(' · ')}
        </span>
      )}
    </div>
  );
}
