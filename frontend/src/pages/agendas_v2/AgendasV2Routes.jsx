import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

// Agendas 2.0 (Learnation Thalamus), montado bajo /agendas-v2/* con sesión y rol admin o
// director_comercial (ProtectedRoute en App.jsx). Se carga aparte (lazy) para no sumarle nada al
// paquete que usa el resto de la app.
//   /agendas-v2                          → Thalamus, la herramienta del director comercial
// La página pública del lead (/agendas-v2/agenda/...) NO pasa por acá: es AgendasV2Publica.jsx, sin sesión.
const ThalamusApp = lazy(() => import('./ThalamusApp'));

export default function AgendasV2Routes() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#030720' }} />}>
            <Routes>
                <Route index element={<ThalamusApp />} />
                <Route path="*" element={<ThalamusApp />} />
            </Routes>
        </Suspense>
    );
}
