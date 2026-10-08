import React, { useEffect, useRef } from 'react';
import {
    ArrowDown, ArrowUpDown, CheckCircle2, XCircle, ChevronRight, X, Trash2, ShieldCheck, PenLine,
} from 'lucide-react';
import InlineConfirm from '../../../../components/ui/InlineConfirm';
import {
    APPS, ANCHO_MAX, ANCHO_MIN, ORDENES, AGRUPAR, appsOn, banda, expCorta, fechaCorta, haceTxt, horasDesde,
    minAncho, nivelIdioma, pideNum, plantillaCols,
} from '../lib/vista';
import { techoIA, soloDigitos as soloDigitosWa } from '../lib/escalas';
import { App, Bandera, Chip, ChipModalidad, Inicial, Puntos, Riel } from './Piezas';
import { VEREDICTO } from './comun';
import logoWhatsapp from '../assets/apps/whatsapp.png';

// La tabla de postulaciones: columnas que cada quien elige y estira, orden por
// columna, grupos opcionales y pie con lo que se está mostrando. No pide datos:
// recibe los grupos ya filtrados y ordenados (ver `lib/vista.js`).

// El techo de IA en una palabra: la columna es angosta y «Construyó herramientas» no entra.
const TECHO_CORTO = {
    'Construyó herramientas': 'Construye',
    'Creó GPTs propios': 'GPTs propios',
    'Prompts con contexto': 'Prompting',
    'Redacta/resume': 'Redacta',
    'Preguntas sueltas': 'Preguntas',
    'Casi no la usa': 'Casi no usa',
};

const EstadoChip = ({ veredicto }) => {
    const v = VEREDICTO[veredicto] || VEREDICTO.sin_analizar;
    return <Chip c={v.fg} chico>{v.label}</Chip>;
};

const Celda = ({ id, p, ctx }) => {
    switch (id) {
        case 'cand':
            return (
                <div className="tl-c-cand" role="cell">
                    <Inicial nombre={p.nombre} />
                    <div>
                        <span className="tl-c-nom trunc">{p.nombre}</span>
                        <span className="tl-c-sub">
                            <Bandera de={p.pais} />
                            <span className="trunc">{p.provincia || p.pais || '—'}</span>
                            <ChipModalidad modalidad={p.modalidad} />
                            {(ctx.conEstado || p.veredicto === 'incompleta') && <EstadoChip veredicto={p.veredicto} />}
                            {p.veredicto === 'incompleta' && typeof p.completitud === 'number' && (
                                <span className="num" title={`Completó el ${p.completitud} % del formulario`}>{p.completitud} %</span>
                            )}
                        </span>
                    </div>
                </div>
            );
        case 'fecha': {
            const h = horasDesde(p.created_at, ctx.ahora);
            return (
                <div className="tl-c-fecha" role="cell" title={fechaCorta(p.created_at)}>
                    <b>{h != null && h < 24 && <i aria-label="Nueva" />}{haceTxt(h)}</b>
                    <small>{fechaCorta(p.created_at)}</small>
                </div>
            );
        }
        case 'pide': {
            const pide = pideNum(p);
            const pasa = ctx.presMax && pide > ctx.presMax;
            return (
                <div className="tl-c-pide" role="cell" title={pasa ? `Pide más que el máximo de ${ctx.presMax} USD` : undefined}>
                    {pide ? (
                        <>
                            <b style={pasa ? { color: 'var(--warning)' } : undefined}>{pide}<small>USD</small></b>
                            <Riel pct={(pide / ((ctx.presMax || 400) * 1.3)) * 100} color={pasa ? 'var(--warning)' : 'var(--barra)'} />
                        </>
                    ) : <b className="mut40">—</b>}
                </div>
            );
        }
        case 'exp':
            return <div className="tl-c-txt" role="cell" title={p.experiencia || ''}>{expCorta(p.experiencia)}</div>;
        case 'ia': {
            const t = techoIA(p.ia_avanzado);
            return (
                <div className="tl-c-ia" role="cell" title={p.ia_avanzado || 'Sin respuesta'}>
                    <span style={{ color: t.n >= 3 ? 'var(--text-on-surface)' : 'var(--text-muted)' }}>{t.ok ? (TECHO_CORTO[t.label] || t.label) : '—'}</span>
                    <Puntos n={t.n} total={4} seg />
                </div>
            );
        }
        case 'idi': {
            const segundo = p.pais === 'Brasil' ? 'es' : 'Brasil';
            return (
                <div className="tl-c-idi" role="cell">
                    <span><Bandera de="en" titulo={`Inglés: ${p.ingles || 'sin respuesta'}`} /><Puntos n={nivelIdioma(p.ingles)} total={3} /></span>
                    <span>
                        <Bandera de={segundo} titulo={`${segundo === 'es' ? 'Español' : 'Portugués'}: ${p.idioma2 || 'sin respuesta'}`} />
                        <Puntos n={nivelIdioma(p.idioma2)} total={3} />
                    </span>
                </div>
            );
        }
        case 'apps': {
            if (ctx.modoDescarte) {
                const esBaja = p.veredicto === 'baja';
                const auto = !esBaja && !p.estado && (p.auto_ko || p.descartado);
                return (
                    <div role="cell">
                        <div className="tl-origen" title={esBaja ? `Baja: ${p.estado_motivo || 'sin motivo'}` : auto ? (p.motivo_descarte || 'Lo cortó el formulario por un excluyente') : 'Lo descartó un revisor'}>
                            <Chip chico c={esBaja || auto ? 'var(--error)' : 'var(--info)'} icono={esBaja ? Trash2 : auto ? ShieldCheck : PenLine}>
                                {esBaja ? 'Baja' : auto ? 'Automático' : 'Manual'}
                            </Chip>
                            <small>{esBaja ? (p.estado_motivo || 'Sin motivo') : auto ? 'Excluyente' : (p.revisado_por || 'Revisor')}</small>
                        </div>
                    </div>
                );
            }
            const on = appsOn(p);
            return (
                <div role="cell">
                    <div className="tl-c-apps">
                        {APPS.map((a) => <App key={a.id} img={a.img} titulo={a.t} apagada={!on[a.id]} />)}
                    </div>
                </div>
            );
        }
        case 'video':
            return (
                <div className={`cen ${p.video_ok ? 'tl-ok' : 'tl-no'}`} role="cell" title={p.video_ok ? 'Video verificado' : 'Sin video verificado'}>
                    {p.video_ok ? <CheckCircle2 size={19} /> : <XCircle size={19} />}
                </div>
            );
        case 'cv':
            return (
                <div className={`cen ${p.cv ? 'tl-ok' : 'tl-no'}`} role="cell" title={p.cv ? 'Adjuntó CV' : 'Sin CV'}>
                    {p.cv ? <CheckCircle2 size={19} /> : <XCircle size={19} />}
                </div>
            );
        case 'wa': {
            const digitos = soloDigitosWa(p.whatsapp);
            return (
                <div role="cell">
                    {digitos ? (
                        <a className="tl-wa" href={`https://wa.me/${digitos}`} target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()} title="Escribirle por WhatsApp">
                            <img src={logoWhatsapp} alt="" />
                            <span className="trunc">{String(p.whatsapp).replace(/^\+\d{2,3}\s*/, '')}</span>
                        </a>
                    ) : <span className="tl-c-txt mut40">Sin WhatsApp</span>}
                </div>
            );
        }
        case 'score':
            return (
                <div className="tl-c-score der" role="cell">
                    <b>{p.score ?? '—'}</b>
                    <Riel pct={p.score || 0} color={banda(p.score || 0)} />
                </div>
            );
        default:
            return null;
    }
};

/** Encabezado de una columna: botón de orden (si ordena) y tirador del ancho. */
const Encabezado = ({ col, etiqueta, orden, onOrden, onAncho, ancho }) => {
    const ref = useRef(null);
    const arrastre = useRef(null);
    const cls = `tl-th${col.cen ? ' cen' : col.der ? ' der' : ''}`;
    const activo = col.orden && orden.campo === col.orden;

    const empezar = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const th = ref.current;
        arrastre.current = { x: e.clientX, w: th.getBoundingClientRect().width };
        e.currentTarget.classList.add('activo');
        document.body.classList.add('tl-redim');
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* el navegador no lo soporta */ }
    };
    const mover = (e) => {
        if (!arrastre.current) return;
        const nuevo = Math.round(Math.max(ANCHO_MIN, Math.min(ANCHO_MAX, arrastre.current.w + e.clientX - arrastre.current.x)));
        onAncho(col.id, nuevo, false);
    };
    const soltar = (e) => {
        if (!arrastre.current) return;
        arrastre.current = null;
        e.currentTarget.classList.remove('activo');
        document.body.classList.remove('tl-redim');
        onAncho(col.id, null, true);
    };
    const teclado = (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const actual = ancho || ref.current.getBoundingClientRect().width;
        const paso = e.shiftKey ? 40 : 10;
        onAncho(col.id, Math.max(ANCHO_MIN, Math.min(ANCHO_MAX, Math.round(actual + (e.key === 'ArrowRight' ? paso : -paso)))), true);
    };

    return (
        <div className={cls} ref={ref} role="columnheader">
            {col.orden ? (
                <button type="button" onClick={() => onOrden(col.orden)}
                    aria-sort={activo ? (orden.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    title={`Ordenar por ${etiqueta.toLowerCase()}`}>
                    {etiqueta}{activo ? <ArrowDown /> : <ArrowUpDown />}
                </button>
            ) : <span>{etiqueta}</span>}
            <span
                className="tl-tir"
                role="separator"
                aria-orientation="vertical"
                aria-label={`Ancho de ${etiqueta}`}
                tabIndex={0}
                title="Arrastrá para cambiar el ancho · doble clic para restablecerlo"
                onPointerDown={empezar}
                onPointerMove={mover}
                onPointerUp={soltar}
                onPointerCancel={soltar}
                onDoubleClick={(e) => { e.stopPropagation(); onAncho(col.id, undefined, true); }}
                onKeyDown={teclado}
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
};

const TablaPostulaciones = ({
    grupos, cols, cfg, ctx, totalBase, onOrden, onAncho, onAbrir, onEliminar, onLimpiarFiltros, vacio, entra,
}) => {
    const n = grupos.reduce((a, g) => a + g.filas.length, 0);
    const ord = ORDENES.find((o) => o.id === cfg.orden.campo) || ORDENES[0];
    const etiquetaDe = (c) => (c.id === 'apps' && ctx.modoDescarte ? ctx.etiquetaDescarte : c.label);
    const tabla = useRef(null);

    // La animación de las barritas va solo al entrar a la vista, no al reordenar.
    useEffect(() => {
        const t = tabla.current;
        if (!t || !entra) return undefined;
        t.classList.add('entra');
        const id = setTimeout(() => t.classList.remove('entra'), 1100);
        return () => clearTimeout(id);
    }, [entra]);

    return (
        <div className="tl-tabla-scroll">
            <div
                ref={tabla}
                className="tl-tabla"
                role="table"
                aria-label="Postulaciones"
                style={{ '--cols': plantillaCols(cols, cfg.anchos), '--minw': `${minAncho(cols, cfg.anchos)}px` }}
            >
                <div className="tl-tcab" role="row">
                    {cols.map((c) => (
                        <Encabezado key={c.id} col={c} etiqueta={etiquetaDe(c)} orden={cfg.orden}
                            onOrden={onOrden} onAncho={onAncho} ancho={cfg.anchos[c.id]} />
                    ))}
                    <span />
                </div>

                {n === 0 && <div className="tl-vacio">{vacio}</div>}

                {grupos.map((gr) => (
                    <React.Fragment key={gr.g ? gr.g.id : 'todas'}>
                        {gr.g && (
                            <div className="tl-grupo" role="row">
                                {cfg.agrupar === 'pais' && <Bandera de={gr.g.label} />}
                                {gr.g.label}<b>{gr.filas.length}</b>
                            </div>
                        )}
                        {gr.filas.map((p) => (
                            <div
                                key={p.id}
                                className="tl-fila"
                                role="row"
                                tabIndex={0}
                                onClick={() => onAbrir(p.id)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onAbrir(p.id); }}
                            >
                                {cols.map((c) => <Celda key={c.id} id={c.id} p={p} ctx={ctx} />)}
                                <div className="tl-c-fin" role="cell">
                                    {onEliminar && (
                                        // Click y teclado se quedan acá: borrar no abre la postulación.
                                        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
                                        <div className="tl-borrar" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                            <InlineConfirm
                                                compacto
                                                alto={30}
                                                corner={15}
                                                tamIcono={14}
                                                title={`Eliminar la postulación de ${p.nombre}`}
                                                question="¿Borrar?"
                                                confirmLabel="Sí, borrar"
                                                doneLabel="Eliminada"
                                                onConfirm={() => onEliminar(p.id)}
                                            />
                                        </div>
                                    )}
                                    <ChevronRight size={18} className="tl-c-go" />
                                </div>
                            </div>
                        ))}
                    </React.Fragment>
                ))}

                <div className="tl-tpie">
                    Mostrando <b>{n}</b>{totalBase !== n && ` de ${totalBase}`}
                    <span className="sep" />
                    {`${ord.label} · ${ord.txt[cfg.orden.dir]}`}
                    {cfg.agrupar !== 'none' && (
                        <>
                            <span className="sep" />
                            Agrupado por {AGRUPAR.find((a) => a.id === cfg.agrupar)?.label.toLowerCase()}
                        </>
                    )}
                    {totalBase !== n && onLimpiarFiltros && (
                        <>
                            <span className="sep" />
                            <button type="button" className="btn btn--sm" style={{ height: 28, padding: '0 10px' }} onClick={onLimpiarFiltros}>
                                <X /> Quitar filtros
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TablaPostulaciones;
