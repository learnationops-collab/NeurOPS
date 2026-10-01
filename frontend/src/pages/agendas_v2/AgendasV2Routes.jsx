import React, { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// Laboratorio de Agendas 2.0: pantallas de prueba públicas, sin backend ni login, montadas bajo
// /agendas-v2/*. Se cargan aparte (lazy) para no sumarle nada al paquete que usa el resto de la app.
const ReservaPage = lazy(() => import('./reserva/ReservaPage'));
const EstrategiaPage = lazy(() => import('./estrategia/EstrategiaPage'));

const PANTALLAS = [
    { to: 'reserva/workshop', titulo: 'Reserva del lead', desc: 'Formulario estilo Typeform, calendario estilo Calendly y preparación con videos después de agendar.' },
    { to: 'estrategia/workshop', titulo: 'Constructor de estrategia', desc: 'Puntaje del formulario, segmentos, colas de closers con cuotas, y simulación del reparto.' },
];

function Indice() {
    return (
        <div className="bg-v6" style={{ minHeight: '100dvh', color: '#fff', display: 'grid', placeItems: 'center', padding: 24 }}>
            <div style={{ width: '100%', maxWidth: 640 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.28em', textTransform: 'uppercase', color: '#6E779B', margin: 0 }}>Laboratorio · sin conexión con la operación</p>
                <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-.03em', margin: '10px 0 28px' }}>Agendas 2.0</h1>
                <div style={{ display: 'grid', gap: 12 }}>
                    {PANTALLAS.map(p => (
                        <Link key={p.to} to={p.to} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: '#fff', textDecoration: 'none' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 17, fontWeight: 800 }}>{p.titulo}</div>
                                <div style={{ fontSize: 13, color: '#A9B0CC', marginTop: 4 }}>{p.desc}</div>
                            </div>
                            <ArrowRight size={18} color="#FF3FA4" />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function AgendasV2Routes() {
    return (
        <Suspense fallback={<div className="bg-v6" style={{ minHeight: '100dvh' }} />}>
            <Routes>
                <Route index element={<Indice />} />
                <Route path="reserva" element={<ReservaPage />} />
                <Route path="reserva/:funnel" element={<ReservaPage />} />
                <Route path="estrategia" element={<EstrategiaPage />} />
                <Route path="estrategia/:funnel" element={<EstrategiaPage />} />
            </Routes>
        </Suspense>
    );
}
