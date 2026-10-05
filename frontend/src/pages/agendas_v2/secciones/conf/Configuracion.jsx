// Configuración (el dial magenta): Perfil, Miembros, Roles, Accesos, Funnels e Integraciones.
// Se abre como ventana flotante o a pantalla completa; las pestañas dependen del rol simulado.

import { useEffect, useRef, useState } from 'react';
import { Dial, Icono, Modal } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { almacen, useDatos, useUi } from '../../data/hooks';
import { tabConfOk } from '../../core/permisos';
import TabPerfil from './TabPerfil';
import TabMiembros from './TabMiembros';
import { TabAccesos, TabRoles } from './TabRoles';
import TabFunnels from './TabFunnels';
import TabIntegraciones from './TabIntegraciones';
import TabIA from './TabIA';

const TABS = [
    ['perfil', 'Perfil', 'ojo'], ['miembros', 'Miembros', 'user'], ['roles', 'Roles', 'users'], ['accesos', 'Accesos', 'candado'],
    ['funnels', 'Funnels', 'funnel'], ['ia', 'Con IA', 'rayo'], ['integraciones', 'Integraciones', 'enchufe'],
];
const VISTAS = [['completa', 'Pantalla completa'], ['flotante', 'Ventana flotante']];

function MenuVisualizacion({ abierto, setAbierto }) {
    const { confVis } = useUi();
    const caja = useRef(null), btn = useRef(null);
    useEffect(() => {
        if (!abierto) return;
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

export default function Configuracion() {
    const { d } = useDatos();
    const { conf, confVis, sim } = useUi();
    const [borrar, setBorrar] = useState(null);       // funnel con la confirmación de borrado abierta
    const [visAbierto, setVisAbierto] = useState(false);
    const [volver] = useState(() => document.activeElement);
    const tab = conf && tabConfOk(d, sim, conf.tab) && TABS.some(t => t[0] === conf.tab) ? conf.tab : 'perfil';

    const cerrar = () => {
        almacen.flush();
        ui.set({ conf: null });
        const v = volver;
        if (v && document.body.contains(v)) v.focus();
    };
    // Escape: primero cierra el menú de visualización o la confirmación de borrado; después, Configuración.
    const alEscape = useRef(null);
    useEffect(() => {
        alEscape.current = () => {
            if (visAbierto) setVisAbierto(false);
            else if (borrar) setBorrar(null);
            else cerrar();
        };
    });
    // Al abrir, el foco va a la pestaña activa (y no al primer campo, que en Perfil es el de la foto).
    useEffect(() => { document.querySelector('#conf .tab[aria-selected="true"]')?.focus({ preventScroll: true }); }, []);
    const irTab = (t) => { almacen.flush(); setBorrar(null); ui.set({ conf: { ...conf, tab: t } }); };

    let cuerpo;
    if (tab === 'miembros') cuerpo = <TabMiembros />;
    else if (tab === 'roles') cuerpo = <TabRoles />;
    else if (tab === 'accesos') cuerpo = <TabAccesos />;
    else if (tab === 'funnels') cuerpo = <TabFunnels borrar={borrar} setBorrar={setBorrar} />;
    else if (tab === 'integraciones') cuerpo = <TabIntegraciones />;
    else if (tab === 'ia') cuerpo = <TabIA />;
    else cuerpo = <TabPerfil />;

    return (
        <Modal onCerrar={() => alEscape.current()} id="conf" labelledBy="conf-tit" clase={'modal--conf' + (confVis === 'completa' ? ' modal--full' : '')}>
            <div className="conf-cab">
                <Dial tile className="tl-logo sg-48" label="Configuración" />
                <h2 className="t-h2" id="conf-tit">Configuración</h2>
                <div className="tabs" role="tablist" aria-label="Configuración">
                    {TABS.filter(t => tabConfOk(d, sim, t[0])).map(([t, n, ico]) => (
                        <button key={t} type="button" className="tab" role="tab" data-nav="" aria-selected={tab === t} aria-controls="conf-cuerpo" onClick={() => irTab(t)}>
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
