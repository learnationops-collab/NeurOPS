import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarClock, CheckCircle2, CopyCheck, Info, Loader2, Phone, RotateCcw } from 'lucide-react';
import api from '../../../../services/api';
import Modal from '../../../../components/ui/Modal';
import { parseUtcIso } from '../../../../utils/datetime';

/**
 * «Duplicados» de la tabla Agendas de Revisar (10/10/2026): el panel de agendas repetidas del libro
 * viejo de Operaciones (`AgendasDuplicadosModal`, en `FinancialAgendasPage`), ahora como herramienta
 * de Revisar (ver `operacion.js`).
 *
 * El motor es el mismo y no se reimplementó (`app/services/agenda_dedup_service.py`, rutas en
 * `app/api/public/financial_agendas_dedup.py`): agrupa por mail, instagram o teléfono las agendas
 * del espejo de n8n/Calendly (`FinancialAgenda`), sugiere cuál conservar y marca las otras con
 * `duplicada_de_id`, sin borrar nada. Revisar en cambio lista citas (`Appointment`), con otros ids:
 * por eso el panel no parte de las filas de la lista sino del PERÍODO de Revisar, por fecha de
 * reunión, que es la base con la que Revisar cuenta las agendas.
 *
 * Al resolver con «cancelar citas» (cada grupo trae su casilla, prendida por defecto como en el
 * panel viejo), la cita de cada agenda descartada se cancela (`result` 'Cancelado'), así que en
 * Revisar sale de las vigentes y queda en «Descartadas». Restaurar devuelve la agenda al libro y la
 * cita a su pre call de antes, si nadie la tocó después. Todo es reversible desde la pestaña
 * «Descartadas» del panel: por eso resolver no pide confirmación; resolver todos de una, sí.
 */

// Color por motivo: primero lo que casi seguro sobra.
const ESTILO_MOTIVO = {
    duplicado_del_webhook: 'bg-rose-500/15 text-rose-200 border-rose-500/30',
    reprogramacion: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
    volvio_a_agendar: 'bg-slate-500/15 text-slate-300 border-slate-600/40',
};

const dos = (n) => String(n).padStart(2, '0');
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * `10/09 15:00` en el reloj de quien mira. Las fechas de las agendas llegan en UTC y sin zona
 * (`isoformat()`): leídas tal cual, una reunión de las 9 en La Paz se veía a las 13 (el panel viejo
 * las leía así). `parseUtcIso` es la conversión de la ficha y de Revisar.
 */
const cuando = (iso, { conHora = true } = {}) => {
    const d = parseUtcIso(iso);
    if (!d) return '—';
    const dia = `${dos(d.getDate())}/${dos(d.getMonth() + 1)}`;
    return conHora ? `${dia} ${dos(d.getHours())}:${dos(d.getMinutes())}` : dia;
};

/** `2026-10-01` → `01/10`. Los límites del período son días, no instantes: sin conversión de zona. */
const dia = (ymd) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}` : '');

/**
 * Los filtros de `GET …/duplicados` para el período de Revisar. Esa ruta reusa los del libro viejo
 * (`_build_agenda_queries`): `start_date`/`end_date` en `YYYY-MM-DD` y `date_filter_by`, que va
 * siempre en `meet` (la reunión), no en la creación.
 */
export const filtrosDelPeriodo = (fechas) => {
    const desde = fechas?.start ? String(fechas.start).slice(0, 10) : null;
    const hasta = fechas?.end ? String(fechas.end).slice(0, 10) : null;
    if (!desde) return null;
    return { start_date: desde, ...(hasta ? { end_date: hasta } : {}), date_filter_by: 'meet' };
};

const mensajeDe = (e, porDefecto) => e?.response?.data?.error || porDefecto;

const Pastilla = ({ children, className = 'border-slate-700 bg-slate-800/70 text-slate-300' }) => (
    <small className={`shrink-0 rounded-md border px-1.5 py-px text-[10px] font-bold ${className}`}>
        {children}
    </small>
);

/** Una agenda del grupo: se toca para elegir que sea la que se conserva. */
const Opcion = ({ agenda, elegida, sugerida, onElegir, deshabilitada }) => (
    <button type="button" role="radio" aria-checked={elegida} disabled={deshabilitada} onClick={onElegir}
        className={`w-full cursor-pointer rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${
            elegida
                ? 'border-emerald-500/45 bg-emerald-500/10'
                : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
        }`}>
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${elegida ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <b className="text-[13px] text-slate-100 tabular-nums">#{agenda.id}</b>
                <Pastilla>{agenda.estado}</Pastilla>
                {agenda.fuente && <Pastilla className="border-slate-700 bg-slate-950/60 text-slate-400">{agenda.fuente}</Pastilla>}
                {sugerida && <Pastilla className="border-emerald-500/35 bg-emerald-500/10 text-emerald-200">Sugerida</Pastilla>}
            </span>
            <small className={`text-[10px] font-black uppercase tracking-widest ${elegida ? 'text-emerald-300' : 'text-slate-500'}`}>
                {elegida ? 'Se conserva' : 'Se descarta'}
            </small>
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] font-medium text-slate-400 tabular-nums">
            <span className="flex items-center gap-1.5">
                <CalendarClock size={12} aria-hidden="true" /> Reunión {cuando(agenda.date)}
            </span>
            <span>Closer {agenda.closer || '—'}</span>
            <span>Alta {cuando(agenda.created_at, { conHora: false })}</span>
            {agenda.appointment_id && (
                <span className="flex items-center gap-1.5">
                    <Phone size={11} aria-hidden="true" /> Llamada #{agenda.appointment_id}
                    {agenda.cita_cancelada ? ' · ya cancelada' : ''}
                </span>
            )}
        </span>
    </button>
);

const Grupo = ({ grupo, elegida, cancelar, onElegir, onCancelar, onResolver, ocupado, resolviendo, reducido, orden }) => {
    const lead = grupo.agendas[0]?.lead || 'Sin nombre';
    const aDescartar = grupo.agendas.length - 1;
    return (
        <motion.section aria-label={`Grupo de ${lead}`}
            className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50"
            {...(reducido ? {} : {
                layout: 'position',
                initial: { opacity: 0, y: 8 },
                animate: { opacity: 1, y: 0 },
                // Escalonado, con techo: con 60 grupos el último no puede tardar dos segundos.
                transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: Math.min(orden, 8) * 0.03 },
            })}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/70 px-4 py-3">
                <span className="min-w-0">
                    <b className="block truncate text-[14px] text-white" title={lead}>{lead}</b>
                    {grupo.detalle && <small className="mt-0.5 block text-[11px] text-slate-400">{grupo.detalle}</small>}
                </span>
                <small className={`shrink-0 rounded-lg border px-2.5 py-1 text-[9.5px] font-black uppercase tracking-widest ${
                    ESTILO_MOTIVO[grupo.motivo] || ESTILO_MOTIVO.volvio_a_agendar}`}>
                    {grupo.etiqueta || 'Repetida'}
                </small>
            </div>

            <div role="radiogroup" aria-label={`Cuál se conserva de ${lead}`} className="grid gap-2 p-3">
                {grupo.agendas.map(a => (
                    <Opcion key={a.id} agenda={a} elegida={a.id === elegida}
                        sugerida={a.id === grupo.conservar_sugerida_id}
                        onElegir={() => onElegir(a.id)} deshabilitada={ocupado} />
                ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-3">
                <label className="flex min-w-0 cursor-pointer items-center gap-2 text-[12px] font-semibold text-slate-300">
                    <input type="checkbox" checked={cancelar} disabled={ocupado}
                        onChange={(e) => onCancelar(e.target.checked)} className="h-4 w-4 accent-rose-500" />
                    {aDescartar === 1
                        ? 'Cancelar también la cita de la que se descarta'
                        : `Cancelar también las citas de las ${aDescartar} que se descartan`}
                </label>
                <button type="button" disabled={ocupado} onClick={onResolver}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-white shadow-lg shadow-rose-600/20 transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300">
                    {resolviendo && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                    <small className="text-[10.5px] font-black uppercase tracking-widest">Resolver</small>
                </button>
            </div>
        </motion.section>
    );
};

/** Lo que ya se descartó (de cualquier período), para deshacerlo. */
const Descartadas = ({ filas, onRestaurar, trabajando }) => {
    if (filas === null) {
        return (
            <p className="flex items-center justify-center gap-3 py-14 text-[13px] text-slate-400">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Cargando…
            </p>
        );
    }
    if (filas.length === 0) {
        return <p className="py-14 text-center text-[13px] text-slate-400">Todavía no se descartó ninguna agenda.</p>;
    }
    return (
        <>
            <small className="block text-[11.5px] text-slate-400">
                Las últimas descartadas, de cualquier período. Restaurar vuelve a poner la agenda en el libro y su
                llamada como estaba, si nadie la tocó después.
            </small>
            <ul className="grid gap-2" aria-label="Agendas descartadas">
                {filas.map(a => (
                    <li key={a.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                        <span className="min-w-0">
                            <b className="block truncate text-[13px] text-slate-100">#{a.id} · {a.lead || 'Sin nombre'}</b>
                            <small className="mt-0.5 block text-[11px] text-slate-400 tabular-nums">
                                {[`Reunión ${cuando(a.date)}`, a.closer, `se conservó la #${a.duplicada_de_id}`,
                                    a.descartada_por && `por ${a.descartada_por}`].filter(Boolean).join(' · ')}
                            </small>
                        </span>
                        <button type="button" disabled={!!trabajando} onClick={() => onRestaurar(a)}
                            aria-label={`Restaurar #${a.id}`}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-200 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                            {trabajando === `r${a.id}`
                                ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                                : <RotateCcw size={12} aria-hidden="true" />}
                            <small className="text-[10px] font-black uppercase tracking-widest">Restaurar</small>
                        </button>
                    </li>
                ))}
            </ul>
        </>
    );
};

export const PanelDuplicados = ({ fechas, onCerrar, onHecho }) => {
    const reducido = useReducedMotion();
    const filtros = filtrosDelPeriodo(fechas);
    const desde = filtros?.start_date || null;
    const hasta = filtros?.end_date || null;

    const [pestana, setPestana] = useState('pendientes');
    // Lo que respondió el último pedido de grupos, con la clave del pedido: si el período cambia o
    // se vuelve a pedir (`vuelta`, después de restaurar), lo cargado deja de valer solo, sin
    // limpiarlo a mano dentro del efecto.
    const [vuelta, setVuelta] = useState(0);
    const pedido = desde ? `${desde}|${hasta || ''}|${vuelta}` : null;
    const [cargado, setCargado] = useState(null); // { pedido, datos } o { pedido, error }
    const vigenteCargado = cargado && cargado.pedido === pedido ? cargado : null;
    const datos = vigenteCargado?.datos || null;
    const [errorAccion, setError] = useState(null);
    const error = errorAccion || vigenteCargado?.error || null;
    const [conservar, setConservar] = useState({});   // clave del grupo -> id que se conserva
    const [sinCancelar, setSinCancelar] = useState({}); // clave del grupo -> true si NO se cancelan citas
    const [descartadas, setDescartadas] = useState(null);
    const [trabajando, setTrabajando] = useState(null); // clave del grupo, 'todos' o `r${id}`
    const [confirmarTodos, setConfirmarTodos] = useState(false);
    const [hechos, setHechos] = useState({ descartadas: 0, restauradas: 0 });

    // Los grupos del período. Se piden por las fechas (texto) y no por el objeto `fechas`: Revisar
    // lo recrea en cada recarga (la que dispara `onHecho`) y sin esto cada resolución pediría todo.
    useEffect(() => {
        if (!pedido) return undefined;
        let vigente = true;
        api.get('/public/financial-agendas/duplicados', { params: filtrosDelPeriodo({ start: desde, end: hasta }) })
            .then((res) => {
                if (!vigente) return;
                setCargado({ pedido, datos: res.data });
                setConservar(Object.fromEntries((res.data.grupos || []).map(g => [g.clave, g.conservar_sugerida_id])));
            })
            .catch((e) => {
                if (vigente) setCargado({ pedido, error: mensajeDe(e, 'No se pudieron cargar los duplicados.') });
            });
        return () => { vigente = false; };
    }, [pedido, desde, hasta]);

    useEffect(() => {
        if (pestana !== 'descartadas' || descartadas !== null) return undefined;
        let vigente = true;
        api.get('/public/financial-agendas/duplicados/descartadas')
            .then((res) => { if (vigente) setDescartadas(res.data || []); })
            .catch((e) => {
                if (!vigente) return;
                setDescartadas([]);
                setError(mensajeDe(e, 'No se pudieron cargar las descartadas.'));
            });
        return () => { vigente = false; };
    }, [pestana, descartadas]);

    const grupos = datos?.grupos || [];
    // «Resolver todos» toma solo los grupos que el motor sugiere descartar. Los de «Volvió a agendar»
    // suelen ser dos llamadas de verdad (la anterior ya se resolvió): esos se deciden uno por uno.
    const sugeridos = grupos.filter(g => g.sugiere_descartar);
    const ocupado = trabajando !== null;

    /** Resuelve un grupo con la conservada elegida. Devuelve cuántas agendas descartó. */
    const resolverGrupo = async (grupo) => {
        const conservadaId = conservar[grupo.clave] ?? grupo.conservar_sugerida_id;
        const descartarIds = grupo.agendas.map(a => a.id).filter(id => id !== conservadaId);
        await api.post('/public/financial-agendas/duplicados/resolver', {
            conservada_id: conservadaId,
            descartar_ids: descartarIds,
            cancelar_citas: !sinCancelar[grupo.clave],
        });
        return descartarIds.length;
    };

    const terminar = (claves, cuantas) => {
        if (!claves.length) return;
        setCargado(prev => (prev?.datos ? {
            ...prev, datos: { ...prev.datos, grupos: prev.datos.grupos.filter(g => !claves.includes(g.clave)) },
        } : prev));
        setHechos(h => ({ ...h, descartadas: h.descartadas + cuantas }));
        // Lo que se acaba de descartar tiene que aparecer en su pestaña: se vuelve a pedir al abrirla.
        setDescartadas(null);
        onHecho?.();
    };

    const resolver = async (grupo) => {
        setTrabajando(grupo.clave);
        setError(null);
        try {
            terminar([grupo.clave], await resolverGrupo(grupo));
        } catch (e) {
            setError(mensajeDe(e, 'No se pudo resolver el grupo.'));
        } finally {
            setTrabajando(null);
        }
    };

    // De a un grupo por pedido: la ruta resuelve uno por vez y revalida en el servidor que las
    // descartadas sean del mismo lead. Si uno falla se corta ahí, y lo ya resuelto queda resuelto.
    const resolverTodos = async () => {
        setTrabajando('todos');
        setError(null);
        const listos = [];
        let cuantas = 0;
        try {
            for (const grupo of sugeridos) {
                cuantas += await resolverGrupo(grupo);
                listos.push(grupo.clave);
            }
        } catch (e) {
            setError(mensajeDe(e, 'No se pudieron resolver todos.'));
        } finally {
            terminar(listos, cuantas);
            setTrabajando(null);
            setConfirmarTodos(false);
        }
    };

    const restaurar = async (agenda) => {
        setTrabajando(`r${agenda.id}`);
        setError(null);
        try {
            await api.post('/public/financial-agendas/duplicados/restaurar', { agenda_ids: [agenda.id] });
            setDescartadas(prev => (prev || []).filter(a => a.id !== agenda.id));
            setHechos(h => ({ ...h, restauradas: h.restauradas + 1 }));
            // La restaurada puede volver a formar grupo: los de «Por resolver» se piden de nuevo.
            setVuelta(v => v + 1);
            onHecho?.();
        } catch (e) {
            setError(mensajeDe(e, 'No se pudo restaurar.'));
        } finally {
            setTrabajando(null);
        }
    };

    const resumen = [
        hechos.descartadas > 0 && `${plural(hechos.descartadas, 'agenda descartada', 'agendas descartadas')}`,
        hechos.restauradas > 0 && `${plural(hechos.restauradas, 'restaurada', 'restauradas')}`,
    ].filter(Boolean).join(' · ');

    const pestanas = [
        ['pendientes', `Por resolver${datos ? ` (${grupos.length})` : ''}`],
        ['descartadas', 'Descartadas'],
    ];

    return (
        <Modal ancho="4xl" titulo="Agendas repetidas" onCerrar={onCerrar} cerrable={!ocupado}
            icono={<CopyCheck size={18} className="text-rose-300" />}
            subtitulo={desde
                ? `El mismo lead agendado más de una vez · reuniones del ${dia(desde)}${hasta && hasta !== desde ? ` al ${dia(hasta)}` : ''}`
                : 'El mismo lead agendado más de una vez'}
            cuerpoClassName="grid gap-4 content-start"
            barra={(
                <div role="tablist" aria-label="Duplicados" className="flex flex-wrap items-center gap-2">
                    {pestanas.map(([id, label]) => (
                        <button key={id} type="button" role="tab" aria-selected={pestana === id}
                            onClick={() => setPestana(id)}
                            className={`cursor-pointer rounded-xl border px-4 py-2 transition-colors ${
                                pestana === id
                                    ? 'border-rose-500/40 bg-rose-600/20 text-white'
                                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                            }`}>
                            <small className="text-[10px] font-black uppercase tracking-widest">{label}</small>
                        </button>
                    ))}
                </div>
            )}
            pie={(
                <>
                    <small className="mr-auto text-[11px] font-semibold text-slate-400">
                        {resumen ? `${resumen} en esta sesión` : 'Nada resuelto todavía'}
                    </small>
                    <button type="button" onClick={onCerrar} disabled={ocupado}
                        className="cursor-pointer rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 text-slate-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                        <small className="text-xs font-black uppercase tracking-widest">Cerrar</small>
                    </button>
                </>
            )}>
            {error && (
                <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-[12.5px] font-semibold text-rose-200">
                    {error}
                </p>
            )}

            {pestana === 'pendientes' && !desde && (
                <p className="py-14 text-center text-[13px] text-slate-400">
                    Elegí un período en Revisar para buscar las agendas repetidas.
                </p>
            )}

            {pestana === 'pendientes' && desde && !datos && !error && (
                <p className="flex items-center justify-center gap-3 py-14 text-[13px] text-slate-400">
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Buscando repetidas…
                </p>
            )}

            {pestana === 'pendientes' && datos && grupos.length === 0 && (
                <div className="grid justify-items-center gap-2 py-12 text-center">
                    <CheckCircle2 size={28} className="text-emerald-400" aria-hidden="true" />
                    <p className="text-[14px] font-bold text-slate-200">
                        {hechos.descartadas > 0 ? 'Listo, no queda nada por resolver.' : 'No hay agendas repetidas en este período.'}
                    </p>
                    <small className="text-[11px] text-slate-400">Se busca entre las reuniones del período de Revisar.</small>
                </div>
            )}

            {pestana === 'pendientes' && grupos.length > 0 && (
                <>
                    {datos.hay_mas && (
                        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-[12px] font-semibold text-amber-200">
                            Hay más grupos de los que entran acá. Acotá el período de Revisar para revisarlos por tramos.
                        </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                        <small className="flex min-w-0 flex-1 items-start gap-2 text-[11.5px] leading-snug text-slate-400">
                            <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                            <span>
                                Se puede deshacer desde «Descartadas». Cancelar la cita no toca Calendly: la invitación
                                del lead se cancela desde ahí.
                            </span>
                        </small>
                        {confirmarTodos ? (
                            <span className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar resolver todos">
                                <small className="text-[11.5px] font-semibold text-slate-200">
                                    {`¿Resolver ${plural(sugeridos.length, 'grupo', 'grupos')} conservando la marcada en cada uno?`}
                                </small>
                                <button type="button" disabled={ocupado} onClick={resolverTodos}
                                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-white transition-colors hover:bg-rose-500 disabled:opacity-40">
                                    {trabajando === 'todos' && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                                    <small className="text-[10px] font-black uppercase tracking-widest">Sí, resolver</small>
                                </button>
                                <button type="button" disabled={ocupado} onClick={() => setConfirmarTodos(false)}
                                    className="cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-slate-300 hover:text-white disabled:opacity-40">
                                    <small className="text-[10px] font-black uppercase tracking-widest">No</small>
                                </button>
                            </span>
                        ) : (
                            <button type="button" disabled={ocupado || sugeridos.length === 0}
                                onClick={() => setConfirmarTodos(true)}
                                title={sugeridos.length === 0
                                    ? 'Los que quedan parecen dos llamadas de verdad: se resuelven uno por uno.'
                                    : undefined}
                                className="cursor-pointer rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-100 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40">
                                <small className="text-[10px] font-black uppercase tracking-widest">Resolver todos con la sugerida</small>
                            </button>
                        )}
                    </div>
                    {sugeridos.length < grupos.length && (
                        <small className="-mt-2 block text-[11px] text-slate-500">
                            «Resolver todos» deja afuera los de «Volvió a agendar»: suelen ser dos llamadas de verdad.
                        </small>
                    )}

                    {grupos.map((grupo, i) => (
                        <Grupo key={grupo.clave} grupo={grupo} orden={i} reducido={reducido}
                            elegida={conservar[grupo.clave] ?? grupo.conservar_sugerida_id}
                            cancelar={!sinCancelar[grupo.clave]}
                            onElegir={(id) => setConservar(p => ({ ...p, [grupo.clave]: id }))}
                            onCancelar={(si) => setSinCancelar(p => ({ ...p, [grupo.clave]: !si }))}
                            onResolver={() => resolver(grupo)}
                            ocupado={ocupado}
                            resolviendo={trabajando === grupo.clave
                                || (trabajando === 'todos' && grupo.sugiere_descartar)} />
                    ))}
                </>
            )}

            {pestana === 'descartadas' && (
                <Descartadas filas={descartadas} onRestaurar={restaurar} trabajando={trabajando} />
            )}
        </Modal>
    );
};

/** La herramienta, tal como la registra `operacion.js`. */
export const HERRAMIENTA_DUPLICADOS = {
    id: 'duplicados', label: 'Duplicados', Icono: CopyCheck, Panel: PanelDuplicados,
};

const duplicados = { agendas: { herramientas: [HERRAMIENTA_DUPLICADOS] } };

export default duplicados;
