import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, CheckCircle2, Inbox, Search, Target, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import './comercial.css';
import '../../components/learnation-ds/learnation-ds.css';
import { Cargando, PillMenu, Segmented } from './components/Shared';
import Analizar from './components/Analizar';
import Comparativas from './components/Comparativas';
import Revisar, { TABLAS_POR_ROL } from './components/Revisar';
import LeadModal from './components/LeadModal';
import Reportar from './components/Reportar';
import { corregirAgenda, getComparativas, getContexto, getResumen, getTabla } from './comercialApi';

/**
 * Dashboard comercial.
 *
 * Un solo componente para tres audiencias: la dirección comercial (todo el equipo, con selector
 * de persona y de rol, y la sección Reportar) y "Mis datos" de closers y setters (los mismos
 * paneles acotados a esa persona). Quién ve qué lo decide el backend: acá solo se esconden los
 * controles que esa persona no puede usar, según lo que diga `/comercial/contexto`.
 *
 * El período y la sección viven en la query string, para poder compartir una vista tal como se
 * está mirando.
 */

const SECCIONES = [
    { id: 'analizar', label: 'Analizar', Icono: Search, tabs: [{ key: 'dashboard', label: 'Dashboard' }, { key: 'comparativas', label: 'Comparativas' }] },
    { id: 'revisar', label: 'Revisar', Icono: CheckCircle2, tabs: [] },
    { id: 'proyectar', label: 'Proyectar', Icono: Calendar, tabs: [], pronto: true },
    { id: 'simulador', label: 'Simulador', Icono: Target, tabs: [], pronto: true },
    { id: 'reportar', label: 'Reportar', Icono: Inbox, tabs: [{ key: 'reporte', label: 'Reporte del día' }, { key: 'historial', label: 'Historial' }], soloDireccion: true },
];

const PRONTO = {
    proyectar: 'Vas a poder proyectar el cierre del mes con el ritmo actual y ajustar la meta. Estamos puliendo el cálculo.',
    simulador: 'Vas a poder mover cada palanca del embudo y ver cuánto cambia el resultado. Estamos puliendo el modelo.',
};

const ProntoSection = ({ seccion }) => (
    <div className="ln-panel">
        <div className="ln-empty">
            <span className="ln-empty-ico"><seccion.Icono size={22} /></span>
            <p className="ln-empty-title">{seccion.label} llega pronto</p>
            <p className="ln-empty-desc">{PRONTO[seccion.id]}</p>
        </div>
    </div>
);

const DashboardComercial = () => {
    const [params, setParams] = useSearchParams();
    const [contexto, setContexto] = useState(null);

    const seccion = params.get('s') || 'analizar';
    const period = params.get('p') || 'mes';
    const compare = params.get('vs') || 'prev';
    const rolPedido = params.get('rol');
    const miembroPedido = params.get('m');
    const tabla = params.get('t') || null;

    const [tab, setTab] = useState('dashboard');
    const [basis, setBasis] = useState('meet');
    const [resumen, setResumen] = useState(null);
    const [comparativas, setComparativas] = useState(null);
    const [datosTabla, setDatosTabla] = useState(null);
    const [cargandoTabla, setCargandoTabla] = useState(false);
    const [filaAbierta, setFilaAbierta] = useState(null);
    const [filtroInicial, setFiltroInicial] = useState(null);
    const [stepper, setStepper] = useState(null);

    const set = useCallback((cambios) => {
        const siguiente = new URLSearchParams(params);
        Object.entries(cambios).forEach(([k, v]) => {
            if (v === null || v === undefined || v === '') siguiente.delete(k);
            else siguiente.set(k, v);
        });
        setParams(siguiente, { replace: true });
    }, [params, setParams]);

    useEffect(() => {
        getContexto().then(setContexto).catch(() => toast.error('No se pudo abrir el dashboard comercial'));
    }, []);

    // El rol y la persona efectivos: para un closer o un setter los manda el backend y la query
    // string no puede cambiarlos (ver `alcance_de` en app/api/comercial.py).
    const rol = contexto?.puede_elegir_equipo ? (rolPedido || 'closers') : contexto?.rol;
    const miembroId = contexto?.puede_elegir_equipo ? miembroPedido : null;

    const filtros = useMemo(
        () => ({ period, compare, rol, miembroId }),
        [period, compare, rol, miembroId]);

    const seccionActual = SECCIONES.find(s => s.id === seccion) || SECCIONES[0];
    const tablaActual = tabla && TABLAS_POR_ROL[rol]?.includes(tabla) ? tabla : TABLAS_POR_ROL[rol]?.[0];

    // Al cambiar de sección o de rol, la tab vuelve a la primera válida.
    useEffect(() => {
        const primera = seccionActual.tabs[0]?.key;
        if (primera && !seccionActual.tabs.some(t => t.key === tab)) setTab(primera);
    }, [seccionActual, tab]);

    const cargarAnalizar = useCallback(() => {
        if (!rol) return;
        getResumen(filtros).then(setResumen).catch(() => toast.error('No se pudieron cargar los KPIs'));
        if (tab === 'comparativas') {
            getComparativas(filtros).then(setComparativas)
                .catch(() => toast.error('No se pudieron cargar las comparativas'));
        }
    }, [filtros, rol, tab]);

    const cargarTabla = useCallback(() => {
        if (!rol || !tablaActual) return;
        setCargandoTabla(true);
        getTabla(filtros, tablaActual, basis)
            .then(setDatosTabla)
            .catch(() => toast.error('No se pudo cargar la tabla'))
            .finally(() => setCargandoTabla(false));
    }, [filtros, rol, tablaActual, basis]);

    useEffect(() => { if (seccion === 'analizar') cargarAnalizar(); }, [seccion, cargarAnalizar]);
    useEffect(() => { if (seccion === 'revisar') cargarTabla(); }, [seccion, cargarTabla]);

    /** Drill-down desde Analizar: abre Revisar en la tabla pedida, ya filtrada. */
    const irA = useCallback((cual, filtro) => {
        setFiltroInicial({ ...filtro, __t: Date.now() });
        set({ s: 'revisar', t: cual });
    }, [set]);

    const irAPersona = useCallback((id) => {
        if (contexto?.puede_elegir_equipo) set({ s: 'revisar', m: id });
    }, [contexto, set]);

    /**
     * Corrige un estado y vuelve a pedir TODO lo que depende de él. Es el requisito del diseño:
     * la tabla, los chips rápidos, los totales y los KPIs se recalculan sin recargar la página.
     */
    const corregir = useCallback(async (fila, campo, valor) => {
        try {
            await corregirAgenda(fila.id, campo, valor);
            const datos = await getTabla(filtros, tablaActual, basis);
            setDatosTabla(datos);
            setFilaAbierta(datos.filas.find(f => f.id === fila.id && f.tipo === fila.tipo) || null);
            getResumen(filtros).then(setResumen).catch(() => { /* el KPI viejo no rompe la corrección */ });
        } catch (error) {
            toast.error(error?.response?.status === 403
                ? 'Solo puede corregirla quien la atiende o la dirección comercial'
                : 'No se pudo guardar la corrección');
            throw error;
        }
    }, [filtros, tablaActual, basis]);

    if (!contexto) {
        return <div className="dc-shell"><div className="dc-wrap"><Cargando texto="Abriendo el dashboard…" /></div></div>;
    }

    const secciones = SECCIONES.filter(s => !s.soloDireccion || contexto.puede_reportar);
    const titulo = contexto.puede_elegir_equipo ? seccionActual.label : `${seccionActual.label} · mis datos`;

    const miembroNombre = miembroId
        ? contexto.miembros.find(m => String(m.id) === String(miembroId))?.nombre
        : null;
    const alcance = [miembroNombre || (contexto.puede_elegir_equipo ? 'Todo el equipo' : contexto.yo.nombre),
        contexto.periodos.find(p => p.key === period)?.label.toLowerCase()].filter(Boolean).join(' · ');

    const puedeCorregirFila = (fila) => {
        if (!fila || fila.tipo !== 'agenda') return false;
        if (contexto.puede_reportar) return true;
        if (contexto.yo.rol === 'closer') return fila.closer_id === contexto.yo.id;
        if (contexto.yo.rol === 'setter') return fila.setter_id === contexto.yo.id;
        return false;
    };

    return (
        <div className="dc-shell">
            <div className="dc-wrap">
                <header className="dc-header">
                    <div className="dc-header-left">
                        <h1 className="ln-t-h1">{titulo}</h1>
                    </div>
                </header>

                <div className="dc-controls">
                    {seccionActual.tabs.length > 0 && (
                        <Segmented opciones={seccionActual.tabs} valor={tab} onChange={setTab}
                            ariaLabel={`Vistas de ${seccionActual.label}`} />
                    )}

                    {seccion === 'reportar' && stepper}

                    <div className="dc-controls-right">
                        {contexto.puede_elegir_equipo && seccion === 'analizar' && (
                            <PillMenu icono={<Users size={14} />}
                                texto={miembroNombre || 'Todo el equipo'}
                                valor={miembroId || 'all'}
                                opciones={[{ key: 'all', label: 'Todo el equipo' },
                                    ...contexto.miembros.map(m => ({ key: String(m.id), label: m.nombre }))]}
                                onChange={(k) => set({ m: k === 'all' ? null : k })} />
                        )}

                        {seccion !== 'reportar' && (
                            <PillMenu icono={<Calendar size={14} />}
                                texto={contexto.periodos.find(p => p.key === period)?.label}
                                detalle={resumen?.dates ? `${resumen.dates.start.slice(8)}–${resumen.dates.end.slice(8)}` : null}
                                valor={period} opciones={contexto.periodos}
                                onChange={(k) => set({ p: k })} />
                        )}

                        {seccion === 'analizar' && (
                            <PillMenu icono={<span className="ln-muted" style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.14em' }}>VS</span>}
                                texto={contexto.comparaciones.find(c => c.key === compare)?.label}
                                valor={compare} opciones={contexto.comparaciones} ancho={250}
                                onChange={(k) => set({ vs: k })} />
                        )}
                    </div>
                </div>

                {seccion === 'analizar' && tab === 'dashboard' && (
                    <Analizar datos={resumen} rol={rol} irA={irA} />
                )}
                {seccion === 'analizar' && tab === 'comparativas' && (
                    <Comparativas datos={comparativas} irAPersona={irAPersona} />
                )}
                {seccion === 'revisar' && (
                    <Revisar tabla={tablaActual} setTabla={(t) => set({ t })} datos={datosTabla}
                        cargando={cargandoTabla} rol={rol} basis={basis} setBasis={setBasis}
                        alcance={alcance} filtroInicial={filtroInicial}
                        onAbrirFila={setFilaAbierta} />
                )}
                {seccionActual.pronto && <ProntoSection seccion={seccionActual} />}
                {seccion === 'reportar' && contexto.puede_reportar && (
                    <Reportar tab={tab} setTab={setTab} miembros={contexto.miembros}
                        onStepper={setStepper}
                        irAPersona={(persona) => set({ s: 'revisar', m: persona.id, p: 'hoy' })} />
                )}

                <LeadModal fila={filaAbierta} estados={contexto.estados}
                    puedeCorregir={puedeCorregirFila(filaAbierta)}
                    onCorregir={corregir} onCerrar={() => setFilaAbierta(null)} />

                <nav className="dc-dock" aria-label="Secciones del dashboard comercial">
                    {contexto.puede_elegir_equipo && (
                        <div className="dc-scope">
                            {[['closers', 'Closers'], ['setters', 'Setters']].map(([k, label]) => (
                                <button key={k} type="button" className="dc-scope-btn" aria-selected={rol === k}
                                    onClick={() => set({ rol: k, t: null, m: null })}>
                                    <span className="dc-scope-dot" />
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {contexto.puede_elegir_equipo && <span className="dc-dock-sep" />}
                    {secciones.map((s, i) => (
                        <button key={s.id} type="button" className="dc-dock-item" aria-current={seccion === s.id}
                            aria-label={s.label} onClick={() => set({ s: s.id })}>
                            <span className="dc-dock-num">{i + 1}</span>
                            <span className="dc-dock-ico"><s.Icono size={20} /></span>
                            <span>{s.label}</span>
                            {s.pronto && <span className="dc-dock-soon">Pronto</span>}
                        </button>
                    ))}
                </nav>
            </div>
        </div>
    );
};

export default DashboardComercial;
