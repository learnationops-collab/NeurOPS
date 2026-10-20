import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

// Página pública de reserva de Agendas 2.0, montada bajo /agendas-v2/agenda/* SIN sesión. Va aparte de
// AgendasV2Routes (Thalamus, que pide sesión) para que lo que carga un lead no incluya la herramienta de
// gestión ni sus llamadas a la API: solo reserva/PaginaPublica y /api/agendas-v2/publico/*.
//   /agendas-v2/agenda/:funnel/:evento   (?o=origen)
//   /agendas-v2/agenda/:evento
//   /agendas-v2/agenda/gracias/:id(/plan)   página de gracias del evento, después de agendar (reserva/gracias)
//   /agendas-v2/agenda/descalificados       landing de los que no califican (reserva/descalificados)
const PaginaPublica = lazy(() => import('./reserva/PaginaPublica'));
const Descalificados = lazy(() => import('./reserva/descalificados/PaginaDescalificados'));
const Gracias = lazy(() => import('./reserva/gracias/PaginaGracias').then(m => ({ default: m.Gracias })));
const Plan = lazy(() => import('./reserva/gracias/PaginaGracias').then(m => ({ default: m.Plan })));

export default function AgendasV2Publica() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#030720' }} />}>
            <Routes>
                <Route path="gracias/:id" element={<Gracias />} />
                <Route path="gracias/:id/plan" element={<Plan />} />
                <Route path="descalificados" element={<Descalificados />} />
                <Route path=":funnel/:evento" element={<PaginaPublica />} />
                <Route path=":evento" element={<PaginaPublica />} />
                <Route path="*" element={<PaginaPublica />} />
            </Routes>
        </Suspense>
    );
}
