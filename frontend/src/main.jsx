import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'
import './efectos/efectos.css'
import { iniciarEfectos } from './efectos/efectos'

// El humo baja solo en las compus que no dan (ver efectos/efectos.js): antes parpadeaba.
iniciarEfectos();

console.log('Frontend Version: 2024-02-04 JWT Patch v2');

// Pestaña abierta desde "Simular" con clic derecho (nueva pestaña aislada, ver
// TeamManagementPage.jsx / sesion/Simular.jsx): la URL trae el token y el usuario
// simulados como query params. Se guardan en sessionStorage (NO localStorage, que se
// comparte entre TODAS las pestañas) antes de montar React, para que AuthContext los
// encuentre ahí desde su primerísimo render sin parpadeos ni carreras de useEffect. El
// token se saca de la URL de inmediato para no dejarlo visible en el historial del navegador.
// El token y el usuario viajan en el fragmento (#), que no llega al servidor ni sale en el Referer.
if (window.location.pathname === '/session-entry') {
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
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
