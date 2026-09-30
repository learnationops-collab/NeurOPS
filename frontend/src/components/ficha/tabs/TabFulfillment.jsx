// Pestaña «Fulfillment»: cómo le está yendo al alumno dentro de la Academia (Learnation).
//
// Es la contracara de Acciones — una cobra, la otra entrega. Hasta ahora, después de darle el
// acceso, el closer quedaba ciego: para saber si el alumno entró, cuánto avanzó o cuándo se le
// vence el producto había que abrir la otra plataforma.
//
// Pide sus datos APARTE de la ficha (`onConsultar('fulfillment')`) porque son de otro sistema:
// tienen su propio tiempo de espera y su propio modo de fallar, y ninguno de los dos puede
// tumbar el modal. Por eso esta pestaña tiene carga y error propios en vez de apoyarse en los
// del cascarón.
//
// El protagonista es el producto que PAGÓ (el Programa de Acciones, resuelto en el backend: ver
// `resolver_producto` en `ficha_fulfillment_service.py`). Todo lo demás que tenga en la Academia
// —el curso de bienvenida que regala a todo alumno nuevo, accesos dados a mano— va a una sección
// aparte y cerrada: antes salía mezclado y se leía como lo comprado.
//
// Cada número lleva su «i» con qué mide, en qué unidad y quién lo calcula (`fulfillment.js`).
// Se reusa el `Tip` del tablero comercial: la ficha ya vive dentro de `.dc-shell`, que es donde
// ese tooltip tiene sus estilos, y ya resuelve portal, bordes de la ventana, teclado y toque.

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, GraduationCap, RefreshCw } from 'lucide-react';
import { Hueso } from '../../huesos/Huesos';
import Tip from '../../../pages/comercial/components/Tip';
import { SeccionColapsable, diaLegible, instanteLegible, useMovimiento } from '../piezas';
import { pestanasVisibles } from '../estadoFicha';
import {
  AYUDA_ACCESO, SECCIONES, diasRestantes, estadoAcceso, nombreProducto,
} from '../fulfillment';
import '../../dashboard/pareja.css';
import './fulfillment.css';

const SUAVE = [0.22, 0.7, 0.2, 1];

/** Rótulo de un dato con su «i». `titulo` del tooltip = el mismo rótulo, así se sabe qué explica. */
const Rotulo = ({ texto, ayuda, eyebrow = false, id = undefined }) => (
  <span className="ful-rotulo">
    <small id={id} className={eyebrow ? 'ln-t-eyebrow ln-muted' : 'ln-t-caption ln-muted'}>{texto}</small>
    <Tip titulo={texto} texto={ayuda} />
  </span>
);

const Dato = ({ rotulo, ayuda, valor, tono = undefined }) => (
  <div className="ful-dato">
    <Rotulo texto={rotulo} ayuda={ayuda} />
    <b className="ln-t-body" style={{ color: tono }}>{valor}</b>
  </div>
);

/** Barra de 0 a 100. Crece al aparecer; con movimiento reducido ya está donde va. */
function Barra({ valor, etiqueta }) {
  const { quieto } = useMovimiento();
  const pct = Math.max(0, Math.min(100, Number(valor) || 0));
  return (
    <span className="ful-barra" role="progressbar" aria-label={etiqueta}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <motion.i initial={quieto ? false : { width: 0 }} animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: SUAVE }} />
    </span>
  );
}

function Metrica({ m, desempeno }) {
  const valor = desempeno?.[m.clave];
  const barra = m.barra ? m.barra(desempeno) : null;
  const nota = m.nota ? m.nota(desempeno) : null;
  return (
    <div className="ful-metrica">
      <Rotulo texto={m.label} ayuda={m.ayuda} />
      <b className="ful-valor" style={{ color: m.alerta?.(valor) ? 'var(--warning)' : undefined }}>
        {m.formato(valor, desempeno)}
      </b>
      {barra !== null && barra !== undefined && <Barra valor={barra} etiqueta={m.label} />}
      {nota && <small className="ln-t-caption ln-muted">{nota}</small>}
    </div>
  );
}

// Adónde mandar a arreglar cada aviso del producto. `sin_vinculo` no tiene pestaña: lo arregla un
// admin fuera de la ficha, y el texto del aviso ya dice dónde.
const ACCION_AVISO = {
  sin_programa: { pestana: 'acciones', label: 'Ir a Acciones' },
  sin_producto: {
    pestana: 'resultado', label: 'Ir a Resultado',
    detalle: 'El acceso se da (o se renueva) al registrar un pago en Resultado, respondiendo «Sí» a «¿Le das acceso a la Academia?».',
  },
};

function AvisoProducto({ aviso, ficha, irA }) {
  const accion = ACCION_AVISO[aviso.codigo];
  // Solo se ofrece ir a una pestaña que este rol y este lead tienen: el cascarón caería a la
  // primera visible y el botón parecería no hacer nada.
  const puedeIr = accion && irA && pestanasVisibles(ficha).some((p) => p.id === accion.pestana);
  return (
    <div className="ln-alert ln-alert--warning" role="status">
      <span className="ln-alert-ico"><AlertTriangle /></span>
      <span className="ln-alert-body">
        <span className="ln-alert-title">{aviso.motivo}</span>
        {accion?.detalle && <span className="ln-alert-desc">{accion.detalle}</span>}
      </span>
      {puedeIr && (
        <button type="button" className="btn btn--linea btn--sm" onClick={() => irA(accion.pestana)}>
          {accion.label}
          <ArrowRight />
        </button>
      )}
    </div>
  );
}

/** El acceso que pagó: qué programa, qué producto le corresponde allá y hasta cuándo lo tiene. */
function AccesoPagado({ datos, ficha, irA }) {
  const { programa, producto_pagado: p, aviso_producto: aviso, alumno } = datos;
  const estado = estadoAcceso(p);
  const activo = alumno?.producto_activo;
  // La Academia marca UN producto como activo. Si no es el que pagó, al entrar ve otra cosa.
  const activoEsOtro = p && activo?.slug && activo.slug !== p.product_slug;
  return (
    <section className="ln-panel ln-panel--sm ful-acceso" aria-labelledby="ful-acceso"
      style={{ '--c': estado ? `var(--${estado.tono})` : 'var(--border-control)' }}>
      <Rotulo id="ful-acceso" eyebrow texto="Lo que pagó" ayuda={AYUDA_ACCESO.programa} />
      <div className="ful-acceso-titulo">
        <p className="ln-t-h3">{programa?.nombre || 'Sin programa cargado'}</p>
        {estado && <span className={`ln-chip ln-chip--sm ln-chip--${estado.tono}`}>{estado.etiqueta}</span>}
        {p?.is_deposit && (
          <span className="ful-rotulo">
            <span className="ln-chip ln-chip--sm ln-chip--warning">Seña</span>
            <Tip titulo="Seña" texto={AYUDA_ACCESO.sena} />
          </span>
        )}
      </div>
      {p && (
        <div className="ful-datos pareja">
          <Dato rotulo="Producto en la Academia" ayuda={AYUDA_ACCESO.producto} valor={nombreProducto(p)} />
          {/* `diaLegible` lee el texto: la Academia guarda el vencimiento a las 00:00 UTC y
              pasarlo por el huso de quien mira lo mostraba un día antes. */}
          <Dato rotulo="Vence" ayuda={AYUDA_ACCESO.vence}
            valor={p.expires_at ? diaLegible(p.expires_at) : 'Sin vencimiento'} />
          <Dato rotulo="Días restantes" ayuda={AYUDA_ACCESO.dias} valor={diasRestantes(p)}
            tono={estado && estado.tono !== 'success' ? `var(--${estado.tono})` : undefined} />
          <Dato rotulo="Asignado" ayuda={AYUDA_ACCESO.asignado}
            valor={p.assigned_at ? diaLegible(p.assigned_at) : '—'} />
        </div>
      )}
      {aviso && <AvisoProducto aviso={aviso} ficha={ficha} irA={irA} />}
      {activoEsOtro && (
        <small className="ln-t-caption" style={{ color: 'var(--warning)' }}>
          {`La Academia tiene como producto activo «${activo.name || activo.slug}», no el que pagó.`}
        </small>
      )}
    </section>
  );
}

function Cuenta({ datos, ficha }) {
  const { alumno } = datos;
  return (
    <section className="ln-panel ln-panel--sm ful-seccion" aria-labelledby="ful-cuenta">
      <small id="ful-cuenta" className="ln-t-eyebrow ln-muted">Cuenta en la Academia</small>
      <p className="ln-t-body" style={{ margin: 0, fontWeight: 700 }}>{alumno.nombre || 'Sin nombre'}</p>
      <div className="ful-datos pareja">
        <Dato rotulo="Correo" ayuda={AYUDA_ACCESO.correo} valor={alumno.email || '—'} />
        <Dato rotulo="Teléfono" ayuda={AYUDA_ACCESO.telefono} valor={alumno.telefono || '—'}
          tono={datos.telefono_coincide === false ? 'var(--warning)' : undefined} />
      </div>
      {/* El teléfono no sirve para BUSCAR al alumno —la Academia sólo cruza por correo—,
          pero que no coincida es justo lo que hay que ver acá: es por donde se le escribe. */}
      {datos.telefono_coincide === false && (
        <small className="ln-t-caption" style={{ color: 'var(--warning)' }}>
          {`El teléfono en la Academia no coincide con el de acá (${ficha?.identidad?.telefono || 'sin teléfono'}).`}
        </small>
      )}
      {datos.email_usado && datos.email_usado !== ficha?.identidad?.email && (
        <small className="ln-t-caption ln-muted">
          {`Se lo encontró con ${datos.email_usado}, que no es el correo cargado en la ficha.`}
        </small>
      )}
    </section>
  );
}

function FilaProducto({ p }) {
  const estado = estadoAcceso(p);
  return (
    <div className="ln-table-row">
      <span className="ln-cell-label">{nombreProducto(p)}</span>
      <span className="ln-t-body-sm">{p.expires_at ? diaLegible(p.expires_at) : 'Sin vencimiento'}</span>
      <span className="ln-t-body-sm" style={{ color: `var(--${estado.tono})`, fontWeight: 700 }}>
        {estado.etiqueta === 'Vencido' ? 'Vencido' : diasRestantes(p)}
        {p.is_deposit ? ' · seña' : ''}
      </span>
    </div>
  );
}

/**
 * Lo que tiene en la Academia y NO es lo que pagó. Cerrado por defecto: es contexto, y abierto
 * competía con el acceso pagado por ser «el producto» de la pestaña.
 */
function OtrosAccesos({ datos }) {
  const otros = datos.otros_productos ?? datos.productos ?? [];
  if (!otros.length) return null;
  // Sin programa (o sin vínculo) no se sabe cuál es el pagado: no se puede decir que ninguno lo sea.
  const sabido = datos.producto_pagado || datos.aviso_producto?.codigo === 'sin_producto';
  return (
    <SeccionColapsable
      titulo={sabido ? 'Otros accesos en la Academia' : 'Accesos en la Academia'}
      resumen={`${otros.length} · ${sabido ? 'no es lo que pagó' : 'no se sabe cuál es el que pagó'}`}>
      <p className="t-sm mut" style={{ margin: '0 0 var(--s3)' }}>
        Productos que también tiene asignados en la Academia: el curso de bienvenida que la
        Academia le da a todo alumno nuevo, o accesos que alguien le dio a mano.
      </p>
      <div className="ln-table" style={{ '--cols': '1.6fr 1fr 1fr' }}>
        <div className="ln-table-head">
          <span>Producto</span>
          <span>Vence</span>
          <span>Estado</span>
        </div>
        {otros.map((p, i) => <FilaProducto key={p.assignment_id ?? i} p={p} />)}
      </div>
    </SeccionColapsable>
  );
}

const PanelHuesos = () => (
  <div className="ln-panel ln-panel--sm" aria-hidden="true">
    <Hueso alto={22} ancho="38%" />
    <Hueso alto={64} paso={1} style={{ marginTop: 'var(--space-4)' }} />
  </div>
);

export default function TabFulfillment({ ficha, onConsultar, irA }) {
  const mov = useMovimiento();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(null);
  // Si el backend no manda `consultado_en`, la hora en que llegó la respuesta dice lo mismo.
  const [traidoEn, setTraidoEn] = useState(null);

  const pedir = useCallback(async () => {
    setCargando(true);
    setFallo(null);
    try {
      setDatos(await onConsultar?.('fulfillment'));
      setTraidoEn(new Date().toISOString());
    } catch (e) {
      // Esto es que NeurOPS no contestó. Que la Academia no conteste viaja DENTRO de la
      // respuesta, en `error`: son dos fallas distintas y se cuentan distinto.
      setFallo(e?.response?.data?.message || e?.message || 'No se pudo consultar la Academia');
    } finally {
      setCargando(false);
    }
  }, [onConsultar]);

  useEffect(() => { pedir(); }, [pedir]);

  if (cargando && !datos) return <PanelHuesos />;

  const error = fallo || datos?.error?.motivo;
  const alumno = datos?.alumno;
  const desempeno = datos?.desempeno;
  const probados = datos?.emails_probados || [];
  const programa = datos?.programa;
  const consultado = datos?.consultado_en || traidoEn;
  // Las piezas entran de a una, en el orden en que se leen.
  let orden = 0;
  const entrar = () => mov.campo(orden++);

  return (
    <div className="ful">
      {datos && (
        <div className="ful-consulta">
          <span className="ful-rotulo">
            <small className="ln-t-caption ln-muted">
              {consultado ? `Datos de la Academia al ${instanteLegible(consultado)}` : 'Datos de la Academia'}
            </small>
            <Tip titulo="De cuándo son" texto={AYUDA_ACCESO.consultado} />
          </span>
          <button type="button" className="btn btn--linea btn--sm" onClick={pedir} disabled={cargando}>
            {cargando ? <span className="ln-spinner" /> : <RefreshCw />}
            Actualizar
          </button>
        </div>
      )}

      {error && (
        <div className="ln-alert ln-alert--error" role="alert">
          <span className="ln-alert-ico"><AlertTriangle /></span>
          <span className="ln-alert-body"><span className="ln-alert-title">{error}</span></span>
          {/* El `.btn` de la ficha: el `.ln-btn` del DS perdía el borde contra `.dc-shell button`
              y se leía como texto suelto. Chico porque vive dentro del aviso, al lado de una línea. */}
          <button type="button" className="btn btn--linea btn--sm" onClick={pedir}>
            <RefreshCw />
            Reintentar
          </button>
        </div>
      )}

      {!error && !datos?.vinculado && (
        <div className="vacio-grande">
          <span className="vacio-icono"><GraduationCap /></span>
          <p className="t-h3">Este cliente todavía no es alumno en la Academia</p>
          <p className="t-sm mut">
            {probados.length
              ? `No hay ninguna cuenta con ${probados.length === 1 ? 'su correo' : 'ninguno de sus correos'}: ${probados.join(', ')}.`
              : 'No tenemos ningún correo real suyo, y el cruce con la Academia es por correo.'}
            {programa?.nombre ? ` Pagó ${programa.nombre}: ese es el acceso que le corresponde.` : ''}
            {' '}El acceso se da al registrar un pago en Resultado, respondiendo «Sí» a «¿Le das acceso a la Academia?».
          </p>
        </div>
      )}

      {datos?.vinculado && alumno && (
        <>
          <motion.div {...entrar()}><AccesoPagado datos={datos} ficha={ficha} irA={irA} /></motion.div>

          {desempeno ? (
            <div className="ful-secciones pareja">
              {SECCIONES.map((s) => (
                <motion.section key={s.id} {...entrar()} className="ln-panel ln-panel--sm ful-seccion"
                  aria-labelledby={`ful-${s.id}`}>
                  <Rotulo id={`ful-${s.id}`} eyebrow texto={s.titulo} ayuda={s.ayuda} />
                  <div className="ful-metricas pareja">
                    {s.metricas.map((m) => <Metrica key={m.clave} m={m} desempeno={desempeno} />)}
                  </div>
                </motion.section>
              ))}
            </div>
          ) : (
            <p className="t-sm mut">La Academia no mandó métricas de desempeño para este alumno.</p>
          )}

          <motion.div {...entrar()}><Cuenta datos={datos} ficha={ficha} /></motion.div>
          <motion.div {...entrar()}><OtrosAccesos datos={datos} /></motion.div>
        </>
      )}
    </div>
  );
}
