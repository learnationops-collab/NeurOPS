// Prórroga sin pago desde Fulfillment (22/10/2026): de un tipo fijo y con motivo. Nadie elige la
// fecha: la calcula Work desde el vencimiento (o desde hoy, si ya venció). Los tipos vienen del
// backend (`subscription_service.PRORROGAS`) en `datos.prorrogas`.

import { useState } from 'react';
import { Button, FieldError, Segmented, TextArea } from '../../standard';
import { diaLegible } from '../piezas/fecha';
import { mensajeDeError } from '../fichaApi';
import { sumarMeses } from '../fulfillment';

const sumarDias = (iso, n) => {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const duracion = (t) => (t.meses ? `${t.meses} ${t.meses === 1 ? 'mes' : 'meses'}` : `${t.dias} días`);

export default function ProrrogaAcademia({ tipos, base, sena, onAccion, onHecho, onCerrar }) {
  const disponibles = (tipos || []).filter((t) => t.value !== 'sena' || sena);
  const [tipo, setTipo] = useState(disponibles[0]?.value || '');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const elegido = disponibles.find((t) => t.value === tipo);
  const hasta = elegido && (elegido.meses ? sumarMeses(base, elegido.meses) : sumarDias(base, elegido.dias));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onAccion('prorrogar_acceso_academia', { tipo, motivo: motivo.trim() });
      onHecho?.();
      onCerrar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="ful-gestion" onSubmit={guardar} aria-label="Prórroga sin pago">
      <Segmented value={tipo} onChange={setTipo} label="Tipo de prórroga" radio size="sm"
        options={disponibles.map((t) => ({ value: t.value, label: `${t.label} · ${duracion(t)}` }))} />
      {hasta && <small className="t-cap mut">{`Hasta el ${diaLegible(hasta)}.`}</small>}
      <label className="t-sm" htmlFor="prorroga-motivo">Por qué se le dan días sin pago.</label>
      <TextArea id="prorroga-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus
        placeholder="Ej.: está por completar el pago de la seña" />
      <div className="ful-gestion-botones">
        <Button variant="primary" type="submit" disabled={guardando || !tipo || !motivo.trim()}>Dar prórroga</Button>
        <Button variant="ghost" onClick={onCerrar} disabled={guardando}>Volver</Button>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </form>
  );
}
