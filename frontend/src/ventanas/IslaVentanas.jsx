// La isla de ventanas del dock (DockSecciones), como el botón «Ventanas» de Leadership y las minimizadas
// del dock de la Academia: un acceso por ventana abierta. Tocarla la trae adelante si estaba minimizada
// y la minimiza si estaba a la vista. Sin ventanas no ocupa lugar.
import { useAuth } from '../contexts/AuthContext';
import { herramienta, permitida } from './herramientas';
import { abrirVentana, minimizarVentana, useVentanas } from './ventanasStore';

export default function IslaVentanas() {
    const { user } = useAuth();
    const items = useVentanas()
        .map(item => ({ item, h: herramienta(item.key) }))
        .filter(({ h }) => permitida(h, user));
    if (!items.length) return null;
    return (
        <>
            <span className="dock-sep" />
            <div className="dock-fijadas dock-ventanas" role="group" aria-label="Ventanas abiertas">
                {items.map(({ item, h }) => {
                    const minimizada = item.estado === 'minimizada';
                    const rotulo = `${h.label}: ${minimizada ? 'minimizada, tocá para abrirla' : 'abierta, tocá para minimizarla'}`;
                    return (
                        <button key={item.key} type="button" className={`dock-fijada dock-ventana${minimizada ? '' : ' dock-ventana--abierta'}`}
                            aria-label={rotulo} title={rotulo} aria-pressed={!minimizada}
                            onClick={() => (minimizada ? abrirVentana(item.key) : minimizarVentana(item.key))}>
                            <h.Icono size={19} aria-hidden="true" />
                        </button>
                    );
                })}
            </div>
        </>
    );
}
