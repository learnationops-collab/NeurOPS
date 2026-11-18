// Elegir el personaje de la cuenta (Configuración › Datos). Antes vivía en el menú del avatar; desde
// que el avatar abre Configuración directo (ADR-W162), está acá. Cambia al instante —dock incluido— y
// se guarda en la cuenta (`PUT /auth/me/mascota`); si falla, vuelve al anterior y lo dice.
// Simulando a otro no se elige.
import { useCallback, useState } from 'react';
import Mascota from './Mascota';
import { MASCOTAS, mascotaDe } from './mascotas';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { saveSession } from '../../utils/sessionStore';

export default function ElegirPersonaje() {
    const auth = useAuth();
    const usuario = auth?.user;
    const [toques, setToques] = useState({});
    const [noSeGuardo, setNoSeGuardo] = useState(false);
    const tocar = useCallback((k) => setToques(t => ({ ...t, [k]: (t[k] || 0) + 1 })), []);
    if (!usuario || usuario.is_impersonating || typeof auth.setUser !== 'function') return null;
    const actual = mascotaDe(usuario, usuario.name || usuario.username);

    const fijar = (mascota) => auth.setUser((u) => {
        if (!u) return u;
        const nuevo = { ...u, mascota };
        saveSession(nuevo);
        return nuevo;
    });
    const elegir = (id) => {
        tocar(id);
        if (id === actual) return;
        const anterior = usuario.mascota ?? null;
        setNoSeGuardo(false);
        fijar(id);
        api.put('/auth/me/mascota', { mascota: id }).catch(() => { fijar(anterior); setNoSeGuardo(true); });
    };

    return (
        <section className="cu-personaje" aria-label="Tu personaje">
            <b className="t-sm">Tu personaje</b>
            <div className="cu-personajes" role="radiogroup" aria-label="Elegí tu personaje">
                {MASCOTAS.map(m => (
                    <button key={m.id} type="button" role="radio" aria-checked={m.id === actual} aria-label={m.nombre} title={m.nombre}
                        className="cu-personaje-op" onClick={() => elegir(m.id)}>
                        <Mascota personaje={m.id} size={44} toques={toques[m.id]} />
                    </button>
                ))}
            </div>
            {noSeGuardo && <p className="t-sm" role="alert">No se pudo guardar. Probá de nuevo.</p>}
        </section>
    );
}
