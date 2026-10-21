// Las ventas activas que el agrupado (o el scheduler) dejó con un motivo de revisión: una seña que
// no siguió, un programa a definir, una cuota sin venta anterior. Operaciones las abre en la ficha
// y las corrige o las cancela desde el bloque Ventas de Fulfillment (21/10/2026).

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList } from 'lucide-react';
import api from '../../../services/api';
import { Button, EmptyState, FieldError, Panel, Select, Skeleton, SkeletonPanel } from '../../../components/standard';
import FichaLeadModal from '../../../components/ficha/FichaLeadModal';
import { diaLegible } from '../../../components/ficha/piezas';
import { moneda } from '../../../components/ficha/acciones/planCuotas';

export default function VentasParaRevisar() {
  const [datos, setDatos] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  const [ficha, setFicha] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await api.get('/ficha/ventas/revisar', { params: motivo ? { motivo } : {} });
      setDatos(r.data);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'No se pudo cargar la lista');
    }
  }, [motivo]);

  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <FieldError>{error}</FieldError>;
  if (!datos) {
    return <Skeleton label="Cargando las ventas para revisar…"><SkeletonPanel rows={6} rowHeight={44} /></Skeleton>;
  }

  const opciones = [{ value: '', label: 'Todos los motivos' },
    ...datos.motivos.map(([m, n]) => ({ value: m, label: `${m} (${n})` }))];

  return (
    <Panel>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <h2 className="ln-t-h3" style={{ margin: 0 }}>Ventas para revisar</h2>
        <span className="t-sm mut">{datos.ventas.length} {datos.ventas.length === 1 ? 'venta' : 'ventas'}</span>
        <Select value={motivo} options={opciones} onChange={setMotivo} size="sm" label="Motivo" />
      </div>
      {datos.ventas.length === 0 ? (
        <EmptyState icon={<ClipboardList />} title="No hay ventas para revisar">
          Ninguna venta activa tiene un motivo de revisión{motivo ? ' con este filtro' : ''}.
        </EmptyState>
      ) : (
        <div className="ln-table" style={{ '--cols': '1.4fr 0.6fr 0.8fr 0.8fr 0.8fr 0.8fr 2fr 0.7fr' }}>
          <div className="ln-table-head">
            <span>Cliente</span>
            <span>Programa</span>
            <span>Fecha</span>
            <span>Total</span>
            <span>Cobrado</span>
            <span>Saldo</span>
            <span>Motivo</span>
            <span />
          </div>
          {datos.ventas.map((v) => (
            <div key={v.id} className="ln-table-row">
              <span className="ln-cell-label">{v.nombre || `Venta #${v.id}`}</span>
              <span className="ln-t-body-sm">{v.program_code || '—'}</span>
              <span className="ln-t-body-sm">{v.sold_at ? diaLegible(v.sold_at) : '—'}</span>
              <span className="ln-t-body-sm">{v.total == null ? '—' : moneda(v.total)}</span>
              <span className="ln-t-body-sm">{moneda(v.cobrado)}</span>
              <span className="ln-t-body-sm">{moneda(v.saldo)}</span>
              <span className="ln-t-body-sm ln-muted">{v.motivos.join(' · ')}</span>
              <span>
                <Button onClick={() => setFicha({ clientId: v.client_id, personUuid: v.person_uuid })}
                  disabled={!v.client_id && !v.person_uuid}>Abrir</Button>
              </span>
            </div>
          ))}
        </div>
      )}
      {ficha && createPortal(
        <FichaLeadModal clientId={ficha.clientId} personUuid={ficha.personUuid || null} pestanaInicial="ful"
          onCerrar={() => setFicha(null)} onCambio={cargar} />,
        document.body,
      )}
    </Panel>
  );
}
