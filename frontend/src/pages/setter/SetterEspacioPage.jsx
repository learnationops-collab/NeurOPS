import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { BarChart3, BookOpen, CalendarClock, CalendarDays, CheckCircle2, ClipboardList, Ghost, Link2, MessagesSquare, Share2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePlaybook } from '../../contexts/PlaybookContext';
import { revertImpersonation } from '../../utils/impersonation';
import { armarMenuSesion, rotuloDeSesion } from '../../sesion/menuSesion';
import { useConfiguracion } from '../../sesion/ConfiguracionContext';
import { abrirSimulacion } from '../../sesion/simulacion';
import DashboardComercial from '../comercial/DashboardComercial';
import DockSecciones from '../comercial/components/DockSecciones';
import MenuSesion from '../comercial/components/MenuSesion';
import { Segmented } from '../comercial/components/Shared';
import { REVISAR_DEL_SETTER } from '../comercial/components/tablasSetter';
import '../comercial/comercial.css';
import './setterEspacio.css';
import MisAgendas from './agendas/MisAgendas';
import MisLinks, { BotonIcono, copiar } from './MisLinks';
import { abrirVentana } from '../../ventanas/ventanasStore';
import { marcaDelDock } from './agendas/meses';
import ReporteSeccion from '../reporte/ReporteSeccion';
import useMarcaReporte from '../reporte/useMarcaReporte';
import CompartidosConmigo from '../../components/compartidos/CompartidosConmigo';

// La bandeja del Inbox como sección (1435, ADR-W184): se carga recién al abrirla, con sus estilos.
const InboxEmbebido = lazy(() => import('../inbox/InboxEmbebido'));

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
 * Revisar es una sección del setter desde el 10/10/2026 (pedido del usuario: «una pestaña de
 * revisar donde pueda ver todas sus agendas, porque Mis agendas debe vaciarse [...] y las ventas que
 * se van registrando con su fuente»). Revierte dos decisiones: la del 29/09 (el setter no veía
 * Revisar) y la del 01/10, que había puesto sus listas en Reporte · Registros. Son las listas del
 * Revisar de closers y dirección —el mismo `DashboardComercial`, no una copia— acotadas a él por el
 * backend, de solo lectura: sus agendas (todas, con y sin palabra clave), los cobros de su fuente y
 * sus leads. Ver `tablasSetter.js`.
 *
 * El orden del dock es el del día del setter (pedido del 11/10/2026: «Mis agendas, Reporte, Mis datos
 * y luego Revisar»): lo que hace, lo que reporta, cómo le va y, al final, las listas para buscar algo.
 */

/**
 * Las secciones del dock, en orden: el número de cada una (01, 02...) es el que muestra el
 * encabezado. `sub` es la frase apagada que sigue al saludo ("Hola, Elias. Así cerraste el día."):
 * dice para qué está la sección, y a ancho de teléfono se esconde.
 */
const SECCIONES = [
    // La primera es el aterrizaje del rol y adonde cae una sección que no existe.
    { id: 'agendas', label: 'Mis agendas', Icono: CalendarDays, sub: 'Cada agenda, con su anuncio.' },
    // Las conversaciones de Instagram, sin salir a /inbox (Social Selling, 17/11/2026: un solo lugar de trabajo).
    { id: 'conversaciones', label: 'Conversaciones', Icono: MessagesSquare, sub: 'Los que te escribieron, por espera.' },
    // Lo que se manda en cada etapa del setting, editable (ADR-W197).
    { id: 'guia', label: 'Embudos', Icono: BookOpen, sub: 'Lo que se manda en cada fase y sus seguimientos.' },
    // El reporte único (pages/reporte/): trae sus propias pestañas Hoy / Historial.
    { id: 'reporte', label: 'Reporte', Icono: ClipboardList, sub: 'Así cerraste el día.' },
    // El Analizar del dashboard comercial, el mismo tablero de setters que ve la dirección, con sus
    // pestañas Dashboard · Comparativas · Variabilidad (las dibuja el dashboard, no el encabezado).
    { id: 'datos', label: 'Mis datos', Icono: BarChart3, sub: 'Así vienen tus números.' },
    // Una pestaña por tabla, y la tabla la elige la pestaña (`tablaFija`): su Ventas no es una de las
    // tablas de setters de la dirección, así que la `t` de la URL sola no la podía abrir.
    { id: 'revisar', label: 'Revisar', Icono: CheckCircle2, sub: 'Tus agendas, tus ventas y tus leads.',
        tabs: REVISAR_DEL_SETTER.map(({ key, label }) => ({ key, label })) },
    // Los leads en los que alguien lo nombró con «@» en el chat (ADR-W047): contesta sin tocar la agenda.
    { id: 'compartidos', label: 'Compartidos', Icono: Share2, sub: 'Leads donde te nombraron.' },
];

/** "01", "02"...: el número de la sección en el dock, como lo escribe el encabezado. */
const numeroDe = (id) => String(SECCIONES.findIndex(s => s.id === id) + 1).padStart(2, '0');

/** "Ana Setter" → "Ana": el saludo va con el nombre de pila. */
const nombreDePila = (nombre) => String(nombre || '').trim().split(/\s+/)[0] || 'Setter';

/** La pestaña de Revisar que abre la tabla `t` de un drill-down de "Mis datos". */
const pestanaDeTabla = (t) => REVISAR_DEL_SETTER.find(p => p.tabla === t)?.key || REVISAR_DEL_SETTER[0].key;
const tablaDePestana = (key) => REVISAR_DEL_SETTER.find(p => p.key === key)?.tabla;

/**
 * Lo que el drill-down de "Mis datos" deja en la URL: la tabla (`t`) y su filtro (`f`, con su token
 * `ft`). Ver `DashboardComercial`.
 */
const CLAVES_DEL_DRILL_DOWN = ['t', 'f', 'ft'];

const SetterEspacioPage = () => {
    const { user, logout } = useAuth();
    const { abrir: abrirConfiguracion } = useConfiguracion();
    const { pendingCount, openPlaybook } = usePlaybook();
    const [params, setParams] = useSearchParams();
    const navegar = useNavigate();
    const reducir = useReducedMotion();
    const [saliendo, setSaliendo] = useState(false);
    // La marca de «Reporte» en el dock: ✓ con hoy completo, ámbar si hoy o ayer quedan incompletos.
    const { marcas: marcasDelReporte, actualizar: actualizarMarcaDelReporte } = useMarcaReporte(!!user?.id);
    // El resumen de la bandeja de "Mis agendas": de ahí sale su marca en el dock (ver `marcaDelDock`:
    // cuenta las del mes que se trabaja, no las 149 de todos los meses). Lo informa la propia bandeja
    // (al cargar y después de cada asignación); si se entra por otra sección, se pide solo el resumen.
    const [resumenAgendas, setResumenAgendas] = useState(null);
    const alResumenDeAgendas = useCallback((resumen) => {
        if (resumen && typeof resumen.pendientes === 'number') setResumenAgendas(resumen);
    }, []);

    const seccionActual = SECCIONES.find(s => s.id === params.get('step')) || SECCIONES[0];
    const seccion = seccionActual.id;
    const tab = seccionActual.tabs?.some(t => t.key === params.get('tab'))
        ? params.get('tab')
        : seccionActual.tabs?.[0].key ?? null;

    /**
     * Cambia de sección (y de pestaña) sin tocar el período que eligió en "Mis datos" (`p`, `vs`):
     * sigue puesto al volver, y es el mismo con el que Revisar arma la lista.
     *
     * `base` es la URL del drill-down de "Mis datos": el dashboard escribe su tabla y su filtro
     * (`t`, `f`, `ft`) y en el mismo clic pide ir a la lista, así que la URL de este render todavía
     * no los tiene. Armando desde ella, este cambio pisaba al otro y la lista abría sin filtro. Va
     * como entrada nueva del historial (el dashboard escribe la suya reemplazando), así que "atrás"
     * desde la lista vuelve a "Mis datos".
     *
     * Sin `base` es un cambio a mano (el dock o una pestaña), y suelta el drill-down: Revisar
     * abierto así muestra la lista de esa pestaña sin filtro, no el último número que tocó.
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

    // Atajo 'w' para Simular a alguien. Sin MainLayout esta pantalla no tiene el
    // HotkeysManager global (igual que el mazo del closer), y un operador que simula a un setter
    // lo necesita para cambiar de simulación.
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

    useEffect(() => {
        if (!user?.id || seccion === 'agendas' || resumenAgendas !== null) return;
        api.get('/setter/palabras-clave', { params: { solo: 'resumen' } })
            .then(res => alResumenDeAgendas(res.data?.resumen))
            .catch(() => { /* sin marca: no se inventa un número */ });
    }, [user?.id, seccion]); // eslint-disable-line react-hooks/exhaustive-deps

    const marcaDeAgendas = marcaDelDock(resumenAgendas);
    const secciones = SECCIONES.map((s) => {
        if (s.id === 'reporte' && marcasDelReporte.length) return { ...s, marcas: marcasDelReporte };
        if (s.id === 'agendas' && marcaDeAgendas) return { ...s, marca: marcaDeAgendas };
        return s;
    });

    // Las pestañas de Revisar no desmontan la vista: es un solo dashboard que cambia de tabla, y
    // desmontarlo volvía a pedir su contexto y mostraba el esqueleto de la página entera. El resto
    // entra con su animación cada vez.
    const claveVista = seccion === 'revisar' ? seccion : `${seccion}-${tab || ''}`;
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
                {/* El encabezado en una línea: el número de la sección en el dock, el saludo, las pestañas si la
                    sección tiene y los botones redondos. Lo que se hace en la sección y su nombre se leen con un
                    lector (Mario, 26/11: sin el subtítulo a la vista). */}
                <div className="dc-shell dc-shell--embebido">
                    <header className="tope setter-top">
                        <div className="hola">
                            <span className="head-num num" aria-hidden="true">{numeroDe(seccion)}</span>
                            <h1>
                                <span className="sr">{seccionActual.label}. {seccionActual.sub} </span>
                                Hola, {nombreDePila(nombre)}.
                            </h1>
                        </div>
                        {seccionActual.tabs && (
                            <Segmented opciones={seccionActual.tabs} valor={tab} onChange={elegirTab}
                                ariaLabel={`Vistas de ${seccionActual.label}`} />
                        )}
                        {/* Todo a la derecha en una fila de botones redondos (Mario, 26/11: menos texto): Links, Turnos,
                            Tálamus y, simulando, el fantasma para volver a la sesión propia (solo lo ve quien simula; también
                            está en el menú del avatar). Al pasar el mouse cada uno se estira y dice qué es. */}
                        <MisLinks>
                            <BotonIcono icono={CalendarClock} rotulo="Los turnos que quedan de triage y de closers, por día" onClick={() => abrirVentana('turnos')}>Turnos</BotonIcono>
                            <BotonIcono icono={CalendarDays} rotulo="Ver los turnos libres del equipo en Tálamus" onClick={() => navegar('/agendas-v2?ver=available')}>Tálamus</BotonIcono>
                            {user?.is_impersonating && (
                                <BotonIcono icono={Ghost} tono="simula" rotulo="Estás simulando su sesión: tocá para volver a la tuya" disabled={saliendo} onClick={volverAMiSesion}>
                                    {saliendo ? 'Volviendo…' : 'Volver a mi sesión'}
                                </BotonIcono>
                            )}
                        </MisLinks>
                    </header>
                </div>

                <motion.div key={claveVista}
                    initial={reducir ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 0.7, 0.2, 1] }}>
                    {seccion === 'agendas' && (
                        <MisAgendas onResumen={alResumenDeAgendas} onVerDatos={() => irA('datos')} />
                    )}
                    {/* El reporte único del día, con su Historial (docs/plan_reporte_unico.md). El setter es
                        el de la sesión: simulando, el simulado. `?tab=historial` (/setter/statistics) abre el Historial. */}
                    {seccion === 'reporte' && (
                        <ReporteSeccion onDia={actualizarMarcaDelReporte}
                            tabInicial={params.get('tab') === 'historial' ? 'hist' : 'hoy'} />
                    )}
                    {/* Revisar es el dashboard comercial, acotado a este setter por el backend
                        (`alcance_de`): la lista de Revisar, como "Mi cartera" en el mazo del closer.
                        Sin selector de persona: el contexto de un setter no lo ofrece. La tabla la
                        elige la pestaña. */}
                    {seccion === 'revisar' && (
                        <DashboardComercial embebido seccionFija="revisar" tablaFija={tablaDePestana(tab)} />
                    )}
                    {/* «Mis datos» es el Analizar del dashboard comercial embebido: el MISMO tablero de
                        setters que ve la dirección, acotado a él por el backend (`alcance_de`), con
                        Comparativas de solo lectura (10/10/2026: vuelve a ser este y no una vista
                        propia). Un número del sistema lleva a Revisar, a la pestaña de su tabla y con
                        el filtro de ese número, partiendo de la URL que el dashboard acaba de escribir. */}
                    {seccion === 'compartidos' && <CompartidosConmigo />}
                    {seccion === 'conversaciones' && (
                        <Suspense fallback={<p className="sub">Cargando la bandeja…</p>}><InboxEmbebido /></Suspense>
                    )}
                    {seccion === 'guia' && (
                        <Suspense fallback={<p className="sub">Cargando la guía…</p>}><InboxEmbebido seccion="guia" /></Suspense>
                    )}
                    {seccion === 'datos' && (
                        <DashboardComercial embebido seccionFija="analizar"
                            onIrASeccion={(_seccion, urlDelFiltro) => irA('revisar',
                                pestanaDeTabla(urlDelFiltro?.get('t')), urlDelFiltro)} />
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

        </div>
    );
};

// Van también los links de los eventos viejos (`/book/<slug>`, los que daba el botón "Links de
// Agendamiento" de la pestaña Historial, que se fue el 10/10/2026): si un setter todavía tiene uno,
// lo sigue encontrando acá. Si ese pedido falla, quedan los de Agendas 2.0.
const cargarMisLinks = async () => {
    const [nuevos, viejos] = await Promise.allSettled([
        api.get('/setter/agendas-links'),
        api.get('/setter/booking-link'),
    ]);
    if (nuevos.status === 'rejected' && viejos.status === 'rejected') throw nuevos.reason;
    const deAgendas = nuevos.status === 'fulfilled' ? (nuevos.value.data?.links || []) : [];
    const deEventos = viejos.status === 'fulfilled' && Array.isArray(viejos.value.data) ? viejos.value.data : [];
    return [
        ...deAgendas.map((l) => ({
            id: l.ruta,
            label: `${l.funnel} · ${l.evento}`,
            onClick: () => copiar(window.location.origin + l.ruta),
        })),
        ...deEventos.flatMap(g => (g.links || []).map((l) => ({
            id: `evento-${l.id}`,
            label: `${g.name} · ${l.name}`,
            onClick: () => copiar(l.url),
        }))),
    ];
};

export default SetterEspacioPage;
