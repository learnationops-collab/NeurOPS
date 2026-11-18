// La cabecera de Configuración, igual en los tres servicios (ADR-W167): Notificaciones con la cuenta, el
// Portal (si tenés más de un área o rol) y Cerrar sesión. Va en las `acciones` de la hoja (HojaModal).
import { Bell, LayoutGrid, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { abrirAvisos, useAvisosSinLeer } from '../utils/avisosBus';
import { hayPortal } from '../utils/portal';
import { abrirPortal } from './portalBus';

const Boton = ({ label, onClick, children, peligro = false }) => (
    <button type="button" onClick={onClick} aria-label={label} title={label}
        className={`cu-acc relative flex items-center justify-center w-7 h-7 rounded-full text-muted hover:text-base${peligro ? ' cu-acc--salir' : ''}`}>
        {children}
    </button>
);

export default function AccionesConfiguracion({ user, onCerrar }) {
    const { logout } = useAuth();
    const sinLeer = useAvisosSinLeer();
    const ir = (fn) => () => { onCerrar(); setTimeout(fn, 0); };
    return (
        <>
            <Boton label={sinLeer ? `Notificaciones · ${sinLeer} sin leer` : 'Notificaciones'} onClick={ir(abrirAvisos)}>
                <Bell size={14} aria-hidden="true" />
                {sinLeer > 0 && <span className="cu-acc-globo" aria-hidden="true">{sinLeer > 9 ? '9+' : sinLeer}</span>}
            </Boton>
            {hayPortal(user) && (
                <Boton label="Portal: otra área o rol" onClick={ir(() => abrirPortal())}><LayoutGrid size={14} aria-hidden="true" /></Boton>
            )}
            <Boton label="Cerrar sesión" peligro onClick={() => { if (window.confirm('¿Cerrar sesión?')) logout(); }}>
                <LogOut size={14} aria-hidden="true" />
            </Boton>
        </>
    );
}
