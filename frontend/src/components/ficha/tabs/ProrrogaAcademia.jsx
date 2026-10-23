// Prórroga sin pago desde Fulfillment, siempre con motivo: de los días que se quiera (Santiago,
// 23/10/2026) o de una duración recomendada, que vienen del backend (`subscription_service.PRORROGAS`)
// en `datos.prorrogas`. La fecha la calcula Work desde el vencimiento (o desde hoy, si ya venció).

import { useState } from 'react';
import { Button, FieldError, Input, Segmented, TextArea } from '../../standard';
import { diaLegible } from '../piezas/fecha';
import { mensajeDeError } from '../fichaApi';
import { sumarMeses } from '../fulfillment';

const MAX_DIAS = 365;

const sumarDias = (iso, n) => {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const duracion = (t) => (t.meses ? `${t.meses} ${t.meses === 1 ? 'mes' : 'meses'}` : `${t.dias} días`);

export default function ProrrogaAcademia({ tipos, base, sena, onAccion, onHecho, onCerrar }) {
  const disponibles = (tipos || []).filter((t) => t.value !== 'sena' || sena);
  const [tipo, setTipo] = useState(disponibles[0]?.value || 'libre');
  const [dias, setDias] = useState('10');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const libre = tipo === 'libre';
  const n = Number.parseInt(dias, 10);
  const diasValidos = Number.isInteger(n) && n >= 1 && n <= MAX_DIAS;
  const elegido = disponibles.find((t) => t.value === tipo);
  const hasta = libre
    ? (diasValidos ? sumarDias(base, n) : null)
    : elegido && (elegido.meses ? sumarMeses(base, elegido.meses) : sumarDias(base, elegido.dias));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onAccion('prorrogar_acceso_academia', libre ? { dias: n, motivo: motivo.trim() } : { tipo, motivo: motivo.trim() });
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
      <Segmented value={tipo} onChange={setTipo} label="Duración de la prórroga" radio size="sm"
        options={[...disponibles.map((t) => ({ value: t.value, label: `${t.value === 'sena' ? 'Seña · ' : ''}${duracion(t)}` })),
          { value: 'libre', label: 'Otra' }]} />
      {libre && (
        <label className="t-sm" htmlFor="prorroga-dias">
          Días
          <Input id="prorroga-dias" type="number" min={1} max={MAX_DIAS} value={dias} invalid={!diasValidos}
            onChange={(e) => setDias(e.target.value)} />
        </label>
      )}
      {hasta && <small className="t-cap mut">{`Hasta el ${diaLegible(hasta)}.`}</small>}
      {libre && !diasValidos && <FieldError>{`De 1 a ${MAX_DIAS} días.`}</FieldError>}
      <label className="t-sm" htmlFor="prorroga-motivo">Por qué se le dan días sin pago.</label>
      <TextArea id="prorroga-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus
        placeholder="Ej.: está por completar el pago de la seña" />
      <div className="ful-gestion-botones">
        <Button variant="primary" type="submit" disabled={guardando || !hasta || !motivo.trim()}>Dar prórroga</Button>
        <Button variant="ghost" onClick={onCerrar} disabled={guardando}>Volver</Button>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </form>
  );
}
