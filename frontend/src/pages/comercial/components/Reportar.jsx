import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Plus, Trophy, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Cargando, fmt } from './Shared';
import { getConstancia, getReporteHoy, getReportes, guardarReporte } from '../comercialApi';

/**
 * Reportar: el reporte diario del director comercial, en cuatro pasos, más el historial.
 *
 * Una cosa a la vez. Cada paso tiene sus propias pantallas (`SUBPASOS`) y nunca se ve más de una:
 * el grupal pregunta por un equipo por vez, el individual por UNA persona ("No" avanza sola, sin
 * pedir respuesta) y el cierre por una lista por vez. El único CTA de la pantalla es "Guardar
 * reporte", y hasta que no esté no hay nada más que apretar.
 *
 * El paso 1 no es un formulario: es la lista de control del director sobre datos que ya existen.
 * Por eso bloquea el resto del reporte hasta que las N personas estén revisadas, y por eso la
 * marca de "revisada" NO tiene tabla — vive en el borrador de `localStorage`, junto con el resto
 * de lo escrito, con clave por fecha. Las escrituras van en `try/catch`: en modo privado el
 * reporte sigue funcionando, solo no se guarda el borrador.
 *
 * El stepper, el día que se revisa y la navegación se pintan en la barra del header (`onStepper`),
 * no dentro del contenido: el cuerpo es la pregunta y nada más.
 */

const PASOS = ['El día', 'Grupal', 'Individual', 'Cierre'];
/** Cuántas pantallas tiene cada paso. Es lo que hace que "Siguiente" no salte de tema. */
const SUBPASOS = [1, 2, 1, 3];

const GRUPOS = [
    { key: 'setters', label: 'Setters', pregunta: '¿Qué trabajaste hoy con todos los setters?' },
    { key: 'closers', label: 'Closers', pregunta: '¿Qué trabajaste hoy con todos los closers?' },
];

const LISTAS = [
    { key: 'victorias', label: 'Victorias del día', tono: 'success', pregunta: '¿Qué salió bien hoy?' },
    { key: 'mejoras', label: 'A mejorar', tono: 'warning', pregunta: '¿Qué hay que mejorar?' },
    { key: 'proximos', label: 'Próximos días', tono: 'info', pregunta: '¿Qué querés trabajar en los próximos días?' },
];

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

/** El día anterior a una fecha ISO. Al mediodía, para que ningún huso corra el día. */
const diaAnterior = (iso) => {
    const f = new Date(`${iso.slice(0, 10)}T12:00:00`);
    f.setDate(f.getDate() - 1);
    return f.toISOString().slice(0, 10);
};

const rolDe = (persona) => (persona.grupo === 'setters' ? 'Setter' : 'Closer');

/** El avatar del diseño, con el tono del rol: los setters van en azul informativo. */
const avatarEstilo = (grupo, px, radio) => ({
    width: px,
    height: px,
    borderRadius: radio,
    fontSize: px > 38 ? 14 : 11.5,
    ...(grupo === 'setters'
        ? { background: 'var(--info-surface)', borderColor: 'var(--info-border)', color: 'var(--info)' }
        : {}),
});

/** Chip de estado con el tono que manda el backend (nunca uno elegido acá). */
const Chip = ({ tono, children }) => (
    <span className="chip" style={{ '--c': `var(--${tono})` }}>{children}</span>
);

/** El "i" con la explicación. Es CSS puro: abre con hover y con foco de teclado. */
const Tip = ({ titulo, texto }) => (
    <span className="tip" tabIndex={0} role="note" aria-label={`${titulo ? `${titulo}: ` : ''}${texto}`}>
        <span className="tip-dot" aria-hidden="true">i</span>
        <span className="tip-burbuja" aria-hidden="true">
            {titulo && <b>{titulo}</b>}
            {texto}
        </span>
    </span>
);

/** Cifras del día, todas en la misma caja: mismo alto, mismo padding, número tabular. */
const Cifras = ({ items, min = 104 }) => (
    <div className="cifras"
        style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${min}px),1fr))` }}>
        {items.map(([label, valor, color]) => (
            <div key={label} className="cifra">
                <span className="ficha-lbl">{label}</span>
                <span className="cifra-n" style={{ color: color || 'var(--text-on-surface)' }}>{valor}</span>
            </div>
        ))}
    </div>
);

/** Encabezado de una pantalla del paso: de qué se trata y en cuál de sus pantallas está. */
const Cabecera = ({ rotulo, sub, total }) => (
    <div className="fila" style={{ gap: 'var(--s2)' }}>
        <span className="t-rotulo">{rotulo}</span>
        {total > 1 && (
            <span className="t-cap mut40 num" style={{ marginLeft: 'auto' }}>{sub + 1} de {total}</span>
        )}
    </div>
);

/**
 * La barra del header: los cuatro pasos, el día que se revisa y la navegación.
 *
 * Son tres bloques hermanos (van dentro de la fila de controles del dashboard, no en una caja
 * propia). Las acciones llegan por una ref para que un click use siempre el estado de ahora y no
 * el del render en el que se creó el nodo.
 */
const BarraPasos = ({ paso, sub, hechos, bloqueos, faltan, dias, diaSel, guardando, acciones }) => {
    const ultimo = paso === PASOS.length - 1 && sub === SUBPASOS[paso] - 1;
    const bloqueado = bloqueos[paso];

    return (
        <>
            <div className="stepper" role="tablist" aria-label="Pasos del reporte">
                {PASOS.map((label, i) => {
                    const hecho = hechos[i];
                    const bloq = (i === 3 && bloqueos[2]) || (i > 0 && bloqueos[0]);
                    return (
                        <button key={label} type="button" role="tab" className={`paso-btn${hecho ? ' hecho' : ''}`}
                            aria-current={paso === i ? 'step' : undefined} disabled={bloq}
                            onClick={() => acciones.current.irAPaso(i)}>
                            <span className="paso-n">
                                {hecho && paso !== i ? <Check size={12} /> : i + 1}
                            </span>
                            {label}
                        </button>
                    );
                })}
            </div>

            {paso === 0 && dias.length > 1 && (
                <div className="tabs" role="tablist" aria-label="Día a revisar">
                    {dias.map(d => (
                        <button key={d.label} type="button" role="tab" className="tab tab--sm"
                            aria-selected={diaSel === d.valor}
                            onClick={() => acciones.current.verDia(d.valor)}>
                            {d.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="fila" style={{ gap: 'var(--s2)', marginLeft: 'auto' }}>
                {bloqueado && <span className="t-cap mut40">Faltan {faltan}</span>}
                {(paso > 0 || sub > 0) && (
                    <button type="button" className="btn btn--linea btn--sm"
                        onClick={() => acciones.current.atras()}>Atrás</button>
                )}
                {ultimo ? (
                    <button type="button" className="btn btn--cta btn--sm" disabled={guardando}
                        onClick={() => acciones.current.guardar()}>
                        {guardando ? 'Guardando…' : 'Guardar reporte'}
                    </button>
                ) : (
                    <button type="button" className="btn btn--linea btn--sm" disabled={bloqueado}
                        onClick={() => acciones.current.siguiente()}>Siguiente</button>
                )}
            </div>
        </>
    );
};

/* Constancia de carga. Va acá y no en comercialApi.js porque ese archivo lo está tocando otra
   tarea en paralelo; al integrar, esta llamada se muda con las demás. */
const RANGOS = [[7, '7 días'], [14, '14 días'], [30, '30 días']];
const TODOS = 'todos';

/* El hueco no es rojo: un día libre o un día sin nada que cargar no es una deuda. */
const HUECO = { background: 'transparent', border: '1px solid var(--border-subtle)' };
const CELDA = {
    completo: { background: 'var(--success)' },
    incompleto: { background: 'var(--warning)' },
    sin_cargar: { background: 'var(--error-surface)', border: '1px solid var(--error-border)' },
    libre: HUECO,
    sin_actividad: HUECO,
};

const tonoTasa = (tasa) => {
    if (tasa === null || tasa === undefined) return 'text-muted-40';
    return tasa >= 85 ? 'success' : tasa >= 65 ? 'warning' : 'error';
};

/**
 * Constancia de carga: una fila por persona y una celda por día.
 *
 * El chip del paso 1 dice si alguien cargó su día HOY; esto dice si es un descuido o una
 * costumbre. La tasa de la derecha es sobre los días en que la persona tenía algo que cargar, así
 * que un fin de semana no la castiga; sin esos días viene "—" y no 0%.
 */
const PanelConstancia = () => {
    const [rango, setRango] = useState(14);
    const [quien, setQuien] = useState(TODOS);
    const [datos, setDatos] = useState(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let vivo = true;
        setDatos(null);
        setVisible(false);
        getConstancia(rango)
            .then(d => { if (vivo) setDatos(d); })
            .catch(() => { if (vivo) setDatos({ dias: [], personas: [] }); });
        return () => { vivo = false; };
    }, [rango]);

    /* Las celdas entran de a poco, como en el diseño: el CSS las deja en opacity 0 y acá se
       encienden una vez que los datos ya están en el DOM. */
    useEffect(() => {
        if (!datos) return undefined;
        const id = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(id);
    }, [datos]);

    const ayuda = 'Quién dejó cargado el resultado de su día, día por día. Verde es el día completo, '
        + 'ámbar es cargado pero con llamadas sin resultado y el rojo es un día con trabajo sin cargar. '
        + 'El hueco es un día libre o sin nada que cargar, y no cuenta para la tasa.';

    const personas = datos
        ? datos.personas.filter(p => quien === TODOS || String(p.id) === quien)
        : [];
    const nombreDeDia = datos
        ? datos.dias.reduce((acc, d) => ({ ...acc, [d.fecha]: d.dia }), {})
        : {};

    return (
        <section className="panel" style={{ marginTop: 'var(--s4)' }}>
            <div className="panel-cab">
                <h2 className="t-h3">Reportado</h2>
                <Tip titulo="Reportado" texto={ayuda} />
                <div className="panel-cab-der">
                    <div className="leyenda" style={{ marginTop: 0 }}>
                        <span><i style={{ background: 'var(--success)' }} />completo</span>
                        <span><i style={{ background: 'var(--warning)' }} />incompleto</span>
                        <span><i style={CELDA.sin_cargar} />sin cargar</span>
                        <span><i style={HUECO} />sin actividad</span>
                    </div>
                </div>
            </div>

            <div className="fila barra-tabla">
                <span className="t-rotulo">Rango</span>
                <div className="tabs" role="tablist" aria-label="Rango">
                    {RANGOS.map(([valor, label]) => (
                        <button key={valor} type="button" role="tab" className="tab tab--sm"
                            aria-selected={rango === valor} onClick={() => setRango(valor)}>
                            {label}
                        </button>
                    ))}
                </div>
                {datos && datos.personas.length > 1 && (
                    <>
                        <span className="t-rotulo" style={{ marginLeft: 'var(--s3)' }}>Quién</span>
                        <div className="tabs tabs--wrap" role="tablist" aria-label="Persona">
                            <button type="button" role="tab" className="tab tab--sm"
                                aria-selected={quien === TODOS} onClick={() => setQuien(TODOS)}>
                                Todos
                            </button>
                            {datos.personas.map(p => (
                                <button key={p.id} type="button" role="tab" className="tab tab--sm"
                                    aria-selected={quien === String(p.id)}
                                    onClick={() => setQuien(String(p.id))}>
                                    {p.nombre}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {!datos ? <Cargando texto="Cargando la constancia…" /> : (
                <div className="hundido" style={{ padding: 'var(--s3) var(--s4)' }}>
                    <div className="rep-fila"
                        style={{ cursor: 'default', paddingLeft: 0, paddingRight: 0 }}>
                        <span className="rep-nom" />
                        <span style={{ width: 96, flexShrink: 0 }} />
                        <span className="heat heat--cab">
                            {datos.dias.map(d => <i key={d.fecha}>{d.dia}<em>{d.n}</em></i>)}
                        </span>
                        <span className="rep-tasa"
                            style={{ '--c': 'var(--text-muted-40)', fontSize: 10 }}>tasa</span>
                    </div>
                    {personas.map((p, pi) => (
                        <button key={p.id} type="button" className="rep-fila"
                            style={{ paddingLeft: 0, paddingRight: 0 }}
                            aria-label={`Ver solo la constancia de ${p.nombre}`}
                            onClick={() => setQuien(quien === String(p.id) ? TODOS : String(p.id))}>
                            <span className="rep-nom">{p.nombre}</span>
                            <span className="delta"
                                style={{ '--c': `var(--${p.sin_cargar === 0 ? 'success' : 'warning'})` }}>
                                {p.sin_cargar === 0
                                    ? 'al día'
                                    : fmt.plural(p.sin_cargar, 'día sin cargar', 'días sin cargar')}
                            </span>
                            <span className="heat">
                                {p.celdas.map((c, i) => (
                                    <i key={c.fecha} style={{
                                        ...CELDA[c.estado],
                                        opacity: visible ? 1 : 0,
                                        transitionDelay: `${pi * 60 + i * 18}ms`,
                                    }} title={`${nombreDeDia[c.fecha] || ''} ${fmt.fecha(c.fecha)} · ${c.label}`} />
                                ))}
                            </span>
                            <span className="rep-tasa" style={{ '--c': `var(--${tonoTasa(p.tasa)})` }}>
                                {fmt.pct(p.tasa)}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
};

/**
 * Paso 1 · El día: los números del grupo y una fila por persona.
 *
 * Un click NO navega: abre el modal con la actividad de esa persona y un "Aceptar" que la marca
 * revisada y encadena con la siguiente sin volver a la lista.
 */
const PasoDia = ({ dia, revisadas, onRevisar, irAPersona }) => {
    const [abierta, setAbierta] = useState(null);
    const personas = dia.personas;
    const persona = personas.find(p => p.id === abierta) || null;
    const revisados = personas.filter(p => revisadas[p.id]).length;

    const proximaSinRevisar = (desde, hechas = revisadas) => {
        for (let i = 0; i < personas.length; i += 1) {
            const p = personas[(desde + i) % personas.length];
            if (!hechas[p.id]) return p.id;
        }
        return null;
    };

    /* Aceptar encadena con la próxima sin revisar. La marca recién puesta se pasa a mano porque
       el borrador todavía no se actualizó: sin eso volvería a abrir a la misma persona. */
    const aceptar = () => {
        const idx = personas.findIndex(p => p.id === abierta);
        onRevisar(abierta);
        setAbierta(proximaSinRevisar(idx + 1, { ...revisadas, [abierta]: true }));
    };

    useEffect(() => {
        if (!persona) return undefined;
        const cerrarConEsc = (e) => { if (e.key === 'Escape') setAbierta(null); };
        document.addEventListener('keydown', cerrarConEsc);
        return () => document.removeEventListener('keydown', cerrarConEsc);
    }, [persona]);

    return (
        <>
            <div className="grid-2" style={{ marginBottom: 'var(--s4)' }}>
                <section className="panel panel--fino">
                    <p className="t-rotulo" style={{ marginBottom: 'var(--s3)' }}>Closers</p>
                    <Cifras min={88} items={[
                        ['Agendas', fmt.num(dia.closers.agendas)],
                        ['Show up', fmt.num(dia.closers.asistieron), 'var(--success)'],
                        ['Ventas', fmt.num(dia.closers.ventas), 'var(--brand-secondary)'],
                        ['Cash', fmt.money(dia.closers.cash)],
                    ]} />
                </section>
                <section className="panel panel--fino">
                    <p className="t-rotulo" style={{ marginBottom: 'var(--s3)' }}>Setters</p>
                    <Cifras min={88} items={[
                        ['Leads', fmt.num(dia.setters.leads)],
                        ['Mensajes', fmt.num(dia.setters.mensajes), 'var(--info)'],
                        ['Respuesta', fmt.pct(dia.setters.respuesta)],
                        ['Agendas', fmt.num(dia.setters.agendas), 'var(--success)'],
                    ]} />
                </section>
            </div>

            <section className="panel">
                <div className="panel-cab">
                    <h2 className="t-h3">Equipo</h2>
                    <Tip titulo="Equipo"
                        texto={'Abrí a la primera persona y aceptá: el reporte encadena solo hasta la última. '
                            + 'Hasta que no estén todas, no avanza.'} />
                    <div className="panel-cab-der">
                        {revisados < personas.length ? (
                            <button type="button" className="btn btn--linea btn--sm"
                                onClick={() => setAbierta(proximaSinRevisar(0))}>
                                {revisados ? 'Seguir revisando' : 'Empezar a revisar'}
                            </button>
                        ) : (
                            <Chip tono="success"><Check size={12} /> equipo revisado</Chip>
                        )}
                        <span className="t-cap num"
                            style={{ color: revisados === personas.length && personas.length
                                ? 'var(--success)' : 'var(--text-muted-40)' }}>
                            {revisados} de {personas.length}
                        </span>
                    </div>
                </div>

                {personas.length === 0 ? (
                    <div className="vacio">
                        <p className="t-h3">No hay nadie activo en el equipo</p>
                        <p className="t-sm mut">Sin closers ni setters activos no hay día que revisar.</p>
                    </div>
                ) : (
                    <div className="hundido">
                        {personas.map(p => (
                            <button key={p.id} type="button" className="rep-persona"
                                onClick={() => setAbierta(p.id)}>
                                <span className="avatar" style={avatarEstilo(p.grupo, 34, 12)}>
                                    {fmt.iniciales(p.nombre)}
                                </span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                    <span className="celda" style={{ display: 'block' }}>{p.nombre}</span>
                                    <span className="celda-sub">{rolDe(p)} · {p.resumen}</span>
                                </span>
                                <Chip tono={p.estado.tone}>{p.estado.label}</Chip>
                                <span className={`rep-ok${revisadas[p.id] ? ' si' : ''}`}>
                                    {revisadas[p.id] ? <Check size={14} /> : <ArrowRight size={14} />}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            <PanelConstancia />

            {persona && (
                <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) setAbierta(null); }}>
                    <div className="modal caja" style={{ width: 'min(640px,100%)' }}
                        role="dialog" aria-modal="true" aria-label={`Día de ${persona.nombre}`}>
                        <div className="modal-cab" style={{ marginBottom: 'var(--s4)' }}>
                            <span className="avatar" style={avatarEstilo(persona.grupo, 44, 14)}>
                                {fmt.iniciales(persona.nombre)}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h2 className="t-h3">{persona.nombre}</h2>
                                <p className="t-cap mut40" style={{ marginTop: 4 }}>
                                    {rolDe(persona)} · {fmt.fechaLarga(dia.fecha)}
                                </p>
                            </div>
                            <Chip tono={persona.estado.tone}>{persona.estado.label}</Chip>
                            <button type="button" className="ibtn" aria-label="Cerrar"
                                onClick={() => setAbierta(null)}><X size={17} /></button>
                        </div>

                        <div className="hundido">
                            {persona.actividad.length === 0 ? (
                                <p className="t-sm mut40" style={{ padding: 'var(--s6)' }}>
                                    Sin actividad registrada.
                                </p>
                            ) : persona.actividad.map((a, i) => (
                                <div key={`${a.hora}-${a.cliente}-${i}`} className="rep-persona"
                                    style={{ cursor: 'default' }}>
                                    <span className="num"
                                        style={{ width: 46, flexShrink: 0, fontSize: 13, fontWeight: 700 }}>
                                        {a.hora}
                                    </span>
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                        <span className="celda" style={{ display: 'block' }}>{a.cliente}</span>
                                        <span className="celda-sub">{a.detalle}</span>
                                    </span>
                                    <Chip tono={a.chip.tone}>{a.chip.label}</Chip>
                                </div>
                            ))}
                        </div>

                        <div className="rep-pie">
                            <button type="button" className="btn btn--linea btn--sm"
                                onClick={() => { setAbierta(null); irAPersona(persona); }}>
                                Ver en Revisar
                            </button>
                            <button type="button" className="btn btn--cta btn--sm"
                                style={{ marginLeft: 'auto' }} onClick={aceptar}>
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

/** Paso 2 · Grupal: un equipo por vez, setters primero. Una pregunta, un textarea, nada más. */
const PasoGrupal = ({ sub, borrador, setBorrador }) => {
    const g = GRUPOS[Math.min(sub, GRUPOS.length - 1)];
    return (
        <div className="columna" style={{ display: 'grid', gap: 'var(--s3)' }}>
            <Cabecera rotulo="Trabajo grupal" sub={sub} total={GRUPOS.length} />
            <section className="panel">
                <div className="panel-cab"><h2 className="t-h3">{g.label}</h2></div>
                <textarea className="area" placeholder={g.pregunta} aria-label={g.pregunta}
                    value={borrador.grupal[g.key]}
                    onChange={(e) => setBorrador({
                        ...borrador, grupal: { ...borrador.grupal, [g.key]: e.target.value },
                    })} />
            </section>
        </div>
    );
};

/**
 * Paso 3 · Individual: UNA persona por vez, con el equipo al costado para corregir.
 *
 * "No" no necesita respuesta, así que salta sola a la próxima sin responder. Cuando están todas,
 * el lado derecho deja de preguntar y lo dice.
 */
const PasoIndividual = ({ dia, borrador, setBorrador, indice, setIndice }) => {
    const personas = dia.personas;
    if (personas.length === 0) {
        return <p className="t-sm mut">No hay nadie activo en el equipo.</p>;
    }

    const idx = Math.min(indice, personas.length - 1);
    const persona = personas[idx];
    const respuesta = borrador.individual[persona.id];
    const respondidas = personas.filter(p => borrador.individual[p.id] !== undefined).length;
    const listo = respondidas === personas.length;

    const proximaSinResponder = (desde, respuestas) => {
        for (let i = 1; i <= personas.length; i += 1) {
            const j = (desde + i) % personas.length;
            if (respuestas[personas[j].id] === undefined) return j;
        }
        return -1;
    };

    const responder = (trabajo) => {
        const individual = {
            ...borrador.individual,
            [persona.id]: { trabajo, texto: trabajo ? (respuesta?.texto || '') : '' },
        };
        setBorrador({ ...borrador, individual });
        if (!trabajo) {
            const sig = proximaSinResponder(idx, individual);
            if (sig >= 0) setIndice(sig);
        }
    };

    const avanzar = () => {
        const sig = proximaSinResponder(idx, borrador.individual);
        if (sig >= 0) setIndice(sig);
    };

    const botonSiNo = (etiqueta, valor, tono) => {
        const activo = respuesta?.trabajo === valor;
        return (
            <button type="button" className="chip" aria-pressed={activo}
                onClick={() => responder(valor)}
                style={{
                    '--c': `var(--${activo ? tono : 'idle'})`,
                    height: 40, padding: '0 26px', fontSize: 13, textTransform: 'none', letterSpacing: 0,
                    ...(activo ? {} : {
                        background: 'transparent',
                        borderColor: 'var(--border-control)',
                        color: 'var(--text-muted)',
                    }),
                }}>
                {etiqueta}
            </button>
        );
    };

    return (
        <div className="indiv">
            <section className="panel" style={{ padding: 'var(--s3)' }}>
                <div className="fila" style={{ padding: '0 var(--s2) var(--s2)' }}>
                    <span className="t-rotulo">Equipo</span>
                    <span className="t-cap num"
                        style={{ marginLeft: 'auto', color: listo ? 'var(--success)' : 'var(--text-muted-40)' }}>
                        {respondidas} de {personas.length}
                    </span>
                </div>
                {personas.map((q, i) => {
                    const r = borrador.individual[q.id];
                    const tono = r === undefined ? null : (r.trabajo ? 'success' : 'error');
                    return (
                        <button key={q.id} type="button"
                            className={`roster${!listo && i === idx ? ' act' : ''}`}
                            aria-current={!listo && i === idx ? 'true' : undefined}
                            onClick={() => setIndice(i)}>
                            <span className="avatar" style={avatarEstilo(q.grupo, 28, 10)}>
                                {fmt.iniciales(q.nombre)}
                            </span>
                            <span className="trunc"
                                style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>
                                {q.nombre}
                            </span>
                            <span className="roster-pt"
                                style={tono ? { background: `var(--${tono})`, borderColor: 'transparent' } : undefined} />
                        </button>
                    );
                })}
            </section>

            {listo ? (
                <section className="panel caja"
                    style={{ display: 'grid', placeItems: 'center', textAlign: 'center',
                        gap: 'var(--s3)', padding: 'var(--s12) var(--s6)' }}>
                    <span className="vacio-icono"
                        style={{ background: 'var(--success-surface)', borderColor: 'var(--success-border)',
                            color: 'var(--success)' }}>
                        <Check size={24} />
                    </span>
                    <h2 className="t-h2">Terminaste el individual</h2>
                    <p className="t-sm mut">
                        Las {personas.length} personas quedaron registradas. Podés tocar a cualquiera de la
                        izquierda para corregir, o seguir al cierre del día.
                    </p>
                </section>
            ) : (
                <section className="panel">
                    <div className="fila" style={{ gap: 'var(--s3)', marginBottom: 'var(--s4)' }}>
                        <span className="avatar" style={avatarEstilo(persona.grupo, 44, 14)}>
                            {fmt.iniciales(persona.nombre)}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                            <span className="t-h3" style={{ display: 'block' }}>{persona.nombre}</span>
                            <span className="celda-sub">{rolDe(persona)} · {persona.resumen}</span>
                        </span>
                        <Chip tono={persona.estado.tone}>{persona.estado.label}</Chip>
                    </div>

                    <p className="t-body" style={{ marginBottom: 'var(--s3)' }}>
                        ¿Trabajaste algo específico con {persona.nombre.split(' ')[0]}?
                    </p>
                    <div className="fila" style={{ gap: 'var(--s2)', flexWrap: 'wrap' }}>
                        {botonSiNo('Sí', true, 'success')}
                        {botonSiNo('No', false, 'error')}
                    </div>

                    {respuesta?.trabajo === true && (
                        <div style={{ display: 'grid', gap: 'var(--s3)', marginTop: 'var(--s4)' }}>
                            <textarea className="area" placeholder="¿Qué trabajaron?"
                                aria-label={`Qué trabajaron con ${persona.nombre}`} value={respuesta.texto}
                                onChange={(e) => setBorrador({
                                    ...borrador,
                                    individual: {
                                        ...borrador.individual,
                                        [persona.id]: { trabajo: true, texto: e.target.value },
                                    },
                                })} />
                            <button type="button" className="btn btn--linea btn--sm"
                                style={{ justifySelf: 'start' }} onClick={avanzar}>
                                Listo, siguiente
                            </button>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

/**
 * Paso 4 · Cierre: una lista por vez.
 *
 * Las sugerencias salen de los datos del día y son como máximo dos: si no pasó nada que sugerir,
 * no hay chips en vez de rellenar con frases hechas.
 */
const PasoCierre = ({ dia, sub, borrador, setBorrador }) => {
    const [drafts, setDrafts] = useState({});
    const L = LISTAS[Math.min(sub, LISTAS.length - 1)];
    const items = borrador.listas[L.key];
    const sugerencias = (dia.sugerencias[L.key] || []).filter(s => !items.includes(s)).slice(0, 2);

    const agregar = (texto) => {
        const limpio = (texto || '').trim();
        if (!limpio || items.includes(limpio)) return;
        setBorrador({ ...borrador, listas: { ...borrador.listas, [L.key]: [...items, limpio] } });
        setDrafts({ ...drafts, [L.key]: '' });
    };

    const quitar = (texto) => setBorrador({
        ...borrador,
        listas: { ...borrador.listas, [L.key]: items.filter(i => i !== texto) },
    });

    return (
        <div className="columna" style={{ display: 'grid', gap: 'var(--s3)' }}>
            <Cabecera rotulo="Cierre del día" sub={sub} total={LISTAS.length} />
            <section className="panel">
                <div className="panel-cab">
                    <span className="dato-punto"
                        style={{ background: `var(--${L.tono})`, marginTop: 6, marginRight: 2 }} />
                    <h2 className="t-h3">{L.label}</h2>
                    {items.length > 0 && (
                        <div className="panel-cab-der">
                            <span className="t-cap mut40 num">{fmt.num(items.length)}</span>
                        </div>
                    )}
                </div>

                {items.length === 0 ? (
                    <p className="t-sm mut40" style={{ marginBottom: 'var(--s4)' }}>
                        Todavía no anotaste nada acá.
                    </p>
                ) : (
                    <div className="hundido" style={{ marginBottom: 'var(--s4)' }}>
                        {items.map(item => (
                            <div key={item} className="rep-persona" style={{ cursor: 'default' }}>
                                <span className="dato-punto" style={{ background: `var(--${L.tono})` }} />
                                <span className="t-sm" style={{ flex: 1, minWidth: 0 }}>{item}</span>
                                <button type="button" className="ibtn ibtn--sm" aria-label={`Quitar ${item}`}
                                    onClick={() => quitar(item)}><X size={15} /></button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="entrada">
                    <input value={drafts[L.key] || ''} placeholder={L.pregunta} aria-label={L.pregunta}
                        onChange={(e) => setDrafts({ ...drafts, [L.key]: e.target.value })}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); agregar(drafts[L.key]); }
                        }} />
                    <button type="button" className="ibtn ibtn--sm" aria-label="Agregar"
                        onClick={() => agregar(drafts[L.key])}><Plus size={15} /></button>
                </div>

                {sugerencias.length > 0 && (
                    <div className="fila" style={{ gap: 'var(--s2)', flexWrap: 'wrap', marginTop: 'var(--s3)' }}>
                        {sugerencias.map(s => (
                            <button key={s} type="button" className="chip" onClick={() => agregar(s)}
                                style={{ '--c': `var(--${L.tono})`, textTransform: 'none', letterSpacing: 0,
                                    fontSize: 12, fontWeight: 600, height: 30 }}>
                                <Plus size={13} /> {s}
                            </button>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

const TODO = 'todo';
const GRUPAL = { 'grupal-closers': 'closers', 'grupal-setters': 'setters' };

/**
 * Historial: solo los reportes del director.
 *
 * Dos vistas. "Todo" es una tarjeta por día que se despliega; con una persona (o un grupo) elegido
 * pasa a ser el registro de trabajo: los días en los que hubo una respuesta, sea "trabajamos" o
 * "no hizo falta".
 */
const Historial = ({ miembros, nuevoId, aviso, onCerrarAviso }) => {
    const [filtro, setFiltro] = useState(TODO);
    const [datos, setDatos] = useState(null);
    const [abiertos, setAbiertos] = useState(() => (nuevoId ? { [nuevoId]: true } : {}));

    const miembroId = filtro === TODO || GRUPAL[filtro] ? null : filtro;

    useEffect(() => {
        let vivo = true;
        setDatos(null);
        getReportes(miembroId)
            .then(d => { if (vivo) setDatos(d); })
            .catch(() => { if (vivo) setDatos({ reportes: [] }); });
        return () => { vivo = false; };
    }, [miembroId]);

    const opciones = [
        { key: TODO, label: 'Todo' },
        { key: 'grupal-setters', label: 'Grupal setters' },
        { key: 'grupal-closers', label: 'Grupal closers' },
        ...miembros.map(m => ({ key: String(m.id), label: m.nombre })),
    ];
    const elegida = opciones.find(o => o.key === filtro);

    const banda = (
        <>
            {aviso && (
                <div className="aviso" style={{ marginBottom: 'var(--s4)' }}>
                    <Trophy size={16} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                        Completaste tu reporte. Quedó en tu historial y en el registro de cada persona.
                    </span>
                    <button type="button" className="ibtn ibtn--sm" aria-label="Descartar"
                        onClick={onCerrarAviso}><X size={15} /></button>
                </div>
            )}
            <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s2)', marginBottom: 'var(--s4)' }}>
                <span className="t-rotulo">Ver registro de</span>
                {opciones.map(o => (
                    <button key={o.key} type="button" aria-pressed={filtro === o.key}
                        className={`pastilla pastilla--sm${filtro === o.key ? ' pastilla--on' : ''}`}
                        onClick={() => setFiltro(o.key)}>
                        {o.label}
                    </button>
                ))}
            </div>
        </>
    );

    if (!datos) return <>{banda}<Cargando texto="Cargando el historial…" /></>;

    if (datos.reportes.length === 0 && filtro === TODO) {
        return (
            <>
                {banda}
                <section className="panel">
                    <div className="vacio">
                        <p className="t-h3">Todavía no hay reportes</p>
                        <p className="t-sm mut">El primero que guardes aparece acá.</p>
                    </div>
                </section>
            </>
        );
    }

    /* Registro de una persona o de un grupo: la línea de tiempo de lo trabajado, día por día. */
    if (filtro !== TODO) {
        const gk = GRUPAL[filtro];
        const dias = gk
            ? datos.reportes.map(r => ({
                fecha: r.fecha, trabajo: Boolean(r.grupal[gk].trim()), texto: r.grupal[gk],
            }))
            : (datos.dias || []);
        const conTrabajo = dias.filter(d => d.trabajo).length;
        return (
            <>
                {banda}
                <section className="panel">
                    <div className="panel-cab">
                        <h2 className="t-h3">Registro de trabajo · {elegida?.label}</h2>
                        <Tip titulo="Registro de trabajo"
                            texto={'Los días en los que hubo una respuesta, sacados de tus reportes guardados. '
                                + '"No hizo falta" también es una respuesta.'} />
                        <div className="panel-cab-der">
                            <span className="t-cap mut40 num">
                                {conTrabajo} de {fmt.plural(dias.length, 'día', 'días')}
                            </span>
                        </div>
                    </div>
                    {dias.length === 0 ? (
                        <p className="t-sm mut40">Todavía no hay un día con respuesta para {elegida?.label}.</p>
                    ) : (
                        <div className="linea-tiempo">
                            {dias.map(d => (
                                <div key={d.fecha}>
                                    <span className="fila" style={{ gap: 'var(--s2)', flexWrap: 'wrap' }}>
                                        <span className="t-cap" style={{ fontWeight: 700 }}>
                                            {fmt.fechaLarga(d.fecha)}
                                        </span>
                                        <span className="t-cap"
                                            style={{ fontWeight: 700,
                                                color: `var(--${d.trabajo ? 'success' : 'text-muted-40'})` }}>
                                            {d.trabajo ? 'Trabajaron' : 'No hizo falta'}
                                        </span>
                                    </span>
                                    {d.trabajo && d.texto && <span className="t-sm">{d.texto}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </>
        );
    }

    return (
        <>
            {banda}
            <div style={{ display: 'grid', gap: 'var(--s2)' }}>
                {datos.reportes.map(r => {
                    const trabajadas = r.individual.filter(p => p.trabajo && (p.texto || '').trim());
                    const abierto = Boolean(abiertos[r.id]);
                    return (
                        <div key={r.id} className="hist-dia">
                            <button type="button" className="hist-cab" aria-expanded={abierto}
                                onClick={() => setAbiertos({ ...abiertos, [r.id]: !abierto })}>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                    <span className="celda" style={{ display: 'block' }}>
                                        {fmt.fechaLarga(r.fecha)}
                                    </span>
                                    <span className="celda-sub num">
                                        {fmt.plural(r.individual.length, 'respuesta', 'respuestas')}
                                        {' · '}{fmt.plural(trabajadas.length, 'individual', 'individuales')}
                                    </span>
                                </span>
                                {r.id === nuevoId && <Chip tono="info">Nuevo</Chip>}
                                <span style={{ color: 'var(--text-muted-40)', transition: 'transform .2s ease',
                                    transform: `rotate(${abierto ? 90 : 0}deg)` }}>
                                    <ChevronRight size={16} />
                                </span>
                            </button>

                            {abierto && (
                                <div className="hist-cuerpo">
                                    {GRUPOS.filter(g => r.grupal[g.key]).map(g => (
                                        <div key={g.key} className="hist-bloque">
                                            <span className="t-rotulo">Grupal · {g.label.toLowerCase()}</span>
                                            <p className="t-sm">{r.grupal[g.key]}</p>
                                        </div>
                                    ))}
                                    {trabajadas.map(p => (
                                        <div key={p.miembro_id} className="hist-bloque">
                                            <span className="t-rotulo">{p.nombre}</span>
                                            <p className="t-sm">{p.texto}</p>
                                        </div>
                                    ))}
                                    {LISTAS.filter(L => r.listas[L.key].length).map(L => (
                                        <div key={L.key} className="hist-bloque">
                                            <span className="t-rotulo fila" style={{ gap: 6 }}>
                                                <span className="dato-punto"
                                                    style={{ background: `var(--${L.tono})` }} />
                                                {L.label}
                                            </span>
                                            {r.listas[L.key].map(i => (
                                                <p key={i} className="t-sm">· {i}</p>
                                            ))}
                                        </div>
                                    ))}
                                    {!r.grupal.closers && !r.grupal.setters && trabajadas.length === 0
                                        && LISTAS.every(L => !r.listas[L.key].length) && (
                                        <p className="t-sm mut40">Ese día quedó sin nada escrito.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
};

const Reportar = ({ tab, setTab, miembros, irAPersona, onStepper }) => {
    const [dia, setDia] = useState(null);
    const [fechaPedida, setFechaPedida] = useState(null);
    const [paso, setPaso] = useState(0);
    const [sub, setSub] = useState(0);
    const [indice, setIndice] = useState(0);
    const [borrador, setBorrador] = useState(borradorVacio);
    const [guardando, setGuardando] = useState(false);
    const [nuevoId, setNuevoId] = useState(null);
    const [aviso, setAviso] = useState(false);
    // La primera respuesta es la de hoy: con eso se sabe qué día es "ayer" sin preguntárselo al
    // reloj del navegador, que puede estar en otro huso que el del backend.
    const [hoy, setHoy] = useState(null);

    useEffect(() => {
        let vivo = true;
        setDia(null);
        getReporteHoy(fechaPedida).then(d => {
            if (!vivo) return;
            if (!fechaPedida) setHoy(d.fecha);
            setDia(d);
            setBorrador(leerBorrador(d.fecha));
            setIndice(0);
        }).catch(() => { if (vivo) toast.error('No se pudo cargar el día del equipo'); });
        return () => { vivo = false; };
    }, [fechaPedida]);

    useEffect(() => {
        if (!dia) return;
        try {
            localStorage.setItem(claveBorrador(dia.fecha), JSON.stringify(borrador));
        } catch {
            /* modo privado o cuota llena: el reporte sigue funcionando, solo no se guarda el borrador */
        }
    }, [borrador, dia]);

    const personas = dia?.personas || [];
    const faltanRevisar = personas.filter(p => !borrador.revisadas[p.id]).length;
    const faltanResponder = personas.filter(p => borrador.individual[p.id] === undefined).length;

    /* Un paso "hecho" es un tilde, no un permiso: lo que bloquea está en `bloqueos`. */
    const hechos = useMemo(() => [
        personas.length > 0 && faltanRevisar === 0,
        GRUPOS.every(g => borrador.grupal[g.key].trim()),
        personas.length > 0 && faltanResponder === 0,
        false,
    ], [personas.length, faltanRevisar, faltanResponder, borrador.grupal]);

    /* Sin equipo activo no hay nada que revisar ni que responder, así que tampoco hay bloqueo. */
    const bloqueos = useMemo(
        () => [faltanRevisar > 0, false, faltanResponder > 0, false],
        [faltanRevisar, faltanResponder]);

    const guardar = useCallback(async () => {
        if (!dia) return;
        setGuardando(true);
        try {
            const guardado = await guardarReporte({
                fecha: dia.fecha,
                grupal: borrador.grupal,
                individual: personas
                    .filter(p => borrador.individual[p.id] !== undefined)
                    .map(p => ({ miembro_id: p.id, ...borrador.individual[p.id] })),
                listas: borrador.listas,
            });
            setNuevoId(guardado.id);
            try { localStorage.removeItem(claveBorrador(dia.fecha)); } catch { /* ver arriba */ }
            setBorrador(borradorVacio());
            setPaso(0);
            setSub(0);
            setIndice(0);
            setAviso(true);
            setTab('historial');
        } catch {
            toast.error('No se pudo guardar el reporte');
        } finally {
            setGuardando(false);
        }
    }, [dia, borrador, personas, setTab]);

    /* Las acciones de la barra viven en una ref: el nodo del stepper se crea en un render y se
       aprieta en otro, y con un closure viejo se guardaría un borrador viejo. */
    const acciones = useRef({});
    acciones.current = {
        irAPaso: (i) => { setPaso(i); setSub(0); },
        verDia: (valor) => setFechaPedida(valor),
        siguiente: () => {
            if (sub < SUBPASOS[paso] - 1) setSub(sub + 1);
            else if (paso < PASOS.length - 1) { setPaso(paso + 1); setSub(0); }
        },
        atras: () => {
            if (sub > 0) setSub(sub - 1);
            else if (paso > 0) { setPaso(paso - 1); setSub(SUBPASOS[paso - 1] - 1); }
        },
        guardar,
    };

    const dias = useMemo(() => (hoy
        ? [{ valor: null, label: 'Hoy' }, { valor: diaAnterior(hoy), label: 'Ayer' }]
        : []), [hoy]);

    useEffect(() => {
        if (!onStepper) return;
        onStepper(tab === 'reporte' && dia
            ? <BarraPasos paso={paso} sub={sub} hechos={hechos} bloqueos={bloqueos}
                faltan={paso === 0 ? faltanRevisar : faltanResponder} dias={dias} diaSel={fechaPedida}
                guardando={guardando} acciones={acciones} />
            : null);
    }, [tab, dia, paso, sub, hechos, bloqueos, faltanRevisar, faltanResponder, dias, fechaPedida,
        guardando, onStepper]);

    if (tab === 'historial') {
        return <Historial miembros={miembros} nuevoId={nuevoId} aviso={aviso}
            onCerrarAviso={() => setAviso(false)} />;
    }
    if (!dia) return <Cargando texto="Cargando el día del equipo…" />;

    return (
        <>
            {paso === 0 && (
                <PasoDia dia={dia} revisadas={borrador.revisadas} irAPersona={irAPersona}
                    onRevisar={(id) => setBorrador({
                        ...borrador, revisadas: { ...borrador.revisadas, [id]: true },
                    })} />
            )}
            {paso === 1 && <PasoGrupal sub={sub} borrador={borrador} setBorrador={setBorrador} />}
            {paso === 2 && (
                <PasoIndividual dia={dia} borrador={borrador} setBorrador={setBorrador}
                    indice={indice} setIndice={setIndice} />
            )}
            {paso === 3 && (
                <PasoCierre dia={dia} sub={sub} borrador={borrador} setBorrador={setBorrador} />
            )}
        </>
    );
};

export default Reportar;
