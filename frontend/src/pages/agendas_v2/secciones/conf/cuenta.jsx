// Lo de cada cuenta, con el estilo de Thalamus: datos, Google Calendar, WhatsApp y disponibilidad.
// Lo usan la Configuración de Agendamiento y la del closer (que lo envuelve en `.thalamus`). No tiene
// lógica propia: habla con los mismos endpoints de NeurOPS (/google/*, /auth/me/*).
//
// Google Calendar y el WhatsApp confirmado son obligatorios para recibir agendas (app/agendas_v2/
// servicio.py, solo_elegibles). La disponibilidad es el horario de la persona de Team de la cuenta.

import { useEffect, useState } from 'react';
import api from '../../../../services/api';
import { rotuloDeRol } from '../../../../utils/cuentasVinculadas';
import { Icono, Sx } from '../../ui/base';
import { HorarioEditor } from '../team/Horario';
import FotoCuenta from './FotoCuenta';

function Estado({ ok, si, no }) {
    return ok
        ? <span className="chip" style={{ '--c': 'var(--success)' }}><Icono n="check" />{si}</span>
        : <span className="chip" style={{ '--c': 'var(--warning)' }}><Icono n="alerta" />{no}</span>;
}

// Tarjeta de un ajuste: ícono, título, para qué sirve y su estado.
function Tarjeta({ icono, titulo, texto, estado, children }) {
    return (
        <section className="panel cu-tarjeta">
            <header className="cu-cab">
                <span className="icono-m"><Icono n={icono} s={19} /></span>
                <div className="cu-tit"><h3 className="t-h3">{titulo}</h3>{texto && <p className="t-sm mut">{texto}</p>}</div>
                {estado}
            </header>
            {children}
        </section>
    );
}

function Mensajes({ error, aviso }) {
    return (
        <>
            {error && <p className="campo-err" role="alert"><Icono n="alerta" s={14} />{error}</p>}
            {aviso && <p className="cu-ok" role="status"><Icono n="check" s={14} />{aviso}</p>}
        </>
    );
}

/** Quién es la cuenta: su foto, usuario, email y roles. Sin email lo puede cargar (para entrar con Google). */
export function DatosCuenta({ user }) {
    const [email, setEmail] = useState('');
    const [guardado, setGuardado] = useState(user?.email || '');
    const [error, setError] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    if (!user) return null;
    const roles = user.roles?.length ? user.roles : [user.role];
    const cargar = async (e) => {
        e.preventDefault();
        setOcupado(true); setError(null);
        try {
            const r = await api.put('/auth/me/email', { email });
            setGuardado(r.data?.user?.email || r.data?.email || email.trim().toLowerCase());
        } catch (err) {
            setError(err?.response?.data?.message || 'No se pudo guardar el email.');
        } finally { setOcupado(false); }
    };
    return (
        <section className="panel cu-tarjeta cu-datos">
            <FotoCuenta nombre={user.username} />
            <div className="cu-datos-txt">
                <p className="t-eyebrow">Tu cuenta</p>
                <h3 className="t-h2">{user.username}</h3>
                {guardado ? <p className="t-sm mut"><Icono n="mail" s={14} /> {guardado}</p> : (
                    <form className="entrada cu-email" onSubmit={cargar} noValidate>
                        <span className="prefijo"><Icono n="mail" /></span>
                        <label className="sr" htmlFor="cu-email">Tu email</label>
                        <input id="cu-email" type="email" placeholder="Cargá tu email para entrar con Google" value={email} onChange={(e) => setEmail(e.target.value)} />
                        <button type="submit" className="btn btn--cta btn--sm" disabled={ocupado || !email.trim()}>Guardar</button>
                    </form>
                )}
                <div className="cu-roles">
                    {roles.map((r) => (
                        <span key={r} className="chip chip--n" style={{ '--c': r === user.role ? 'var(--brand-secondary)' : 'var(--idle)' }}>{rotuloDeRol(r)}</span>
                    ))}
                </div>
                <Mensajes error={error} />
            </div>
        </section>
    );
}

// Vuelta de Google: el resultado llega en ?google_connected= y se borra de la dirección.
function leerVueltaDeGoogle() {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('google_connected');
    if (!r) return {};
    params.delete('google_connected');
    const resto = params.toString();
    window.history.replaceState({}, document.title, window.location.pathname + (resto ? '?' + resto : ''));
    if (r === 'success') return { aviso: 'Tu cuenta de Google quedó conectada.' };
    if (r === 'cancelado') return { error: 'Cancelaste la conexión con Google. Sin el calendario conectado no recibís agendas.' };
    return { error: 'Google no pudo completar la conexión. Probá de nuevo; si sigue fallando, avisá a operaciones.' };
}

/**
 * Google Calendar: conectar (vuelve a esta pantalla), elegir en qué calendario se crean las agendas y
 * desconectar. volver: a dónde lo devuelve Google ('agendamiento' o, sin nada, a esta misma pantalla con la
 * Configuración abierta, sesion/ConfiguracionContext.jsx).
 */
export function TarjetaCalendar({ volver }) {
    const [st, setSt] = useState(null); // { connected, vencido, calendars, selected_calendar }
    const [destino, setDestino] = useState('primary');
    const [msg, setMsg] = useState(() => leerVueltaDeGoogle());
    const [ocupado, setOcupado] = useState(false);

    const leer = () => api.get('/google/calendars').then((r) => {
        setSt(r.data);
        if (r.data.connected) setDestino(r.data.selected_calendar || 'primary');
    }).catch(() => setSt({ connected: false }));
    useEffect(() => { leer(); }, []);

    const correr = async (fn) => {
        setOcupado(true);
        try { await fn(); } catch { setMsg({ error: 'Algo falló con Google. Probá de nuevo.' }); } finally { setOcupado(false); }
    };
    const conectar = () => correr(async () => {
        const r = await api.get('/google/login', { params: { volver: volver || window.location.pathname } });
        if (r.data.auth_url) window.location.href = r.data.auth_url;
    });
    const elegir = (v) => correr(async () => {
        setDestino(v);
        await api.post('/google/calendars', { calendar_id: v });
        setMsg({ aviso: 'Las agendas nuevas se crean en ese calendario.' });
    });
    // Como en Calendly: en qué calendarios se miran los conflictos antes de ofrecerte a un lead.
    const alternarConflicto = (id, on) => correr(async () => {
        const actual = st.conflicto || [];
        const nuevo = on ? [...actual, id] : actual.filter(x => x !== id);
        const r = await api.post('/google/calendars', { conflicto: nuevo });
        setSt(x => ({ ...x, conflicto: r.data?.conflicto || nuevo }));
    });
    const desconectar = () => correr(async () => {
        await api.post('/google/disconnect');
        setSt({ connected: false });
        setMsg({ aviso: 'Desconectaste tu Google Calendar.' });
    });

    const conectado = !!st?.connected;
    return (
        <Tarjeta icono="calendar" titulo="Google Calendar"
            texto="Ahí se crea cada agenda, con su Meet. Sin él, el sistema de agendas no te ofrece a los leads."
            estado={st && <Estado ok={conectado} si="Conectado" no={st.vencido ? 'Vencido' : 'Sin conectar'} />}>
            {!st ? <p className="t-sm mut">Cargando…</p> : conectado ? (
                <div className="cu-fila">
                    <span className="t-rotulo">Calendario de destino</span>
                    <Sx id="cu-cal" label="Calendario de destino" valor={destino} disabled={ocupado} onChange={elegir}
                        opciones={(st.calendars || []).map((c) => ({ v: c.id, n: c.summary + (c.primary ? ' (principal)' : ''), icono: 'calendar', color: 'var(--info)' }))} />
                    <button type="button" className="btn btn--peligro btn--sm" disabled={ocupado} onClick={desconectar}>Desconectar</button>
                    {(st.todos || []).length > 0 && (
                        <div className="cu-cals" role="group" aria-labelledby="cu-conf-tit">
                            <span className="t-rotulo" id="cu-conf-tit">Revisar conflictos en</span>
                            <p className="t-cap mut">Si tenés algo en estos calendarios, en ese horario no te ofrecemos a los leads.</p>
                            {st.todos.map((c) => {
                                const on = (st.conflicto || []).includes(c.id);
                                return (
                                    <label key={c.id} className="cu-cal">
                                        <button type="button" className="switch" role="switch" aria-checked={on} disabled={ocupado}
                                            aria-label={'Revisar conflictos en ' + c.summary} onClick={() => alternarConflicto(c.id, !on)} />
                                        <span className="trunc">{c.summary}</span>
                                        {c.primary && <span className="chip chip--n" style={{ '--c': 'var(--idle)' }}>Principal</span>}
                                        {c.id === destino && <span className="chip chip--n" style={{ '--c': 'var(--info)' }}>Destino</span>}
                                        {!c.escribe && <span className="t-cap mut40">solo lectura</span>}
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div className="cu-fila">
                    <p className="t-sm mut" style={{ flex: '1 1 220px' }}>
                        {st.vencido ? 'Google dejó de aceptar tu conexión. Volvé a conectar tu cuenta para seguir recibiendo agendas.' : 'Conectá tu cuenta de Google para recibir agendas.'}
                    </p>
                    <button type="button" className="btn btn--cta btn--sm" disabled={ocupado} onClick={conectar}>
                        <Icono n="enchufe" />{st.vencido ? 'Volver a conectar' : 'Conectar con Google'}
                    </button>
                </div>
            )}
            <Mensajes error={msg.error} aviso={msg.aviso} />
        </Tarjeta>
    );
}

/** WhatsApp: guardar el número, mandar una prueba y confirmar que llegó. Cambiar el número lo vuelve a pedir. */
export function TarjetaWhatsapp() {
    const [estado, setEstado] = useState(null); // { numero, confirmado }
    const [numero, setNumero] = useState('');
    const [paso, setPaso] = useState('editar'); // editar | enviado
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    const [aviso, setAviso] = useState(null);

    const aplicar = (datos) => { setEstado(datos); setNumero(datos.numero || ''); };
    useEffect(() => {
        api.get('/auth/me/whatsapp').then((r) => aplicar(r.data)).catch(() => setError('No se pudo leer tu número.'));
    }, []);
    const correr = async (fn) => {
        setOcupado(true); setError(null); setAviso(null);
        try { await fn(); } catch (e) { setError(e?.response?.data?.message || 'Algo falló. Probá de nuevo.'); } finally { setOcupado(false); }
    };
    const probar = () => correr(async () => {
        const r = await api.put('/auth/me/whatsapp', { numero });
        aplicar(r.data);
        await api.post('/auth/me/whatsapp/prueba');
        setPaso('enviado');
        setAviso('Te mandamos un WhatsApp de prueba. ¿Te llegó?');
    });
    const confirmar = () => correr(async () => {
        const r = await api.post('/auth/me/whatsapp/confirmar');
        aplicar(r.data);
        setPaso('editar');
        setAviso('Listo: tu WhatsApp quedó confirmado.');
    });

    const cambio = estado && numero.replace(/\D/g, '') !== (estado.numero || '');
    return (
        <Tarjeta icono="whatsapp" titulo="WhatsApp" texto="Te avisamos cada agenda nueva con los datos del lead."
            estado={estado && <Estado ok={estado.confirmado && !cambio} si="Confirmado" no="Sin confirmar" />}>
            {!estado && !error ? <p className="t-sm mut">Cargando…</p> : (
                <div className="cu-fila">
                    <div className="entrada" style={{ flex: '1 1 240px' }}>
                        <span className="prefijo">+</span>
                        <label className="sr" htmlFor="cu-wa">Tu número, con código de país</label>
                        <input id="cu-wa" type="tel" inputMode="numeric" placeholder="5491122334455" value={numero}
                            onChange={(e) => { setNumero(e.target.value); setPaso('editar'); }} />
                    </div>
                    {paso === 'enviado' ? (
                        <>
                            <button type="button" className="btn btn--linea btn--sm" disabled={ocupado} onClick={probar}>No me llegó, reenviar</button>
                            <button type="button" className="btn btn--cta btn--sm" disabled={ocupado} onClick={confirmar}><Icono n="check" />Sí, me llegó</button>
                        </>
                    ) : (!estado?.confirmado || cambio) && (
                        <button type="button" className="btn btn--cta btn--sm" disabled={ocupado || numero.replace(/\D/g, '').length < 8} onClick={probar}>
                            <Icono n="whatsapp" />Mandarme una prueba
                        </button>
                    )}
                </div>
            )}
            <p className="t-cap mut40">Con código de país, sin + ni espacios.</p>
            <Mensajes error={error} aviso={aviso} />
        </Tarjeta>
    );
}

/** La disponibilidad: el horario de la persona de Team de esta cuenta, con el mismo editor de Team. */
export function TarjetaDisponibilidad() {
    const [datos, setDatos] = useState(null);
    const [horario, setHorario] = useState({});
    const [tz, setTz] = useState('');
    const [cambios, setCambios] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    const [aviso, setAviso] = useState(null);

    const aplicar = (r) => { setDatos(r); setHorario(r.horario || {}); setTz(r.tz); setCambios(false); };
    useEffect(() => {
        api.get('/auth/me/disponibilidad').then((r) => aplicar(r.data)).catch(() => setError('No se pudo leer tu disponibilidad.'));
    }, []);
    const editar = (campos) => {
        if (campos.horario) setHorario(campos.horario);
        if (campos.tz) setTz(campos.tz);
        setCambios(true); setAviso(null);
    };
    const guardar = async () => {
        setOcupado(true); setError(null);
        try {
            const r = await api.put('/auth/me/disponibilidad', { horario, tz });
            aplicar(r.data);
            setAviso('Listo: tu disponibilidad quedó guardada.');
        } catch (e) {
            setError(e?.response?.data?.message || 'No se pudo guardar. Probá de nuevo.');
        } finally { setOcupado(false); }
    };

    return (
        <Tarjeta icono="clock" titulo="Disponibilidad" texto="Los horarios en los que el sistema te ofrece a los leads. La dirección comercial también puede ajustarlos.">
            {!datos ? <p className="t-sm mut">{error || 'Cargando…'}</p> : (
                <>
                    <div className="horario--horizontal"><HorarioEditor p={{ id: 'yo', horario, tz }} onGuardar={editar} /></div>
                    <div className="cu-fila cu-fila--fin">
                        <Mensajes error={error} aviso={aviso} />
                        <button type="button" className="btn btn--cta btn--sm" disabled={ocupado || !cambios} onClick={guardar}>
                            {ocupado ? 'Guardando…' : 'Guardar disponibilidad'}
                        </button>
                    </div>
                </>
            )}
        </Tarjeta>
    );
}
