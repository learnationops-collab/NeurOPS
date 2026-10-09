import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowRightLeft, Check, ChevronDown, FileUp, Pencil, RotateCcw, Search, User, X } from 'lucide-react';
import toast from 'react-hot-toast';
import InlineConfirm from '../../../../components/ui/InlineConfirm';
import FichaLeadModal from '../../../../components/ficha/FichaLeadModal';
import { EsqueletoTablero, PanelCab, Segmented } from '../Shared';
import { Cifron, HUMOS, conSigno, dinero, tonoDe } from './comun';
import * as apiFz from './finanzasApi';

/**
 * Finanzas › Diferencias (09/10/2026): lo reportado en el sistema contra lo que entró de verdad por
 * Stripe y Hotmart. Pedido de Kerwin: «agregá una pestaña de Diferencias, para agregar CSVs [...]
 * para revisar las diferencias entre lo reportado y lo ingresado realmente, con KPIs que muestren lo
 * reportado y lo ingresado, y que me permita hacer correcciones rápidas en lo reportado».
 *
 * Se suben los exports de cada pasarela (uno o varios; la pasarela se reconoce sola o se elige) y el
 * backend los cruza con las ventas del período (`conciliacion_service`): cada fila coincide, tiene
 * otro monto, entró sin reportarse o se reportó sin entrar. Arriba, lo reportado, lo ingresado, la
 * diferencia y cuántas quedan pendientes, por pasarela. Desde cada fila se corrige lo reportado ahí
 * mismo («Usar $X», cambiar el método, editar monto o fecha), se abre la ficha del cliente para
 * registrar el pago, o se marca la diferencia como revisada. Cada cambio vuelve a pedir la
 * conciliación: la fila y los KPIs quedan al día al momento.
 */

const v = (tono) => `var(--${tono})`;
const PASARELAS = { stripe: 'Stripe', hotmart: 'Hotmart' };

export const ESTADOS = {
    monto_distinto: { label: 'Monto distinto', tono: 'warning' },
    sin_reportar: { label: 'Sin reportar', tono: 'info' },
    sin_ingreso: { label: 'Sin ingreso', tono: 'error' },
    coincide: { label: 'Coincide', tono: 'success' },
};

// Cómo se supo que la venta y el cobro son de la misma persona; lo débil se dice en la fila.
const IDENTIDADES = {
    correo: 'Mismo correo',
    cliente: 'El correo del cobro es el de su ficha',
    correo_parcial: 'El correo quedó cortado en el sistema: coincide lo de antes de la «@»',
    nombre: 'Por el nombre: el correo del cobro es otro',
    nombre_otro_cliente: 'Por el nombre: el correo del cobro figura en la ficha de otro cliente',
};
const DEBILES = new Set(['nombre', 'nombre_otro_cliente', 'correo_parcial']);
const MOTIVOS = { misma_persona: 'misma persona', mismo_monto: 'mismo monto', otra_pasarela: 'en la otra pasarela' };

const FILTROS = [
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'monto_distinto', label: 'Monto distinto' },
    { key: 'sin_reportar', label: 'Sin reportar' },
    { key: 'sin_ingreso', label: 'Sin ingreso' },
    { key: 'coincide', label: 'Coinciden' },
    { key: 'revisadas', label: 'Revisadas' },
    { key: 'todas', label: 'Todas' },
];

export const REGLA = 'Una venta y un cobro van juntos si son de la misma persona y están a 3 días o menos (el reporte '
    + 'se carga cuando se cierra la venta, y en septiembre el cobro llegó hasta 31 h después). Misma persona: el '
    + 'mismo correo (el de la venta o el de su ficha), el correo cortado en el sistema, o dos palabras del nombre '
    + '(sin tildes; una letra de diferencia vale). Primero se busca el mismo monto, después dos o tres cobros que '
    + 'lo sumen (un pago partido) y al final la misma persona con otro monto (por nombre solo, hasta un 20 % de '
    + 'diferencia). Stripe viene en UTC y se pasa a UTC−3. Cada fila deja ver con qué más podría ir.';

/** Si la fila entra en el filtro de estado elegido. */
export const pasaFiltro = (fila, filtro) => {
    if (filtro === 'todas') return true;
    if (filtro === 'revisadas') return !!fila.revisada;
    if (filtro === 'pendientes') return fila.estado !== 'coincide' && !fila.revisada;
    if (filtro === 'coincide') return fila.estado === 'coincide';
    return fila.estado === filtro && !fila.revisada;
};

const normal = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const textoDeFila = (fila) => [
    fila.venta?.nombre, fila.venta?.email, fila.venta?.tipo_pago, fila.reportado, fila.ingresado,
    ...fila.movimientos.flatMap(m => [m.nombre, m.email, m.nota]),
].map(normal).join(' ');

const dia = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
const diaHora = (iso) => (iso ? `${dia(iso)} ${iso.slice(11, 16)}` : '—');
const nCobros = (n) => `${n} ${n === 1 ? 'cobro' : 'cobros'}`;
const esTransferencia = (medio) => normal(medio).includes('transfer');

/** Lo que dice el toast de un CSV subido. */
export const resumenDeCarga = (r) => {
    const nombre = r.archivo || 'El archivo';
    if (!r.nuevas) return `${nombre}: ya estaba subido (${nCobros(r.repetidas)} repetidos)`;
    return [`${nombre}: ${r.nuevas} ${r.nuevas === 1 ? 'cobro nuevo' : 'cobros nuevos'} de ${PASARELAS[r.pasarela]}`,
        r.repetidas ? `${r.repetidas} ya estaban` : null,
        r.omitidas ? `${r.omitidas} ${r.omitidas === 1 ? 'fila omitida' : 'filas omitidas'}` : null,
    ].filter(Boolean).join(' · ');
};

// ------------------------------------------------------------------------------------------------
// Piezas

/**
 * Un botón que pregunta en su lugar antes de corregir una venta («Usar $480.77», «Pasar a Hotmart»).
 * No es `InlineConfirm`: aquel es para borrar (tacho, deshacer diferido) y esto cambia un dato que
 * se puede volver a cambiar.
 */
const Confirmar = ({ etiqueta, pregunta, onConfirmar, icono = null }) => {
    const [fase, setFase] = useState('reposo');
    const quieto = useReducedMotion();
    if (fase === 'reposo') {
        return (
            <button type="button" className="btn btn--linea btn--sm fz-dif-accion" onClick={() => setFase('pregunta')}>
                {icono}{etiqueta}
            </button>
        );
    }
    const confirmar = async () => {
        setFase('guardando');
        try {
            await onConfirmar();
        } catch {
            // El aviso ya lo dio quien corrige: el botón vuelve a su lugar.
        } finally {
            setFase('reposo');
        }
    };
    return (
        <motion.span className="fz-dif-confirma" role="group" aria-label={pregunta}
            initial={quieto ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
            transition={quieto ? { duration: 0 } : { duration: 0.2, ease: [0.32, 0.72, 0, 1] }}>
            <small>{pregunta}</small>
            <button type="button" className="btn btn--linea btn--sm" disabled={fase === 'guardando'}
                onClick={() => setFase('reposo')}>No</button>
            <button type="button" className="btn btn--cta btn--sm" disabled={fase === 'guardando'} onClick={confirmar}>
                {fase === 'guardando' ? '…' : 'Sí'}
            </button>
        </motion.span>
    );
};

/** El campo de archivos, escondido: lo abren el botón «Subir CSV» y la zona de arrastre. */
const useElegirArchivos = (onArchivos) => {
    const input = useRef(null);
    const campo = (
        <input ref={input} type="file" accept=".csv,text/csv" multiple hidden aria-label="Archivos CSV"
            onChange={(e) => {
                const archivos = [...(e.target.files || [])];
                e.target.value = '';
                if (archivos.length) onArchivos(archivos);
            }} />
    );
    return [campo, () => input.current?.click()];
};

/** Sin ningún CSV en el período: la zona donde soltarlos, con lo que se puede subir. */
const ZonaDeCarga = ({ onArchivos, subiendo }) => {
    const [encima, setEncima] = useState(false);
    const [campo, elegir] = useElegirArchivos(onArchivos);
    return (
        <div className={`fz-dif-zona${encima ? ' fz-dif-zona--encima' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
            onDragLeave={() => setEncima(false)}
            onDrop={(e) => {
                e.preventDefault();
                setEncima(false);
                const archivos = [...(e.dataTransfer?.files || [])];
                if (archivos.length) onArchivos(archivos);
            }}>
            <span className="vacio-icono"><FileUp size={24} /></span>
            <p className="t-sm">Subí los CSV de Stripe y Hotmart del período para ver qué no cierra.</p>
            <p className="t-cap mut">
                Sirven los exports de cada pasarela y los de la planilla de conciliación (Stripe: fecha en UTC,
                Amount, Fee, Total, nombre y correo; Hotmart: fecha de venta, precio bruto, precio de la oferta,
                comisión, nombre y correo). Se pueden soltar acá.
            </p>
            <button type="button" className="btn btn--cta btn--sm" onClick={elegir} disabled={subiendo}>
                <FileUp /> {subiendo ? 'Subiendo…' : 'Elegir archivos'}
            </button>
            {campo}
        </div>
    );
};

/** Los archivos que no dicen de qué pasarela son: se elige y se vuelven a subir. */
const ElegirPasarela = ({ archivos, onElegir, onDescartar }) => archivos.map(archivo => (
    <div key={archivo.name} className="fz-dif-elegir" role="group" aria-label={`Pasarela de ${archivo.name}`}>
        <AlertTriangle aria-hidden="true" />
        <span className="fz-dif-elegir-txt">No se reconoce de qué pasarela es <b>{archivo.name}</b>.</span>
        {Object.entries(PASARELAS).map(([clave, label]) => (
            <button key={clave} type="button" className="btn btn--linea btn--sm" onClick={() => onElegir(archivo, clave)}>
                Es de {label}
            </button>
        ))}
        <button type="button" className="ibtn ibtn--sm" aria-label={`Descartar ${archivo.name}`} onClick={() => onDescartar(archivo)}>
            <X />
        </button>
    </div>
));

// ------------------------------------------------------------------------------------------------
// KPIs

const AYUDAS = {
    reportado: 'Las ventas completadas del período reportadas por Stripe o Hotmart, por su monto bruto: lo mismo que suma el Resumen antes de descontar la comisión. Solo de las pasarelas con CSV en el período.',
    ingresado: 'El bruto de los cobros de los CSV con fecha en el período: lo que pagó el cliente. El neto es lo que llegó, y la comisión, la real de la pasarela (Finanzas la estima en 4,5 % para Stripe y 8,9 % para Hotmart).',
    diferencia: 'Ingresado menos reportado. Positiva: entró más de lo que se reportó; negativa: se reportó algo que no entró. Se explica por las filas pendientes, las revisadas y las parejas con la venta o el cobro en otro período.',
    pendientes: 'Las filas que no coinciden y nadie marcó como revisadas.',
};

const partesDeLaDiferencia = (por) => {
    if (!por) return null;
    const partes = [
        Math.abs(por.pendientes) > 0.004 ? `${conSigno(por.pendientes)} pendientes` : null,
        Math.abs(por.revisadas) > 0.004 ? `${conSigno(por.revisadas)} revisadas` : null,
        Math.abs(por.otro_periodo) > 0.004 ? `${conSigno(por.otro_periodo)} de otro período` : null,
    ].filter(Boolean);
    return partes.length ? partes.join(' · ') : 'Todo coincide';
};

export const KpisDiferencias = ({ kpis }) => {
    const sinCsv = !kpis.con_csv;
    const p = kpis.pendientes;
    return (
        <div className="fz-grid fz-grid--4">
            <Cifron rotulo="Reportado" valor={dinero(kpis.reportado)} humo={HUMOS.marca} ayuda={AYUDAS.reportado}
                sub={`${kpis.ventas} ${kpis.ventas === 1 ? 'venta' : 'ventas'} en el sistema`} />
            <Cifron rotulo="Ingresado" valor={sinCsv ? '—' : dinero(kpis.ingresado)} tono={sinCsv ? undefined : 'success'}
                humo={HUMOS.ingreso} ayuda={`${AYUDAS.ingresado} Finanzas estima ${dinero(kpis.comision_estimada)} de comisión para lo reportado.`}
                sub={sinCsv ? 'Falta el CSV del período' : `Bruto · neto ${dinero(kpis.neto)} · comisión ${dinero(kpis.comision)}`} />
            <Cifron rotulo="Diferencia" valor={sinCsv ? '—' : conSigno(kpis.diferencia)}
                tono={sinCsv ? undefined : tonoDe(kpis.diferencia)} humo={HUMOS.info} ayuda={AYUDAS.diferencia}
                sub={sinCsv ? 'Sin CSV no hay con qué comparar' : partesDeLaDiferencia(kpis.diferencia_por)} />
            <Cifron rotulo="Pendientes" valor={String(p.total)} tono={p.total ? 'warning' : 'success'} humo={HUMOS.gasto}
                ayuda={AYUDAS.pendientes}
                sub={p.total ? `${p.monto_distinto} monto · ${p.sin_reportar} sin reportar · ${p.sin_ingreso} sin ingreso`
                    : `Nada pendiente${kpis.revisadas ? ` · ${kpis.revisadas} revisadas` : ''}`} />
        </div>
    );
};

// ------------------------------------------------------------------------------------------------
// La fila y su detalle

/** Corregir a mano la venta reportada: monto, fecha y medio (con a quién, si pasa a transferencia). */
const EditorVenta = ({ fila, opciones, onCorregir }) => {
    const venta = fila.venta;
    const [monto, setMonto] = useState(String(venta.monto));
    const [fecha, setFecha] = useState(venta.fecha.slice(0, 10));
    const [medio, setMedio] = useState(venta.metodo_pago || '');
    const [quien, setQuien] = useState('');
    const [error, setError] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const medios = opciones?.medios || [];
    const conActual = medios.some(m => m.clave === venta.metodo_pago) || !venta.metodo_pago
        ? medios : [{ clave: venta.metodo_pago, label: venta.metodo_pago }, ...medios];
    const cobro = fila.movimientos[0];

    const cambios = {};
    if (monto.trim() !== '' && Number(monto) !== venta.monto) cambios.monto = Number.isFinite(Number(monto)) ? Number(monto) : monto;
    if (fecha && fecha !== venta.fecha.slice(0, 10)) cambios.fecha = fecha;
    if (medio && medio !== venta.metodo_pago) cambios.metodo_pago = medio;
    if (esTransferencia(medio) && quien) cambios.transferido_a = quien;
    const hayCambios = Object.keys(cambios).length > 0;

    const guardar = async () => {
        setGuardando(true);
        setError(null);
        try {
            await onCorregir(venta.id, cambios, 'Venta corregida');
        } catch (e) {
            setError(e?.response?.data?.error || 'No se pudo corregir la venta');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fz-dif-editor" role="group" aria-label={`Corregir la venta de ${venta.nombre || 'este cliente'}`}>
            <label className="fz-atr-campo">
                <small>Monto reportado</small>
                <span className="fz-monto">
                    <span aria-hidden="true">$</span>
                    <input type="number" inputMode="decimal" step="0.01" value={monto} aria-label="Monto reportado"
                        onChange={(e) => setMonto(e.target.value)} />
                </span>
            </label>
            <label className="fz-atr-campo">
                <small>Fecha</small>
                <input type="date" className="fz-select fz-dif-fecha" value={fecha} aria-label="Fecha de la venta"
                    onChange={(e) => setFecha(e.target.value)} />
            </label>
            <label className="fz-atr-campo">
                <small>Medio de pago</small>
                <select className="fz-select" value={medio} aria-label="Medio de pago" onChange={(e) => setMedio(e.target.value)}>
                    {conActual.map(m => <option key={m.clave} value={m.clave}>{m.label}</option>)}
                </select>
            </label>
            {esTransferencia(medio) && (
                <label className="fz-atr-campo">
                    <small>Se le hizo a</small>
                    <select className="fz-select" value={quien} aria-label="A quién se le hizo la transferencia"
                        onChange={(e) => setQuien(e.target.value)}>
                        <option value="">Elegí…</option>
                        {(opciones?.transferido_a || []).map(o => <option key={o.clave} value={o.clave}>{o.label}</option>)}
                    </select>
                </label>
            )}
            {cobro && (
                <span className="fz-dif-atajos">
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => setMonto(String(fila.ingresado))}>
                        Monto del cobro
                    </button>
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => setFecha(cobro.fecha.slice(0, 10))}>
                        Fecha del cobro
                    </button>
                </span>
            )}
            {error && <p className="fz-nota fz-dif-error"><AlertTriangle /><span>{error}</span></p>}
            <span className="fz-acciones">
                <button type="button" className="btn btn--cta btn--sm" disabled={!hayCambios || guardando} onClick={guardar}>
                    {guardando ? 'Guardando…' : 'Guardar corrección'}
                </button>
            </span>
        </div>
    );
};

const Detalle = ({ fila, opciones, onCorregir, onRevisar }) => {
    const quieto = useReducedMotion();
    const [nota, setNota] = useState(fila.revisada?.nota || '');
    const venta = fila.venta;
    return (
        <motion.div className="fz-dif-detalle" role="region" aria-label="Detalle de la diferencia"
            initial={quieto ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            transition={quieto ? { duration: 0 } : { duration: 0.22, ease: [0.32, 0.72, 0, 1] }}>
            <div className="fz-dif-lados">
                <div className="fz-dif-lado">
                    <small>Lo reportado</small>
                    {venta ? (
                        <p className="t-sm">
                            <b>{dinero(venta.monto)}</b> · {diaHora(venta.fecha)} · {venta.metodo_pago}
                            {venta.tipo_pago ? ` · ${venta.tipo_pago}` : ''}
                            {!venta.en_periodo && <span className="mut"> · de otro período</span>}
                        </p>
                    ) : <p className="t-sm mut">Ninguna venta en el sistema.</p>}
                </div>
                <div className="fz-dif-lado">
                    <small>Lo ingresado</small>
                    {fila.movimientos.length ? fila.movimientos.map(m => (
                        <p key={m.id} className="t-sm">
                            <b>{dinero(m.bruto)}</b> · {diaHora(m.fecha)} · {m.nombre || 'Sin nombre'}
                            {m.email ? ` · ${m.email}` : ''}
                            {m.bruto_desconocido
                                ? <span style={{ color: v('warning') }}> · sin precio bruto: se toma el neto</span>
                                : m.neto != null && <span className="mut"> · neto {dinero(m.neto)}</span>}
                            {!m.en_periodo && <span className="mut"> · de otro período</span>}
                            {m.nota && <span className="fz-dif-nota"> · «{m.nota}»</span>}
                        </p>
                    )) : <p className="t-sm mut">Ningún cobro en el CSV de {PASARELAS[fila.pasarela]}.</p>}
                </div>
            </div>
            {fila.identidad && DEBILES.has(fila.identidad) && (
                <p className="fz-nota fz-dif-aviso">
                    <AlertTriangle />
                    <span>
                        {IDENTIDADES[fila.identidad]}
                        {fila.identidad === 'nombre_otro_cliente' && fila.movimientos[0]?.cliente_nombre
                            ? ` (${fila.movimientos[0].cliente_nombre}).` : '.'}
                    </span>
                </p>
            )}
            {fila.candidatos.length > 0 && (
                <div className="fz-dif-candidatos">
                    <small>También podría ir con</small>
                    <ul>
                        {fila.candidatos.map(c => (
                            <li key={`${c.tipo}-${c.id}`} className="t-sm">
                                <span className="chip" style={{ '--c': v(c.motivo === 'otra_pasarela' ? 'brand-secondary' : 'info') }}>
                                    <span className="trunc">{MOTIVOS[c.motivo]}</span>
                                </span>
                                <span>
                                    {c.tipo === 'venta' ? 'Venta' : 'Cobro'} de {c.nombre || 'sin nombre'} · <b>{dinero(c.monto)}</b>
                                    {' '}· {dia(c.fecha)} · {PASARELAS[c.pasarela]}
                                    {c.ocupado && <span className="mut"> · ya está en otra fila</span>}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {venta && <EditorVenta fila={fila} opciones={opciones} onCorregir={onCorregir} />}
            {fila.estado !== 'coincide' && !fila.revisada && (
                <div className="fz-dif-revisar">
                    <label className="fz-atr-campo fz-dif-campo-nota">
                        <small>Nota de la revisión (opcional)</small>
                        <input className="fz-select" value={nota} maxLength={500} placeholder="Ej: redondeo de la pasarela"
                            aria-label="Nota de la revisión" onChange={(e) => setNota(e.target.value)} />
                    </label>
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => onRevisar(fila, true, nota)}>
                        <Check /> Marcar como revisada
                    </button>
                </div>
            )}
            {fila.revisada && (
                <p className="fz-nota">
                    <Check />
                    <span>
                        Revisada por {fila.revisada.por || 'alguien'} el {dia(fila.revisada.at)}
                        {fila.revisada.nota ? ` · «${fila.revisada.nota}»` : ''}
                    </span>
                </p>
            )}
        </motion.div>
    );
};

const COLS = { '--cols': 'minmax(118px,.7fr) minmax(170px,1.5fr) 120px 132px 108px minmax(232px,1.25fr)', '--min': '980px' };

const FilaDiferencia = ({ fila, abierta, onAbrir, onCorregir, onRevisar, onFicha }) => {
    const estado = ESTADOS[fila.estado];
    const venta = fila.venta;
    const cobros = fila.movimientos;
    const nombre = venta?.nombre || cobros[0]?.nombre || 'Sin nombre';
    const email = venta?.email || cobros[0]?.email;
    const pendiente = fila.estado !== 'coincide' && !fila.revisada;
    const sugerencia = fila.sugerencia;

    let principal = null;
    if (pendiente && fila.estado === 'monto_distinto') {
        principal = (
            <Confirmar etiqueta={`Usar ${dinero(fila.ingresado)}`} pregunta={`¿Poner ${dinero(fila.ingresado)}?`}
                onConfirmar={() => onCorregir(venta.id, { monto: fila.ingresado }, `Venta corregida a ${dinero(fila.ingresado)}`)} />
        );
    } else if (pendiente && sugerencia) {
        principal = (
            <Confirmar etiqueta={`Pasar a ${sugerencia.metodo_pago}`} icono={<ArrowRightLeft />}
                pregunta={`¿La venta fue por ${sugerencia.metodo_pago}?`}
                onConfirmar={() => onCorregir(sugerencia.venta_id, { metodo_pago: sugerencia.metodo_pago },
                    `La venta pasó a ${sugerencia.metodo_pago}`)} />
        );
    } else if (pendiente && fila.estado === 'sin_reportar') {
        principal = fila.cliente_id ? (
            <button type="button" className="btn btn--linea btn--sm fz-dif-accion"
                onClick={() => onFicha(fila.cliente_id, 'pagos')}>
                <User /> Agregar pago
            </button>
        ) : (
            <span className="chip fz-dif-sin-cliente" style={{ '--c': v('text-muted') }}
                title="El correo del cobro no es de ningún cliente del sistema: hay que cargar la venta.">
                <span className="trunc">Sin cliente</span>
            </span>
        );
    }

    return (
        <div className={`fz-fila fz-dif-fila${abierta ? ' fz-fila--abierta' : ''}${fila.revisada ? ' fz-dif-revisada' : ''}`}>
            <span className="fz-dif-estado">
                {fila.revisada ? (
                    <span className="chip" style={{ '--c': v('text-muted') }} title={`${estado.label}, revisada`}>
                        <Check /><span className="trunc">Revisada</span>
                    </span>
                ) : (
                    <span className="chip" style={{ '--c': v(estado.tono) }}><span className="trunc">{estado.label}</span></span>
                )}
            </span>
            <span className="fz-dif-nom">
                <b title={nombre}>{nombre}</b>
                <span className="fz-dif-sub" title={[email, PASARELAS[fila.pasarela], fila.identidad && IDENTIDADES[fila.identidad]].filter(Boolean).join(' · ')}>
                    {PASARELAS[fila.pasarela]}{email ? ` · ${email}` : ''}
                    {fila.identidad && DEBILES.has(fila.identidad) && <span className="fz-dif-debil"> · por nombre</span>}
                </span>
            </span>
            <span className="fz-dif-monto">
                {venta ? (
                    <>
                        <b className="fz-n">{dinero(venta.monto)}</b>
                        <span className="fz-dif-sub" title={venta.tipo_pago || ''}>
                            {dia(venta.fecha)}{venta.en_periodo ? '' : ' · otro mes'}
                        </span>
                    </>
                ) : <b className="fz-n mut40">—</b>}
            </span>
            <span className="fz-dif-monto">
                {cobros.length ? (
                    <>
                        <b className="fz-n">{dinero(fila.ingresado)}</b>
                        <span className="fz-dif-sub">
                            {cobros.length > 1 ? `${dia(cobros[0].fecha)} · ${nCobros(cobros.length)}`
                                : `${dia(cobros[0].fecha)}${cobros[0].en_periodo ? '' : ' · otro mes'}`}
                        </span>
                    </>
                ) : <b className="fz-n mut40">—</b>}
            </span>
            <span className="fz-n fz-der" style={{ color: v(tonoDe(fila.diferencia)) }}>{conSigno(fila.diferencia)}</span>
            <span className="fz-acciones fz-dif-acciones">
                {principal}
                {fila.cliente_id && !(pendiente && fila.estado === 'sin_reportar' && !sugerencia) && (
                    <button type="button" className="ibtn ibtn--sm" title="Abrir la ficha del cliente"
                        aria-label={`Abrir la ficha de ${nombre}`} onClick={() => onFicha(fila.cliente_id, null)}>
                        <User />
                    </button>
                )}
                {pendiente && (
                    <button type="button" className="ibtn ibtn--sm" title="Marcar como revisada"
                        aria-label={`Marcar como revisada la diferencia de ${nombre}`} onClick={() => onRevisar(fila, true)}>
                        <Check />
                    </button>
                )}
                {fila.revisada && (
                    <button type="button" className="ibtn ibtn--sm" title="Volver a pendientes"
                        aria-label={`Volver a pendientes la diferencia de ${nombre}`} onClick={() => onRevisar(fila, false)}>
                        <RotateCcw />
                    </button>
                )}
                <button type="button" className="ibtn ibtn--sm fz-dif-abrir" aria-expanded={abierta}
                    title={abierta ? 'Cerrar el detalle' : 'Ver el detalle y corregir'}
                    aria-label={`${abierta ? 'Cerrar' : 'Ver'} el detalle de ${nombre}`} onClick={onAbrir}>
                    {venta ? <Pencil /> : <ChevronDown />}
                </button>
            </span>
        </div>
    );
};

// ------------------------------------------------------------------------------------------------
// Las cargas

const Cargas = ({ cargas, pasarelas, onBorrar, onSubir, subiendo }) => {
    const [campo, elegir] = useElegirArchivos(onSubir);
    return (
        <section className="panel">
            <PanelCab titulo="CSV subidos"
                tip="Cada archivo subido, con los cobros que trajo. Volver a subir el mismo (o uno que se pisa con otro) no duplica nada: las filas que ya estaban se cuentan como repetidas. Borrar una carga saca los cobros que entraron con ella.">
                <button type="button" className="pastilla" onClick={elegir} disabled={subiendo}>
                    <FileUp size={14} /><span>{subiendo ? 'Subiendo…' : 'Subir CSV'}</span>
                </button>
                {campo}
            </PanelCab>
            <div className="fz-dif-cobertura">
                {Object.entries(PASARELAS).map(([clave, label]) => {
                    const p = pasarelas[clave];
                    return (
                        <span key={clave} className="chip" style={{ '--c': v(p?.con_csv ? 'success' : 'text-muted') }}>
                            <span className="trunc">
                                {label} · {p?.con_csv ? `${nCobros(p.movimientos)} del ${dia(p.desde)} al ${dia(p.hasta)}` : 'sin CSV en el período'}
                            </span>
                        </span>
                    );
                })}
            </div>
            {cargas.length ? (
                <div className="fz-scroll">
                    <div className="fz-tabla" style={{ '--cols': 'minmax(170px,1.4fr) 150px 120px minmax(150px,1fr) 44px', '--min': '680px' }}>
                        <div className="fz-cab">
                            <span>Archivo</span><span>Cobros</span><span>Fechas</span><span>Subido</span><span />
                        </div>
                        {cargas.map(c => (
                            <div key={c.id} className={`fz-fila${c.en_periodo ? '' : ' fz-dif-otra-carga'}`}>
                                <span className="fz-dif-nom">
                                    <b title={c.archivo || ''}>{c.archivo || 'Sin nombre'}</b>
                                    <span className="fz-dif-sub">{PASARELAS[c.pasarela]}{c.en_periodo ? '' : ' · fuera del período'}</span>
                                </span>
                                <span className="fz-dif-nom">
                                    <b className="num">{nCobros(c.movimientos)}</b>
                                    <span className="fz-dif-sub">
                                        {[c.repetidas ? `${c.repetidas} repetidas` : null, c.omitidas ? `${c.omitidas} omitidas` : null]
                                            .filter(Boolean).join(' · ') || 'Todas nuevas'}
                                    </span>
                                </span>
                                <span className="num mut">{c.desde ? `${dia(c.desde)} – ${dia(c.hasta)}` : '—'}</span>
                                <span className="fz-dif-sub" title={c.subido_por || ''}>
                                    {c.subido_por || 'Alguien'} · {dia(c.subido_at)}
                                </span>
                                <span className="fz-acciones">
                                    <InlineConfirm tema="oscuro" compacto alto={32} tamIcono={13}
                                        label={`Borrar la carga ${c.archivo || ''}`.trim()} question="¿Borrar?" confirmLabel="Sí"
                                        doneLabel="Borrada" onConfirm={() => onBorrar(c)} />
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : <p className="fz-vacio">Todavía no se subió ningún CSV.</p>}
        </section>
    );
};

// ------------------------------------------------------------------------------------------------

const Diferencias = ({ periodo }) => {
    const [datos, setDatos] = useState(null);
    const [pasarela, setPasarela] = useState('todas');
    const [filtro, setFiltro] = useState('pendientes');
    const [buscar, setBuscar] = useState('');
    const [abierta, setAbierta] = useState(null);
    const [ficha, setFicha] = useState(null);       // {clientId, seccion}
    const [subiendo, setSubiendo] = useState(false);
    const [porElegir, setPorElegir] = useState([]); // archivos sin pasarela reconocida
    const pedido = useRef(0);

    // Solo la respuesta del último pedido llega a la pantalla: una corrección rápida tras otra no
    // deja la tabla con la conciliación de antes.
    const cargar = useCallback(async () => {
        const n = ++pedido.current;
        try {
            const respuesta = await apiFz.getConciliacion(periodo);
            if (n === pedido.current) setDatos(respuesta);
        } catch {
            if (n === pedido.current) toast.error('No se pudo cargar la conciliación');
        }
    }, [periodo]);
    useEffect(() => { cargar(); }, [cargar]);

    const subir = async (archivos, elegida = null) => {
        setSubiendo(true);
        const sinPasarela = [];
        for (const archivo of archivos) {
            try {
                toast.success(resumenDeCarga(await apiFz.subirCsv(archivo, elegida)));
            } catch (e) {
                const cuerpo = e?.response?.data;
                if (cuerpo?.codigo === 'pasarela') sinPasarela.push(archivo);
                else toast.error(`${archivo.name}: ${cuerpo?.error || 'no se pudo subir'}`);
            }
        }
        setPorElegir(lista => [...lista.filter(a => !archivos.includes(a)), ...sinPasarela]);
        setSubiendo(false);
        await cargar();
    };

    const corregir = async (ventaId, cambios, aviso) => {
        try {
            const r = await apiFz.corregirVenta(ventaId, cambios);
            toast.success(aviso || 'Venta corregida');
            await cargar();
            return r;
        } catch (e) {
            toast.error(e?.response?.data?.error || 'No se pudo corregir la venta');
            throw e;
        }
    };

    const revisar = async (fila, revisada, nota = '') => {
        try {
            await apiFz.marcarRevisada(fila.clave, revisada, revisada ? { estado: fila.estado, nota } : {});
            toast.success(revisada ? 'Diferencia marcada como revisada' : 'La diferencia volvió a pendientes');
            await cargar();
        } catch {
            toast.error('No se pudo guardar la revisión');
        }
    };

    const borrarCarga = async (carga) => {
        try {
            await apiFz.borrarCarga(carga.id);
            await cargar();
        } catch {
            toast.error('No se pudo borrar la carga');
        }
    };

    if (!datos) return <EsqueletoTablero rotulo="Cargando las diferencias…" />;

    const kpis = datos.kpis[pasarela] || datos.kpis.todas;
    const conCsv = Object.values(datos.pasarelas).some(p => p.con_csv);
    const dePasarela = datos.filas.filter(f => pasarela === 'todas' || f.pasarela === pasarela);
    const texto = normal(buscar);
    const visibles = dePasarela.filter(f => pasaFiltro(f, filtro) && (!texto || textoDeFila(f).includes(texto)));
    const opcionesPasarela = [{ key: 'todas', label: 'Todas' }, ...Object.entries(PASARELAS).map(([key, label]) => ({ key, label }))];
    const opcionesFiltro = FILTROS.map(f => ({ ...f, cuenta: dePasarela.filter(x => pasaFiltro(x, f.key)).length }));

    let vacio = null;
    if (!dePasarela.length) {
        vacio = pasarela !== 'todas' && !datos.pasarelas[pasarela]?.con_csv
            ? `No hay CSV de ${PASARELAS[pasarela]} en este período.`
            : 'No hay ventas por Stripe o Hotmart ni cobros en este período.';
    } else if (!visibles.length) {
        vacio = texto ? `Ninguna fila coincide con «${buscar.trim()}».`
            : filtro === 'pendientes' ? 'Nada pendiente: lo reportado y lo ingresado cierran.'
                : 'Ninguna fila en este estado.';
    }

    return (
        <>
            <KpisDiferencias kpis={kpis} />

            <section className="panel">
                <PanelCab titulo="Lo reportado contra lo ingresado" tip={REGLA}>
                    {conCsv && (
                        <label className="busca busca--sm fz-dif-busca">
                            <Search aria-hidden="true" />
                            <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)}
                                placeholder="Buscar cliente, correo, monto…" aria-label="Buscar en las diferencias" />
                        </label>
                    )}
                </PanelCab>
                <ElegirPasarela archivos={porElegir} onElegir={(archivo, clave) => subir([archivo], clave)}
                    onDescartar={(archivo) => setPorElegir(lista => lista.filter(a => a !== archivo))} />
                {!conCsv ? <ZonaDeCarga onArchivos={(a) => subir(a)} subiendo={subiendo} /> : (
                    <>
                        <div className="fz-dif-filtros">
                            <Segmented chico opciones={opcionesPasarela} valor={pasarela} onChange={setPasarela}
                                ariaLabel="Pasarela" />
                            <Segmented chico opciones={opcionesFiltro} valor={filtro} onChange={setFiltro}
                                ariaLabel="Estado de las filas" />
                        </div>
                        <div className="fz-scroll">
                            <div className="fz-tabla" style={COLS}>
                                <div className="fz-cab">
                                    <span>Estado</span>
                                    <span>Cliente</span>
                                    <span>Reportado</span>
                                    <span>Ingresado</span>
                                    <span className="fz-der">Diferencia</span>
                                    <span className="fz-der">Corregir</span>
                                </div>
                                {visibles.map(fila => (
                                    <React.Fragment key={fila.clave}>
                                        <FilaDiferencia fila={fila} abierta={abierta === fila.clave}
                                            onAbrir={() => setAbierta(a => (a === fila.clave ? null : fila.clave))}
                                            onCorregir={corregir} onRevisar={revisar}
                                            onFicha={(clientId, seccion) => setFicha({ clientId, seccion })} />
                                        {abierta === fila.clave && (
                                            <Detalle fila={fila} opciones={datos.opciones}
                                                onCorregir={corregir} onRevisar={revisar} />
                                        )}
                                    </React.Fragment>
                                ))}
                                {vacio && <p className="fz-vacio">{vacio}</p>}
                            </div>
                        </div>
                    </>
                )}
            </section>

            <Cargas cargas={datos.cargas} pasarelas={datos.pasarelas} onBorrar={borrarCarga}
                onSubir={(a) => subir(a)} subiendo={subiendo} />

            {/* En un portal: la `.vista` anima a sus hijos con `transform`, y un `fixed` adentro de
                uno de ellos queda atado a esa caja en vez de a la ventana. */}
            {ficha && createPortal(
                <FichaLeadModal clientId={ficha.clientId} pestanaInicial="hist" seccionInicial={ficha.seccion}
                    onCerrar={() => setFicha(null)} onCambio={cargar} />,
                document.body,
            )}
        </>
    );
};

export default Diferencias;
