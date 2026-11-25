// Lo de cada cuenta, con el estilo de Thalamus: datos, Google Calendar y WhatsApp (disponibilidad y sesiones,
// en disponibilidad.jsx).
// Lo usan la Configuración de Agendamiento y la del closer (que lo envuelve en `.thalamus`). No tiene
// lógica propia: habla con los mismos endpoints de NeurOPS (/google/*, /auth/me/*).
//
// Google Calendar y el WhatsApp confirmado son obligatorios para recibir agendas (app/agendas_v2/
// servicio.py, solo_elegibles).

import { useEffect, useState } from 'react';
import api from '../../../../services/api';
import { rotuloDeRol } from '../../../../utils/cuentasVinculadas';
import { Icono, Sx } from '../../ui/base';
import Cupos from './Cupos';
import FotoCuenta from './FotoCuenta';
import { Button, Chip, FieldError, InputGroup, Panel, Switch } from '../../../../components/standard';

export function Estado({ ok, si, no }) {
    return ok
        ? <Chip color="var(--success)" icon={<Icono n="check" />}>{si}</Chip>
        : <Chip color="var(--warning)" icon={<Icono n="alerta" />}>{no}</Chip>;
}

// Tarjeta de un ajuste: ícono, título, para qué sirve y su estado.
export function Tarjeta({ icono, titulo, texto, estado, clase = '', aura, children }) {
    return (
        <Panel as="section" className={'cu-tarjeta ' + clase} aura={aura} soft>
            <header className="cu-cab">
                <span className="icono-m"><Icono n={icono} s={19} /></span>
                <div className="cu-tit"><h3 className="t-h3">{titulo}</h3>{texto && <p className="t-sm mut">{texto}</p>}</div>
                {estado}
            </header>
            {children}
        </Panel>
    );
}

export function Mensajes({ error, aviso }) {
    return (
        <>
            {error && <FieldError>{error}</FieldError>}
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
        <Panel as="section" className="cu-tarjeta cu-datos">
            <FotoCuenta nombre={user.username} />
            <div className="cu-datos-txt">
                <p className="t-eyebrow">Tu cuenta</p>
                <h3 className="t-h2">{user.username}</h3>
                {guardado ? <p className="t-sm mut"><Icono n="mail" s={14} /> {guardado}</p> : (
                    <InputGroup as="form" className="cu-email" prefix={<Icono n="mail" />} onSubmit={cargar} noValidate>
                        <label className="sr" htmlFor="cu-email">Tu email</label>
                        <input id="cu-email" type="email" placeholder="Cargá tu email para entrar con Google" value={email} onChange={(e) => setEmail(e.target.value)} />
                        <Button variant="primary" type="submit" disabled={ocupado || !email.trim()}>Guardar</Button>
                    </InputGroup>
                )}
                <div className="cu-roles">
                    {roles.map((r) => (
                        <Chip key={r} color={r === user.role ? 'var(--brand-secondary)' : 'var(--idle)'} subtle>{rotuloDeRol(r)}</Chip>
                    ))}
                </div>
                <Mensajes error={error} />
            </div>
        </Panel>
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
    const [version, setVersion] = useState(0); // al cambiar un calendario, los cupos vuelven a leer Google

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
        setVersion(n => n + 1);
    });
    // Como en Calendly: en qué calendarios se miran los conflictos antes de ofrecerte a un lead.
    const alternarConflicto = (id, on) => correr(async () => {
        const actual = st.conflicto || [];
        const nuevo = on ? [...actual, id] : actual.filter(x => x !== id);
        const r = await api.post('/google/calendars', { conflicto: nuevo });
        setSt(x => ({ ...x, conflicto: r.data?.conflicto || nuevo }));
        setVersion(n => n + 1);
    });
    const desconectar = () => correr(async () => {
        await api.post('/google/disconnect');
        setSt({ connected: false });
        setMsg({ aviso: 'Desconectaste tu Google Calendar.' });
    });

    const conectado = !!st?.connected;
    const activos = new Set(st?.conflicto || []);
    const todos = st?.todos || [];
    const fila = (c) => {
        const on = activos.has(c.id);
        return (
            <label key={c.id} className={'cu-cal' + (on ? ' cu-cal--on' : '')}>
                <Switch checked={on} disabled={ocupado} label={'Revisar conflictos en ' + c.summary} onChange={v => alternarConflicto(c.id, v)} />
                <span className="trunc">{c.summary}</span>
                {c.id === destino && <Chip color="var(--info)" subtle>Agendas</Chip>}
                {!c.escribe && <span className="t-cap mut40">lectura</span>}
            </label>
        );
    };
    return (
        <Tarjeta icono="calendar" titulo="Google Calendar"
            estado={st && <Estado ok={conectado} si="Conectado" no={st.vencido ? 'Vencido' : 'Sin conectar'} />}>
            {!st ? <p className="t-sm mut">Cargando…</p> : conectado ? (
                <>
                    <div className="cu-fila">
                        <span className="t-rotulo">Agendas en</span>
                        <Sx id="cu-cal" label="Calendario donde se crean las agendas" valor={destino} disabled={ocupado} onChange={elegir}
                            opciones={(st.calendars || []).map((c) => ({ v: c.id, n: c.summary + (c.primary ? ' (principal)' : ''), icono: 'calendar', color: 'var(--info)' }))} />
                        <Button variant="danger" disabled={ocupado} onClick={desconectar}>Desconectar</Button>
                    </div>
                    <Cupos version={version} />
                    {todos.length > 0 && (
                        <div className="cu-cals" role="group" aria-labelledby="cu-conf-tit">
                            <p className="cu-cals-cab">
                                <span className="t-rotulo" id="cu-conf-tit">Te bloquean</span>
                                <span className="t-cap mut">Solo lo marcado como Ocupado. Lo Disponible no te bloquea.</span>
                            </p>
                            <div className="cu-cals-grilla">
                                {todos.filter(c => activos.has(c.id)).map(fila)}
                                {!activos.size && <p className="t-cap mut40">Ninguno: no se revisa tu calendario.</p>}
                            </div>
                            {todos.some(c => !activos.has(c.id)) && (
                                <>
                                    <span className="t-rotulo cu-cals-sep">No se revisan</span>
                                    <div className="cu-cals-grilla">{todos.filter(c => !activos.has(c.id)).map(fila)}</div>
                                </>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <div className="cu-fila">
                    <p className="t-sm mut" style={{ flex: '1 1 220px' }}>
                        {st.vencido ? 'Google dejó de aceptar tu conexión. Volvé a conectar tu cuenta para seguir recibiendo agendas.' : 'Conectá tu cuenta de Google para recibir agendas.'}
                    </p>
                    <Button variant="primary" icon={<Icono n="enchufe" />} disabled={ocupado} onClick={conectar}>
                        {st.vencido ? 'Volver a conectar' : 'Conectar con Google'}
                    </Button>
                </div>
            )}
            <Mensajes error={msg.error} aviso={msg.aviso} />
        </Tarjeta>
    );
}

const PASOS_WA = ['Tu número', 'La prueba', 'Confirmado'];
const AURA_WA = ['var(--success)', 'var(--brand-secondary)', 'var(--success)', 'var(--brand-navy)'];

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
    const etapa = estado?.confirmado && !cambio ? 3 : paso === 'enviado' ? 2 : 1;
    return (
        <Tarjeta icono="whatsapp" titulo="WhatsApp" texto="Cada agenda nueva te llega con los datos del lead." clase="cu-wa"
            aura={etapa === 3 ? AURA_WA : undefined}
            estado={estado && <Estado ok={estado.confirmado && !cambio} si="Confirmado" no="Sin confirmar" />}>
            {!estado && !error ? <p className="t-sm mut">Cargando…</p> : (
                <>
                <ol className="cu-pasos" aria-label="Cómo se confirma">
                    {PASOS_WA.map((t, i) => (
                        <li key={t} className={etapa === 3 || i + 1 < etapa ? 'hecho' : i + 1 === etapa ? 'ahora' : ''} style={{ '--i': i }}>
                            <span>{i + 1 < etapa || etapa === 3 ? <Icono n="check" s={13} /> : i + 1}</span>{t}
                        </li>
                    ))}
                </ol>
                <div className="cu-fila">
                    <InputGroup prefix={<>+</>} style={{ flex: '1 1 240px' }} data-tip="Con código de país, sin + ni espacios">
                        <label className="sr" htmlFor="cu-wa">Tu número, con código de país</label>
                        <input id="cu-wa" type="tel" inputMode="numeric" placeholder="5491122334455" value={numero}
                            onChange={(e) => { setNumero(e.target.value); setPaso('editar'); }} />
                    </InputGroup>
                    {paso === 'enviado' ? (
                        <>
                            <Button disabled={ocupado} onClick={probar}>No me llegó, reenviar</Button>
                            <Button variant="primary" icon={<Icono n="check" />} disabled={ocupado} onClick={confirmar}>Sí, me llegó</Button>
                        </>
                    ) : (!estado?.confirmado || cambio) ? (
                        <Button variant="primary" icon={<Icono n="whatsapp" />} disabled={ocupado || numero.replace(/\D/g, '').length < 8} onClick={probar}>
                            Mandarme una prueba
                        </Button>
                    ) : (
                        <Button icon={<Icono n="whatsapp" />} disabled={ocupado} onClick={probar}>Mandarme otra prueba</Button>
                    )}
                </div>
                </>
            )}
            <Mensajes error={error} aviso={aviso} />
        </Tarjeta>
    );
}
