import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CalendarDays, ClipboardCheck, Database, DollarSign, Ghost, GraduationCap, LifeBuoy, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePlaybook } from '../../contexts/PlaybookContext';
import { revertImpersonation } from '../../utils/impersonation';
import { armarMenuSesion, rotuloDeSesion } from '../../sesion/menuSesion';
import { useConfiguracion } from '../../sesion/ConfiguracionContext';
import { abrirSimulacion } from '../../sesion/simulacion';
import DockSecciones from '../comercial/components/DockSecciones';
import MenuSesion from '../comercial/components/MenuSesion';
import { Isotipo, Segmented } from '../comercial/components/Shared';
import '../comercial/comercial.css';
import './operadorEspacio.css';
import SeccionTecnica, { ETIQUETAS_TECNICAS } from './settings/SeccionTecnica';
import FinancialAgendasPage from '../admin/reports/FinancialAgendasPage';
import PublicFinancialSalesPage from '../public/PublicFinancialSalesPage';
import FormsManagementPage from '../shared/FormsManagementPage';
import CourseEditorPage from './course-editor/CourseEditorPage';

/**
 * El espacio del operador: todo su trabajo en una sola pantalla, con un solo dock.
 *
 * Antes eran cuatro páginas con el dock global de la app y, en la principal, un menú vertical de doce
 * botones más otro de filtro por rol dentro de Gestión de Equipo. Ahora es como el espacio del
 * setter, el mazo del closer y el dashboard comercial: las secciones van en el dock
 * (`DockSecciones`), cada una con sus pestañas arriba, y la sesión (Playbook, cambiar de rol,
 * volver de una simulación, cerrar sesión) en el avatar del final (`MenuSesion`).
 *
 * La sección y su pestaña viven en la query string (`step` y `tab`): `/ops/dashboard` sigue siendo
 * la ruta de aterrizaje del rol, y las rutas viejas (`/ops/agendas`, `/ops/ventas`,
 * `/ops/course-editor`) redirigen acá (ver `OpsRuta`).
 *
 * Va SIN `MainLayout`, como el mazo del closer y el del setter: el dock de la app le quedaría encima
 * del propio. El contenido NO va dentro de un `.dc-shell` (su reset de botones borraría los estilos
 * de Tailwind de los paneles); solo el header, las pestañas y el dock son islas del dashboard.
 */

/** Las doce secciones del panel técnico, repartidas en dos grupos para que cada pestaña sea corta. */
const pestanasTecnicas = (ids) => ids.map(key => ({ key, label: ETIQUETAS_TECNICAS[key] }));

const SECCIONES = [
    { id: 'equipo', label: 'Equipo', Icono: Users },
    { id: 'soporte', label: 'Soporte', Icono: LifeBuoy,
        tabs: pestanasTecnicas(['bug_reports', 'closer_aliases', 'leads_audit', 'report_backlog', 'playbook', 'bitacora']) },
    { id: 'datos', label: 'Datos', Icono: Database,
        tabs: pestanasTecnicas(['database', 'operations']) },
    { id: 'agendas', label: 'Agendas', Icono: CalendarDays },
    { id: 'ventas', label: 'Ventas', Icono: DollarSign },
    // Los formularios de cualificación y la fusión de clientes (10/10/2026): eran del panel de
    // «Administración», que se retiró. El triage sigue con su propia pantalla (/triage/formularios).
    { id: 'formularios', label: 'Formularios', Icono: ClipboardCheck },
    { id: 'curso', label: 'Curso', Icono: GraduationCap },
];

const OperadorEspacioPage = () => {
    const { user, logout } = useAuth();
    const { abrir: abrirConfiguracion } = useConfiguracion();
    const { pendingCount, openPlaybook } = usePlaybook();
    const [params, setParams] = useSearchParams();
    const reducir = useReducedMotion();
    const [saliendo, setSaliendo] = useState(false);

    const seccionActual = SECCIONES.find(s => s.id === params.get('step')) || SECCIONES[0];
    const seccion = seccionActual.id;
    const tab = seccionActual.tabs?.some(t => t.key === params.get('tab'))
        ? params.get('tab')
        : seccionActual.tabs?.[0].key ?? null;

    const irA = useCallback((id, nuevaTab = null) => {
        const siguiente = new URLSearchParams(params);
        siguiente.set('step', id);
        if (nuevaTab) siguiente.set('tab', nuevaTab);
        else siguiente.delete('tab');
        setParams(siguiente);
        window.scrollTo({ top: 0 });
    }, [params, setParams]);

    const elegirTab = useCallback((nuevaTab) => irA(seccion, nuevaTab), [irA, seccion]);

    // Atajo 'w' para Simular a alguien: sin MainLayout no está el HotkeysManager global.
    useEffect(() => {
        const alTeclear = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            if (e.key.toLowerCase() === 'w' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                abrirSimulacion();
            }
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, []);

    const volverAMiSesion = async () => {
        setSaliendo(true);
        try {
            await revertImpersonation();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'No se pudo volver a tu sesión');
            setSaliendo(false);
        }
    };

    const nombre = user?.name || user?.username || 'Operador';
    const claveVista = `${seccion}-${tab || ''}`;

    const gruposDeSesion = armarMenuSesion({
        user, logout, navigate: (ruta) => window.location.assign(ruta),
        acciones: [],
        configuracion: { onClick: () => abrirConfiguracion() },
        playbook: { onClick: () => openPlaybook('pending'), pendientes: pendingCount },
    });

    return (
        <div className="operador-espacio">
            <div className="operador-espacio-wrap">
                <div className="dc-shell dc-shell--embebido">
                    <header className="tope">
                        <div className="tope-id">
                            <Isotipo idGrad="lnGradOperador" />
                            <h1 className="t-h1">{seccionActual.label}</h1>
                        </div>
                        {user?.is_impersonating && (
                            <div className="tope-meta tope-acciones">
                                <button type="button" className="btn btn--linea btn--sm" disabled={saliendo}
                                    title="Volver a tu sesión original" onClick={volverAMiSesion}>
                                    <Ghost size={15} />
                                    {saliendo ? 'Volviendo…' : 'Volver a mi sesión'}
                                </button>
                            </div>
                        )}
                    </header>

                    {seccionActual.tabs && (
                        <div className="barra">
                            <Segmented opciones={seccionActual.tabs} valor={tab} onChange={elegirTab}
                                ariaLabel={`Vistas de ${seccionActual.label}`} />
                        </div>
                    )}
                </div>

                <motion.div key={claveVista}
                    initial={reducir ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 0.7, 0.2, 1] }}>
                    {seccion === 'equipo' && (
                        <div className="operador-panel dash-v6 bg-main text-base"><SeccionTecnica id="team" embebido /></div>
                    )}
                    {(seccion === 'soporte' || seccion === 'datos') && (
                        <div className="operador-panel dash-v6 bg-main text-base"><SeccionTecnica id={tab} embebido /></div>
                    )}
                    {/* Estas dos vistas están diseñadas sobre fondo oscuro (venían del hub de admin, que
                        lo aportaba): necesitan su propia superficie. */}
                    {seccion === 'agendas' && (
                        <div className="operador-oscuro"><FinancialAgendasPage /></div>
                    )}
                    {seccion === 'ventas' && (
                        <div className="operador-oscuro"><PublicFinancialSalesPage /></div>
                    )}
                    {seccion === 'formularios' && (
                        <div className="operador-oscuro"><FormsManagementPage /></div>
                    )}
                    {seccion === 'curso' && <CourseEditorPage />}
                </motion.div>

                <div className="dc-shell dc-shell--embebido">
                    <DockSecciones secciones={SECCIONES} activa={seccion}
                        onElegir={(id) => { if (id !== seccion) irA(id); }}
                        ariaLabel="Secciones del espacio del operador"
                        despues={(
                            <MenuSesion nombre={nombre}
                                rol={rotuloDeSesion(user)}
                                aviso={pendingCount > 0
                                    ? { texto: pendingCount, titulo: `${pendingCount} ${pendingCount === 1 ? 'video pendiente' : 'videos pendientes'} del Playbook` }
                                    : null}
                                grupos={gruposDeSesion} />
                        )} />
                </div>
            </div>

        </div>
    );
};

export default OperadorEspacioPage;
