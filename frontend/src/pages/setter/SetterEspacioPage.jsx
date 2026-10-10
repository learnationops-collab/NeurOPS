import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { BarChart3, CalendarDays, ClipboardList, Ghost, Link2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePlaybook } from '../../contexts/PlaybookContext';
import { revertImpersonation } from '../../utils/impersonation';
import { armarMenuSesion, rotuloDeSesion } from '../../sesion/menuSesion';
import { useConfiguracion } from '../../sesion/ConfiguracionContext';
import OperatorControls from '../../components/modals/OperatorControls';
import DashboardComercial from '../comercial/DashboardComercial';
import DockSecciones from '../comercial/components/DockSecciones';
import MenuSesion from '../comercial/components/MenuSesion';
import { Segmented } from '../comercial/components/Shared';
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
 * "atrás" y la ruta de aterrizaje del rol (`/setter/deck?step=agendas`) siguen andando. Las
 * rutas viejas (/setter/report, /setter/agendas, /setter/mis-datos...) redirigen acá.
 *
 * Cualificación ya no es una sección (pedido del 10/10/2026: "ya no es necesaria para los
 * setters"): el aterrizaje es "Mis agendas", y un link viejo a `?step=cualificacion` cae ahí como
 * cualquier sección que no existe.
 *
 * Va SIN `MainLayout`, igual que el mazo del closer: el dock de la app le quedaría encima del
 * propio. A cambio, ofrece lo que daba aquel: el Playbook, la salida de una simulación y cerrar
 * sesión. Desde el 30/09/2026 están en la sesión al final del dock (`MenuSesion`, el avatar), como
 * en el mazo del closer; en el header queda solo "Volver a mi sesión" mientras se simula, que es lo
 * primero que busca quien termina de mirar.
 *
 * Revisar (el libro de registros del dashboard) NO es una sección del setter (pedido del
 * 29/09/2026), y `?step=revisar` de un link viejo cae en Mis agendas. Sus listas viven en
 * Reporte · Registros (pedido del 01/10/2026: "el setter trabaja con Reporte, que vea los datos
 * dentro de su reporte"): sus leads y sus agendas generadas, acotadas a él por el backend.
 */

/**
 * Las secciones del dock, en orden: el número de cada una (01, 02...) es el que muestra el
 * encabezado. `sub` es la frase apagada que sigue al saludo ("Hola, Elias. Así cerraste el día."):
 * dice para qué está la sección, y a ancho de teléfono se esconde.
 *
 * "Registros", una palabra: es la que ya dice el ojo de cada número de "Mis datos" ("Ver los
 * registros"), así que el clic y el lugar al que lleva se llaman igual. "Mis registros" quedaba al
 * lado de "Mis reportes" y de un vistazo eran la misma pestaña.
 */
const SECCIONES = [
    // La primera es el aterrizaje del rol y adonde cae una sección que no existe.
    { id: 'agendas', label: 'Mis agendas', Icono: CalendarDays, sub: 'Cada agenda, con su anuncio.' },
    { id: 'reporte', label: 'Reporte', Icono: ClipboardList, sub: 'Así cerraste el día.',
        tabs: [{ key: 'hoy', label: 'Reporte del día' }, { key: 'historial', label: 'Mis reportes' },
            { key: 'registros', label: 'Registros' }] },
    { id: 'datos', label: 'Mis datos', Icono: BarChart3, sub: 'Así vienen tus números.' },
];

/** "01", "02"...: el número de la sección en el dock, como lo escribe el encabezado. */
const numeroDe = (id) => String(SECCIONES.findIndex(s => s.id === id) + 1).padStart(2, '0');

/** "Ana Setter" → "Ana": el saludo va con el nombre de pila. */
const nombreDePila = (nombre) => String(nombre || '').trim().split(/\s+/)[0] || 'Setter';

/**
 * Lo que el drill-down de "Mis datos" deja en la URL: la tabla (`t`) y su filtro (`f`, con su token
 * `ft`). Ver `DashboardComercial`.
 */
const CLAVES_DEL_DRILL_DOWN = ['t', 'f', 'ft'];

/** Fecha local de hoy (YYYY-MM-DD), la misma que el formulario del reporte pone por defecto. */
const hoyLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const SetterEspacioPage = () => {
    const { user, logout } = useAuth();
    const { abrir: abrirConfiguracion } = useConfiguracion();
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
     * Cambia de sección (y de pestaña) sin tocar el período que eligió en "Mis datos" (`p`, `vs`):
     * sigue puesto al volver, y es el mismo con el que Registros arma la lista.
     *
     * `base` es la URL del drill-down de "Mis datos": el dashboard escribe su tabla y su filtro
     * (`t`, `f`, `ft`) y en el mismo clic pide ir a la lista, así que la URL de este render todavía
     * no los tiene. Armando desde ella, este cambio pisaba al otro y la lista abría sin filtro. Va
     * como entrada nueva del historial (el dashboard escribe la suya reemplazando), así que "atrás"
     * desde la lista vuelve a "Mis datos".
     *
     * Sin `base` es un cambio a mano (el dock o una pestaña), y suelta el drill-down: Registros
     * abierto así muestra sus leads sin filtro, no el último número que tocó.
     */
    const irA = useCallback((id, nuevaTab = null, base = null) => {
        const siguiente = new URLSearchParams(base || params);
        siguiente.set('step', id);
        if (nuevaTab) siguiente.set('tab', nuevaTab);
        else siguiente.delete('tab');
        if (!base) CLAVES_DEL_DRILL_DOWN.forEach(k => siguiente.delete(k));
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

    const claveVista = `${seccion}-${tab || ''}`;
    const nombre = user?.name || user?.username || 'Setter';

    // La sesión al final del dock: lo que antes eran botones del header.
    const gruposDeSesion = armarMenuSesion({
        user, logout, navigate: (ruta) => window.location.assign(ruta),
        acciones: [
            // Sus links de Agendas 2.0 (uno por evento de cada funnel de setting): lo que entra por ahí
            // queda a su nombre y aparece en sus agendas, como con Calendly. Tocar uno lo copia.
            { id: 'links', label: 'Mis links de agendamiento', Icono: Link2,
                panel: { titulo: 'Mis links de agendamiento', vacio: 'Todavía no hay funnels de setting publicados.', cargar: cargarMisLinks } },
        ],
        configuracion: { onClick: () => abrirConfiguracion() },
        playbook: { onClick: () => openPlaybook('pending'), pendientes: pendingCount },
    });

    return (
        <div className="setter-espacio">
            {/* El humo de fondo de toda la página, el del reporte que aprobó Kerwin: los paneles
                de vidrio flotan encima. Quieto con movimiento reducido. */}
            <div className="aura-pag" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="setter-espacio-wrap">
                {/* El encabezado en una línea, como el artifact: el número de la sección en el
                    dock, el saludo con lo que se hace ahí y, si la sección tiene, sus pestañas.
                    El nombre de la sección lo dice el dock; acá se lee igual con un lector. */}
                <div className="dc-shell dc-shell--embebido">
                    <header className="tope setter-top">
                        <div className="hola">
                            <span className="head-num num" aria-hidden="true">{numeroDe(seccion)}</span>
                            <h1>
                                <span className="sr">{seccionActual.label}. </span>
                                Hola, {nombreDePila(nombre)}.{' '}
                                {seccionActual.sub && <span className="sub">{seccionActual.sub}</span>}
                            </h1>
                        </div>
                        {seccionActual.tabs && (
                            <Segmented opciones={seccionActual.tabs} valor={tab} onChange={elegirTab}
                                ariaLabel={`Vistas de ${seccionActual.label}`} />
                        )}
                        {/* Simulando, la salida es terminar la simulación. Ya no es la ÚNICA
                            salida de ningún lado: moverse entre secciones es el dock. También está
                            en el menú del avatar, pero acá se ve sin buscarla. */}
                        {user?.is_impersonating && (
                            <button type="button" className="btn btn--linea btn--sm setter-volver" disabled={saliendo}
                                title="Volver a tu sesión original" onClick={volverAMiSesion}>
                                <Ghost size={15} />
                                {saliendo ? 'Volviendo…' : 'Volver a mi sesión'}
                            </button>
                        )}
                    </header>
                </div>

                <motion.div key={claveVista}
                    initial={reducir ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 0.7, 0.2, 1] }}>
                    {seccion === 'agendas' && (
                        <>
                            <SetterWorkflowPage paso="agendas" />
                            <SetterAgendasPage />
                        </>
                    )}
                    {seccion === 'reporte' && tab === 'hoy' && (
                        <PublicSetterReportPage onEnviado={(fecha) => { if (fecha === hoyLocal()) setReporteHoy(true); }} />
                    )}
                    {seccion === 'reporte' && tab === 'historial' && <PublicSetterStatsPage embebido />}
                    {/* Registros y "Mis datos" son el dashboard comercial, acotado a este setter
                        por el backend (`alcance_de`): la lista de Revisar y el tablero de Analizar,
                        como "Mi cartera" y "Ver mis datos" en el mazo del closer. Sin selector de
                        persona: el contexto de un setter no lo ofrece. */}
                    {seccion === 'reporte' && tab === 'registros' && (
                        <DashboardComercial embebido seccionFija="revisar" />
                    )}
                    {/* El drill-down de un dato lleva a Registros con la tabla y el filtro de ese
                        número, partiendo de la URL que el dashboard acaba de escribir. */}
                    {seccion === 'datos' && (
                        <DashboardComercial embebido seccionFija="analizar"
                            onIrASeccion={(_seccion, urlDelFiltro) => irA('reporte', 'registros', urlDelFiltro)} />
                    )}
                </motion.div>

                <div className="dc-shell dc-shell--embebido">
                    <DockSecciones secciones={secciones} activa={seccion}
                        onElegir={(id) => { if (id !== seccion) irA(id); }}
                        ariaLabel="Secciones del espacio del setter"
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

            <OperatorControls isOpen={operador} onClose={() => setOperador(false)} />
        </div>
    );
};

// Tocar un link lo copia: es lo que el setter pega en WhatsApp o Instagram.
const cargarMisLinks = async () => {
    const res = await api.get('/setter/agendas-links');
    return (res.data?.links || []).map((l) => ({
        id: l.ruta,
        label: `${l.funnel} · ${l.evento}`,
        onClick: async () => {
            const url = window.location.origin + l.ruta;
            try { await navigator.clipboard.writeText(url); toast.success('Link copiado'); } catch { window.prompt('Copiá tu link:', url); }
        },
    }));
};

export default SetterEspacioPage;
