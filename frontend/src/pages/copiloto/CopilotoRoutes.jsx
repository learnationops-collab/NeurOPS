import { lazy, Suspense } from 'react';

// Copiloto, montado en /copiloto con sesión de closer o de quien lo supervisa (ProtectedRoute en
// App.jsx). Se carga aparte (lazy), como el Inbox.
const CopilotoApp = lazy(() => import('./CopilotoApp'));

export default function CopilotoRoutes() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#030720' }} />}>
            <CopilotoApp />
        </Suspense>
    );
}
