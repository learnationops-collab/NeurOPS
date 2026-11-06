import React, { useCallback, useEffect, useState } from 'react';
import { getSimuladorTendencia } from '../../comercialApi';
import { EsqueletoPanel, FalloCarga, PanelCab, Segmented, fmt } from '../Shared';
import { MESES } from './modelo';

const MODOS = [{ key: 'tendencia', label: 'Con tendencia' }, { key: 'actual', label: 'Cálculo actual' }];
const MODELO = { 'Ritmo 30 días': 'Ritmo de 30 días', 'Ritmo 60 días': 'Ritmo de 60 días' };

const cifra = (v, dinero) => (dinero ? fmt.money(v) : fmt.num(Math.round(v)));

/** Una cifra: el total del mes, su rango, la comparación con el mes anterior y la barra. */
const Tarjeta = ({ c, modo }) => {
    if (c.total === null) {
        return (
            <div className="sim-linea sim-tend">
                <span className="t-rotulo">{c.titulo}</span>
                <span className="sim-linea-n">—</span>
                <span className="t-cap mut40">Falta historia para proyectarla.</span>
            </div>
        );
    }
    const v = modo === 'actual' ? c.actual : c;
    const tope = Math.max(v.alto, c.anterior || 0) * 1.05 || 1;
    const pct = (x) => `${Math.min(100, (x / tope) * 100)}%`;
    const delta = c.anterior ? Math.round((v.total / c.anterior - 1) * 100) : null;
    return (
        <div className="sim-linea sim-tend">
            <span className="t-rotulo">{c.titulo}</span>
            <span className="sim-linea-n">{cifra(v.total, c.dinero)}</span>
            <span className="t-cap mut num">
                entre {cifra(v.bajo, c.dinero)} y {cifra(v.alto, c.dinero)}
                {delta !== null && (
                    <> · <span data-signo={delta >= 0 ? '+' : '-'} className="sim-tend-d">
                        {delta >= 0 ? '+' : ''}{delta}% vs el mes pasado ({cifra(c.anterior, c.dinero)})
                    </span></>
                )}
            </span>
            <span className="sim-tend-bar" aria-hidden="true">
                <i className="sim-tend-hecho" style={{ width: pct(c.hecho) }} />
                <i className="sim-tend-rango" style={{ left: pct(v.bajo), width: `calc(${pct(v.alto)} - ${pct(v.bajo)})` }} />
                {c.anterior ? <i className="sim-tend-ant" style={{ left: pct(c.anterior) }} /> : null}
            </span>
            <span className="t-cap mut40">
                {modo === 'actual' ? 'Ritmo de 30 días' : (MODELO[c.modelo] || c.modelo)} · se equivoca ±{v.error}%
            </span>
        </div>
    );
};

/**
 * Proyección con tendencia (06/11/2026, ADR-W111): el resto del mes con el modelo que menos se
 * equivocó en la prueba hacia atrás, cifra por cifra (`proyeccion_tendencia.py`). El rango es ese
 * error. «Cálculo actual» muestra lo mismo con el ritmo de 30 días, para comparar.
 */
const Tendencia = () => {
    const [datos, setDatos] = useState(null);
    const [falla, setFalla] = useState(false);
    const [modo, setModo] = useState('tendencia');
    const pedir = useCallback(() => {
        setFalla(false);
        getSimuladorTendencia().then(setDatos).catch(() => setFalla(true));
    }, []);
    useEffect(() => { pedir(); }, [pedir]);

    if (falla) return <FalloCarga texto="No se pudo calcular la proyección con tendencia" onReintentar={pedir} />;
    if (!datos) return <EsqueletoPanel rotulo="Entrenando la proyección…" lineas={5} />;
    const mes = MESES[Number(datos.mes.slice(5, 7)) - 1];
    return (
        <section className="panel">
            <PanelCab titulo={`Cómo cierra ${mes}`}
                tip="Modelos entrenados con los datos diarios. Cada cifra usa el que menos se equivocó proyectando 4 semanas.">
                <Segmented chico opciones={MODOS} valor={modo} onChange={setModo} ariaLabel="Modelo de la proyección" />
            </PanelCab>
            <div className="sim-lineas sim-tends pareja">
                {datos.cifras.map(c => <Tarjeta key={c.clave} c={c} modo={modo} />)}
            </div>
            <p className="sim-nota" style={{ marginTop: 'var(--s3)' }}>
                Gris: lo que ya pasó hasta el {fmt.fecha(datos.hasta)}. Color: el rango de lo que falta. La raya marca el mes pasado.
            </p>
        </section>
    );
};

export default Tendencia;
