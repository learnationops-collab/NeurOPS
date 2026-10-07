// Configuración de Agendamiento (el dial magenta, como en Thalamus): Datos, Disponibilidad,
// Integraciones, Equipo y Apariencia. Se abre como ventana flotante o a pantalla completa
// (Visualización). No repite lógica de NeurOPS: las pestañas usan sus mismos endpoints (conf/cuenta.jsx).

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { Dial, Icono, Modal } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { almacen, useUi } from '../../data/hooks';
import { DatosCuenta, TarjetaCalendar, TarjetaDisponibilidad, TarjetaWhatsapp } from './cuenta';
import TabEquipo from './TabEquipo';

export const TABS = [
    ['datos', 'Datos', 'user'], ['disponibilidad', 'Disponibilidad', 'clock'], ['integraciones', 'Integraciones', 'enchufe'],
    ['equipo', 'Equipo', 'users'], ['apariencia', 'Apariencia', 'sol'],
];
const VISTAS = [['completa', 'Pantalla completa'], ['flotante', 'Ventana flotante']];
const TEMAS = [['oscuro', 'Oscuro', 'luna'], ['claro', 'Claro', 'sol'], ['sistema', 'Sistema', 'monitor']];

function MenuVisualizacion({ abierto, setAbierto }) {
    const { confVis } = useUi();
    const caja = useRef(null), btn = useRef(null);
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
                <div className="vis-pop" role="menu" aria-label="Visualización">
                    <div className="vis-cab">
                        <span className="t-rotulo">Visualización</span>
                        <button type="button" className="ibtn ibtn--xs" aria-label="Cerrar" onClick={cerrar}><Icono n="x" /></button>
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

function Apariencia() {
    const { tema } = useUi();
    return (
        <section className="panel cu-tarjeta">
            <p className="t-eyebrow">Apariencia de Agendamiento</p>
            <div className="apariencia" role="group" aria-label="Apariencia">
                {TEMAS.map(([v, n, ico]) => (
                    <button key={v} type="button" data-nav="" aria-pressed={tema === v} onClick={() => ui.set({ tema: v })}><Icono n={ico} />{n}</button>
                ))}
            </div>
        </section>
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
    useEffect(() => { document.querySelector('#conf .tab[aria-selected="true"]')?.focus({ preventScroll: true }); }, []);

    let cuerpo;
    if (tab === 'disponibilidad') cuerpo = <TarjetaDisponibilidad />;
    else if (tab === 'integraciones') cuerpo = <><TarjetaCalendar volver="agendamiento" /><TarjetaWhatsapp /></>;
    else if (tab === 'equipo') cuerpo = <TabEquipo />;
    else if (tab === 'apariencia') cuerpo = <Apariencia />;
    else cuerpo = <DatosCuenta user={user} />;

    return (
        <Modal onCerrar={alEscape} id="conf" labelledBy="conf-tit" clase={'modal--conf' + (confVis === 'completa' ? ' modal--full' : '')}>
            <div className="conf-cab">
                <Dial tile className="tl-logo sg-48" label="Configuración" />
                <h2 className="t-h2" id="conf-tit">Configuración</h2>
                <div className="tabs" role="tablist" aria-label="Configuración">
                    {TABS.map(([t, n, ico]) => (
                        <button key={t} type="button" className="tab" role="tab" data-nav="" aria-selected={tab === t} aria-controls="conf-cuerpo"
                            onClick={() => { almacen.flush(); ui.set({ conf: { tab: t } }); }}>
                            <Icono n={ico} />{n}
                        </button>
                    ))}
                </div>
                <MenuVisualizacion abierto={visAbierto} setAbierto={setVisAbierto} />
                <button type="button" className="ibtn" data-nav="" aria-label="Cerrar" onClick={cerrar}><Icono n="x" /></button>
            </div>
            <div className="conf-cuerpo" id="conf-cuerpo" role="tabpanel" aria-labelledby="conf-tit">{cuerpo}</div>
        </Modal>
    );
}
