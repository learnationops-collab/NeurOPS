import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

// Área Inbox, montada bajo /inbox/* con sesión y rol admin, director_comercial o setter (ProtectedRoute en
// App.jsx). Se carga aparte (lazy): el lienzo de flujos (React Flow) no pesa en el resto de la app.
const InboxApp = lazy(() => import('./InboxApp'));

export default function InboxRoutes() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#030720' }} />}>
            <Routes>
                <Route index element={<InboxApp />} />
                <Route path="*" element={<InboxApp />} />
            </Routes>
        </Suspense>
    );
}
