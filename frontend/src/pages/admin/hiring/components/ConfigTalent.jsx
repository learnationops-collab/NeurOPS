import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Settings, SlidersHorizontal, Briefcase, Maximize2, Minimize2, X, RotateCcw, List, CheckCircle2, AlertTriangle, Loader2,
} from 'lucide-react';
import api from '../../../../services/api';
import { Humo } from '../../../comercial/components/Shared';
import { Inicial } from './Piezas';
import { VEREDICTO } from './comun';

// Configuración de Learnation Talent (el orbe del dock): los pesos de Clarity,
// con el ranking que se recalcula mientras movés un peso, y los datos de la
// búsqueda (puesto, cierre, presupuesto, cambio a reales).

const HUMO_MARCA = ['var(--brand-secondary)', 'var(--brand-primary)', 'var(--brand-secondary-light)', 'var(--focus-blue)'];

const TABS = [
    { id: 'clarity', label: 'Clarity', icono: SlidersHorizontal },
    { id: 'busqueda', label: 'Búsqueda', icono: Briefcase },
];

const iguales = (a, b) => a.every((p) => b.find((q) => q.criterion === p.criterion)?.weight === p.weight);

const Clarity = ({ todas, onAbrir, onGuardado }) => {
    const [pesos, setPesos] = useState(null);
    const [guardados, setGuardados] = useState([]);
    const [scores, setScores] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/assistant-applications/clarity-weights')
            .then((res) => { setPesos(res.data); setGuardados(res.data); })
            .catch(() => setError('No se pudieron cargar los pesos.'));
    }, []);

    // El ranking con los pesos que estás probando lo calcula el backend (sin
    // guardar nada): mismo cálculo que el del listado, así no hay dos fórmulas.
    const pedido = useRef(0);
    useEffect(() => {
        if (!pesos) return undefined;
        if (iguales(pesos, guardados)) { setScores(null); return undefined; }
        const mio = ++pedido.current;
        const id = setTimeout(() => {
            const weights = Object.fromEntries(pesos.map((p) => [p.criterion, p.weight]));
            api.post('/assistant-applications/clarity-weights/preview', { weights })
                .then((res) => { if (mio === pedido.current) setScores(res.data.scores || {}); })
                .catch(() => { if (mio === pedido.current) setScores(null); });
        }, 220);
        return () => clearTimeout(id);
    }, [pesos, guardados]);

    const total = useMemo(() => (pesos || []).reduce((a, p) => a + (p.weight || 0), 0), [pesos]);
    const sucio = pesos && !iguales(pesos, guardados);
    const esDefault = pesos && pesos.every((p) => p.weight === p.default_weight);

    const ranking = useMemo(() => todas
        .map((p) => ({ p, s: scores?.[p.id] ?? p.score ?? 0, b: p.score ?? 0 }))
        .sort((a, b) => b.s - a.s), [todas, scores]);

    const guardar = async () => {
        setGuardando(true);
        setError('');
        try {
            await api.put('/assistant-applications/clarity-weights', {
                weights: Object.fromEntries(pesos.map((p) => [p.criterion, p.weight])),
            });
            setGuardados(pesos);
            setScores(null);
            onGuardado?.();
        } catch (err) {
            setError(err.response?.data?.message || 'No se pudieron guardar los pesos.');
        } finally {
            setGuardando(false);
        }
    };

    if (!pesos) {
        return <div>{error ? <p className="tl-estado" style={{ color: 'var(--error)' }}>{error}</p> : <p className="t-cap mut40">Cargando Clarity…</p>}</div>;
    }

    return (
        <div>
            <div className="tl-cl-grid">
                <section className="panel">
                    <div className="tl-cab">
                        <span className="tl-rotulo"><SlidersHorizontal size={14} />Peso de cada criterio</span>
                        <span className="tl-total caja"><Humo colores={HUMO_MARCA} clase="humo--barra" /><span>{total}</span><small>pts</small></span>
                    </div>
                    {pesos.map((p) => (
                        <div key={p.criterion} className="tl-peso">
                            <div className="tl-peso-cab">
                                <label htmlFor={`tl-p-${p.criterion}`}>{p.label}</label>
                                <b>{p.weight} pts<small>{total ? Math.round((p.weight / total) * 100) : 0} %</small></b>
                            </div>
                            {p.detalle && <p className="tl-peso-det">{p.detalle}</p>}
                            <input className="slider" type="range" id={`tl-p-${p.criterion}`} min="0" max="40" step="1" value={p.weight}
                                onChange={(e) => setPesos((prev) => prev.map((x) => (x.criterion === p.criterion ? { ...x, weight: Number(e.target.value) } : x)))} />
                        </div>
                    ))}
                    <div className="tl-cl-acc">
                        <button type="button" className="btn btn--linea" disabled={esDefault}
                            onClick={() => setPesos((prev) => prev.map((x) => ({ ...x, weight: x.default_weight })))}>
                            <RotateCcw /> Volver al default
                        </button>
                        <button type="button" className="btn btn--cta" disabled={!sucio || guardando} onClick={guardar}>
                            {guardando && <Loader2 className="animate-spin" />} Guardar pesos
                        </button>
                        <span className="tl-estado" style={{ color: error ? 'var(--error)' : sucio ? 'var(--warning)' : 'var(--success)' }}>
                            {error ? <AlertTriangle size={15} /> : sucio ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                            {error || (sucio ? 'Cambios sin guardar' : 'Guardado · se aplica al ranking')}
                        </span>
                    </div>
                </section>

                <section className="panel">
                    <div className="tl-cab">
                        <span className="tl-rotulo"><List size={14} />Ranking con estos pesos</span>
                        <span className="tl-cab-der">cambio contra los pesos guardados</span>
                    </div>
                    {ranking.length === 0 && <p className="t-cap mut40">Todavía no hay postulaciones para rankear.</p>}
                    {ranking.map(({ p, s, b }, i) => {
                        const d = s - b;
                        return (
                            <button key={p.id} type="button" className="tl-rank" onClick={() => onAbrir(p.id)}>
                                <span className="pos">{i + 1}</span>
                                <Inicial nombre={p.nombre} />
                                <span>
                                    <span className="nom">{p.nombre}</span>
                                    <span className="meta">{[p.pais, VEREDICTO[p.veredicto]?.label].filter(Boolean).join(' · ')}</span>
                                </span>
                                <span className="delta" style={{ color: d > 0 ? 'var(--success)' : d < 0 ? 'var(--error)' : 'var(--text-muted-40)' }}>
                                    {d === 0 ? '—' : `${d > 0 ? '+' : ''}${d}`}
                                </span>
                                <span className="sc">{s}</span>
                            </button>
                        );
                    })}
                </section>
            </div>
        </div>
    );
};

const CONFIG_DEFAULT = { puesto: 'Asistente Administrativa y Personal', cierre: '', presupuesto_min: 200, presupuesto_max: 400, tasa_brl: 5.4 };

const Busqueda = ({ onGuardado }) => {
    const [cfg, setCfg] = useState(null);
    const [guardado, setGuardado] = useState(null);
    const [estado, setEstado] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/hiring/config')
            .then((res) => { const c = { ...CONFIG_DEFAULT, ...res.data, cierre: res.data.cierre || '' }; setCfg(c); setGuardado(c); })
            .catch(() => { setCfg(CONFIG_DEFAULT); setGuardado(CONFIG_DEFAULT); setError('No se pudo leer la configuración guardada.'); });
    }, []);

    if (!cfg) return <div><p className="t-cap mut40">Cargando…</p></div>;

    const sucio = JSON.stringify(cfg) !== JSON.stringify(guardado);
    const cambiar = (k) => (e) => { setCfg({ ...cfg, [k]: e.target.value }); setEstado(''); };

    const guardar = async () => {
        setError('');
        setEstado('guardando');
        const cuerpo = {
            puesto: String(cfg.puesto || '').trim(),
            cierre: cfg.cierre || null,
            presupuesto_min: Number(cfg.presupuesto_min),
            presupuesto_max: Number(cfg.presupuesto_max),
            tasa_brl: Number(cfg.tasa_brl),
        };
        try {
            const res = await api.put('/hiring/config', cuerpo);
            const c = { ...CONFIG_DEFAULT, ...res.data, cierre: res.data.cierre || '' };
            setCfg(c);
            setGuardado(c);
            setEstado('ok');
            onGuardado?.(res.data);
        } catch (err) {
            setEstado('');
            setError(err.response?.data?.message || 'No se pudo guardar.');
        }
    };

    return (
        <div>
            <section className="tl-conf-sec">
                <p className="tl-rotulo">El puesto</p>
                <div className="tl-campos">
                    <div className="tl-campo">
                        <label htmlFor="tl-ap-puesto">Puesto</label>
                        <input className="tl-input" id="tl-ap-puesto" maxLength={160} value={cfg.puesto} onChange={cambiar('puesto')} />
                    </div>
                    <div className="tl-campo">
                        <label htmlFor="tl-ap-cierre">Cierre</label>
                        <input className="tl-input" id="tl-ap-cierre" type="date" value={cfg.cierre} onChange={cambiar('cierre')} style={{ maxWidth: 240 }} />
                    </div>
                </div>
            </section>
            <section className="tl-conf-sec">
                <p className="tl-rotulo">Remuneración de referencia</p>
                <div className="tl-campos">
                    <div className="tl-campo">
                        <span>Presupuesto</span>
                        <div className="tl-campo-doble">
                            <input className="tl-input" type="number" min="50" max="3000" step="10" value={cfg.presupuesto_min}
                                onChange={cambiar('presupuesto_min')} aria-label="Mínimo en USD" />
                            <input className="tl-input" type="number" min="100" max="5000" step="10" value={cfg.presupuesto_max}
                                onChange={cambiar('presupuesto_max')} aria-label="Máximo en USD" />
                        </div>
                    </div>
                    <p className="tl-campo-ayuda">Mínimo y máximo en USD por mes. Lo que supere el máximo se marca en ámbar en la tabla.</p>
                    <div className="tl-campo">
                        <label htmlFor="tl-ap-brl">Cambio a reales</label>
                        <input className="tl-input" id="tl-ap-brl" type="number" min="1" max="20" step="0.1" value={cfg.tasa_brl}
                            onChange={cambiar('tasa_brl')} style={{ maxWidth: 160 }} />
                    </div>
                    <p className="tl-campo-ayuda">El formulario lo usa para mostrar el equivalente en R$ a quien vive en Brasil.</p>
                </div>
            </section>
            <div className="tl-cl-acc" style={{ marginTop: 0 }}>
                <button type="button" className="btn btn--cta" disabled={!sucio || estado === 'guardando'} onClick={guardar}>
                    {estado === 'guardando' && <Loader2 className="animate-spin" />} Guardar
                </button>
                {(error || estado === 'ok' || sucio) && (
                    <span className="tl-estado" style={{ color: error ? 'var(--error)' : sucio ? 'var(--warning)' : 'var(--success)' }}>
                        {error ? <AlertTriangle size={15} /> : sucio ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                        {error || (sucio ? 'Cambios sin guardar' : 'Guardado')}
                    </span>
                )}
            </div>
        </div>
    );
};

const ConfigTalent = ({ tab, onTab, onCerrar, todas, onAbrir, onPesosGuardados, onConfigGuardada }) => {
    const [full, setFull] = useState(false);
    const panel = useRef(null);

    useEffect(() => {
        const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
        window.addEventListener('keydown', tecla);
        const previo = document.activeElement;
        panel.current?.focus();
        return () => { window.removeEventListener('keydown', tecla); previo?.focus?.(); };
    }, [onCerrar]);

    const abrir = useCallback((id) => { onCerrar(); onAbrir(id); }, [onAbrir, onCerrar]);

    return createPortal(
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div className="dc-shell talent tl-velo" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div ref={panel} tabIndex={-1} className={`tl-modal${full ? ' tl-modal--full' : ''}`} role="dialog" aria-modal="true" aria-labelledby="tl-conf-tit">
                <Humo colores={HUMO_MARCA} tarjeta />
                <div className="tl-conf-cab">
                    <span className="tl-conf-ico"><Settings size={26} /></span>
                    <h2 className="t-h2" id="tl-conf-tit">Configuración</h2>
                    <button type="button" className="ibtn tl-btn-full" onClick={() => setFull((v) => !v)}
                        aria-label={full ? 'Ventana flotante' : 'Pantalla completa'} title={full ? 'Ventana flotante' : 'Pantalla completa'}>
                        {full ? <Minimize2 /> : <Maximize2 />}
                    </button>
                    <button type="button" className="ibtn" onClick={onCerrar} aria-label="Cerrar"><X /></button>
                    <div className="tabs tabs--marca" role="tablist">
                        {TABS.map((t) => (
                            <button key={t.id} type="button" role="tab" className="tab" aria-pressed={tab === t.id} aria-selected={tab === t.id} onClick={() => onTab(t.id)}>
                                <t.icono />{t.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="tl-conf-cuerpo">
                    {tab === 'busqueda'
                        ? <Busqueda onGuardado={onConfigGuardada} />
                        : <Clarity todas={todas} onAbrir={abrir} onGuardado={onPesosGuardados} />}
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default ConfigTalent;
