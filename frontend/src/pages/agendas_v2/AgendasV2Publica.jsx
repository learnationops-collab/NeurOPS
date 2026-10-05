import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

// Página pública de reserva de Agendas 2.0, montada bajo /agendas-v2/agenda/* SIN sesión. Va aparte de
// AgendasV2Routes (Thalamus, que pide sesión) para que lo que carga un lead no incluya la herramienta de
// gestión ni sus llamadas a la API: solo reserva/PaginaPublica y /api/agendas-v2/publico/*.
//   /agendas-v2/agenda/:funnel/:evento   (?o=origen)
//   /agendas-v2/agenda/:evento
const PaginaPublica = lazy(() => import('./reserva/PaginaPublica'));

export default function AgendasV2Publica() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#030720' }} />}>
            <Routes>
                <Route path=":funnel/:evento" element={<PaginaPublica />} />
                <Route path=":evento" element={<PaginaPublica />} />
                <Route path="*" element={<PaginaPublica />} />
            </Routes>
        </Suspense>
    );
}
