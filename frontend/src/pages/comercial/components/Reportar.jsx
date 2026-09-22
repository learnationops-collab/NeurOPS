import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Cargando, Chip, fmt, Segmented } from './Shared';
import { getReporteHoy, getReportes, guardarReporte } from '../comercialApi';

/**
 * Reportar: el reporte diario del director comercial, en cuatro pasos, más el historial.
 *
 * Una cosa a la vez: el paso 3 pregunta por UNA persona y avanza sola; el paso 4 trabaja una
 * lista por vez. El único CTA de la pantalla es "Guardar reporte".
 *
 * El borrador vive en localStorage por fecha (incluida la marca de "revisada" del paso 1, que es
 * una lista de control del propio director dentro de una sentada, no un dato del negocio). Si se
 * recarga la página a mitad del reporte, no se pierde nada.
 */

const LISTAS = [
    { key: 'victorias', label: 'Victorias del día', tono: 'success', pregunta: '¿Qué salió bien hoy?' },
    { key: 'mejoras', label: 'A mejorar', tono: 'warning', pregunta: '¿Qué hay que mejorar?' },
    { key: 'proximos', label: 'Próximos días', tono: 'info', pregunta: '¿Qué querés trabajar en los próximos días?' },
];

const PASOS = ['El día', 'Grupal', 'Individual', 'Cierre'];

const claveBorrador = (fecha) => `neurops.reporte-director.${fecha}`;

const borradorVacio = () => ({
    grupal: { closers: '', setters: '' },
    individual: {},
    listas: { victorias: [], mejoras: [], proximos: [] },
    revisadas: {},
});

const leerBorrador = (fecha) => {
    try {
        const crudo = localStorage.getItem(claveBorrador(fecha));
        return crudo ? { ...borradorVacio(), ...JSON.parse(crudo) } : borradorVacio();
    } catch {
        return borradorVacio();
    }
};

const Stepper = ({ paso, setPaso, completos, bloqueado }) => (
    <div className="dc-stepper">
        {PASOS.map((label, i) => {
            const hecho = completos[i];
            const deshabilitado = i === 3 && bloqueado;
            return (
                <button key={label} type="button" className="dc-step" aria-current={paso === i}
                    disabled={deshabilitado} onClick={() => !deshabilitado && setPaso(i)}>
                    <span className={`dc-step-num${hecho && paso !== i ? ' dc-step-num--done' : ''}`}>
                        {hecho && paso !== i ? <Check size={12} /> : i + 1}
                    </span>
                    <span>{label}</span>
                </button>
            );
        })}
    </div>
);

/** Paso 1: los números del día y una fila por persona, que abre su modal. */
const PasoDia = ({ dia, revisadas, onRevisar, irAPersona }) => {
    const [abierta, setAbierta] = useState(null);
    const persona = dia.personas.find(p => p.id === abierta);
    const revisados = dia.personas.filter(p => revisadas[p.id]).length;

    return (
        <>
            <div className="dc-grid-2" style={{ marginTop: 0 }}>
                <div className="ln-panel ln-panel--sm">
                    <div className="dc-eyebrow" style={{ marginBottom: 14 }}>Closers</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 12 }}>
                        {[['Agendas', dia.closers.agendas, null], ['Asistieron', dia.closers.asistieron, 'var(--success)'],
                        ['Ventas', dia.closers.ventas, 'var(--brand-secondary)'], ['Cash', fmt.money(dia.closers.cash), null]]
                            .map(([label, valor, color]) => (
                                <div key={label}>
                                    <div className="dc-total-label">{label}</div>
                                    <div className="dc-total-value" style={{ color }}>{valor}</div>
                                </div>
                            ))}
                    </div>
                </div>
                <div className="ln-panel ln-panel--sm">
                    <div className="dc-eyebrow" style={{ marginBottom: 14 }}>Setters</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 12 }}>
                        {[['Leads', dia.setters.leads, null], ['Mensajes', dia.setters.mensajes, 'var(--info)'],
                        ['Respuesta', fmt.pct(dia.setters.respuesta), null],
                        ['Agendas', dia.setters.agendas, 'var(--success)']].map(([label, valor, color]) => (
                            <div key={label}>
                                <div className="dc-total-label">{label}</div>
                                <div className="dc-total-value" style={{ color }}>{valor}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="ln-panel" style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                    <span className="dc-eyebrow">Equipo</span>
                    <span className="ln-t-caption ln-muted dc-num">
                        {revisados} de {dia.personas.length} revisados
                    </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dia.personas.map(p => (
                        <button key={p.id} type="button" className="dc-person-row" onClick={() => setAbierta(p.id)}>
                            <span className={`dc-avatar${p.grupo === 'setters' ? ' dc-avatar--info' : ''}`}>
                                {fmt.iniciales(p.nombre)}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span className="dc-cell-main" style={{ display: 'block' }}>{p.nombre}</span>
                                <span className="dc-cell-sub dc-num">{p.resumen}</span>
                            </span>
                            <Chip chip={p.estado} sm />
                            <span className={`dc-go${revisadas[p.id] ? ' dc-go--done' : ''}`}>
                                {revisadas[p.id] ? <Check size={14} /> : <ArrowRight size={14} />}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {persona && (
                <div className="dc-scrim" onClick={(e) => { if (e.target === e.currentTarget) setAbierta(null); }}>
                    <div className="dc-modal dc-modal--sm" role="dialog" aria-modal="true">
                        <div className="dc-modal-head">
                            <div style={{ display: 'flex', gap: 14 }}>
                                <span className={`dc-avatar dc-avatar--lg${persona.grupo === 'setters' ? ' dc-avatar--info' : ''}`}>
                                    {fmt.iniciales(persona.nombre)}
                                </span>
                                <div>
                                    <h3 className="ln-t-h3">{persona.nombre}</h3>
                                    <p className="ln-t-caption ln-muted dc-num" style={{ marginTop: 4 }}>
                                        {persona.grupo === 'setters' ? 'Setter' : 'Closer'} · {persona.resumen}
                                    </p>
                                </div>
                            </div>
                            <Chip chip={persona.estado} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {persona.actividad.length === 0 && (
                                <p className="ln-t-body-sm ln-muted-40">Sin actividad registrada hoy.</p>
                            )}
                            {persona.actividad.map((a, i) => (
                                <div key={i} className="dc-person-row" style={{ cursor: 'default' }}>
                                    <span className="dc-num ln-muted" style={{ width: 44 }}>{a.hora}</span>
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                        <span className="dc-cell-main" style={{ display: 'block' }}>{a.cliente}</span>
                                        <span className="dc-cell-sub">{a.detalle}</span>
                                    </span>
                                    <Chip chip={a.chip} sm />
                                </div>
                            ))}
                        </div>

                        <div className="dc-foot">
                            <button type="button" className="ln-btn ln-btn--ghost ln-btn--sm"
                                onClick={() => { setAbierta(null); irAPersona(persona); }}>
                                Ver en Revisar
                            </button>
                            <button type="button" className="ln-btn ln-btn--secondary ln-btn--sm"
                                onClick={() => { onRevisar(persona.id); setAbierta(null); }}>
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

/** Paso 2: un textarea por grupo. Sin chips de temas ni textos de ayuda. */
const PasoGrupal = ({ borrador, setBorrador }) => (
    <div className="dc-grid-2" style={{ marginTop: 0 }}>
        {[['closers', 'Closers', '¿Qué trabajaste hoy con todos los closers?'],
        ['setters', 'Setters', '¿Qué trabajaste hoy con todos los setters?']].map(([key, titulo, placeholder]) => (
            <div key={key} className="ln-panel ln-panel--sm">
                <div className="dc-eyebrow" style={{ marginBottom: 12 }}>{titulo}</div>
                <textarea className="dc-textarea" placeholder={placeholder} value={borrador.grupal[key]}
                    onChange={(e) => setBorrador({ ...borrador, grupal: { ...borrador.grupal, [key]: e.target.value } })} />
            </div>
        ))}
    </div>
);

/** Paso 3: de a una persona. "No" avanza sola; "Sí" abre el textarea. */
const PasoIndividual = ({ dia, borrador, setBorrador, indice, setIndice }) => {
    const personas = dia.personas;
    const persona = personas[indice] || personas[0];
    if (!persona) return <p className="ln-t-body-sm ln-muted">No hay nadie activo en el equipo.</p>;

    const respuesta = borrador.individual[persona.id];
    const respondidas = personas.filter(p => borrador.individual[p.id] !== undefined).length;

    const responder = (trabajo) => {
        const siguiente = { ...borrador.individual, [persona.id]: { trabajo, texto: trabajo ? (respuesta?.texto || '') : '' } };
        setBorrador({ ...borrador, individual: siguiente });
        if (!trabajo) {
            const proxima = personas.findIndex((p, i) => i > indice && siguiente[p.id] === undefined);
            setIndice(proxima >= 0 ? proxima : indice);
        }
    };

    const avanzar = () => {
        const proxima = personas.findIndex((p, i) => i > indice && borrador.individual[p.id] === undefined);
        if (proxima >= 0) setIndice(proxima);
        else {
            const cualquiera = personas.findIndex(p => borrador.individual[p.id] === undefined);
            if (cualquiera >= 0) setIndice(cualquiera);
        }
    };

    return (
        <div className="dc-col">
            <div className="dc-initials-row">
                {personas.map((p, i) => {
                    const r = borrador.individual[p.id];
                    return (
                        <button key={p.id} type="button" className="dc-initial" aria-current={i === indice}
                            data-answer={r === undefined ? undefined : r.trabajo ? 'si' : 'no'}
                            onClick={() => setIndice(i)}>
                            {fmt.iniciales(p.nombre)}
                        </button>
                    );
                })}
                <span className="ln-t-caption ln-muted dc-num" style={{ marginLeft: 'auto' }}>
                    {respondidas} de {personas.length}
                </span>
            </div>

            <div className="ln-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                    <span className={`dc-avatar dc-avatar--lg${persona.grupo === 'setters' ? ' dc-avatar--info' : ''}`}>
                        {fmt.iniciales(persona.nombre)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 className="ln-t-h3">{persona.nombre}</h3>
                        <p className="ln-t-caption ln-muted dc-num" style={{ marginTop: 4 }}>
                            {persona.grupo === 'setters' ? 'Setter' : 'Closer'} · {persona.resumen}
                        </p>
                    </div>
                    <Chip chip={persona.estado} sm />
                </div>

                <p className="ln-t-body" style={{ marginBottom: 14 }}>
                    ¿Trabajaste algo específico con {persona.nombre}?
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="dc-yesno" data-tone="success"
                        aria-pressed={respuesta?.trabajo === true} onClick={() => responder(true)}>Sí</button>
                    <button type="button" className="dc-yesno" data-tone="idle"
                        aria-pressed={respuesta?.trabajo === false} onClick={() => responder(false)}>No</button>
                </div>

                {respuesta?.trabajo && (
                    <>
                        <textarea className="dc-textarea" style={{ marginTop: 16 }} placeholder="¿Qué trabajaron?"
                            value={respuesta.texto}
                            onChange={(e) => setBorrador({
                                ...borrador,
                                individual: { ...borrador.individual, [persona.id]: { trabajo: true, texto: e.target.value } },
                            })} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                            <button type="button" className="ln-btn ln-btn--tertiary ln-btn--sm" onClick={avanzar}>
                                {respondidas === personas.length ? 'Listo' : 'Siguiente persona'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

/** Paso 4: una lista por vez, con hasta dos sugerencias sacadas de los datos del día. */
const PasoCierre = ({ dia, borrador, setBorrador, lista, setLista }) => {
    const [drafts, setDrafts] = useState({});
    const actual = LISTAS[lista];
    const items = borrador.listas[actual.key];
    const sugerencias = (dia.sugerencias[actual.key] || []).filter(s => !items.includes(s));

    const agregar = (texto) => {
        const limpio = (texto || '').trim();
        if (!limpio || items.includes(limpio)) return;
        setBorrador({ ...borrador, listas: { ...borrador.listas, [actual.key]: [...items, limpio] } });
        setDrafts({ ...drafts, [actual.key]: '' });
    };

    const quitar = (texto) => setBorrador({
        ...borrador,
        listas: { ...borrador.listas, [actual.key]: items.filter(i => i !== texto) },
    });

    return (
        <div className="dc-col">
            <Segmented ariaLabel="Lista del cierre" valor={actual.key}
                opciones={LISTAS.map((l, i) => ({
                    key: l.key,
                    label: `${l.label}${borrador.listas[l.key].length ? ` · ${borrador.listas[l.key].length}` : ''}`,
                    idx: i,
                }))}
                onChange={(k) => setLista(LISTAS.findIndex(l => l.key === k))} />

            <div className="ln-panel" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {items.length === 0 && (
                        <p className="ln-t-body-sm ln-muted-40">Todavía no anotaste nada acá.</p>
                    )}
                    {items.map(item => (
                        <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="dc-dot" style={{ background: `var(--${actual.tono})` }} />
                            <span className="ln-t-body-sm" style={{ flex: 1 }}>{item}</span>
                            <button type="button" className="ln-iconbtn" style={{ width: 28, height: 28 }}
                                onClick={() => quitar(item)} aria-label="Quitar">
                                <X size={13} />
                            </button>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <input className="dc-input" placeholder={actual.pregunta} value={drafts[actual.key] || ''}
                        onChange={(e) => setDrafts({ ...drafts, [actual.key]: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(drafts[actual.key]); } }} />
                    <button type="button" className="ln-btn ln-btn--tertiary" style={{ height: 44 }}
                        onClick={() => agregar(drafts[actual.key])} aria-label="Agregar">
                        <Plus size={16} />
                    </button>
                </div>

                {sugerencias.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                        {sugerencias.slice(0, 2).map(s => (
                            <button key={s} type="button" className="dc-suggest" onClick={() => agregar(s)}>
                                + {s}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const Historial = ({ miembros, nuevoId }) => {
    const [quien, setQuien] = useState('todo');
    const [datos, setDatos] = useState(null);
    const [abierto, setAbierto] = useState(nuevoId || null);

    useEffect(() => {
        let vivo = true;
        setDatos(null);
        getReportes(quien === 'todo' ? null : quien)
            .then(d => { if (vivo) setDatos(d); })
            .catch(() => { if (vivo) setDatos({ reportes: [] }); });
        return () => { vivo = false; };
    }, [quien]);

    const opciones = [{ id: 'todo', nombre: 'Todo' }, ...miembros];

    return (
        <>
            <div style={{ marginBottom: 16 }}>
                <div className="dc-total-label" style={{ marginBottom: 8 }}>Ver registro de</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {opciones.map(o => (
                        <button key={o.id} type="button" className="dc-chip-btn" aria-pressed={quien === o.id}
                            onClick={() => setQuien(o.id)}>
                            {o.nombre}
                        </button>
                    ))}
                </div>
            </div>

            {!datos ? <Cargando /> : datos.reportes.length === 0 ? (
                <div className="ln-empty">
                    <p className="ln-empty-title">Todavía no hay reportes</p>
                    <p className="ln-empty-desc">El primero que guardes aparece acá.</p>
                </div>
            ) : quien !== 'todo' ? (
                <div className="ln-panel">
                    <h3 className="ln-t-h3">Registro de trabajo · {opciones.find(o => o.id === quien)?.nombre}</h3>
                    <p className="ln-t-caption ln-muted" style={{ marginTop: 6 }}>
                        Trabajo individual en {datos.trabajados} de {datos.total} días reportados
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
                        {datos.dias.map(d => (
                            <div key={d.fecha} className="dc-hist-box">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                    <span className="dc-cell-main">{fmt.fechaLarga(d.fecha)}</span>
                                    <span className={`ln-chip ln-chip--sm ln-chip--${d.trabajo ? 'success' : 'idle'}`}>
                                        {d.trabajo ? 'Trabajaron' : 'No hizo falta'}
                                    </span>
                                </div>
                                {d.texto && <p className="ln-t-body-sm ln-muted" style={{ marginTop: 8 }}>{d.texto}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {datos.reportes.map(r => {
                        const individuales = r.individual.filter(p => p.trabajo).length;
                        const desplegado = abierto === r.id;
                        return (
                            <div key={r.id} className="ln-panel ln-panel--sm">
                                <button type="button" className="dc-hist-card" style={{ padding: 0, border: 0, background: 'none' }}
                                    onClick={() => setAbierto(desplegado ? null : r.id)}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                        <span>
                                            <span className="dc-cell-main">{fmt.fechaLarga(r.fecha)}</span>
                                            {r.id === nuevoId && <span className="ln-chip ln-chip--sm ln-chip--info" style={{ marginLeft: 8 }}>Nuevo</span>}
                                            <span className="dc-cell-sub dc-num">
                                                {individuales} individuales · {r.listas.victorias.length} victorias
                                                · {r.listas.mejoras.length} a mejorar
                                            </span>
                                        </span>
                                        <span className="ln-t-caption ln-accent">{desplegado ? 'Ocultar' : 'Ver'}</span>
                                    </div>
                                </button>

                                {desplegado && (
                                    <>
                                        <div className="dc-hist-cols">
                                            <div>
                                                <div className="dc-total-label" style={{ marginBottom: 10 }}>Grupal</div>
                                                {[['Equipo de closers', r.grupal.closers], ['Equipo de setters', r.grupal.setters]]
                                                    .map(([t, texto]) => (
                                                        <div key={t} style={{ marginBottom: 12 }}>
                                                            <div className="ln-t-caption ln-accent">{t}</div>
                                                            <p className="ln-t-body-sm ln-muted" style={{ marginTop: 4 }}>
                                                                {texto || '—'}
                                                            </p>
                                                        </div>
                                                    ))}
                                            </div>
                                            <div>
                                                <div className="dc-total-label" style={{ marginBottom: 10 }}>Individual</div>
                                                {r.individual.map(p => (
                                                    <div key={p.miembro_id} style={{ marginBottom: 10 }}>
                                                        <div className="ln-t-caption ln-accent">{p.nombre}</div>
                                                        <p className={`ln-t-body-sm ${p.trabajo ? 'ln-muted' : 'ln-muted-40'}`}
                                                            style={{ marginTop: 4 }}>
                                                            {p.trabajo ? p.texto : 'No hizo falta'}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="dc-hist-cols">
                                            {LISTAS.map(l => (
                                                <div key={l.key} className="dc-hist-box">
                                                    <div className="dc-total-label" style={{ color: `var(--${l.tono})` }}>
                                                        {l.label}
                                                    </div>
                                                    {r.listas[l.key].length === 0 && (
                                                        <p className="ln-t-caption ln-muted-40" style={{ marginTop: 6 }}>—</p>
                                                    )}
                                                    {r.listas[l.key].map(i => (
                                                        <p key={i} className="ln-t-body-sm ln-muted" style={{ marginTop: 6 }}>• {i}</p>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
};

const Reportar = ({ tab, setTab, miembros, irAPersona, onStepper }) => {
    const [dia, setDia] = useState(null);
    const [paso, setPaso] = useState(0);
    const [indice, setIndice] = useState(0);
    const [lista, setLista] = useState(0);
    const [borrador, setBorrador] = useState(borradorVacio);
    const [guardando, setGuardando] = useState(false);
    const [nuevoId, setNuevoId] = useState(null);

    useEffect(() => {
        getReporteHoy().then(d => {
            setDia(d);
            setBorrador(leerBorrador(d.fecha));
        }).catch(() => toast.error('No se pudo cargar el día del equipo'));
    }, []);

    useEffect(() => {
        if (!dia) return;
        try {
            localStorage.setItem(claveBorrador(dia.fecha), JSON.stringify(borrador));
        } catch {
            /* modo privado o cuota llena: el reporte sigue funcionando, solo no se guarda el borrador */
        }
    }, [borrador, dia]);

    const personas = dia?.personas || [];
    const faltan = personas.filter(p => borrador.individual[p.id] === undefined).length;

    const completos = useMemo(() => [
        personas.length > 0 && personas.every(p => borrador.revisadas[p.id]),
        Boolean(borrador.grupal.closers.trim() || borrador.grupal.setters.trim()),
        personas.length > 0 && faltan === 0,
        false,
    ], [personas, borrador, faltan]);

    useEffect(() => {
        if (onStepper) {
            onStepper(tab === 'reporte' && dia
                ? <Stepper paso={paso} setPaso={setPaso} completos={completos} bloqueado={faltan > 0} />
                : null);
        }
    }, [tab, dia, paso, completos, faltan, onStepper]);

    const guardar = async () => {
        setGuardando(true);
        try {
            const datos = {
                fecha: dia.fecha,
                grupal: borrador.grupal,
                individual: personas
                    .filter(p => borrador.individual[p.id] !== undefined)
                    .map(p => ({ miembro_id: p.id, ...borrador.individual[p.id] })),
                listas: borrador.listas,
            };
            const guardado = await guardarReporte(datos);
            setNuevoId(guardado.id);
            try { localStorage.removeItem(claveBorrador(dia.fecha)); } catch { /* ver arriba */ }
            setBorrador(borradorVacio());
            setPaso(0);
            setTab('historial');
            toast.success(`Reporte del ${fmt.fechaLarga(dia.fecha)} guardado`);
        } catch {
            toast.error('No se pudo guardar el reporte');
        } finally {
            setGuardando(false);
        }
    };

    if (tab === 'historial') return <Historial miembros={miembros} nuevoId={nuevoId} />;
    if (!dia) return <Cargando texto="Cargando el día del equipo…" />;

    const atras = () => {
        if (paso === 3 && lista > 0) setLista(lista - 1);
        else setPaso(Math.max(0, paso - 1));
    };
    const siguiente = () => {
        if (paso === 3 && lista < LISTAS.length - 1) setLista(lista + 1);
        else if (paso < 3) setPaso(paso + 1);
    };
    const esUltimo = paso === 3 && lista === LISTAS.length - 1;
    const bloqueado = paso === 2 && faltan > 0;

    return (
        <>
            {paso === 0 && (
                <PasoDia dia={dia} revisadas={borrador.revisadas} irAPersona={irAPersona}
                    onRevisar={(id) => setBorrador({ ...borrador, revisadas: { ...borrador.revisadas, [id]: true } })} />
            )}
            {paso === 1 && <PasoGrupal borrador={borrador} setBorrador={setBorrador} />}
            {paso === 2 && (
                <PasoIndividual dia={dia} borrador={borrador} setBorrador={setBorrador}
                    indice={indice} setIndice={setIndice} />
            )}
            {paso === 3 && (
                <PasoCierre dia={dia} borrador={borrador} setBorrador={setBorrador}
                    lista={lista} setLista={setLista} />
            )}

            <div className="dc-foot">
                <button type="button" className="ln-btn ln-btn--tertiary ln-btn--sm" disabled={paso === 0 && true}
                    style={paso === 0 ? { visibility: 'hidden' } : undefined} onClick={atras}>
                    Atrás
                </button>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {bloqueado && <span className="ln-t-caption ln-muted-40">Faltan {faltan}</span>}
                    {esUltimo ? (
                        <button type="button" className="ln-btn ln-btn--cta ln-btn--sm" disabled={guardando}
                            onClick={guardar}>
                            {guardando ? 'Guardando…' : 'Guardar reporte'}
                        </button>
                    ) : (
                        <button type="button" className="ln-btn ln-btn--secondary ln-btn--sm" disabled={bloqueado}
                            onClick={siguiente}>
                            Siguiente
                        </button>
                    )}
                </span>
            </div>
        </>
    );
};

export default Reportar;
