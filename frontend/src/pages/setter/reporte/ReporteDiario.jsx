import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Check, Moon, PenLine, Send, Trophy } from 'lucide-react';
import api from '../../../services/api';
import Calendario from './Calendario';
import Celda from './Celda';
import Flujo from './Flujo';
import Resumen from './Resumen';
import { ChipAviso, ChipCanal, ChipRespuesta, Numero, useAngosto } from './Piezas';
import { reanimar, reducido } from './movimiento';
import {
    AMBOS, BIENVENIDAS, CANALES, ETAPAS, FOLLOWUPS, PASOS, aPayload, aplicarPrecarga, calcular, conRuta,
    desdeLectura, estadoDelPaso, fmtInt, fusionar, hoyIso, leerRuta, primerError, proporcion, textoFecha,
    topeDeArrastre, vacio,
} from './modelo';
import './reporteDiario.css';

/**
 * El reporte diario del setter: el formulario por pasos que aprobó Kerwin el 10/10/2026.
 *
 * Entrantes · Aperturas · Embudo · Follow-ups · Reflexión · Resumen, con una columna por canal
 * (anuncios, inbound y las bienvenidas) y abajo de cada una lo que produce lo que se cargó: el
 * pedazo del embudo de ese paso. Reemplaza a `PublicSetterReportPage`, el formulario de una sola
 * pantalla que cargaba totales sin canales.
 *
 * El setter es el de la sesión (simulando, el simulado): el formulario no ofrece elegir a otro, y
 * el backend tampoco se lo dejaría. La fecha vive en la URL (`fecha`), así el Historial puede abrir
 * un día para editarlo.
 *
 * De dónde salen los números de un día, en este orden:
 *   1. el borrador de ESTE navegador para ese setter y ese día (lo que escribió y no envió);
 *   2. si no hay borrador, lo que ya envió (el backend lo devuelve con `leer()`);
 *   3. si no envió nada, la precarga del sistema (`/prefill`), que nunca pisa lo que el setter
 *      tocó a mano.
 * El borrador es solo una comodidad: localStorage puede no estar (ventana privada, sitio sin
 * datos) y entonces el formulario anda igual, sin recordar.
 */

const claveBorrador = (setterId, fecha) => `neurops:reporte-setter:v2:${setterId}:${fecha}`;

const leerBorrador = (setterId, fecha) => {
    try {
        const crudo = window.localStorage.getItem(claveBorrador(setterId, fecha));
        return crudo ? JSON.parse(crudo) : null;
    } catch {
        return null;
    }
};

const guardarBorrador = (setterId, fecha, estado, tocados) => {
    try {
        window.localStorage.setItem(claveBorrador(setterId, fecha),
            JSON.stringify({ estado, tocados: [...tocados], guardado: Date.now() }));
    } catch { /* sin almacenamiento: el formulario sigue, sin recordar */ }
};

const borrarBorrador = (setterId, fecha) => {
    try { window.localStorage.removeItem(claveBorrador(setterId, fecha)); } catch { /* idem */ }
};

/** ¿Pantalla grande con mouse? Ahí cada paso arranca con el foco en su primer número. */
const escritorio = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(hover:hover) and (min-width:701px)').matches;

// --- Piezas de cada paso ----------------------------------------------------------------------

/** Un número con su rótulo. `punto` le pone el color del canal al rótulo (las agendas por canal). */
const Campo = ({ ruta, rotulo, canal, aria, ancho, punto, ctx }) => (
    <div className={`rd-campo2${ancho ? ' span' : ''}`}>
        <span className="rd-k">
            {punto && <i className="rd-punto" style={{ '--c': canal.c }} aria-hidden="true" />}
            {rotulo}
        </span>
        <Celda ruta={ruta} valor={leerRuta(ctx.estado, ruta)} color={canal.c} aria={aria}
            proporcion={proporcion(ctx.estado, ruta)} tope={topeDeArrastre(ctx.estado, ruta)}
            marca={ctx.marcas.get(ruta)} indice={ctx.orden.indexOf(ruta)} onCambio={ctx.cambiar} onEnter={ctx.alEnter} />
    </div>
);

/** Una columna del paso: arriba lo que se carga, abajo el número grande y su pedazo de embudo. */
const Columna = ({ canal, extra, campos, cols, grande, rotulo, ley, children, indice }) => (
    <div className="rd-pcol" style={{ '--c': canal.c, '--i': indice }}>
        <div className="rd-rcab"><ChipCanal canal={canal} />{extra}</div>
        <div className={`rd-campos${cols ? ` rd-campos--n rd-campos--${cols}` : ''}`} style={cols ? { '--m': cols } : undefined}>{campos}</div>
        <div className="rd-rbody">
            <div className="rd-rbig">{grande}<span>{rotulo}</span>{ley}</div>
            {children}
        </div>
    </div>
);

const Leyenda = ({ items }) => (
    <div className="rd-rley">
        {items.map(([texto, clase, color]) => (
            <span key={texto}><i className={clase} style={color ? { '--c': color } : undefined} />{texto}</span>
        ))}
    </div>
);

const PasoEntrantes = ({ ctx }) => {
    const { estado: s, num } = ctx;
    const mE = Math.max(1, s.anuncios.entrantes, s.inbound.entrantes);
    return (
        <section className="rd-pasopanel rd-vidrio" style={{ '--n': 3 }} aria-label="Entrantes">
            {CANALES.map((c, i) => (
                <Columna key={c.k} canal={c} indice={i}
                    campos={[
                        <Campo key="e" ctx={ctx} ruta={`${c.k}.entrantes`} rotulo="Nuevos mensajes" canal={c} aria={`${c.n}, nuevos mensajes`} ancho />,
                        <Campo key="n" ctx={ctx} ruta={`${c.k}.no_lead`} rotulo="No leads" canal={c} aria={`${c.n}, no leads`} />,
                        <Campo key="i" ctx={ctx} ruta={`${c.k}.inabribles`} rotulo="In-abribles" canal={c} aria={`${c.n}, in-abribles`} />,
                    ]}
                    grande={<Numero valor={num[`${c.k}.cualRate`]} tipo="pct" />} rotulo="cualificación">
                    <Flujo etapas={[{ n: 'Entrantes' }, { n: 'Cualificados' }]} color={c.c} fb={64} fg={104}
                        valores={[s[c.k].entrantes, num[`${c.k}.net`]]} max={mE} convs={[num[`${c.k}.cualRate`]]} />
                </Columna>
            ))}
            <Columna canal={BIENVENIDAS} indice={2}
                campos={[
                    <Campo key="h" ctx={ctx} ruta="bienvenidas.hechas" rotulo="Hechas" canal={BIENVENIDAS} aria="Bienvenidas, hechas" ancho />,
                    <Campo key="r" ctx={ctx} ruta="bienvenidas.respondidas" rotulo="Respondidas" canal={BIENVENIDAS} aria="Bienvenidas, respondidas" ancho />,
                ]}
                grande={<Numero valor={num['bienvenidas.rate']} tipo="pct" />} rotulo="respuesta">
                <Flujo etapas={[{ n: 'Hechas' }, { n: 'Respondidas' }]} color={BIENVENIDAS.c} fb={64} fg={104}
                    valores={[s.bienvenidas.hechas, s.bienvenidas.respondidas]}
                    max={Math.max(1, s.bienvenidas.hechas, s.bienvenidas.respondidas)} convs={[num['bienvenidas.rate']]} />
            </Columna>
        </section>
    );
};

// Anuncios e Inbound se abren sobre sus entrantes; Bienvenidas, sobre las que respondieron.
const PasoAperturas = ({ ctx }) => {
    const { estado: s, num } = ctx;
    const mE = Math.max(1, s.anuncios.entrantes, s.inbound.entrantes);
    return (
        <section className="rd-pasopanel rd-vidrio" style={{ '--n': 3 }} aria-label="Aperturas">
            {CANALES.map((c, i) => (
                <Columna key={c.k} canal={c} indice={i} extra={<ChipRespuesta d={s[c.k]} />}
                    campos={[
                        <Campo key="e" ctx={ctx} ruta={`${c.k}.ap_entrantes`} rotulo="En entrantes" canal={c} aria={`${c.n}, aperturas en entrantes`} />,
                        <Campo key="d" ctx={ctx} ruta={`${c.k}.ap_dolor`} rotulo="En dolor" canal={c} aria={`${c.n}, aperturas en dolor`} />,
                    ]}
                    grande={<Numero valor={num[`${c.k}.apRate`]} tipo="pct" />} rotulo="apertura"
                    ley={<Leyenda items={[['En entrantes', 'claro'], ['En dolor', '']]} />}>
                    <Flujo etapas={[{ n: 'Entrantes', ref: true }, { n: 'Aperturas', split: true }]} color={c.c} fb={64} fg={104}
                        valores={[s[c.k].entrantes, [s[c.k].ap_entrantes, s[c.k].ap_dolor]]} max={mE}
                        convs={[num[`${c.k}.apRate`]]} />
                </Columna>
            ))}
            <Columna canal={BIENVENIDAS} indice={2}
                campos={[<Campo key="a" ctx={ctx} ruta="bienvenidas.aperturas" rotulo="Aperturas" canal={BIENVENIDAS} aria="Bienvenidas, aperturas" ancho />]}
                grande={<Numero valor={num['bienvenidas.apRate']} tipo="pct" />} rotulo="apertura">
                <Flujo etapas={[{ n: 'Respondidas', ref: true }, { n: 'Aperturas' }]} color={BIENVENIDAS.c} fb={64} fg={104}
                    valores={[s.bienvenidas.respondidas, s.bienvenidas.aperturas]}
                    max={Math.max(1, s.bienvenidas.respondidas, s.bienvenidas.aperturas)} convs={[num['bienvenidas.apRate']]} />
            </Columna>
        </section>
    );
};

const PasoEmbudo = ({ ctx }) => {
    const { estado: s, num, G, convG } = ctx;
    const angosto = useAngosto();
    return (
        <section className="rd-pasopanel rd-pasopanel--1 rd-vidrio" style={{ '--n': 1 }} aria-label="Embudo">
            <Columna canal={AMBOS} indice={0} cols={5}
                extra={(
                    <span className="rd-rchips">
                        {CANALES.map(c => (
                            <span key={c.k} className="rd-chip" style={{ '--c': c.c }}>
                                <Numero valor={s[c.k].agendas} /> {c.n.toLowerCase()}
                            </span>
                        ))}
                    </span>
                )}
                campos={[
                    ...ETAPAS.map(([k, n]) => <Campo key={k} ctx={ctx} ruta={`embudo.${k}`} rotulo={n} canal={AMBOS} aria={n} />),
                    ...CANALES.map(c => (
                        <Campo key={c.k} ctx={ctx} ruta={`${c.k}.agendas`} rotulo={`Agendas ${c.n.toLowerCase()}`} canal={c}
                            aria={`Agendas de ${c.n.toLowerCase()}`} punto />
                    )),
                ]}
                grande={<Numero valor={num['tot.convRate']} tipo="pct" />} rotulo="de cualificados a agenda"
                ley={<Leyenda items={CANALES.map(c => [c.n, '', c.c])} />}>
                <Flujo etapas={[{ n: 'Cualificados', ref: true }, ...ETAPAS.map(([, n]) => ({ n })), { n: 'Agendas', split: 'canales' }]}
                    color="var(--ch-tot)" tot fb={76} fg={angosto ? 70 : 150} max={Math.max(1, ...G)} convs={convG.slice(1)}
                    valores={[G[0], G[1], G[2], G[3], [s.anuncios.agendas, s.inbound.agendas]]} />
            </Columna>
        </section>
    );
};

const PasoFollowups = ({ ctx }) => {
    const { estado: s, num } = ctx;
    const angosto = useAngosto();
    const valores = FOLLOWUPS.map(([k]) => s.followups[k]);
    return (
        <section className="rd-pasopanel rd-pasopanel--1 rd-vidrio" style={{ '--n': 1 }} aria-label="Follow-ups">
            <Columna canal={AMBOS} indice={0} cols={4}
                campos={FOLLOWUPS.map(([k, n]) => (
                    <Campo key={k} ctx={ctx} ruta={`followups.${k}`} rotulo={n} canal={AMBOS} aria={`Follow-ups en ${n.toLowerCase()}`} />
                ))}
                grande={<Numero valor={num['tot.fuTot']} />} rotulo="follow-ups">
                <Flujo etapas={FOLLOWUPS.map(([, n]) => ({ n }))} color="var(--ch-tot)" tot bandas={false} fb={96} fg={angosto ? 40 : 170}
                    valores={valores} max={Math.max(1, ...valores)} />
            </Columna>
        </section>
    );
};

const PasoReflexion = ({ ctx }) => (
    <div className="rd-notas rd-vidrio">
        <div className="rd-nota">
            <label className="rd-k" htmlFor="rd-r-flujo"><PenLine strokeWidth={1.75} aria-hidden="true" />Flujo de trabajo</label>
            <div className="rd-area">
                <textarea id="rd-r-flujo" value={ctx.estado.reflexion.flujo_trabajo}
                    placeholder="Abrí 40 conversaciones, retomé 25 seguimientos, agendé 3."
                    onChange={(e) => ctx.cambiar('reflexion.flujo_trabajo', e.target.value)} />
            </div>
        </div>
        <div className="rd-nota">
            <label className="rd-k" htmlFor="rd-r-win"><Trophy strokeWidth={1.75} aria-hidden="true" />Win del día</label>
            <div className="rd-area">
                <textarea id="rd-r-win" value={ctx.estado.reflexion.win_del_dia}
                    placeholder="Una lead fría respondió al follow-up y agendó."
                    onChange={(e) => ctx.cambiar('reflexion.win_del_dia', e.target.value)} />
            </div>
        </div>
    </div>
);

const ORDEN = {
    entrantes: [...CANALES.flatMap(c => ['entrantes', 'no_lead', 'inabribles'].map(f => `${c.k}.${f}`)),
        'bienvenidas.hechas', 'bienvenidas.respondidas'],
    aperturas: [...CANALES.flatMap(c => [`${c.k}.ap_entrantes`, `${c.k}.ap_dolor`]), 'bienvenidas.aperturas'],
    embudo: [...ETAPAS.map(([k]) => `embudo.${k}`), ...CANALES.map(c => `${c.k}.agendas`)],
    followups: FOLLOWUPS.map(([k]) => `followups.${k}`),
};

const PANELES = {
    entrantes: PasoEntrantes,
    aperturas: PasoAperturas,
    embudo: PasoEmbudo,
    followups: PasoFollowups,
    reflexion: PasoReflexion,
};

// --- El festejo ---------------------------------------------------------------------------------

const COLORES_CHISPA = ['var(--brand-secondary)', 'var(--ch-inb)', 'var(--success)', 'var(--brand-secondary-light)'];

const Listo = ({ texto, onEditar }) => {
    const chispas = useMemo(() => (reducido() ? [] : Array.from({ length: 22 }, (_, i) => {
        const a = Math.random() * Math.PI * 2;
        const r = 90 + Math.random() * 120;
        return { c: COLORES_CHISPA[i % 4], dx: Math.cos(a) * r, dy: Math.sin(a) * r, dl: Math.random() * 120 };
    })), []);
    return (
        <div className="rd-listo rd-vidrio" role="status">
            <svg className="rd-ok" viewBox="0 0 84 84" aria-hidden="true">
                <circle cx="42" cy="42" r="40" />
                <path d="M27 43l10 10 20-22" />
            </svg>
            <h2>Reporte enviado</h2>
            <p>{texto}</p>
            <button type="button" className="rd-btn rd-btn--plain" onClick={onEditar}>Editar reporte</button>
            {chispas.map((ch, i) => (
                <i key={i} className="rd-chispa" aria-hidden="true"
                    style={{ '--c': ch.c, '--dx': `${ch.dx}px`, '--dy': `${ch.dy}px`, '--dl': `${ch.dl}ms` }} />
            ))}
        </div>
    );
};

// --- El formulario ------------------------------------------------------------------------------

const ReporteDiario = ({ setterId, onEnviado }) => {
    const [params, setParams] = useSearchParams();
    const hoy = hoyIso();
    const pedida = params.get('fecha');
    const fecha = pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) && pedida <= hoy ? pedida : hoy;

    const [estado, setEstado] = useState(vacio);
    const [paso, setPaso] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [yaEnviado, setYaEnviado] = useState(false);
    // El día se había mandado con el formulario anterior (sin canales).
    const [delV1, setDelV1] = useState(false);
    const [borrador, setBorrador] = useState(false);
    const [listo, setListo] = useState(null);
    const [enviando, setEnviando] = useState(false);
    const [enviados, setEnviados] = useState(() => new Set());
    const tocados = useRef(new Set());
    const sucio = useRef(false);
    const panelRef = useRef(null);
    const foco = useRef(null);

    // Cambiar de día: la fecha va a la URL (hoy no se escribe, es el día por defecto).
    const elegirFecha = (iso) => {
        const siguiente = new URLSearchParams(params);
        if (iso === hoy) siguiente.delete('fecha');
        else siguiente.set('fecha', iso);
        setParams(siguiente, { replace: true });
    };

    useEffect(() => {
        if (!setterId) return undefined;
        let vivo = true;
        const guardado = leerBorrador(setterId, fecha);
        tocados.current = new Set(guardado?.tocados || []);
        sucio.current = false;
        setEstado(guardado ? fusionar(vacio(), guardado.estado) : vacio());
        setBorrador(Boolean(guardado));
        setYaEnviado(false);
        setDelV1(false);
        setListo(null);
        setPaso(0);
        setCargando(true);

        // Lo que ya tocó a mano se conserva aunque la respuesta llegue después de que empezó.
        const conLoTocado = (base, previo) => [...tocados.current]
            .reduce((s, ruta) => conRuta(s, ruta, leerRuta(previo, ruta)), base);

        (async () => {
            try {
                const res = await api.get('/public/setter-report', { params: { setter_id: setterId, date: fecha } });
                if (!vivo) return;
                const enviadoAntes = res.data?.reporte;
                if (enviadoAntes) {
                    setYaEnviado(true);
                    setDelV1(enviadoAntes.version !== 2);
                    if (!guardado) setEstado(previo => conLoTocado(desdeLectura(enviadoAntes), previo));
                    // Un v2 es lo que mandó: no se precarga nada encima. Un v1 no tiene canales:
                    // esos sí se precargan, para rehacerlo por canal.
                    if (enviadoAntes.version === 2) return;
                }
                const pre = await api.get('/public/setter-report/prefill', { params: { setter_id: setterId, date: fecha } });
                if (!vivo) return;
                setEstado(previo => aplicarPrecarga(previo, pre.data, tocados.current));
            } catch {
                // Sin el reporte guardado o sin la precarga, el formulario sigue: se carga a mano.
            } finally {
                if (vivo) setCargando(false);
            }
        })();
        return () => { vivo = false; };
    }, [setterId, fecha]);

    // El borrador se guarda solo con lo que el setter cambió, nunca con la precarga sola.
    useEffect(() => {
        if (sucio.current && setterId) guardarBorrador(setterId, fecha, estado, tocados.current);
    }, [estado, setterId, fecha]);

    const cambiar = useCallback((ruta, valor) => {
        tocados.current.add(ruta);
        sucio.current = true;
        setBorrador(true);
        setListo(null);
        setEstado(s => conRuta(s, ruta, valor));
    }, []);

    const calc = useMemo(() => calcular(estado), [estado]);

    const ir = useCallback((i, { teclado = false, ultimo = false, enfocar = true } = {}) => {
        const destino = Math.max(0, Math.min(PASOS.length - 1, i));
        foco.current = enfocar && (teclado || escritorio()) ? { ultimo, scroll: teclado } : null;
        setListo(null);
        setPaso(destino);
    }, []);

    // Lleva el foco a un número (o a un texto) y lo marca con la llegada.
    const llevarA = (el, scroll = true) => {
        el.focus({ preventScroll: true });
        if (el.matches('input')) el.select();
        if (scroll) el.scrollIntoView({ block: 'nearest', behavior: reducido() ? 'auto' : 'smooth' });
        reanimar(el.closest('.rd-tile'), 'rd-llega');
    };

    // Al entrar a un paso, el foco va a su primer número (o al último, volviendo con Shift+Enter).
    useEffect(() => {
        const pedido = foco.current;
        foco.current = null;
        if (!pedido || !panelRef.current) return;
        const campos = panelRef.current.querySelectorAll('input[data-ruta], textarea');
        const el = pedido.ultimo ? campos[campos.length - 1] : campos[0];
        if (el) llevarA(el, pedido.scroll);
    }, [paso]);

    const alEnter = useCallback((ruta, atras) => {
        const campos = [...(panelRef.current?.querySelectorAll('input[data-ruta]') || [])];
        const i = campos.findIndex(c => c.dataset.ruta === ruta);
        const sig = campos[i + (atras ? -1 : 1)];
        if (sig) llevarA(sig);
        else if (!atras && paso < PASOS.length - 1) ir(paso + 1, { teclado: true });
        else if (atras && paso > 0) ir(paso - 1, { teclado: true, ultimo: true });
    }, [paso, ir]);

    const enviar = async () => {
        const err = primerError(calc.avisos);
        if (err) {
            ir(PASOS.findIndex(p => p.k === err.paso));
            toast.error(err.msg);
            return;
        }
        setEnviando(true);
        try {
            await api.post('/public/setter-report', aPayload(estado, fecha, setterId));
            borrarBorrador(setterId, fecha);
            sucio.current = false;
            setBorrador(false);
            setYaEnviado(true);
            setDelV1(false);
            setEnviados(e => new Set(e).add(fecha));
            const hora = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
            setListo(estado.is_non_working_day
                ? `${hora} · día no laborable`
                : `${hora} · ${fmtInt(calc.num['tot.entr'])} entrantes · ${fmtInt(calc.num['tot.agendas'])} agendas`);
            onEnviado?.(fecha);
        } catch (e) {
            toast.error(e?.response?.data?.message || 'No se pudo enviar el reporte. Probá de nuevo.');
        } finally {
            setEnviando(false);
        }
    };

    // Las marcas del calendario: "Enviado" del backend, "Borrador" de este navegador.
    const alCambiarMes = useCallback((desde, hasta) => {
        if (!setterId) return;
        api.get('/public/setter-report/fechas', { params: { setter_id: setterId, desde, hasta } })
            .then(res => setEnviados(prev => new Set([...prev, ...(res.data?.fechas || [])])))
            .catch(() => { /* sin marcas: el calendario sigue andando */ });
    }, [setterId]);
    const estadoDe = (iso) => {
        const b = iso === fecha ? (borrador ? {} : null) : leerBorrador(setterId, iso);
        if (b) return 'borrador';
        return enviados.has(iso) || (iso === fecha && yaEnviado) ? 'enviado' : null;
    };

    const noLaborable = estado.is_non_working_day;
    const ultimo = paso === PASOS.length - 1;
    const pasoK = PASOS[paso].k;
    const Panel = PANELES[pasoK];
    // El orden de las celdas del paso: escalona su entrada (cada una 35 ms después de la anterior).
    const ctx = { estado, ...calc, cambiar, alEnter, orden: ORDEN[pasoK] || [] };
    const avisosDelPaso = calc.avisos.filter(a => a.paso === pasoK);

    return (
        <div className="dc-shell dc-shell--embebido rd">
            <div className="rd-barra">
                <nav className="rd-pasos" aria-label="Pasos del reporte">
                    {PASOS.map((p, i) => {
                        const est = estadoDelPaso(calc.avisos, p.k);
                        const hecho = listo ? true : i < paso;
                        const clases = ['rd-pz', hecho && 'on', est === 'warn' && 'warn', est === 'err' && 'err'].filter(Boolean).join(' ');
                        return (
                            <button key={p.k} type="button" className={clases} disabled={noLaborable}
                                aria-current={!listo && i === paso ? 'step' : undefined} onClick={() => ir(i)}>
                                <span className="rd-tn"><span>{i + 1}</span><Check strokeWidth={2} aria-hidden="true" /></span>
                                <span className="rd-pz-n">{p.n}</span>
                            </button>
                        );
                    })}
                </nav>
                <div className="rd-barra-der">
                    {cargando && <span className="rd-chip rd-chip--quieto" style={{ '--c': 'var(--text-muted)' }}>Cargando…</span>}
                    {!cargando && yaEnviado && !borrador && !delV1 && (
                        <span className="rd-chip" style={{ '--c': 'var(--success)' }}><Check strokeWidth={2} aria-hidden="true" /><span>Enviado</span></span>
                    )}
                    {!cargando && delV1 && !listo && (
                        <span className="rd-chip" style={{ '--c': 'var(--info)' }}
                            title="Ese día lo mandaste con el formulario anterior, sin canales. Si lo volvés a enviar, queda por canal.">
                            <span>Formulario anterior</span>
                        </span>
                    )}
                    {!cargando && borrador && !listo && (
                        <span className="rd-chip" style={{ '--c': 'var(--text-muted)' }}
                            title="Guardado en este navegador: todavía no lo enviaste">
                            <span>{yaEnviado ? 'Cambios sin enviar' : 'Borrador'}</span>
                        </span>
                    )}
                    <button type="button" className={`rd-chip rd-chip--btn${noLaborable ? ' on' : ''}`} aria-pressed={noLaborable}
                        style={{ '--c': noLaborable ? 'var(--info)' : 'var(--text-muted)' }}
                        onClick={() => cambiar('is_non_working_day', !noLaborable)}>
                        <Moon strokeWidth={1.75} aria-hidden="true" /><span>No laborable</span>
                    </button>
                    <Calendario fecha={fecha} onElegir={elegirFecha} estadoDe={estadoDe} alCambiarMes={alCambiarMes} />
                </div>
            </div>

            <div className="rd-escena">
                {listo ? (
                    <Listo texto={listo} onEditar={() => ir(0)} />
                ) : noLaborable ? (
                    <div className="rd-listo rd-vidrio rd-nolab">
                        <Moon className="rd-nolab-ico" strokeWidth={1.5} aria-hidden="true" />
                        <h2>Día no laborable</h2>
                        <p>{textoFecha(fecha, hoy)} no suma en tus promedios ni en tus totales.</p>
                        <div className="rd-nav rd-nav--centro">
                            <button type="button" className="rd-btn rd-btn--plain" onClick={() => cambiar('is_non_working_day', false)}>
                                Sí trabajé
                            </button>
                            <button type="button" className="rd-btn rd-btn--cta" disabled={enviando} onClick={enviar}>
                                <span>{enviando ? 'Enviando…' : 'Enviar reporte'}</span><Send strokeWidth={1.75} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="rd-flujo">
                        <h2 className="rd-sr">{PASOS[paso].n}</h2>
                        <div className="rd-paneles" ref={panelRef}>
                            <div className="rd-panel" key={pasoK}>
                                {Panel ? <Panel ctx={ctx} /> : <Resumen estado={estado} conAvisos />}
                            </div>
                        </div>
                        <div className="rd-nav">
                            <button type="button" className="rd-btn rd-btn--plain" style={{ visibility: paso === 0 ? 'hidden' : undefined }}
                                onClick={() => ir(paso - 1)}>
                                <ArrowLeft strokeWidth={1.75} aria-hidden="true" />Atrás
                            </button>
                            <div className="rd-avisos" aria-live="polite">
                                {!ultimo && avisosDelPaso.map(a => <ChipAviso key={a.msg} aviso={a} />)}
                            </div>
                            <span className="rd-hint" style={{ visibility: Panel && pasoK !== 'reflexion' ? undefined : 'hidden' }}>
                                <span className="rd-tecla">Enter</span>siguiente número
                            </span>
                            {ultimo ? (
                                <button type="button" className="rd-btn rd-btn--cta" disabled={enviando || !setterId} onClick={enviar}>
                                    <span>{enviando ? 'Enviando…' : 'Enviar reporte'}</span><Send strokeWidth={1.75} aria-hidden="true" />
                                </button>
                            ) : (
                                <button type="button" className="rd-btn rd-btn--sec" onClick={() => ir(paso + 1)}>
                                    <span>{PASOS[paso + 1].n}</span><ArrowRight strokeWidth={1.75} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReporteDiario;

