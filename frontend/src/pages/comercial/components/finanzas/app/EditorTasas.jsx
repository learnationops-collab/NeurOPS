import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import * as apiFz from '../finanzasApi';
import { nombreDelMes } from '../comun';
import { money, r2 } from './modelo';

/**
 * Los % de comisión del mes, editables en el lugar (el editor del artifact): una pestaña por programa
 * de Fulfillment (persona × fuente) y una de Ventas (setting, closing y director). Los cambios quedan
 * en borrador, marcados en magenta, hasta «Guardar y aplicar», que los guarda desde el mes elegido y
 * recalcula el payroll. Ámbar: distinto a los de fábrica.
 */
const FUENTES = [['renovacion', 'Renovación'], ['upsell', 'Upsell'], ['conversion', 'Conversión'], ['cuota', 'Cuota']];
const PROGS = [['AL', 'Ace Learners'], ['RR', 'Residency Roadmap'], ['SI', 'SI']];
const copia = (o) => JSON.parse(JSON.stringify(o));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const limitar = (v) => Math.min(100, Math.max(0, Math.round(v * 2) / 2));

/** {AL+renovacion: {v, n}}: lo que entró a Fulfillment en el período, por programa y fuente. */
const poolsDe = (payroll, claves) => {
    const vistas = new Set(), pool = {};
    claves.forEach((k) => (payroll?.[k]?.sales || []).forEach((s) => {
        if (vistas.has(s.id) || s.is_excluded_from_payroll) return;
        vistas.add(s.id);
        const c = s.programa + s.fuente;
        pool[c] = pool[c] || { v: 0, n: 0 };
        pool[c].v += s.monto_neto || 0;
        pool[c].n += 1;
    }));
    return pool;
};

const Paso = ({ v, onCambiar, etiqueta, clases }) => {
    const [txt, setTxt] = useState(String(v).replace('.', ','));
    useEffect(() => { setTxt(String(v).replace('.', ',')); }, [v]);
    const fijar = (x) => onCambiar(limitar(x));
    return (
        <div className={`stp ${clases}`}>
            <button type="button" aria-label={`Bajar ${etiqueta}`} onClick={() => fijar(v - 0.5)}>−</button>
            <label>
                <input inputMode="decimal" aria-label={etiqueta} value={txt} onChange={(e) => setTxt(e.target.value)}
                    onBlur={() => { const n = parseFloat(txt.replace(',', '.')); fijar(Number.isNaN(n) ? 0 : n); }}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); fijar(v + (e.key === 'ArrowUp' ? 0.5 : -0.5)); }
                        if (e.key === 'Enter') e.currentTarget.blur();
                    }} />
                <i>%</i>
            </label>
            <button type="button" aria-label={`Subir ${etiqueta}`} onClick={() => fijar(v + 0.5)}>+</button>
        </div>
    );
};

const EditorTasas = ({ mes, payroll, onGuardado }) => {
    const [datos, setDatos] = useState(null);
    const [ok, setOk] = useState(null);
    const [tasas, setTasas] = useState(null);
    const [prog, setProg] = useState('AL');
    const [aviso, setAviso] = useState('');
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        let vivo = true;
        setTasas(null);
        apiFz.getTasas(mes).then((d) => {
            if (!vivo) return;
            setDatos(d); setOk(copia(d.tasas)); setTasas(copia(d.tasas));
            setAviso(d.vigente_desde ? `Vigentes desde ${nombreDelMes(d.vigente_desde)}` : 'Los de fábrica');
        }).catch(() => setAviso('No se pudieron cargar los porcentajes'));
        return () => { vivo = false; };
    }, [mes]);

    const ff = datos?.personas?.fulfillment || [];
    const pool = useMemo(() => poolsDe(payroll, ff.map((p) => p.clave)), [payroll, ff]);
    if (!tasas) return <section className="card ff"><div className="vacio">{aviso || 'Cargando los porcentajes…'}</div></section>;

    const fabrica = datos.fabrica || null;
    const pend = !igual(tasas, ok);
    const comProg = (k, p, T) => FUENTES.reduce((t, [f], i) => t + (pool[p + f]?.v || 0) * (+T.fulfillment[k][p][i] || 0) / 100, 0);
    const comFF = (k, T) => r2(PROGS.reduce((s, [p]) => s + comProg(k, p, T), 0));
    const nCambios = () => {
        let n = 0;
        ff.forEach((p) => PROGS.forEach(([g]) => tasas.fulfillment[p.clave][g].forEach((v, i) => { if (v !== ok.fulfillment[p.clave][g][i]) n += 1; })));
        ['setters', 'closers', 'director'].forEach((g) => Object.keys(tasas[g] || {}).forEach((k) => { if (tasas[g][k] !== ok[g][k]) n += 1; }));
        return n;
    };
    const ponerFF = (k, i, v) => setTasas((t) => { const n = copia(t); n.fulfillment[k][prog][i] = v; return n; });
    const ponerVenta = (g, k, v) => setTasas((t) => ({ ...t, [g]: { ...t[g], [k]: v } }));
    const guardar = async () => {
        setGuardando(true);
        setAviso('Guardando…');
        try {
            await apiFz.guardarTasas(mes, tasas);
            setOk(copia(tasas));
            setAviso(`Guardado desde ${nombreDelMes(mes)} · comisiones del payroll actualizadas`);
            onGuardado();
        } catch (error) {
            setAviso('No se pudo guardar. Probá de nuevo.');
            toast.error(error?.response?.data?.error || 'No se pudieron guardar los porcentajes');
        }
        setGuardando(false);
    };
    const clases = (v, vOk, vFab, vacio) => [!v && 'cero', vFab != null && v !== vFab && 'mod', v !== vOk && 'pen', vacio && 'vac'].filter(Boolean).join(' ');
    const ventas = [...(datos.personas.setters || []).map((p) => ['setters', p, 'Setting']),
        ...(datos.personas.closers || []).map((p) => ['closers', p, 'Closing']),
        ...(datos.personas.director || []).map((p) => ['director', p, 'Director · sin renovaciones'])];

    return (
        <section className={`card ff${pend ? ' pending' : ''}`}>
            <div className="head"><div><div className="eyebrow">Configuración</div><h2>Porcentajes de comisión</h2></div></div>
            <div className="tabs" role="tablist" aria-label="Programa">
                {[...PROGS, ['ventas', 'Ventas']].map(([p, n]) => {
                    const t = FUENTES.reduce((s, [f]) => s + (pool[p + f]?.v || 0), 0);
                    return (
                        <button key={p} type="button" className="tab" role="tab" aria-selected={p === prog} onClick={() => setProg(p)}>
                            <b>{n}</b><small>{p === 'ventas' ? 'setting y closing' : t ? `${money(t, 0)} en el período` : 'sin ingresos'}</small>
                        </button>
                    );
                })}
            </div>
            <div className="tscroll">
                {prog === 'ventas' ? (
                    <table className="ed">
                        <thead><tr><th><b>Persona</b><small>&nbsp;</small></th><th><b>Porcentaje</b><small>de lo que cobra</small></th></tr></thead>
                        <tbody>
                            {ventas.map(([g, p, rol]) => (
                                <tr key={g + p.clave}>
                                    <td className="pn"><b>{p.nombre}</b><small>{rol}</small></td>
                                    <td><Paso v={+tasas[g][p.clave] || 0} etiqueta={`${p.nombre} ${rol}`} onCambiar={(v) => ponerVenta(g, p.clave, v)}
                                        clases={clases(+tasas[g][p.clave] || 0, +ok[g][p.clave] || 0, fabrica?.[g]?.[p.clave], false)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <table className="ed">
                        <thead>
                            <tr>
                                <th><b>Persona</b><small>&nbsp;</small></th>
                                {FUENTES.map(([f, l]) => {
                                    const x = pool[prog + f];
                                    return <th key={f} className={x ? '' : 'vac'}><b>{l}</b><small>{x ? `${money(x.v, 0)} · ${x.n} ${x.n === 1 ? 'pago' : 'pagos'}` : 'sin ingresos'}</small></th>;
                                })}
                                <th><b>Comisión</b><small>del período</small></th>
                            </tr>
                        </thead>
                        <tbody>
                            {ff.map((p) => {
                                const tot = comFF(p.clave, tasas), guardada = comFF(p.clave, ok);
                                return (
                                    <tr key={p.clave}>
                                        <td className="pn"><b>{p.nombre}</b><small>&nbsp;</small></td>
                                        {FUENTES.map(([f, l], i) => {
                                            const v = +tasas.fulfillment[p.clave][prog][i] || 0;
                                            return (
                                                <td key={f}><Paso v={v} etiqueta={`${l} de ${p.nombre}`} onCambiar={(x) => ponerFF(p.clave, i, x)}
                                                    clases={clases(v, +ok.fulfillment[p.clave][prog][i] || 0, fabrica?.fulfillment?.[p.clave]?.[prog]?.[i], !pool[prog + f])} /></td>
                                            );
                                        })}
                                        <td className="ct"><b>{money(tot)}</b><small>{tot !== guardada ? <><s>{money(guardada)}</s> sin guardar</> : `${money(r2(comProg(p.clave, prog, tasas)))} en ${prog}`}</small></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            <div className="key">
                <span><b>Conversión</b> pago de alguien que dejó seña antes</span><span><b>Cuota</b> pago de un plan en cuotas</span>
                <span><b>Borde magenta</b> sin guardar</span>
            </div>
            <div className="edfoot">
                <div className="sync">{pend ? `${nCambios()} ${nCambios() === 1 ? 'cambio' : 'cambios'} sin guardar · el payroll todavía usa los anteriores` : aviso}</div>
                <div className="edbtns">
                    {pend && <button type="button" className="undo" onClick={() => { setTasas(copia(ok)); setAviso('Cambios descartados.'); }}>Descartar</button>}
                    <button type="button" className="save" disabled={!pend || guardando} onClick={guardar}>Guardar y aplicar</button>
                </div>
            </div>
        </section>
    );
};

export default EditorTasas;
