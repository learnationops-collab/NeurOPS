import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { BarChart3, CalendarDays, CheckCircle2, ClipboardList, Compass, Ghost, Layers, LogOut } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePlaybook } from '../../contexts/PlaybookContext';
import { revertImpersonation } from '../../utils/impersonation';
import OperatorControls from '../../components/modals/OperatorControls';
import DashboardComercial from '../comercial/DashboardComercial';
import DockSecciones from '../comercial/components/DockSecciones';
import { Isotipo, Segmented, fmt } from '../comercial/components/Shared';
import '../comercial/comercial.css';
import './setterEspacio.css';
import SetterWorkflowPage from './SetterWorkflowPage';
import SetterAgendasPage from './agendas/SetterAgendasPage';
import PublicSetterReportPage from '../public/PublicSetterReportPage';
import PublicSetterStatsPage from '../public/PublicSetterStatsPage';

/**
 * El espacio del setter: todo su trabajo y sus datos en una sola pantalla, con un solo dock.
 *
 * Antes eran cinco páginas sueltas —el mazo, Mis agendas, el reporte, Mis reportes y Mis datos—
 * y "Mis datos" (el dashboard comercial) traía su propio dock: al entrar a ver los datos se
 * cambiaba el panel de abajo y ya no había cómo volver al trabajo. Simulando a un setter era
 * peor: la única salida era "Volver a mi sesión", que terminaba la simulación. Ahora es una sola
 * pantalla, como el mazo del closer, y el dock es el del dashboard: el mismo componente
 * (`DockSecciones`), con las secciones del setter.
 *
 * La sección y su pestaña viven en la query string (`step` y `tab`), así que un link, el botón
 * "atrás" y la ruta de aterrizaje del rol (`/setter/deck?step=cualificacion`) siguen andando. Las
 * rutas viejas (/setter/report, /setter/agendas, /setter/mis-datos...) redirigen acá.
 *
 * Va SIN `MainLayout`, igual que el mazo del closer: el dock de la app le quedaría encima del
 * propio. A cambio, este header ofrece lo que daba aquel: el Playbook, la salida de una simulación
 * y cerrar sesión.
 */

const SECCIONES = [
    { id: 'cualificacion', label: 'Cualificación', Icono: Layers },
    { id: 'agendas', label: 'Agendas', Icono: CalendarDays,
        tabs: [{ key: 'fecha', label: 'Por fecha' }, { key: 'historial', label: 'Historial' }] },
    { id: 'reporte', label: 'Reporte', Icono: ClipboardList,
        tabs: [{ key: 'hoy', label: 'Reporte del día' }, { key: 'historial', label: 'Mis reportes' }] },
    { id: 'datos', label: 'Mis datos', Icono: BarChart3 },
    { id: 'revisar', label: 'Revisar', Icono: CheckCircle2 },
];

/** Fecha local de hoy (YYYY-MM-DD), la misma que el formulario del reporte pone por defecto. */
const hoyLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const SetterEspacioPage = () => {
    const { user, logout } = useAuth();
    const { pendingCount, openPlaybook } = usePlaybook();
    const [params, setParams] = useSearchParams();
    const reducir = useReducedMotion();
    const [saliendo, setSaliendo] = useState(false);
    const [operador, setOperador] = useState(false);
    const [reporteHoy, setReporteHoy] = useState(false);

    const seccionActual = SECCIONES.find(s => s.id === params.get('step')) || SECCIONES[0];
    const seccion = seccionActual.id;
    const tab = seccionActual.tabs?.some(t => t.key === params.get('tab'))
        ? params.get('tab')
        : seccionActual.tabs?.[0].key ?? null;

    /**
     * Cambia de sección (y de pestaña) sin tocar el resto de la query string.
     *
     * `base` es de dónde se parte, y por defecto es la URL de este render. El drill-down de "Mis
     * datos" pasa otra: escribe su tabla y su filtro (`t`, `f`, `ft`) en la URL y en el mismo clic
     * pide ir a Revisar, así que la de este render todavía no los tiene. Armando desde ella, este
     * cambio pisaba al otro y Revisar abría sin ningún filtro.
     */
    const irA = useCallback((id, nuevaTab = null, base = params) => {
        const siguiente = new URLSearchParams(base);
        siguiente.set('step', id);
        if (nuevaTab) siguiente.set('tab', nuevaTab);
        else siguiente.delete('tab');
        setParams(siguiente);
        window.scrollTo({ top: 0 });
    }, [params, setParams]);

    const elegirTab = useCallback((nuevaTab) => irA(seccion, nuevaTab), [irA, seccion]);

    // ¿Ya mandó el reporte de hoy? Es lo que pone el "✓" en el dock, como el "Cerrar el día" del
    // closer. Si la consulta falla no se marca nada: el dock sin ✓ es la respuesta prudente.
    useEffect(() => {
        if (!user?.id) return;
        const hoy = hoyLocal();
        api.get('/public/setter-reports', { params: { setter_id: user.id, start_date: hoy, end_date: hoy, per_page: 1 } })
            .then(res => setReporteHoy((res.data?.total || 0) > 0))
            .catch(() => { /* sin ✓, que es lo que hay que mostrar si no se sabe */ });
    }, [user?.id]);

    // Atajo 'w' para el panel de operador. Sin MainLayout esta pantalla no tiene el
    // HotkeysManager global (igual que el mazo del closer), y un operador que simula a un setter
    // lo necesita para cambiar de simulación.
    useEffect(() => {
        const alTeclear = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            if (e.key.toLowerCase() === 'w' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                setOperador(v => !v);
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

    const secciones = SECCIONES.map(s => (s.id === 'reporte' && reporteHoy
        ? { ...s, marca: { texto: '✓', titulo: 'reporte de hoy enviado' } }
        : s));

    // Cualificación y "Agendas · Por fecha" son el mismo mazo con otro paso: comparten la clave
    // para que React no lo desmonte al ir de una a otra y se conserven el rango de fechas y la
    // búsqueda. El resto entra con su animación cada vez.
    const esMazo = seccion === 'cualificacion' || (seccion === 'agendas' && tab === 'fecha');
    const claveVista = esMazo ? 'mazo' : `${seccion}-${tab || ''}`;
    const nombre = user?.name || user?.username || 'Setter';

    return (
        <div className="setter-espacio">
            <div className="setter-espacio-wrap">
                <div className="dc-shell dc-shell--embebido">
                    <header className="tope">
                        <div className="tope-id">
                            <Isotipo idGrad="lnGradSetter" />
                            <h1 className="t-h1">{seccionActual.label}</h1>
                        </div>
                        <div className="tope-meta tope-acciones">
                            <button type="button" className="btn btn--linea btn--sm"
                                onClick={() => openPlaybook('pending')}
                                title="Videos de formación y actualizaciones">
                                <Compass size={15} />
                                Playbook
                                {pendingCount > 0 && <span className="playbook-n">{pendingCount}</span>}
                            </button>
                            {/* Simulando, la salida es terminar la simulación. Ya no es la ÚNICA
                                salida de ningún lado: moverse entre secciones es el dock. */}
                            {user?.is_impersonating && (
                                <button type="button" className="btn btn--linea btn--sm" disabled={saliendo}
                                    title="Volver a tu sesión original" onClick={volverAMiSesion}>
                                    <Ghost size={15} />
                                    {saliendo ? 'Volviendo…' : 'Volver a mi sesión'}
                                </button>
                            )}
                            <div className="yo" title={nombre}>
                                <span className="avatar" aria-hidden="true">{fmt.iniciales(nombre)}</span>
                                <span className="yo-nombre trunc">{nombre.trim().split(/\s+/)[0]}</span>
                            </div>
                            <button type="button" className="ibtn ibtn--sm" title="Cerrar sesión"
                                aria-label="Cerrar sesión"
                                onClick={() => { if (window.confirm('¿Cerrar sesión?')) logout(); }}>
                                <LogOut />
                            </button>
                        </div>
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
                    {esMazo && <SetterWorkflowPage paso={seccion === 'cualificacion' ? 'cualificacion' : 'agendas'} />}
                    {seccion === 'agendas' && tab === 'historial' && <SetterAgendasPage />}
                    {seccion === 'reporte' && tab === 'hoy' && (
                        <PublicSetterReportPage onEnviado={(fecha) => { if (fecha === hoyLocal()) setReporteHoy(true); }} />
                    )}
                    {seccion === 'reporte' && tab === 'historial' && <PublicSetterStatsPage embebido />}
                    {/* "Mis datos" y Revisar son el dashboard comercial, acotado a este setter por
                        el backend. El drill-down de un dato cambia a Revisar, donde vive la tabla. */}
                    {seccion === 'datos' && (
                        <DashboardComercial embebido seccionFija="analizar"
                            onIrASeccion={(_seccion, urlDelFiltro) => irA('revisar', null, urlDelFiltro)} />
                    )}
                    {seccion === 'revisar' && <DashboardComercial embebido seccionFija="revisar" />}
                </motion.div>

                <div className="dc-shell dc-shell--embebido">
                    <DockSecciones secciones={secciones} activa={seccion}
                        onElegir={(id) => { if (id !== seccion) irA(id); }}
                        ariaLabel="Secciones del espacio del setter" />
                </div>
            </div>

            <OperatorControls isOpen={operador} onClose={() => setOperador(false)} />
        </div>
    );
};

export default SetterEspacioPage;
