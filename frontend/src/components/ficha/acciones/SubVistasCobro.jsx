// Las tres sub-vistas simples del cobro: registrar pago, registrar seguimiento y dar de baja.
// Las tres son formularios chicos, así que comparten `FormularioSimple` y su validación.

import { useMemo, useState } from 'react';
import { SubVista, DesplegableAgrupado } from './piezas';
import FormularioSimple from './FormularioSimple';

const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const enDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Presets del mockup. Van en días para no depender de la longitud del mes.
const PRESETS_SEGUIMIENTO = [
  { clave: 'semana', label: 'En 1 semana', valor: enDias(7) },
  { clave: 'mes', label: 'En 1 mes', valor: enDias(30) },
  { clave: 'tres', label: 'En 3 meses', valor: enDias(90) },
  { clave: 'seis', label: 'En 6 meses', valor: enDias(180) },
];

const MEDIOS_POR_DEFECTO = ['Stripe', 'Transferencia', 'PayPal', 'Efectivo'];
const CANALES_POR_DEFECTO = ['WhatsApp', 'Llamada', 'Email'];

const labels = (vocabulario, porDefecto) => (vocabulario?.length
  ? vocabulario.map((v) => (typeof v === 'string' ? v : v.label)) : porDefecto);

export function SubVistaPago({ ficha, onVolver, onGuardar, guardando }) {
  const [valores, setValores] = useState({ fecha: hoyIso(), medio: null, monto: '' });
  const campos = useMemo(() => [
    { campo: 'monto', label: 'Monto', tipo: 'monto', requerido: true },
    { campo: 'fecha', label: 'Fecha', tipo: 'fecha', requerido: true },
    { campo: 'medio', label: 'Medio', tipo: 'opcion', requerido: true, opciones: labels(ficha?.vocabulario?.medios_pago, MEDIOS_POR_DEFECTO) },
  ], [ficha]);

  return (
    <SubVista titulo="Registrar pago" onVolver={onVolver}>
      <FormularioSimple
        campos={campos}
        valores={valores}
        guardando={guardando}
        cta="Registrar pago"
        onCambio={(parche) => setValores((p) => ({ ...p, ...parche }))}
        onGuardar={() => onGuardar({
          monto: parseFloat(valores.monto) || 0,
          fecha: valores.fecha,
          medio: valores.medio,
          programa_code: ficha?.cobro?.programa_code || null,
        })}
      />
    </SubVista>
  );
}

export function SubVistaSeguimiento({ ficha, onVolver, onGuardar, guardando }) {
  const [valores, setValores] = useState({ fecha: '', canal: null, nota: '' });
  const campos = useMemo(() => [
    { campo: 'fecha', label: 'Volver a contactar el', tipo: 'fecha', requerido: true, presets: PRESETS_SEGUIMIENTO },
    { campo: 'canal', label: 'Canal', tipo: 'opcion', requerido: true, opciones: labels(ficha?.vocabulario?.canales_seguimiento, CANALES_POR_DEFECTO) },
    { campo: 'nota', label: 'Nota', tipo: 'parrafo' },
  ], [ficha]);

  return (
    <SubVista titulo="Registrar seguimiento" onVolver={onVolver}>
      <FormularioSimple
        campos={campos}
        valores={valores}
        guardando={guardando}
        cta="Guardar seguimiento"
        onCambio={(parche) => setValores((p) => ({ ...p, ...parche }))}
        onGuardar={() => onGuardar({
          fecha_seguimiento: valores.fecha,
          fecha_seguimiento_cobro: valores.fecha,
          canal: valores.canal,
          nota: valores.nota || '',
          // Es un seguimiento de cobro: el lead ya compró (misma clasificación que hoy).
          seguimiento_tipo: 'cerrada',
          seguimiento_sub: 'Seguimiento de cobro',
          seguimiento_realizado: false,
        })}
      />
    </SubVista>
  );
}

const MOTIVOS_BAJA_POR_DEFECTO = [
  { titulo: 'Económicos', tono: 'error', opciones: ['No puede pagar', 'Perdió ingresos', 'Le parece caro'] },
  { titulo: 'Tiempo y examen', tono: 'warning', opciones: ['No tiene tiempo para estudiar', 'Posterga el examen', 'Ya rindió el examen'] },
  { titulo: 'Programa', tono: 'info', opciones: ['No ve resultados', 'Se va a otro programa', 'No le sirve el formato'] },
  { titulo: 'Personales', tono: 'success', opciones: ['Salud', 'Motivos familiares', 'Se muda'] },
  { titulo: 'Otros', tono: 'idle', opciones: [] },
];

export function SubVistaBaja({ ficha, onVolver, onGuardar, guardando }) {
  const [motivo, setMotivo] = useState(null);
  const [agenda, setAgenda] = useState(true);
  const [valores, setValores] = useState({ fecha: '' });
  const [nuevas, setNuevas] = useState({});

  // El vocabulario manda: solo si el backend no lo trajo se usa el del mockup.
  const grupos = (ficha?.vocabulario?.motivos_baja?.length
    ? ficha.vocabulario.motivos_baja : MOTIVOS_BAJA_POR_DEFECTO)
    .map((g) => ({ ...g, opciones: [...(g.opciones || []), ...(nuevas[g.titulo] || [])] }));

  const campos = agenda
    ? [{ campo: 'fecha', label: 'Contactar el', tipo: 'fecha', requerido: true, presets: PRESETS_SEGUIMIENTO }]
    : [];

  return (
    <SubVista titulo="Dar de baja" onVolver={onVolver}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className="ln-field-wrap">
          <small className="ln-field-label" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>
            ¿Por qué se da de baja?
          </small>
          <DesplegableAgrupado
            grupos={grupos}
            valor={motivo}
            onChange={setMotivo}
            onAgregar={(titulo, texto) => {
              if (!texto) return;
              setNuevas((p) => ({ ...p, [titulo]: [...(p[titulo] || []), texto] }));
              setMotivo(texto);
            }}
          />
        </div>

        <div className="ln-field-wrap">
          <small className="ln-field-label" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>
            ¿Agendás un seguimiento a futuro?
          </small>
          <div className="ln-btn-row" role="group" aria-label="¿Agendás un seguimiento a futuro?">
            {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map((o) => (
              <button
                key={o.l}
                type="button"
                aria-pressed={agenda === o.v}
                onClick={() => setAgenda(o.v)}
                className="ln-chip ln-chip--sm"
                style={{
                  cursor: 'pointer',
                  background: agenda === o.v ? 'var(--brand-secondary)' : 'transparent',
                  borderColor: agenda === o.v ? 'var(--brand-secondary)' : 'var(--border-control)',
                  color: agenda === o.v ? 'var(--ink)' : 'var(--text-on-surface)',
                }}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <FormularioSimple
          campos={campos}
          valores={valores}
          guardando={guardando}
          cta="Dar de baja"
          faltantesExtra={motivo ? [] : ['Elegí el motivo de la baja']}
          onCambio={(parche) => setValores((p) => ({ ...p, ...parche }))}
          onGuardar={() => onGuardar({
            motivo,
            agenda_seguimiento: agenda,
            fecha_seguimiento: agenda ? valores.fecha : null,
          })}
        />
      </div>
    </SubVista>
  );
}
