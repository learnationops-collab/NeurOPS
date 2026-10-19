// Área Inbox: las automatizaciones de Instagram (el motor propio que reemplaza a ManyChat) y las
// conversaciones. Admin y dirección comercial arman y publican flujos; el setter entra a mirar (lo
// decide el servidor: app/automatizaciones/api.py). Usa el sistema visual de Thalamus (thalamus.css),
// los componentes estándar y el dock de las áreas de la dirección comercial. Cada sección manda sus
// filtros y botones a la cabecera con <HeaderActions>.
import { useEffect, useState } from 'react';
import { Lock, Megaphone, MessagesSquare, Workflow } from 'lucide-react';
import '../agendas_v2/thalamus.css';
import '../comercial/comercial.css';
import './inbox.css';
import { useAuth } from '../../contexts/AuthContext';
import { dataThemeDe, useApariencia } from '../../context/AparienciaContext';
import { useConfiguracion } from '../../sesion/ConfiguracionContext';
import { armarMenuSesion, rotuloDeSesion } from '../../sesion/menuSesion';
import { rotuloDeRol } from '../../utils/cuentasVinculadas';
import { Chip, EmptyState, PageHeader, Status, Toaster, Tooltip } from '../../components/standard';
import DockSecciones from '../comercial/components/DockSecciones';
import MenuSesion from '../comercial/components/MenuSesion';
import Flujos from './Flujos';
import Conversaciones from './Conversaciones';
import Campanas from './Campanas';
import { inboxApi } from './api';

export const SECCIONES = [
    { id: 'flujos', label: 'Flujos', Icono: Workflow },
    { id: 'campanas', label: 'Campañas', Icono: Megaphone },
    { id: 'conversaciones', label: 'Conversaciones', Icono: MessagesSquare },
];
const CLAVE_SECCION = 'inbox-seccion';
const MODO = {
    apagado: { label: 'Motor apagado', color: 'var(--idle)', tip: 'Motor apagado|No lee ni contesta mensajes.' },
    simulado: { label: 'Motor en simulación', color: 'var(--warning)', tip: 'Motor en simulación|Recorre los flujos pero no manda nada a Instagram.' },
    real: { label: 'Motor encendido', color: 'var(--success)', tip: 'Motor encendido|Contesta en Instagram con los flujos activos.' },
};

function seccionGuardada() {
    try {
        const s = window.localStorage.getItem(CLAVE_SECCION);
        return SECCIONES.some((x) => x.id === s) ? s : 'flujos';
    } catch {
        return 'flujos';
    }
}

// Mismo cuadrado que el logo de Thalamus (tl-fondo cambia de color con el tema), con un globo de chat.
function LogoInbox() {
    return (
        <svg className="tope-logo tl-logo" viewBox="0 0 100 100" role="img" aria-label="Learnation Inbox">
            <defs><linearGradient id="tlG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FF3FA4" /><stop offset="100%" stopColor="#FF6AD5" /></linearGradient></defs>
            <rect className="tl-fondo" width="100" height="100" rx="26" />
            <path d="M74 58a6 6 0 0 1-6 6H40L28 76V32a6 6 0 0 1 6-6h34a6 6 0 0 1 6 6z" fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinejoin="round" />
            <circle cx="41" cy="45" r="4.5" fill="#FFFFFF" /><circle cx="51" cy="45" r="4.5" fill="#FFFFFF" /><circle cx="61" cy="45" r="4.5" fill="#FFFFFF" />
        </svg>
    );
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
    const modo = estado?.modo && (MODO[estado.modo] || { label: estado.modo });

    return (
        <>
            <div className="thalamus thalamus-app inbox" data-theme={dataThemeDe(apariencia, undefined)}>
                <div className="wrap">
                    <PageHeader size="sm" title={actual.label} logo={<LogoInbox />}
                        badges={(
                            <>
                                {lectura && (
                                    <Chip color="var(--info)" icon={<Lock size={13} />} className="chip-lectura" data-tip="Solo lectura|Los flujos los arma y publica la dirección comercial.">
                                        Solo lectura
                                    </Chip>
                                )}
                                {modo && <Status color={modo.color} className="inbox-modo" data-tip={modo.tip}>{modo.label}</Status>}
                            </>
                        )} />
                    <main className="vista">
                        {!estado && <EmptyState>Cargando…</EmptyState>}
                        {estado && seccion === 'flujos' && <Flujos puedeEditar={!lectura} />}
                        {estado && seccion === 'campanas' && <Campanas puedeEditar={!lectura} />}
                        {estado && seccion === 'conversaciones' && <Conversaciones />}
                    </main>
                </div>
                <Toaster />
                <Tooltip />
            </div>
            <div className="dc-shell dc-shell--embebido">
                <DockSecciones secciones={SECCIONES} activa={seccion} onElegir={elegir} ariaLabel="Secciones del Inbox"
                    despues={<MenuSesion nombre={user?.username || ''} rol={rotuloDeSesion(user, `${rotuloDeRol(user?.role)} · Inbox`)} grupos={grupos} />} />
            </div>
        </>
    );
}
