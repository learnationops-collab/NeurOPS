import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, CheckCircle2, Target, Sliders, Search, X, ArrowLeft, LogOut, Ghost, Loader2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import OperatorControls from '../../../components/modals/OperatorControls';
import { revertImpersonation } from '../../../utils/impersonation';
import HiringInbox from './components/HiringInbox';
import HiringStatsTab from './components/HiringStatsTab';
import HiringClarityTab from './components/HiringClarityTab';

// Las tres vistas del dock. Clarity vive aparte, en el orbe magenta de la
// derecha: no es un destino más (no lista candidatos), es el panel que ajusta
// cómo se rankean todos — así lo separa el mockup de referencia.
const DESTINOS = [
    { id: 'pendientes', label: 'Pendientes', icon: Inbox, color: '#D9A441' },
    { id: 'analizados', label: 'Analizados', icon: CheckCircle2, color: '#2FBF8F' },
    { id: 'stats', label: 'Estadísticas', icon: Target, color: '#5B7CFF' },
];

const TITULOS = {
    pendientes: 'Pendientes',
    analizados: 'Analizados',
    stats: 'Estadísticas',
    clarity: 'Clarity',
};

const HiringDashboardPage = () => {
    const { user, logout } = useAuth();
    const [vista, setVista] = useState('pendientes');
    const [query, setQuery] = useState('');
    // Los badges del dock (cuántas sin analizar / cuántas analizadas) los sube
    // el inbox cuando carga: el dock no pide los datos por su cuenta.
    const [badges, setBadges] = useState({ pendientes: 0, analizados: 0 });
    const buscador = useRef(null);
    // Modal de Acceso Simulado (el mismo que abre la tecla `w` dentro de
    // MainLayout). Esta ruta corre sin MainLayout, así que no hereda el
    // HotkeysManager global ni el modal: se montan acá, igual que en
    // CloserWorkflowPage, para que un operador pueda salir de la simulación.
    const [showOperatorControls, setShowOperatorControls] = useState(false);
    const [saliendo, setSaliendo] = useState(false);

    // Ctrl/Cmd+P enfoca el buscador, Escape lo limpia — mismos atajos del mockup.
    // `w` (sin modificadores y fuera de un input) abre Acceso Simulado.
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                buscador.current?.focus();
            }
            if (e.key === 'Escape' && query) setQuery('');

            const enCampo = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
            if (!enCampo && e.key.toLowerCase() === 'w' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                setShowOperatorControls((prev) => !prev);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [query]);

    // "Volver a mi sesión": misma salida que ofrece el modal de Acceso Simulado,
    // pero como botón visible en el header — la persona que simula a la usuaria
    // de hiring no tiene por qué saber el atajo de teclado.
    const volverAMiSesion = async () => {
        setSaliendo(true);
        try {
            await revertImpersonation();
        } catch (err) {
            alert(err.response?.data?.message || 'No se pudo volver a tu sesión');
            setSaliendo(false);
        }
    };

    // Al limpiar la búsqueda se vuelve donde estabas, salvo que estuvieras en
    // Clarity: ahí el resultado que acabás de buscar es lo que querés seguir
    // mirando, no los sliders.
    useEffect(() => {
        if (query.trim() && vista === 'clarity') setVista('pendientes');
    }, [query, vista]);

    // Buscar recorre TODAS las postulaciones y pisa la vista activa, sea cual
    // sea: si alguien escribe un nombre no le importa en qué pestaña quedó ni
    // si estaba mirando estadísticas. Se vuelve a la vista al limpiar (Escape).
    const enBusqueda = query.trim().length > 0;

    return (
        <div
            className="dash-v6 min-h-screen text-white"
            style={{
                background:
                    'radial-gradient(1100px 640px at 88% -12%, rgba(19,35,198,.34) 0%, transparent 62%),' +
                    'radial-gradient(860px 560px at 6% 108%, rgba(91,124,255,.16) 0%, transparent 64%), #0B0F26',
                paddingBottom: 140,
            }}
        >
            <header className="sticky top-0 z-40 border-b border-white/10 bg-[#020617]/95 backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-6 px-4 py-4 sm:px-8 lg:px-14">
                    <div className="flex min-w-0 items-center gap-4">
                        {user?.role === 'admin' && (
                            <Link
                                to="/admin/ventas"
                                title="Volver a la sesión del admin"
                                className="group flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition-all hover:bg-white/10 hover:text-white"
                            >
                                <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
                            </Link>
                        )}
                        <div className="flex items-center gap-3">
                            <div
                                className="grid h-9 w-9 flex-none place-items-center rounded-xl text-[17px] font-black"
                                style={{ background: 'linear-gradient(135deg,#1323C6,#FF3FA4)', boxShadow: '0 5px 18px rgba(19,35,198,.45)' }}
                            >
                                L
                            </div>
                            <div className="leading-none">
                                <span className="text-[14px] font-black tracking-[.16em] whitespace-nowrap">
                                    LEARNATION <span className="text-[#5B7CFF]">HIRING</span>
                                </span>
                                <small className="mt-1 block text-[8.5px] font-extrabold uppercase tracking-[.22em] text-white/40">
                                    Asistente Administrativa y Personal
                                </small>
                            </div>
                        </div>
                    </div>

                    <div className="flex h-[46px] min-w-[220px] max-w-[520px] flex-1 items-center gap-3 rounded-2xl border border-white/[.13] bg-white/5 px-4 transition-all focus-within:border-[#5B7CFF] focus-within:bg-[#5B7CFF]/10 focus-within:shadow-[0_0_0_3px_rgba(91,124,255,.22)]">
                        <Search size={17} className="flex-none text-white/40" />
                        <input
                            ref={buscador}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar postulante o país…"
                            aria-label="Buscar postulante"
                            className="min-w-0 flex-1 border-none bg-transparent text-[14.5px] font-semibold text-white outline-none placeholder:text-white/35"
                        />
                        {enBusqueda ? (
                            <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda" className="flex-none text-white/40 hover:text-white">
                                <X size={16} />
                            </button>
                        ) : (
                            <span className="hidden flex-none gap-1 sm:flex">
                                {['Ctrl', 'P'].map((k) => (
                                    <span key={k} className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10.5px] font-extrabold tracking-wide text-white/40">
                                        {k}
                                    </span>
                                ))}
                            </span>
                        )}
                    </div>

                    {/* Acciones de sesión. El rol hiring no tiene dock global (ni
                        MainLayout), así que cerrar sesión y salir de la simulación
                        tienen que vivir en este header o no existen para él. */}
                    <div className="flex flex-none items-center gap-2">
                        {user?.is_impersonating && (
                            <button
                                type="button"
                                onClick={volverAMiSesion}
                                disabled={saliendo}
                                title="Volver a tu sesión original (también con la tecla W)"
                                className="flex h-9 items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 text-[12px] font-extrabold uppercase tracking-wide text-amber-300 transition-all hover:bg-amber-400/20 hover:text-amber-200 disabled:opacity-60"
                            >
                                {saliendo ? <Loader2 size={15} className="animate-spin" /> : <Ghost size={15} />}
                                <span className="hidden sm:inline">Volver a mi sesión</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={logout}
                            title="Cerrar sesión"
                            className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-[12px] font-extrabold uppercase tracking-wide text-white/50 transition-all hover:bg-white/10 hover:text-white"
                        >
                            <LogOut size={15} />
                            <span className="hidden sm:inline">Salir</span>
                        </button>
                    </div>
                </div>
            </header>

            <OperatorControls isOpen={showOperatorControls} onClose={() => setShowOperatorControls(false)} />

            <main className="px-4 py-8 sm:px-8 lg:px-14">
                <h1 className="mb-6 text-[clamp(26px,3.4vw,38px)] font-black leading-none tracking-tight">
                    {enBusqueda ? `Resultados para «${query.trim()}»` : TITULOS[vista]}
                </h1>

                {/* El inbox se monta en las dos vistas de lista; `grupo` decide qué
                    sub-filtros ofrece, igual que en el panel de Closer. */}
                {(vista === 'pendientes' || vista === 'analizados' || enBusqueda) && (
                    <HiringInbox
                        grupo={enBusqueda ? 'busqueda' : vista}
                        query={enBusqueda ? query.trim() : ''}
                        onConteos={setBadges}
                    />
                )}
                {vista === 'stats' && !enBusqueda && <HiringStatsTab />}
                {vista === 'clarity' && !enBusqueda && <HiringClarityTab />}
            </main>

            {/* Dock flotante. Esta ruta no usa MainLayout (ver App.jsx): el panel
                es su propia sub-app, con su menú propio en vez del dock global. */}
            <div className="pointer-events-none fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4">
                <div
                    className="pointer-events-auto flex max-w-full items-stretch gap-2 overflow-x-auto rounded-[26px] border border-[#5B7CFF]/30 bg-[#040718]/95 p-2.5 backdrop-blur-xl"
                    style={{ boxShadow: '0 28px 70px rgba(0,0,0,.62)' }}
                >
                    {DESTINOS.map((d) => {
                        const activo = vista === d.id;
                        const badge = d.id === 'pendientes' ? badges.pendientes : d.id === 'analizados' ? badges.analizados : 0;
                        return (
                            <button
                                key={d.id}
                                type="button"
                                onClick={() => setVista(d.id)}
                                className={`flex h-[58px] flex-none items-center gap-3 whitespace-nowrap rounded-[18px] px-6 text-[15px] font-bold transition-all ${
                                    activo ? 'text-white' : 'text-white/60 hover:-translate-y-0.5 hover:bg-[#5B7CFF]/10 hover:text-white'
                                }`}
                                style={activo ? { background: 'linear-gradient(100deg,#1323C6,#5B7CFF,#FF3FA4)', boxShadow: '0 12px 30px rgba(19,35,198,.5)' } : undefined}
                            >
                                <d.icon size={19} style={{ color: activo ? '#fff' : d.color }} />
                                <span>{d.label}</span>
                                {badge > 0 && (
                                    <span
                                        className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-[9px] px-2 text-[12px] font-black tabular-nums"
                                        style={{ background: activo ? 'rgba(255,255,255,.26)' : 'rgba(91,124,255,.2)' }}
                                    >
                                        {badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}

                    <button
                        type="button"
                        onClick={() => setVista('clarity')}
                        title="Clarity · pesos del score"
                        aria-label="Clarity"
                        className="relative flex h-[58px] w-[58px] flex-none items-center justify-center rounded-full border-2 transition-all hover:-translate-y-0.5 hover:scale-105"
                        style={
                            vista === 'clarity'
                                ? { background: 'linear-gradient(135deg,#FF3FA4,#FF6AD5)', borderColor: '#FF6AD5', boxShadow: '0 12px 30px rgba(255,63,164,.5)' }
                                : { background: 'rgba(255,63,164,.1)', borderColor: 'rgba(255,63,164,.65)' }
                        }
                    >
                        <Sliders size={20} style={{ color: vista === 'clarity' ? '#0B0F26' : '#FF6AD5' }} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HiringDashboardPage;
