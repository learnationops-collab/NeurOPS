import React, { useMemo, useState } from 'react';
import { Delta, Humo, PanelCab, fmt, useMontado } from '../Shared';
import { abrir } from '../../../../components/dashboard/MetricaClicable';
import { conDia, destinoDeSerie, serieCortable } from '../destinos';
import Acumulado from './Acumulado';
import DetalleDia from './DetalleDia';
import { VISTAS_GRAFICO, colorDePersona } from './Graficos';
import { diaConSemana, valorDe } from './formato';
import {
    acumulado, atipicos, banda, contraReferencia, diasPasados, mediaMovil, nombreDia, ritmo,
} from './estadisticos';

const GLIFO = { pico: '▲', caida: '▼', cero: '○' };
const MAX_AVISOS = 3;
const MAX_MARCAS = 8;

/** `2026-09-01` → `01/09`: el rango de la referencia, para la leyenda. */
const rangoCorto = (r) => (r ? `${fmt.fecha(r.start)}–${fmt.fecha(r.end)}` : '');

/** Lo que dice la leyenda de lo que está dibujado; cada capa prendida aporta lo suyo. */
const Leyenda = ({ ex, refNombre, refRango, vista, conAtipicos, hayMarcas }) => {
    const lineas = vista !== 'mapa';
    return (
        <div className="serie-ley t-cap mut40">
            {ex.ref && lineas && (
                <span><i className="ley-ref" />{refNombre} · {rangoCorto(refRango)}</span>
            )}
            {ex.banda && lineas && <span><i className="ley-banda" />Banda normal</span>}
            {ex.mm && lineas && <span><i className="ley-mm" />Media móvil de 7 días</span>}
            {conAtipicos && hayMarcas && (
                <span><b className="ley-pico">▲</b> pico <b className="ley-caida">▼</b> caída
                    <b className="ley-cero"> ○</b> sin movimiento</span>
            )}
        </div>
    );
};

/**
 * Las personas de la serie como botones: tildada cuenta en el gráfico y en el total, destildada
 * queda afuera. Siempre queda al menos una (ver `alternarPersona` en `Variabilidad`).
 */
const Personas = ({ personas, ocultas, onPersona, esTasa, vista }) => (
    <div className="serie-pers" role="group" aria-label="Personas del gráfico">
        {personas.map(p => {
            const fuera = ocultas.includes(p.nombre);
            const ultima = !fuera && personas.filter(q => !ocultas.includes(q.nombre)).length === 1;
            return (
                <button key={p.nombre} type="button" className="pers-chip" aria-pressed={!fuera}
                    disabled={ultima}
                    title={fuera ? `Volver a sumar a ${p.nombre}` : ultima ? 'Tiene que quedar alguien'
                        : `Quitar a ${p.nombre} del gráfico`}
                    onClick={() => onPersona(p.nombre)}>
                    <i className="ley-persona" style={{ background: `var(--${colorDePersona(p, p.k)})` }} />
                    {p.nombre}
                </button>
            );
        })}
        {esTasa && vista !== 'curva' && (
            <span className="t-cap mut40">En Curva se ve cada una por su lado.</span>
        )}
    </div>
);

/**
 * La serie sin las personas quitadas. Lo que se suma, suma a quienes quedan; una tasa se promedia
 * entre quienes quedan, pesando por las llamadas o mensajes que la sostienen cuando hay (`pesos`).
 */
const sinPersonas = (activa, ocultas) => {
    const todas = activa.personas.map((p, k) => ({ ...p, k }));
    const quedan = todas.filter(p => !ocultas.includes(p.nombre));
    if (quedan.length === todas.length) return { ...activa, personas: todas };
    const vals = activa.vals.map((_, i) => {
        if (!activa.esTasa) return Math.round(quedan.reduce((a, p) => a + (p.vals[i] || 0), 0) * 100) / 100;
        const con = quedan.filter(p => (p.pesos ? p.pesos[i] > 0 : p.vals[i] > 0));
        if (!con.length) return 0;
        const peso = (p) => (p.pesos ? p.pesos[i] : 1);
        const total = con.reduce((a, p) => a + peso(p), 0);
        return Math.round((con.reduce((a, p) => a + p.vals[i] * peso(p), 0) / total) * 10) / 10;
    });
    // La referencia es del equipo entero: contra un recorte no dice nada.
    return { ...activa, vals, personas: quedan, previo: null, semana: null };
};

/**
 * Un panel: una métrica, sus sub-series y las capas que la pestaña tenga prendidas.
 *
 * Con todas las capas apagadas es la serie por día de siempre. Cada capa agrega algo a `ex` (lo que
 * reciben los gráficos) o un bloque debajo del gráfico, y ninguna cambia el dato: una barra sigue
 * siendo el valor del día, y sigue abriendo la lista de ese día (salvo con Personas, donde abre el
 * reparto de ese día, que trae su propio enlace a la lista).
 */
const PanelSerie = ({ serie, dias, hoy, vista, rol, irA, capas, refKey, refNombre, refRango, ocultas, onPersona }) => {
    const montado = useMontado();
    const [iSub, setISub] = useState(0);
    // El día abierto (su índice), o null. Nunca se abre solo: seis paneles con su detalle abierto
    // son justo la saturación que las capas evitan.
    const [foco, setFoco] = useState(null);

    const subs = serie.series || null;
    const esTasa = serie.tipo === 'tasa';
    // La serie completa y, aparte, la de las personas que quedan: quitar a alguien cambia lo que se
    // dibuja, el total de la cabecera y los atípicos, no solo la leyenda.
    const todas = useMemo(() => {
        if (subs) return { ...subs[Math.min(iSub, subs.length - 1)], esTasa };
        return {
            vals: serie.vals, tone: serie.tone, label: null, esTasa,
            previo: serie.previo, semana: serie.semana, personas: serie.personas,
        };
    }, [serie, subs, iSub, esTasa]);
    const activa = useMemo(
        () => (capas.personas && todas.personas ? sinPersonas(todas, ocultas) : todas),
        [capas.personas, todas, ocultas],
    );

    const pasados = useMemo(() => diasPasados(dias, hoy), [dias, hoy]);

    const { max, unico, activos, cabecera } = useMemo(() => {
        const conMovimiento = activa.vals.filter(v => v > 0);
        const tope = activa.vals.length ? Math.max(...activa.vals) : 0;
        return {
            max: tope,
            unico: activa.vals.filter(v => v === tope).length === 1,
            activos: conMovimiento.length,
            // Una tasa promedia SOLO los días con movimiento: con los ceros adentro, el show up
            // de un equipo que no trabaja el domingo caería sin que nadie haya faltado a una
            // llamada. Lo que se suma (cash, agendas) sí va entero, que es su total del período.
            cabecera: esTasa
                ? conMovimiento.reduce((a, b) => a + b, 0) / (conMovimiento.length || 1)
                : activa.vals.reduce((a, b) => a + b, 0),
        };
    }, [activa.vals, esTasa]);

    const b = useMemo(() => banda(activa.vals, pasados, serie), [activa.vals, pasados, serie]);
    const ref = capas.comparar && refKey ? activa[refKey] || null : null;
    const lista = useMemo(
        () => (capas.atipicos ? atipicos(activa.vals, dias, pasados, b, serie) : []),
        [capas.atipicos, activa.vals, dias, pasados, b, serie],
    );
    const marcas = useMemo(
        () => Object.fromEntries(lista.slice(0, MAX_MARCAS).map(a => [a.i, a.clase])),
        [lista],
    );
    const mm = capas.tendencia ? mediaMovil(activa.vals, pasados, serie) : null;
    const acum = capas.tendencia && !esTasa ? acumulado(activa.vals, pasados) : null;
    const refAcum = useMemo(() => {
        if (!acum || !ref) return null;
        const hasta = ref.reduce((a, v, i) => (v === null ? a : i + 1), 0);
        return acumulado(ref, hasta);
    }, [acum, ref]);

    const cmp = ref ? contraReferencia(activa.vals, ref, pasados, serie) : null;

    const destino = destinoDeSerie(rol, serie.key, activa.label);
    const cortable = serieCortable(rol, serie.key, activa.label);
    const irLista = irA && destino && cortable
        ? (iso) => abrir(irA, conDia(destino, iso))()
        : null;
    const conReparto = capas.personas && !!activa.personas;
    const apilar = conReparto && !esTasa && vista === 'barras' ? activa.personas : null;
    // En Curva cada persona es una línea (también las tasas, que no se apilan).
    const lineas = conReparto && vista === 'curva' ? activa.personas : null;

    const focoEf = foco;
    const verDetalle = focoEf !== null && focoEf < pasados && b.n > 0;

    const algunaCapa = capas.comparar || capas.atipicos || capas.tendencia || capas.personas;
    const tope = Math.max(max, ...(ref || []).filter(v => v !== null),
        ...(lineas || []).flatMap(p => p.vals), 0);
    const ex = {
        ref, banda: capas.atipicos && b.confiable ? b : null, mm, marcas, apilar, lineas,
        // Sin capas la serie se ve como siempre, también los días que todavía no pasaron.
        pasados: algunaCapa ? pasados : dias.length,
        foco: verDetalle ? focoEf : null,
        accion: conReparto ? 'abre el reparto de ese día' : 'abre la lista de ese día',
    };
    const clicDia = conReparto
        ? (iso, i) => setFoco(f => (f === i ? null : i))
        : irLista;

    const Vista = VISTAS_GRAFICO[vista] || VISTAS_GRAFICO.barras;
    const total = activa.vals.length;
    const rit = acum ? ritmo(acum, pasados, total, serie.meta) : null;

    return (
        <section className="panel caja">
            <Humo colores={[`var(--${activa.tone})`, 'var(--brand-primary)',
                `var(--${activa.tone})`, 'var(--brand-navy)']} tarjeta />
            <PanelCab titulo={`${serie.label} por día`} tip={serie.help}>
                <span style={{ display: 'grid', gap: 2, textAlign: 'right' }}>
                    <span className="serie-total">
                        {cmp && cmp.delta && <Delta delta={cmp.delta} />}
                        <span className="num" style={{
                            fontSize: 20, lineHeight: 1, fontWeight: 900, letterSpacing: '-.025em',
                        }}>
                            {valorDe(serie, cabecera)}
                        </span>
                    </span>
                    {/* "promedio diario" y no "promedio" a secas: el promedio de las tasas
                        diarias NO es la tasa del período (medido: 68.0% contra el 61.3% del
                        tile de Show up, porque cada día pesa igual sin importar cuántas
                        llamadas tuvo). Son dos estadísticos distintos y el rótulo es lo que
                        evita que parezca que uno de los dos está mal. */}
                    <span className="t-cap mut40">
                        {esTasa ? 'promedio diario' : 'total del período'}
                        {cmp && (
                            <span title={`Contra los mismos ${pasados} días de la referencia`}>
                                {' '}· antes {valorDe(serie, cmp.previo)}
                                {pasados < dias.length && ` (${pasados} d)`}
                            </span>
                        )}
                    </span>
                </span>
            </PanelCab>

            {subs && subs.length > 1 && (
                <div className="tabs tabs--wrap" role="tablist"
                    aria-label={`Filtro de ${serie.label}`} style={{ marginBottom: 'var(--s3)' }}>
                    {subs.map((sub, i) => (
                        <button key={sub.label} type="button" role="tab" className="tab tab--sm"
                            aria-selected={iSub === i}
                            onClick={() => { setISub(i); setFoco(null); }}>
                            {sub.label}
                        </button>
                    ))}
                </div>
            )}

            <Vista serie={serie} activa={activa} dias={dias} max={max} tope={tope || max} unico={unico}
                montado={montado} irDia={clicDia} ex={ex} />

            <Leyenda ex={ex} refNombre={refNombre} refRango={refRango} vista={vista}
                conAtipicos={capas.atipicos} hayMarcas={lista.length > 0} />

            {conReparto && (
                <Personas personas={todas.personas.map((p, k) => ({ ...p, k }))} ocultas={ocultas}
                    onPersona={(n) => { onPersona(n); setFoco(null); }} esTasa={esTasa} vista={vista} />
            )}

            {acum && (
                <Acumulado serie={serie} tone={activa.tone} acum={acum} refAcum={refAcum} ritmo={rit}
                    n={total} />
            )}

            {capas.atipicos && (
                <div className="atipicos">
                    {!b.confiable && (
                        <span className="t-cap mut40">Pocos días con movimiento para marcar atípicos.</span>
                    )}
                    {b.confiable && !lista.length && (
                        <span className="t-cap mut40">Ningún día sale de lo normal.</span>
                    )}
                    {lista.slice(0, MAX_AVISOS).map(a => (
                        <button key={a.i} type="button" className={`atipico atipico--${a.clase}`}
                            aria-pressed={focoEf === a.i}
                            title="Abre el detalle de ese día"
                            onClick={() => setFoco(f => (f === a.i ? null : a.i))}>
                            <b>{GLIFO[a.clase]}</b>
                            {diaConSemana(dias[a.i], nombreDia(dias[a.i]))} · {valorDe(serie, activa.vals[a.i])}
                        </button>
                    ))}
                    {lista.length > MAX_AVISOS && (
                        <span className="t-cap mut40">y {lista.length - MAX_AVISOS} más</span>
                    )}
                </div>
            )}

            {verDetalle && (
                <DetalleDia serie={serie} activa={activa} dias={dias} i={focoEf} banda={b}
                    pasados={pasados} conPersonas={capas.personas}
                    irDia={irLista} onCerrar={() => setFoco(null)} />
            )}

            <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s4)', marginTop: 'var(--s3)' }}>
                {max > 0 && unico && irLista ? (
                    <button type="button" className="metrica-clic t-cap mut40 num"
                        onClick={() => irLista(dias[activa.vals.indexOf(max)])}
                        aria-label={`Ver la lista del día pico, ${valorDe(serie, max)}`}>
                        <span className="metrica-clic-txt">
                            pico {valorDe(serie, max)} · el {fmt.fecha(dias[activa.vals.indexOf(max)])}
                        </span>
                    </button>
                ) : (
                    <span className="t-cap mut40 num">
                        {max === 0 ? 'sin movimiento' : unico
                            ? `pico ${valorDe(serie, max)} · el ${fmt.fecha(dias[activa.vals.indexOf(max)])}`
                            : `tope diario ${valorDe(serie, max)}`}
                    </span>
                )}
                <span className="t-cap mut40 num" style={{ marginLeft: 'auto' }}>
                    {activos} de {dias.length} días con movimiento
                </span>
            </div>
        </section>
    );
};

export default PanelSerie;
