import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Check, ChevronRight, PhoneCall, PlayCircle, Search } from 'lucide-react';
import api from '../../../../../services/api';
import { Humo } from '../../../../comercial/components/Shared';
import { soloDigitos } from '../../lib/escalas';
import { banda, fechaCorta, haceTxt, horasDesde, minAncho, plantillaCols } from '../../lib/vista';
import { Encabezado } from '../TablaPostulaciones';
import {
    CONOCIMIENTO_CORTO, NIVEL_INGLES, cierreNum, coincideCloser, puntajeCloser,
} from '../../lib/closers';
import { Bandera, Chip, Inicial, Puntos, Riel } from '../Piezas';
import { VEREDICTO } from '../comun';
import { Tasa } from '../ResumenInbox';
import AlDia from '../AlDia';
import FichaCloser from './FichaCloser';
import logoWhatsapp from '../../assets/apps/whatsapp.png';

// El Inbox de Talent con la búsqueda de Closer elegida (ADR-W192): arriba, el próximo a revisar
// (el de mejor score entre los que nadie calificó) y qué parte de lo decidido se preselecciona o
// queda en reserva; abajo, la tabla. «Por revisar» son las completas sin ningún voto;
// «Incompletas», las que cortaron el formulario a la mitad. Lo ya calificado sigue en la sección
// Closers del dock (Analizados, Revisores, Estadísticas, Clarity). «Antiguos» (ADR-W193, se abre desde
// un botón discreto de la cabecera) son las postulaciones de búsquedas anteriores, ya archivadas: no
// cuentan en nada, se pueden abrir y se las encuentra también con la búsqueda una vez abiertas.

const HUMO_MARCA = ['var(--info)', 'var(--brand-primary)', 'var(--brand-secondary)', 'var(--focus-blue)'];

export const PESTANAS_INBOX_CLOSER = [
    { id: 'revisar', label: 'Por revisar' },
    { id: 'incompletas', label: 'Incompletas', c: 'var(--error)' },
];

const COLS = [
    { id: 'cand', label: 'Candidato', w: 'minmax(220px,1.7fr)', min: 220 },
    { id: 'fecha', label: 'Postuló', w: '92px', min: 84 },
    { id: 'conoc', label: 'Conocimiento', w: 'minmax(150px,1fr)', min: 150 },
    { id: 'cierre', label: 'Cierre', w: '118px', min: 96 },
    { id: 'ingles', label: 'Inglés', w: '92px', min: 72 },
    { id: 'material', label: 'Material', w: '104px', min: 80, cen: true },
    { id: 'wa', label: 'WhatsApp', w: '176px', min: 140 },
    { id: 'score', label: 'Score', w: '92px', min: 60, der: true },
];

// Los anchos que cada quien ajusta en la tabla de closers (como en la de Asistentes): una comodidad
// personal, guardada en el navegador.
const CLAVE_ANCHOS = 'neurops-talent-anchos-closer-v1';
const leerAnchos = () => {
    try {
        const a = JSON.parse(window.localStorage.getItem(CLAVE_ANCHOS) || '{}');
        return a && typeof a === 'object' ? a : {};
    } catch {
        return {};
    }
};
const guardarAnchos = (a) => {
    try { window.localStorage.setItem(CLAVE_ANCHOS, JSON.stringify(a)); } catch { /* sin almacenamiento: dura la sesión */ }
};

const Foco = ({ p, onAbrir }) => {
    const [razones, setRazones] = useState([]);
    useEffect(() => {
        let vigente = true;
        setRazones([]);
        if (!p) return undefined;
        api.get(`/job-applications/${p.id}`)
            .then((res) => {
                if (!vigente) return;
                const top = puntajeCloser(res.data.criterios)
                    .map((r) => [r.bloque, r.puntos / r.maximo])
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3);
                setRazones(top);
            })
            .catch((err) => console.error('Error al cargar el próximo closer:', err));
        return () => { vigente = false; };
    }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!p) return null;
    const cierre = cierreNum(p.cierre);
    return (
        <section className="tl-foco caja" aria-label="Próximo a revisar">
            <Humo colores={HUMO_MARCA} tarjeta />
            <div className="tl-foco-id">
                <Inicial nombre={p.nombre} />
                <div>
                    <p className="tl-rotulo" style={{ color: 'var(--brand-secondary)' }}>Próximo a revisar</p>
                    <h2 className="t-h3 trunc">{p.nombre}</h2>
                    <div className="tl-foco-meta">
                        <Bandera de={p.pais} />
                        {[p.pais, p.edad, haceTxt(horasDesde(p.created_at)).toLowerCase()].filter(Boolean).join(' · ')}
                    </div>
                </div>
            </div>
            <div className="tl-foco-cifras">
                {cierre != null && (
                    <div className="tl-foco-precio" title="Su porcentaje de cierre sobre llamada tomada">
                        <span className="tl-cifra tl-cifra--m">{cierre}<small>%</small></span>
                        <span className="tl-rotulo">Cierre</span>
                    </div>
                )}
                <div className="tl-foco-score">
                    <span className="tl-cifra tl-cifra--m">{p.score ?? '—'}</span>
                    <span className="tl-rotulo">Score</span>
                </div>
            </div>
            <div className="tl-foco-pie">
                <div className="tl-foco-razones">
                    {razones.map(([b, v]) => <span key={b} className="chip chip--neutro"><Check size={12} />{b} {Math.round(v * 100)}</span>)}
                </div>
                <div className="tl-foco-acc">
                    <button type="button" className="btn btn--sm btn--cta" onClick={() => onAbrir(p.id)}>Abrir postulación <ArrowUpRight /></button>
                </div>
            </div>
        </section>
    );
};

const Avance = ({ filas }) => {
    const decididos = filas.filter((p) => p.veredicto !== 'sin_calificar');
    const pre = decididos.filter((p) => ['preseleccionada', 'testeo'].includes(p.veredicto)).length;
    const res = decididos.filter((p) => p.veredicto === 'en_reserva').length;
    return (
        <section className="panel tl-avance" aria-label="Preselección y reserva">
            <Tasa l="Preselección" n={pre} total={decididos.length} color="var(--success)" />
            <Tasa l="Reserva" n={res} total={decididos.length} color="var(--info)" />
        </section>
    );
};

const Fila = ({ p, conEstado, incompleta, onAbrir }) => {
    const h = horasDesde(p.created_at);
    const cierre = cierreNum(p.cierre);
    const digitos = soloDigitos(p.whatsapp);
    const v = VEREDICTO[p.veredicto] || VEREDICTO.sin_calificar;
    const avance = p.total_preguntas ? Math.round((p.respondidas / p.total_preguntas) * 100) : 0;
    return (
        <div className="tl-fila" role="row" tabIndex={0} onClick={() => onAbrir(p.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onAbrir(p.id); }}>
            <div className="tl-c-cand" role="cell">
                <Inicial nombre={p.nombre} />
                <div>
                    <span className="tl-c-nom trunc">{p.nombre}</span>
                    <span className="tl-c-sub">
                        <Bandera de={p.pais} />
                        <span className="trunc">{[p.pais, p.edad].filter(Boolean).join(' · ') || '—'}</span>
                        {conEstado && <Chip c={v.fg} chico>{v.label}</Chip>}
                    </span>
                </div>
            </div>
            <div className="tl-c-fecha" role="cell" title={fechaCorta(p.created_at)}>
                <b>{h != null && h < 24 && <i aria-label="Nueva" />}{haceTxt(h)}</b>
                <small>{fechaCorta(p.created_at)}</small>
            </div>
            <div className="tl-c-txt" role="cell" title={p.conocimiento || ''}>{CONOCIMIENTO_CORTO[p.conocimiento] || p.conocimiento || '—'}</div>
            <div className="tl-c-pide" role="cell">
                {cierre != null ? (
                    <>
                        <b>{cierre}<small>%</small></b>
                        <Riel pct={cierre} color={cierre >= 30 ? 'var(--success)' : 'var(--barra)'} />
                    </>
                ) : <b className="mut40">{p.cierre === 'nada' ? 'No mide' : '—'}</b>}
            </div>
            <div className="tl-c-idi" role="cell">
                <span><Bandera de="en" titulo={`Inglés: ${p.ingles || 'sin respuesta'}`} /><Puntos n={NIVEL_INGLES[p.ingles] || 0} total={3} /></span>
            </div>
            <div className="cen" role="cell">
                <span className={p.video ? 'tl-ok' : 'tl-no'} title={p.video ? 'Mandó video' : 'Sin video'}><PlayCircle size={17} /></span>
                <span className={p.llamada ? 'tl-ok' : 'tl-no'} title={p.llamada ? 'Mandó una llamada' : 'Sin llamada'} style={{ marginLeft: 8 }}><PhoneCall size={16} /></span>
            </div>
            <div role="cell">
                {digitos ? (
                    <a className="tl-wa" href={`https://wa.me/${digitos}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Escribirle por WhatsApp">
                        <img src={logoWhatsapp} alt="" />
                        <span className="trunc">{String(p.whatsapp).replace(/^\+\d{1,3}\s*/, '')}</span>
                    </a>
                ) : <span className="tl-c-txt mut40">Sin WhatsApp</span>}
            </div>
            <div className="tl-c-score der" role="cell">
                {incompleta ? (
                    <>
                        <b title="Preguntas respondidas">{p.respondidas}<small style={{ fontSize: '.55em', opacity: 0.6 }}>/{p.total_preguntas}</small></b>
                        <Riel pct={avance} color="var(--error)" />
                    </>
                ) : (
                    <>
                        <b>{p.score ?? '—'}</b>
                        <Riel pct={p.score || 0} color={banda(p.score || 0)} />
                    </>
                )}
            </div>
            <div className="tl-c-fin" role="cell"><ChevronRight size={18} className="tl-c-go" /></div>
        </div>
    );
};

// `filasSeccion`: la lista ya armada de Analyze o Winners (closers de un veredicto). Sin ella es el Inbox.
const InboxCloser = ({ closers, pestana, q, filasSeccion = null }) => {
    const {
        filas, incompletas, porRevisar, archivadas, cargando, error, cargar, cargarArchivadas,
    } = closers;
    const [abierta, setAbierta] = useState(null);
    const [listaFicha, setListaFicha] = useState([]);
    const [anchos, setAnchos] = useState(leerAnchos);
    // Mientras se arrastra cambia en pantalla; se guarda al soltar (`px` null), con flechas o con el
    // doble clic que lo restablece (`undefined`).
    const cambiarAncho = (id, px, persistir) => setAnchos((prev) => {
        let nuevos = prev;
        if (px !== null) {
            nuevos = { ...prev };
            if (px === undefined) delete nuevos[id];
            else nuevos[id] = px;
        }
        if (persistir) guardarAnchos(nuevos);
        return nuevos;
    });
    const tabla = useRef(null);
    const enBusqueda = q.length > 0;
    const incompleta = !enBusqueda && pestana === 'incompletas';
    const antiguos = !enBusqueda && pestana === 'antiguos';

    useEffect(() => {
        if (pestana === 'antiguos' && archivadas === null) cargarArchivadas();
    }, [pestana, archivadas, cargarArchivadas]);

    const enSeccion = !enBusqueda && Array.isArray(filasSeccion);
    const lista = useMemo(() => {
        if (enBusqueda) return [...filas, ...incompletas, ...(archivadas || [])].filter((p) => coincideCloser(p, q));
        if (filasSeccion) return [...filasSeccion].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        if (antiguos) return archivadas || [];
        return incompleta ? incompletas : porRevisar;
    }, [enBusqueda, q, filas, incompletas, porRevisar, incompleta, antiguos, archivadas, filasSeccion]);
    const ids = useMemo(() => lista.map((p) => p.id), [lista]);

    // Al cambiar de pestaña las barritas vuelven a crecer.
    useEffect(() => {
        const t = tabla.current;
        if (!t) return undefined;
        t.classList.add('entra');
        const id = setTimeout(() => t.classList.remove('entra'), 1100);
        return () => clearTimeout(id);
    }, [pestana, enBusqueda, archivadas]);

    const abrir = (id) => { setListaFicha(ids.includes(id) ? ids : [id]); setAbierta(id); };

    let vacio = null;
    if (cargando || (antiguos && archivadas === null)) vacio = <p className="t-cap mut40">Cargando postulaciones…</p>;
    else if (enSeccion) {
        vacio = (
            <>
                <span className="tl-vacio-ico tl-vacio-ico--idle"><Search size={22} /></span>
                <p className="t-h3">Ningún closer en este estado</p>
            </>
        );
    }
    else if (antiguos) vacio = <p className="t-h3">No hay postulaciones de búsquedas anteriores</p>;
    else if (enBusqueda) {
        vacio = (
            <>
                <span className="tl-vacio-ico tl-vacio-ico--idle"><Search size={22} /></span>
                <p className="t-h3">Ningún closer coincide con «{q}»</p>
                <p className="mut t-cap">Probá con el nombre, el país, el correo o el WhatsApp.</p>
            </>
        );
    } else if (!incompleta) {
        vacio = (
            <>
                <AlDia />
                <p className="t-h3">Revisaste a todos los closers</p>
                <p className="mut t-cap">Los que califiques pasan a Analyze.</p>
            </>
        );
    } else {
        vacio = <p className="t-h3">Nadie dejó el formulario a medias</p>;
    }

    return (
        <>
            {error && <div className="tl-aviso-error"><AlertTriangle size={16} />{error}</div>}
            {!enBusqueda && !enSeccion && !incompleta && !antiguos && !cargando && (
                <div className="tl-resumen">
                    <Foco p={porRevisar[0] || null} onAbrir={abrir} />
                    <Avance filas={filas} />
                </div>
            )}
            <div className="tl-tabla-scroll">
                <div ref={tabla} className="tl-tabla" role="table" aria-label="Postulaciones de Closer"
                    style={{ '--cols': plantillaCols(COLS, anchos), '--minw': `${Math.max(1080, minAncho(COLS, anchos))}px` }}>
                    <div className="tl-tcab" role="row">
                        {COLS.map((c) => (
                            <Encabezado key={c.id} col={c} etiqueta={incompleta && c.id === 'score' ? 'Avance' : c.label}
                                onAncho={cambiarAncho} ancho={anchos[c.id]} />
                        ))}
                        <span />
                    </div>
                    {lista.length === 0 && <div className="tl-vacio">{vacio}</div>}
                    {lista.map((p) => <Fila key={p.id} p={p} conEstado={enBusqueda || antiguos} incompleta={incompleta || !p.completo} onAbrir={abrir} />)}
                    <div className="tl-tpie">
                        Mostrando <b>{lista.length}</b>
                        <span className="sep" />
                        {antiguos ? 'Búsquedas anteriores · las más recientes primero' : incompleta ? 'Las más recientes primero' : 'Mejor score primero'}
                    </div>
                </div>
            </div>
            {abierta && (
                <div className="dash-v6 text-white">
                    <FichaCloser applicationId={abierta} ids={listaFicha.includes(abierta) ? listaFicha : [abierta]}
                        onClose={() => setAbierta(null)} onNavigate={setAbierta} onDecidido={() => cargar({ silencioso: true })} />
                </div>
            )}
        </>
    );
};

export default InboxCloser;
