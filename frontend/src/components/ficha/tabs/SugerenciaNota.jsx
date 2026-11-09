// Lo que dice la nota de Gemini de la Momentum (ADR-W129): se pide una vez a `GET /ficha/<id>/momentum/nota`
// (204 si la llamada todavía no tiene nota) y «Usar» precarga el reporte. El closer revisa y guarda como siempre.

import { useEffect, useState } from 'react';
import { Button, LinkButton } from '../../standard';
import Aviso from '../piezas/Aviso';

const QUE_DICE = {
  sena: { pago: 'Sigue: pagó', plan: 'Sigue con plan de pago', pensando: 'Lo está pensando', no: 'No sigue' },
  cierre: { pago: 'Hace el upsell', plan: 'Upsell con plan de pago', pensando: 'Lo está pensando', no: 'No por ahora' },
};

function useNota(onConsultar) {
  const [nota, setNota] = useState(null);
  useEffect(() => {
    if (!onConsultar) return undefined;
    let vivo = true;
    Promise.resolve(onConsultar('momentum_nota'))
      .then((datos) => { if (vivo && datos && typeof datos === 'object') setNota(datos); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [onConsultar]);
  return nota;
}

export default function SugerenciaNota({ tipo, onConsultar, onUsar }) {
  const nota = useNota(onConsultar);
  const [usada, setUsada] = useState(false);
  if (!nota || usada) return null;
  const decision = QUE_DICE[tipo]?.[nota.sigue];
  const plan = nota.num_cuotas ? ` · ${nota.num_cuotas} cuotas${nota.dia_de_pago ? `, el ${nota.dia_de_pago} de cada mes` : ''}` : '';
  return (
    <div style={{ display: 'grid', gap: 'var(--s2)', marginBottom: 'var(--space-4)' }}>
      <Aviso tono="info" titulo={`La nota de la llamada dice: ${decision || 'no queda claro si sigue'}${plan}`}>
        {nota.resumen}
        {nota.objecion ? ` Lo que lo frena: ${nota.objecion}` : ''}
        {nota.proximo_paso ? ` Próximo paso: ${nota.proximo_paso}` : ''}
      </Aviso>
      <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
        <Button variant="primary" onClick={() => { onUsar(nota); setUsada(true); }}>Usar en el reporte</Button>
        {nota.doc_url && (
          <LinkButton onClick={() => window.open(nota.doc_url, '_blank', 'noopener')}>Abrir la nota</LinkButton>
        )}
      </div>
    </div>
  );
}
