// Las ventas de la persona como las registra Work (21/10/2026): cada compromiso con un programa,
// con lo acordado, lo cobrado y lo que falta. Al lado de la suscripción porque es lo que la abre.
// Cancelar una venta (una seña que no siguió) la deja sin deuda: los pagos y el acceso quedan
// como estaban. Lo pueden el closer de la venta, Operaciones y un admin (`puede_gestionar`).

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Button, FieldError, TextArea } from '../../standard';
import { SeccionColapsable, diaLegible } from '../piezas';
import { moneda } from '../acciones/planCuotas';
import { mensajeDeError } from '../fichaApi';

const KIND = { new: 'Nueva', renewal: 'Renovación', upsell: 'Upsell' };
const ESTADO = {
  active: { label: 'Activa', tono: 'success' },
  cancelled: { label: 'Cancelada', tono: 'danger' },
  refunded: { label: 'Reembolsada', tono: 'warning' },
};

const esSena = (v) => v.suscripcion?.sena || (!!v.pagos?.length && v.pagos.every((p) => /se[ñn]a/i.test(p.tipo || '')));

/** El total y de dónde sale: «$1.500» o «$1.500 (lista)». */
const total = (v) => (v.total == null ? '—' : `${moneda(v.total)}${v.total_de_lista ? ' (lista)' : ''}`);

function Pagos({ v }) {
  if (!v.pagos?.length) return <p className="t-sm mut" style={{ margin: 0 }}>Sin pagos.</p>;
  return (
    <div className="ln-table" style={{ '--cols': '0.9fr 0.8fr 1.4fr 1fr 1.2fr' }}>
      <div className="ln-table-head">
        <span>Fecha</span>
        <span>Monto</span>
        <span>Tipo</span>
        <span>Estado</span>
        <span>Pagó</span>
      </div>
      {v.pagos.map((p) => (
        <div key={p.id} className="ln-table-row">
          <span className="ln-t-body-sm">{p.fecha ? diaLegible(p.fecha) : '—'}</span>
          <span className="ln-t-body-sm">{moneda(p.monto)}</span>
          <span className="ln-t-body-sm">{p.tipo || '—'}</span>
          <span className={`ln-t-body-sm${p.completado ? '' : ' ln-muted'}`}>{p.estado || '—'}</span>
          <span className="ln-t-body-sm ln-muted">{p.pagador || 'El cliente'}</span>
        </div>
      ))}
    </div>
  );
}

function Cancelar({ v, onAccion, onHecho }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const ejecutar = async (accion, payload) => {
    setGuardando(true);
    setError(null);
    try {
      await onAccion(accion, { sale_id: v.id, ...payload });
      setAbierto(false);
      setMotivo('');
      onHecho?.();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  if (v.status === 'cancelled') {
    return (
      <div className="ful-gestion-botones">
        <Button onClick={() => ejecutar('reactivar_venta')} disabled={guardando}>Reactivar</Button>
        {error && <FieldError>{error}</FieldError>}
      </div>
    );
  }
  if (v.status !== 'active') return null;
  if (!abierto) {
    return <Button variant="danger" onClick={() => setAbierto(true)}>Cancelar venta</Button>;
  }
  return (
    <form className="ful-gestion" onSubmit={(e) => { e.preventDefault(); ejecutar('cancelar_venta', { motivo: motivo.trim() }); }}>
      <label className="t-sm" htmlFor={`motivo-${v.id}`}>
        Por qué se cancela. Deja de deber; los pagos y el acceso quedan como están.
      </label>
      <TextArea id={`motivo-${v.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus
        placeholder="Ej.: dejó la seña y no siguió" />
      <div className="ful-gestion-botones">
        <Button variant="dangerSolid" type="submit" disabled={guardando || !motivo.trim()}>Cancelar la venta</Button>
        <Button variant="ghost" onClick={() => { setAbierto(false); setError(null); }} disabled={guardando}>Volver</Button>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </form>
  );
}

function Venta({ v, programa, onAccion, onHecho }) {
  const [abierta, setAbierta] = useState(false);
  const estado = ESTADO[v.status] || { label: v.status };
  const nota = [...(v.motivos || []), ...(v.registro || [])].join(' · ');
  return (
    <Fragment>
      <div className="ln-table-row">
        <span className="ln-cell-label">
          {programa}{v.kind !== 'new' ? ` · ${KIND[v.kind] || v.kind}` : ''}
          {esSena(v) && v.status === 'active' && <> <span className="ln-chip ln-chip--sm ln-chip--warning">Seña</span></>}
        </span>
        <span className="ln-t-body-sm">{v.sold_at ? diaLegible(v.sold_at) : '—'}</span>
        <span className="ln-t-body-sm">{total(v)}</span>
        <span className="ln-t-body-sm">{moneda(v.cobrado)}</span>
        <span className="ln-t-body-sm">{moneda(v.saldo)}</span>
        <span><span className={`ln-chip ln-chip--sm${estado.tono ? ` ln-chip--${estado.tono}` : ''}`}>{estado.label}</span></span>
        <span className="ln-t-body-sm ln-muted">{nota || '—'}</span>
      </div>
      <div className="ful-gestion">
        <div className="ful-gestion-botones">
          <Button variant="ghost" aria-expanded={abierta} onClick={() => setAbierta((a) => !a)}>
            {abierta ? 'Ocultar pagos' : `Ver pagos (${v.pagos?.length || 0})`}
          </Button>
          {v.suscripcion && (
            <span className="t-sm mut">
              Suscripción: {v.suscripcion.producto} hasta el {diaLegible(v.suscripcion.vence)}
            </span>
          )}
        </div>
        {/* A mano en la fila: sobre todo para la seña que no siguió (venta con saldo). */}
        {v.puede_gestionar && onAccion && <Cancelar v={v} onAccion={onAccion} onHecho={onHecho} />}
        {abierta && <Pagos v={v} />}
      </div>
    </Fragment>
  );
}

export default function VentasWork({ onConsultar, onAccion, programas = [] }) {
  const [ventas, setVentas] = useState(null);
  const [fallo, setFallo] = useState(null);

  const pedir = useCallback(async () => {
    setFallo(null);
    try {
      setVentas((await onConsultar?.('ventas'))?.ventas || []);
    } catch (e) {
      setFallo(mensajeDeError(e));
    }
  }, [onConsultar]);

  useEffect(() => { pedir(); }, [pedir]);

  if (fallo) return <FieldError>{`No se pudieron traer las ventas: ${fallo}`}</FieldError>;
  if (!ventas?.length) return null;
  const nombreDe = (v) => programas.find((p) => p.clave === v.program_code)?.label || v.program_code || 'Programa a definir';
  const saldo = ventas.reduce((n, v) => n + (v.saldo || 0), 0);
  const conSaldo = ventas.some((v) => v.saldo > 0 && v.puede_gestionar);
  return (
    <SeccionColapsable titulo="Ventas" abiertaPorDefecto={conSaldo}
      resumen={`${ventas.length} ${ventas.length === 1 ? 'venta' : 'ventas'} · debe ${moneda(saldo)}`}>
      <p className="t-sm mut" style={{ margin: '0 0 var(--s3)' }}>
        Cada venta con lo acordado (o el precio de lista de su época), lo cobrado y lo que falta.
        Una venta cancelada no debe nada; sus pagos siguen contando como cobrados.
      </p>
      <div className="ln-table" style={{ '--cols': '1.2fr 0.8fr 0.9fr 0.8fr 0.8fr 0.8fr 1.6fr' }}>
        <div className="ln-table-head">
          <span>Programa</span>
          <span>Fecha</span>
          <span>Total</span>
          <span>Cobrado</span>
          <span>Saldo</span>
          <span>Estado</span>
          <span>Nota</span>
        </div>
        {ventas.map((v) => (
          <Venta key={v.id} v={v} programa={nombreDe(v)} onAccion={onAccion} onHecho={pedir} />
        ))}
      </div>
    </SeccionColapsable>
  );
}
