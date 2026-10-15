// Área Inbox: las automatizaciones de Instagram (el motor propio que reemplaza a ManyChat) y las
// conversaciones. Admin y dirección comercial arman y publican flujos; el setter entra a mirar (lo
// decide el servidor: app/automatizaciones/api.py). Usa el sistema visual de Thalamus (thalamus.css) y
// el dock de las áreas de la dirección comercial.
import { useEffect, useState } from 'react';
import { Lock, MessagesSquare, Workflow } from 'lucide-react';
import '../agendas_v2/thalamus.css';
import '../comercial/comercial.css';
import './inbox.css';
import { useAuth } from '../../contexts/AuthContext';
import { dataThemeDe, useApariencia } from '../../context/AparienciaContext';
import { useConfiguracion } from '../../sesion/ConfiguracionContext';
import { armarMenuSesion, rotuloDeSesion } from '../../sesion/menuSesion';
import { rotuloDeRol } from '../../utils/cuentasVinculadas';
import DockSecciones from '../comercial/components/DockSecciones';
import MenuSesion from '../comercial/components/MenuSesion';
import Flujos from './Flujos';
import Conversaciones from './Conversaciones';
import { inboxApi } from './api';

export const SECCIONES = [
    { id: 'flujos', label: 'Flujos', Icono: Workflow },
    { id: 'conversaciones', label: 'Conversaciones', Icono: MessagesSquare },
];
const CLAVE_SECCION = 'inbox-seccion';
const MODO = { apagado: 'Motor apagado', simulado: 'Motor en simulación', real: 'Motor encendido' };

function seccionGuardada() {
    try {
        const s = window.localStorage.getItem(CLAVE_SECCION);
        return SECCIONES.some((x) => x.id === s) ? s : 'flujos';
    } catch {
        return 'flujos';
    }
}

export default function InboxApp() {
    const { user, logout } = useAuth();
    const { abrir: abrirConfiguracion } = useConfiguracion();
    const apariencia = useApariencia();
    const [seccion, setSeccion] = useState(seccionGuardada);
    const [estado, setEstado] = useState(null);

    useEffect(() => { document.title = 'Inbox · Learnation'; }, []);
    useEffect(() => { inboxApi.estado().then(setEstado).catch(() => setEstado({ puede_editar: false, modo: null })); }, []);

    const elegir = (id) => {
        setSeccion(id);
        try { window.localStorage.setItem(CLAVE_SECCION, id); } catch { /* sin almacenamiento: no pasa nada */ }
        window.scrollTo({ top: 0 });
    };

    const grupos = armarMenuSesion({ user, logout, configuracion: { onClick: () => abrirConfiguracion() } });
    const actual = SECCIONES.find((s) => s.id === seccion) || SECCIONES[0];
    const lectura = estado ? !estado.puede_editar : false;

    return (
        <>
            <div className="thalamus thalamus-app inbox" data-theme={dataThemeDe(apariencia, undefined)}>
                <div className={`wrap${seccion === 'flujos' ? ' wrap--ancho' : ''}`}>
                    <header className="tope">
                        <div className="tope-id">
                            <h1 className="t-h1">{actual.label}</h1>
                            {lectura && <span className="chip chip-lectura" style={{ '--c': 'var(--info)' }}><Lock size={13} />Solo lectura</span>}
                        </div>
                        {estado?.modo && (
                            <span className={`chip chip--n inbox-modo inbox-modo--${estado.modo}`}>{MODO[estado.modo] || estado.modo}</span>
                        )}
                    </header>
                    <main className="vista">
                        {!estado && <div className="panel vacio"><p className="t-sm mut">Cargando…</p></div>}
                        {estado && seccion === 'flujos' && <Flujos puedeEditar={!lectura} />}
                        {estado && seccion === 'conversaciones' && <Conversaciones />}
                    </main>
                </div>
            </div>
            <div className="dc-shell dc-shell--embebido">
                <DockSecciones secciones={SECCIONES} activa={seccion} onElegir={elegir} ariaLabel="Secciones del Inbox"
                    despues={<MenuSesion nombre={user?.username || ''} rol={rotuloDeSesion(user, `${rotuloDeRol(user?.role)} · Inbox`)} grupos={grupos} />} />
            </div>
        </>
    );
}
