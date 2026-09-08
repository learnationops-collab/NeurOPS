import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'


console.log('Frontend Version: 2024-02-04 JWT Patch v2');

// Pestaña abierta desde "Simular" con clic derecho (nueva pestaña aislada, ver
// TeamManagementPage.jsx / OperatorControls.jsx): la URL trae el token y el usuario
// simulados como query params. Se guardan en sessionStorage (NO localStorage, que se
// comparte entre TODAS las pestañas) antes de montar React, para que AuthContext los
// encuentre ahí desde su primerísimo render sin parpadeos ni carreras de useEffect. El
// token se saca de la URL de inmediato para no dejarlo visible en el historial del navegador.
if (window.location.pathname === '/session-entry') {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userRaw = params.get('u');
    if (token && userRaw) {
        try {
            sessionStorage.setItem('auth_token', token);
            sessionStorage.setItem('user', userRaw);
        } catch (e) {
            // Storage no disponible (ej. modo privado estricto en algunos navegadores)
        }
    }
    const next = params.get('next') || '/publico';
    window.history.replaceState(null, '', `/session-entry?next=${encodeURIComponent(next)}`);
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider>
            <App />
        </ThemeProvider>
    </React.StrictMode>,
)
