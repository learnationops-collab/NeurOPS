import toast from 'react-hot-toast';
import { Bell, Compass, LogOut, MessageCircle, Settings } from 'lucide-react';
import Mascota from '../../../components/mascota/Mascota';
import { mascotaDe } from '../../../components/mascota/mascotas';
import { rotuloDeSesion } from '../../../sesion/menuSesion';
import { abrirVentana } from '../../../ventanas/ventanasStore';
import { useSinLeerChat } from '../../../ventanas/herramientas/chat/usePresencia';

/**
 * La tarjeta de usuario del dock unificado (docs/mockups/dock-unificado, ADR-W165), igual en Work, Academy
 * y Leadership: Notificaciones arriba a la derecha, el personaje y el nombre, y la fila Cerrar sesión ·
 * Mensajes · Leadership · Herramientas · Configuración. La usa la barra lateral desplegada (DockLateral) y,
 * en el dock de abajo, aparece al pasar el mouse por el avatar (TarjetaFlotante).
 * Mensajes abre la ventana Chat: el chat del equipo de la Academia, los conectados y Learnito (ADR-W172).
 * Leadership abre Leadership rápido (ADR-W173).
 */
const abrirChat = () => abrirVentana('chat');

// Leadership abre Leadership rápido (la ventana `leadership`); entrar a Leadership entero va adentro.
const irALeadership = (usuario) => () => {
    if (usuario?.is_impersonating) { toast.error('Simulando no se puede usar Leadership'); return; }
    abrirVentana('leadership');
};

export const BotonFila = ({ Icono, label, onClick, cuenta = null, clase = '' }) => (
    <button type="button" className={`dock-fijada ${clase}`.trim()} onClick={onClick} aria-label={label} title={label}>
        <Icono size={18} aria-hidden="true" />
        {cuenta != null && <span className="dock-sesion-aviso" aria-hidden="true">{cuenta}</span>}
    </button>
);

export const BotonNotificaciones = ({ avisos }) => (avisos ? (
    <BotonFila Icono={Bell} label={avisos.titulo || 'Notificaciones'} onClick={avisos.onClick}
        cuenta={avisos.cuenta} clase="dock-lado-notif" />
) : null);

export const NombreSesion = ({ usuario }) => (
    <span className="dock-lado-nombre">
        <b className="trunc">{usuario?.name || usuario?.username || ''}</b>
        <small className="trunc">{rotuloDeSesion(usuario)}</small>
    </span>
);

// Mensajes con lo no leído del chat (Equipo y conversaciones directas, ADR-W175).
const BotonMensajes = () => {
    const n = useSinLeerChat();
    return <BotonFila Icono={MessageCircle} label={n ? `Mensajes · ${n} sin leer` : 'Mensajes'} onClick={abrirChat} cuenta={n ? (n > 99 ? '99+' : n) : null} />;
};

/** `herr`: el botón de Herramientas (BotonHerramientas), que ya trae su menú. */
export const FilaSesion = ({ usuario, herr, configuracion, salir }) => (
    <div className="dock-lado-fila">
        {salir && <BotonFila Icono={LogOut} label={salir.label} onClick={salir.onClick} clase="dock-lado-salir" />}
        <BotonMensajes />
        <BotonFila Icono={Compass} label="Leadership" onClick={irALeadership(usuario)} />
        {herr && <span className="dock-lado-herr">{herr}</span>}
        {configuracion && (
            <BotonFila Icono={Settings} label={configuracion.titulo ? `Configuración: ${configuracion.titulo}` : 'Configuración'}
                onClick={configuracion.onClick} cuenta={configuracion.cuenta} />
        )}
    </div>
);

/**
 * El avatar del dock con la tarjeta encima al pasar el mouse (o al llegar con Tab). `avatar` es el
 * MenuSesion de la pantalla: sigue abriendo Configuración. El personaje grande de la tarjeta es solo
 * dibujo y también abre Configuración (no se monta otro MenuSesion: publicaría dos veces).
 */
export const TarjetaFlotante = ({ avatar, usuario, herr, configuracion, avisos, salir, volver }) => (
    <div className="dock-av-hover">
        {avatar}
        <section className="dock-lado-tarjeta dock-tarjeta-flot" aria-label="Tu sesión">
            <BotonNotificaciones avisos={avisos} />
            <div className="dock-lado-quien">
                <button type="button" className="dock-sesion dock-sesion--grande" onClick={configuracion?.onClick}
                    aria-label="Configuración" title="Configuración">
                    <Mascota personaje={mascotaDe(usuario, usuario?.name || '')} size={50} />
                </button>
                <NombreSesion usuario={usuario} />
            </div>
            <FilaSesion usuario={usuario} herr={herr} configuracion={configuracion} salir={salir} />
            {volver && (
                <button type="button" className="dock-lado-volver" onClick={volver.onClick} aria-label={volver.label}>
                    <volver.Icono size={17} aria-hidden="true" /><span className="trunc">{volver.label}</span>
                </button>
            )}
        </section>
    </div>
);
