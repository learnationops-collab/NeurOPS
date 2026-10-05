import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

// Agendas 2.0 (Learnation Thalamus), montado bajo /agendas-v2/*. Todavía sin backend: los datos se
// guardan en este navegador (data/adaptadorLocal.js) y no tocan la operación. Se carga aparte (lazy)
// para no sumarle nada al paquete que usa el resto de la app.
//   /agendas-v2                          → Thalamus, la herramienta del director comercial
//   /agendas-v2/agenda/:funnel/:evento   → la página pública de reserva del lead (?o=origen)
const ThalamusApp = lazy(() => import('./ThalamusApp'));
const PaginaPublica = lazy(() => import('./reserva/PaginaPublica'));

export default function AgendasV2Routes() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#030720' }} />}>
            <Routes>
                <Route index element={<ThalamusApp />} />
                <Route path="agenda/:funnel/:evento" element={<PaginaPublica />} />
                <Route path="agenda/:evento" element={<PaginaPublica />} />
                <Route path="*" element={<ThalamusApp />} />
            </Routes>
        </Suspense>
    );
}
