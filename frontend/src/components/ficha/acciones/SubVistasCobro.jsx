// Las tres sub-vistas simples del cobro: registrar pago, registrar seguimiento y dar de baja.
// Las tres son formularios chicos, así que comparten `FormularioSimple` y su validación.

import { useId, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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

// Cobrar una cuota es declarar una venta de tipo Cuota: `POST /ficha/<id>/venta` pasa por
// `SheetsService.post_to_sheets`, que es el único camino que hace todo lo que un cobro implica
// (FinancialSale, espejo a Enrollment/Payment, secuencia de pagos). Y ese camino habla en
// `tipo_pago` / `metodo_pago` / `marca_temporal`, no en monto/medio/fecha: mandarle las otras
// claves era pedirle un cobro sin tipo de pago, que rechazaba siempre.
export function SubVistaPago({ ficha, onVolver, onGuardar, guardando }) {
  const [valores, setValores] = useState({ fecha: hoyIso(), medio: null, monto: '' });
  const campos = useMemo(() => [
    { campo: 'monto', label: 'Monto', tipo: 'monto', requerido: true },
    { campo: 'fecha', label: 'Fecha', tipo: 'fecha', requerido: true },
    { campo: 'medio', label: 'Medio', tipo: 'opcion', requerido: true, opciones: labels(ficha?.vocabulario?.medios_pago, MEDIOS_POR_DEFECTO) },
  ], [ficha]);

  // El programa es el prefijo de `tipo_pago`: sin él no hay cobro que declarar. Se dice acá y se
  // manda a arreglarlo a la tarjeta de la izquierda, en vez de dejar que el backend lo rechace.
  const programa = ficha?.cobro?.programa_code || null;

  return (
    <SubVista titulo="Registrar pago" onVolver={onVolver}>
      {programa ? (
        <FormularioSimple
          campos={campos}
          valores={valores}
          guardando={guardando}
          cta="Registrar pago"
          onCambio={(parche) => setValores((p) => ({ ...p, ...parche }))}
          onGuardar={() => onGuardar({
            tipo_pago: `${programa} - Cuota`,
            monto: parseFloat(valores.monto) || 0,
            metodo_pago: valores.medio,
            marca_temporal: valores.fecha,
          })}
        />
      ) : (
        <p className="ln-t-body-sm ln-muted">
          Este cliente no tiene programa asignado, y un cobro se declara como «programa – Cuota».
          Asignáselo en la tarjeta de la deuda y volvé a esta acción.
        </p>
      )}
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
          fecha: valores.fecha,
          canal: valores.canal,
          nota: valores.nota || '',
          // Es un seguimiento de cobro: el lead ya compró (misma clasificación que hoy). El canal
          // y la nota los junta el backend en `seguimiento_sub`, que es donde el equipo los lee.
          tipo: 'cerrada',
        })}
      />
    </SubVista>
  );
}

/**
 * Sí o no, en el control segmentado de la ficha (`.fi-seg`, el de «Pendiente | Realizado» del
 * historial). Eran dos `.ln-chip` y dentro de `.dc-shell` perdían el borde y el aire: dos palabras
 * sueltas con un bloque magenta detrás de la elegida. La marca se corre de una a la otra
 * (`layoutId`) y con movimiento reducido salta sin animar.
 */
function SiNo({ valor, onElegir, etiqueta }) {
  const reducido = useReducedMotion();
  const marca = useId();
  return (
    <div className="fi-seg" role="group" aria-label={etiqueta}>
      {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map((o) => {
        const activo = valor === o.v;
        return (
          <button key={o.l} type="button" className="fi-seg-op" aria-pressed={activo}
            onClick={() => onElegir(o.v)}>
            {activo && (
              <motion.span className="fi-seg-marca" aria-hidden="true"
                {...(reducido ? {} : {
                  layoutId: `fi-seg-sino-${marca}`,
                  transition: { type: 'spring', bounce: 0.18, duration: 0.36 },
                })} />
            )}
            {o.l}
          </button>
        );
      })}
    </div>
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

        {/* `flex-start` para que la columna del campo no estire el control a todo el ancho. */}
        <div className="ln-field-wrap" style={{ alignItems: 'flex-start' }}>
          <small className="ln-field-label" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>
            ¿Agendás un seguimiento a futuro?
          </small>
          <SiNo valor={agenda} onElegir={setAgenda} etiqueta="¿Agendás un seguimiento a futuro?" />
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
