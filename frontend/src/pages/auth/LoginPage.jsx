// Inicio de sesión con la marca Learnation, en el mismo marco que la elección de rol y de área (hora,
// fondo a elección y el isotipo con anillos). Arranca directo en el panel.
//   entrar   → usuario y clave, o «Entrar con Google» (vuelve a /login?google=…).
//   email    → si la cuenta no tiene email, se pide para poder entrar con Google la próxima vez.
//   rol      → si la persona tiene más de un rol (o cuentas vinculadas), elige con cuál entra (Eleccion).
// Después va a destinoDeEntrada: si el rol tiene más de un área, a /inicio para elegirla (o directo a su
// área por defecto).

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, BarChart3, Briefcase, Eye, EyeOff, Filter, Loader2, Mail, Megaphone, MessageCircle, PhoneCall, Settings2, User, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { destinoDeEntrada } from '../../utils/areas';
import { cambiarDeRol, cambiarDeRolEnLaCuenta, otrasCuentas, rotuloDeRol } from '../../utils/cuentasVinculadas';
import Eleccion, { LogoEntrada, MarcoEntrada } from './Eleccion';
import DebugConsole from '../../components/modals/DebugConsole';
import './login.css';

const MENSAJE_GOOGLE = {
    cancelado: 'Cancelaste el ingreso con Google.',
    error: 'Google no pudo completar el ingreso. Probá de nuevo.',
    sin_verificar: 'Tu cuenta de Google no tiene el email verificado.',
    sin_cuenta: 'Ninguna cuenta tiene ese email de Google. Entrá con tu usuario y clave y cargá tu email.',
    desactivada: 'Tu cuenta está desactivada. Contactá a un administrador.',
};

const iniciales = (nombre) => (nombre || '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

function Avatar({ texto }) {
    return <div className="lg-avatar" aria-hidden="true">{texto || <span className="lg-avatar-l">L</span>}</div>;
}

function LogoGoogle() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
    );
}

function Entrar({ onEntrar, errorInicial }) {
    const { login, entrarConGoogle } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [ver, setVer] = useState(false);
    const [cargando, setCargando] = useState(null); // null | 'clave' | 'google'
    const [error, setError] = useState(errorInicial);
    const ref = useRef(null);
    useEffect(() => { ref.current?.focus(); }, []);

    const conClave = async (e) => {
        e.preventDefault();
        setCargando('clave');
        setError(null);
        try {
            onEntrar(await login(username, password));
        } catch (err) {
            setError(err.response?.data?.message === 'Invalid credentials' || !err.response?.data?.message
                ? 'Usuario o contraseña incorrectos'
                : err.response.data.message);
            setCargando(null);
        }
    };

    const conGoogle = async () => {
        setCargando('google');
        setError(null);
        try {
            await entrarConGoogle();
        } catch {
            setError('No se pudo abrir Google. Probá de nuevo.');
            setCargando(null);
        }
    };

    return (
        <div className="lg-panel">
            <LogoEntrada idGrad="lnGradLogin" />
            <h1 className="lg-titulo"><small>Learnation</small>Acquisitions</h1>
            <p className="lg-texto">Entrá con tu cuenta del equipo.</p>
            <form className="lg-form" onSubmit={conClave}>
                <label className="sr-only" htmlFor="lg-usuario">Usuario o email</label>
                <input id="lg-usuario" ref={ref} className="lg-input" autoComplete="username" required
                    placeholder="Usuario o email" value={username} onChange={(e) => setUsername(e.target.value)} />
                <div className="lg-clave">
                    <label className="sr-only" htmlFor="lg-clave">Contraseña</label>
                    <input id="lg-clave" className="lg-input" type={ver ? 'text' : 'password'} autoComplete="current-password"
                        required placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" className="lg-ojo" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                        {ver ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button type="submit" className="lg-ir" disabled={!!cargando} aria-label="Iniciar sesión">
                        {cargando === 'clave' ? <Loader2 size={18} className="lg-gira" /> : <ArrowRight size={18} />}
                    </button>
                </div>
            </form>
            {error && <p className="lg-error" role="alert">{error}</p>}
            <div className="lg-o"><span>o</span></div>
            <button type="button" className="lg-google" onClick={conGoogle} disabled={!!cargando}>
                {cargando === 'google' ? <Loader2 size={18} className="lg-gira" /> : <LogoGoogle />}
                Entrar con Google
            </button>
        </div>
    );
}

function PedirEmail({ user, onListo }) {
    const { cargarEmail } = useAuth();
    const [email, setEmail] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);

    const guardar = async (e) => {
        e.preventDefault();
        setGuardando(true);
        setError(null);
        try {
            onListo(await cargarEmail(email));
        } catch (err) {
            setError(err.response?.data?.message || 'No se pudo guardar el email');
            setGuardando(false);
        }
    };

    return (
        <div className="lg-panel">
            <Avatar texto={iniciales(user.username)} />
            <h2 className="lg-hola">Hola, {user.username}</h2>
            <p className="lg-texto">Cargá tu email de Google y la próxima vez entrás con un clic, sin clave.</p>
            <form className="lg-form" onSubmit={guardar}>
                <div className="lg-clave">
                    <label className="sr-only" htmlFor="lg-email">Tu email</label>
                    <input id="lg-email" className="lg-input lg-input--icono" type="email" autoComplete="email" required autoFocus
                        placeholder="tu@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Mail size={16} className="lg-icono" aria-hidden="true" />
                    <button type="submit" className="lg-ir" disabled={guardando} aria-label="Guardar email">
                        {guardando ? <Loader2 size={18} className="lg-gira" /> : <ArrowRight size={18} />}
                    </button>
                </div>
            </form>
            {error && <p className="lg-error" role="alert">{error}</p>}
            <button type="button" className="lg-link" onClick={() => onListo(user)}>Ahora no</button>
        </div>
    );
}

const ICONO_DE_ROL = {
    admin: Settings2, director_comercial: BarChart3, director_marketing: Megaphone, closer: PhoneCall,
    setter: MessageCircle, operator: Briefcase, triage: Filter, hiring: UserPlus,
};

function ElegirRol({ user, onElegido }) {
    const [eligiendo, setEligiendo] = useState(null);
    const [error, setError] = useState(null);
    const opciones = [
        ...(user.roles?.length ? user.roles : [user.role]).map((rol) => ({ clave: `rol-${rol}`, rol, entrar: () => (rol === user.role ? onElegido(user) : cambiarDeRolEnLaCuenta(rol)) })),
        ...otrasCuentas(user).map((c) => ({ clave: `cuenta-${c.id}`, rol: c.role, detalle: c.username, entrar: () => cambiarDeRol(c.id) })),
    ];

    const elegir = async (o) => {
        setEligiendo(o.clave);
        setError(null);
        try {
            await o.entrar();
        } catch (err) {
            setError(err.response?.data?.message || 'No se pudo entrar con ese rol');
            setEligiendo(null);
        }
    };

    return (
        <Eleccion
            nombre={user.username}
            pregunta="Seleccioná tu rol. Después podés cambiarlo desde tu menú."
            eligiendo={eligiendo}
            error={error}
            opciones={opciones.map((o) => ({
                clave: o.clave, titulo: rotuloDeRol(o.rol), detalle: o.detalle, Icono: ICONO_DE_ROL[o.rol] || User,
                onElegir: () => elegir(o),
            }))}
        />
    );
}

const tieneVariosRoles = (user) => (user.roles?.length || 0) > 1 || otrasCuentas(user).length > 0;

export default function LoginPage() {
    const navigate = useNavigate();
    const { completarLoginGoogle } = useAuth();
    const [params, setParams] = useSearchParams();
    const [google] = useState(() => params.get('google'));
    const [entrandoGoogle, setEntrandoGoogle] = useState(google === 'ok');
    const [paso, setPaso] = useState('entrar');
    const [user, setUser] = useState(null);
    const [errorGoogle, setErrorGoogle] = useState(google && google !== 'ok' ? MENSAJE_GOOGLE[google] || MENSAJE_GOOGLE.error : null);

    const seguir = (u) => {
        setUser(u);
        if (tieneVariosRoles(u)) setPaso('rol');
        else navigate(destinoDeEntrada(u));
    };
    const alEntrar = (u) => {
        if (!u.email) { setUser(u); setPaso('email'); } else seguir(u);
    };

    // Vuelta de «Entrar con Google»: se canjea la sesión por el token una sola vez.
    useEffect(() => {
        if (!google) return;
        setParams({}, { replace: true });
        if (google !== 'ok') return;
        completarLoginGoogle()
            .then(alEntrar)
            .catch(() => { setErrorGoogle(MENSAJE_GOOGLE.error); setEntrandoGoogle(false); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (paso === 'rol' && user) return <ElegirRol user={user} onElegido={(u) => navigate(destinoDeEntrada(u))} />;

    return (
        <MarcoEntrada clase="lg--login">
            <main className="lg-centro">
                    {paso === 'entrar' && (entrandoGoogle
                        ? <div className="lg-panel"><LogoEntrada idGrad="lnGradLogin" /><p className="lg-texto"><Loader2 size={16} className="lg-gira" /> Entrando con Google…</p></div>
                        : <Entrar onEntrar={alEntrar} errorInicial={errorGoogle} />)}
                    {paso === 'email' && user && <PedirEmail user={user} onListo={seguir} />}
            </main>
            <DebugConsole />
        </MarcoEntrada>
    );
}
