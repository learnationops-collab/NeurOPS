// Configuración de Agendamiento (el dial magenta, como en Thalamus): Datos, Disponibilidad,
// Integraciones, Equipo y Apariencia. Se abre como ventana flotante o a pantalla completa
// (Visualización). No repite lógica de NeurOPS: las pestañas usan sus mismos endpoints (conf/cuenta.jsx).
// Apariencia es el tema de toda la app (temas/TabApariencia.jsx); el oscuro/claro/sistema propio de
// Agendamiento que había antes sigue valiendo solo mientras no se elige un tema.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { Dial, Icono, Modal } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { almacen, useUi } from '../../data/hooks';
import { DatosCuenta, TarjetaCalendar, TarjetaDisponibilidad, TarjetaWhatsapp } from './cuenta';
import TabEquipo from './TabEquipo';
import TabApariencia from '../../../../temas/TabApariencia';
import { IconButton, ModalHeader, Segmented } from '../../../../components/standard';
import { useEnPantalla } from '../../../../components/ui/useEnPantalla';

export const TABS = [
    ['datos', 'Datos', 'user'], ['disponibilidad', 'Disponibilidad', 'clock'], ['integraciones', 'Integraciones', 'enchufe'],
    ['equipo', 'Equipo', 'users'], ['apariencia', 'Apariencia', 'sol'],
];
const VISTAS = [['completa', 'Pantalla completa'], ['flotante', 'Ventana flotante']];

function MenuVisualizacion({ abierto, setAbierto }) {
    const { confVis } = useUi();
    const caja = useRef(null), btn = useRef(null);
    const enPantalla = useEnPantalla();
    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (document.contains(e.target) && !caja.current?.contains(e.target)) setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        caja.current?.querySelector('.vis-op[aria-checked="true"]')?.focus();
        return () => document.removeEventListener('mousedown', fuera);
    }, [abierto, setAbierto]);
    const cerrar = () => { setAbierto(false); btn.current?.focus(); };
    return (
        <div className="vis-caja" ref={caja}>
            <button ref={btn} type="button" className="vis-btn" data-nav="" data-v={confVis} aria-haspopup="menu" aria-expanded={abierto} aria-label="Visualización" title="Visualización"
                onClick={() => setAbierto(!abierto)}>
                <i />
            </button>
            {abierto && (
                <div ref={enPantalla} className="vis-pop" role="menu" aria-label="Visualización">
                    <div className="vis-cab">
                        <span className="t-rotulo">Visualización</span>
                        <IconButton label="Cerrar" icon={<Icono n="x" />} size="xs" onClick={cerrar} />
                    </div>
                    {VISTAS.map(([v, n]) => (
                        <button key={v} type="button" className="vis-op" role="menuitemradio" aria-checked={confVis === v} onClick={() => { ui.set({ confVis: v }); cerrar(); }}>
                            <i className={'vis-ico vis-ico--' + v}><i /></i><span>{n}</span><Icono n="check" s={16} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function Configuracion() {
    const { user } = useAuth();
    const { conf, confVis } = useUi();
    const [visAbierto, setVisAbierto] = useState(false);
    const [volver] = useState(() => document.activeElement);
    const tab = conf && TABS.some(t => t[0] === conf.tab) ? conf.tab : 'datos';

    const cerrar = () => {
        almacen.flush();
        ui.set({ conf: null });
        if (volver && document.body.contains(volver)) volver.focus();
    };
    // Escape: primero cierra el menú de visualización; después, Configuración.
    const alEscape = () => { if (visAbierto) setVisAbierto(false); else cerrar(); };
    useEffect(() => { document.querySelector('#conf .ui-seg__item[aria-pressed="true"]')?.focus({ preventScroll: true }); }, []);

    let cuerpo;
    if (tab === 'disponibilidad') cuerpo = <TarjetaDisponibilidad />;
    else if (tab === 'integraciones') cuerpo = <><TarjetaCalendar volver="agendamiento" /><TarjetaWhatsapp /></>;
    else if (tab === 'equipo') cuerpo = <TabEquipo />;
    else if (tab === 'apariencia') cuerpo = <TabApariencia />;
    else cuerpo = <DatosCuenta user={user} />;

    return (
        <Modal onCerrar={alEscape} id="conf" labelledBy="conf-tit" clase={'modal--conf' + (confVis === 'completa' ? ' modal--full' : '')}>
            <ModalHeader flush size="lg" className="conf-cab" icon={<Dial tile className="tl-logo sg-48" label="Configuración" />} title="Configuración" titleId="conf-tit"
                actions={<MenuVisualizacion abierto={visAbierto} setAbierto={setVisAbierto} />} onClose={cerrar} closeProps={{ 'data-nav': '' }}>
                <Segmented label="Configuración" value={tab} itemProps={{ 'data-nav': '', 'aria-controls': 'conf-cuerpo' }}
                    onChange={t => { almacen.flush(); ui.set({ conf: { tab: t } }); }}
                    options={TABS.map(([t, n, ico]) => ({ value: t, label: n, icon: <Icono n={ico} /> }))} />
            </ModalHeader>
            <div className="conf-cuerpo" id="conf-cuerpo" aria-labelledby="conf-tit">{cuerpo}</div>
        </Modal>
    );
}
