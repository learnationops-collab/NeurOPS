import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { PillMenu } from '../../comercial/components/Shared';
import Comparativas from '../../comercial/components/Comparativas';
import RangoFechas, { mesEnCurso, rangoAnterior, rangoDe, textoRango } from '../../comercial/components/RangoFechas';
import { cargaDe } from '../../../components/dashboard/MetricaClicable';
import { getComparativas, getContexto, getMisDatosSetter } from '../../comercial/comercialApi';
import MisDatos from './MisDatos';
import '../../comercial/components/flujo.css';
import './setterDatos.css';

/**
 * La sección «Mis datos» del espacio del setter (10/10/2026): dos pestañas, «Mis datos» y
 * «Comparativas», con el mismo período.
 *
 * Antes era el Analizar del dashboard comercial embebido. Ahora «Mis datos» es su propia vista
 * (`MisDatos`: el reporte diario y el sistema, lado a lado) y Comparativas es el MISMO componente que
 * ve la dirección (`Comparativas.jsx`), en solo lectura: el backend le fija la de setters y le marca
 * su fila (`yo`).
 *
 * El período y la comparación viven en la URL con los parámetros del dashboard (`p`, `d`, `h`, `vs`,
 * `vd`, `vh`): así sobreviven al ir y volver de una lista, el espacio los conserva al cambiar de
 * sección y la lista de Revisar abre en el mismo período.
 *
 * Tocar un número del sistema abre su lista: se escriben la tabla y el filtro (`t`, `f`, `ft`), como
 * el drill-down del dashboard, y en el mismo clic se le pasa al host la URL ya escrita
 * (`onIrALista(tabla, url)`): el host navega desde ella y no la pisa (ver `SetterEspacioPage`).
 */

/** Período por defecto, el del dashboard. */
const PERIODO = 'mes';
const COMPARACION = 'prev';

const SetterDatos = ({ tab = 'resumen', onIrALista = null }) => {
    const [params, setParams] = useSearchParams();
    const [contexto, setContexto] = useState(null);
    const [datos, setDatos] = useState(null);
    const [comparativas, setComparativas] = useState(null);

    const period = params.get('p') || PERIODO;
    const compare = params.get('vs') || COMPARACION;
    const rango = period === 'custom' ? rangoDe(params.get('d'), params.get('h')) : null;
    const faltaPeriodo = period === 'custom' && !rango;
    const rangoVs = compare === 'custom' ? rangoDe(params.get('vd'), params.get('vh')) : null;
    const faltaVs = compare === 'custom' && !rangoVs;

    const filtros = useMemo(() => ({ period, compare, rol: 'setters', desde: rango?.desde, hasta: rango?.hasta,
        vsDesde: rangoVs?.desde, vsHasta: rangoVs?.hasta }),
    [period, compare, rango?.desde, rango?.hasta, rangoVs?.desde, rangoVs?.hasta]);

    const set = useCallback((cambios) => {
        const siguiente = new URLSearchParams(params);
        Object.entries(cambios).forEach(([k, v]) => {
            if (v === null || v === undefined || v === '') siguiente.delete(k);
            else siguiente.set(k, v);
        });
        setParams(siguiente, { replace: true });
        return siguiente;
    }, [params, setParams]);

    useEffect(() => {
        getContexto().then(setContexto).catch(() => toast.error('No se pudieron abrir tus datos'));
    }, []);

    // Solo la respuesta del último pedido llega a la pantalla: 90 días tarda más que un día, y una
    // respuesta vieja que vuelve tarde pisaría los números del período que se eligió después.
    const ultimo = useRef(0);
    useEffect(() => {
        if (faltaPeriodo || faltaVs) return;
        const n = ++ultimo.current;
        if (tab === 'comparativas') {
            getComparativas(filtros).then(d => { if (ultimo.current === n) setComparativas(d); })
                .catch(() => toast.error('No se pudieron cargar las comparativas'));
        } else {
            getMisDatosSetter(filtros).then(d => { if (ultimo.current === n) setDatos(d); })
                .catch(() => toast.error('No se pudieron cargar tus datos'));
        }
    }, [tab, filtros, faltaPeriodo, faltaVs]);

    /**
     * El drill-down: el mismo contrato que `DashboardComercial.irA`. El token (`ft`) arranca del que
     * ya está en la URL, para que la lista no lo tome por un filtro ya usado.
     */
    const token = useRef(0);
    const irA = useCallback((destino) => {
        if (!onIrALista || !destino) return;
        const limpio = Object.fromEntries(Object.entries(cargaDe(destino))
            .filter(([, v]) => v !== null && v !== undefined));
        token.current = Math.max(token.current, Number(params.get('ft')) || 0) + 1;
        const siguiente = new URLSearchParams(params);
        siguiente.set('t', destino.tabla);
        siguiente.set('f', JSON.stringify(limpio));
        siguiente.set('ft', String(token.current));
        onIrALista(destino.tabla, siguiente);
    }, [onIrALista, params]);

    const fechas = tab === 'comparativas' ? comparativas?.dates : datos?.dates;
    const etiquetaPeriodo = contexto?.periodos?.find(p => p.key === period)?.label;
    const elegirPeriodo = (k) => {
        if (k !== 'custom') { set({ p: k, d: null, h: null }); return; }
        if (period === 'custom') return;
        const inicial = (fechas && rangoDe(fechas.start, fechas.end)) || mesEnCurso();
        set({ p: 'custom', d: inicial.desde, h: inicial.hasta });
    };
    const elegirComparacion = (k) => {
        if (k !== 'custom') { set({ vs: k, vd: null, vh: null }); return; }
        if (compare === 'custom') return;
        const enPantalla = (fechas && rangoDe(fechas.start, fechas.end)) || rango || mesEnCurso();
        const inicial = (fechas && rangoDe(fechas.compare_start, fechas.compare_end)) || rangoAnterior(enPantalla);
        set({ vs: 'custom', vd: inicial.desde, vh: inicial.hasta });
    };
    const camposDelPeriodo = (
        <RangoFechas rotulo="Período"
            desde={rango?.desde ?? (params.get('d') || '')} hasta={rango?.hasta ?? (params.get('h') || '')}
            onCambiar={({ desde, hasta }) => set({ p: 'custom', d: desde || null, h: hasta || null })} />
    );
    const camposDeLaComparacion = (
        <RangoFechas rotulo="Comparación"
            desde={rangoVs?.desde ?? (params.get('vd') || '')} hasta={rangoVs?.hasta ?? (params.get('vh') || '')}
            onCambiar={({ desde, hasta }) => set({ vs: 'custom', vd: desde || null, vh: hasta || null })} />
    );

    const alcance = [contexto?.yo?.nombre, rango ? textoRango(rango) : etiquetaPeriodo?.toLowerCase()]
        .filter(Boolean).join(' · ');

    return (
        <div className="dc-shell dc-shell--embebido setter-datos">
            <div className="wrap">
                <div className="barra">
                    <p className="t-cap mut num setter-datos-alcance">{alcance}</p>
                    {contexto && (
                        <div className="barra-der">
                            <PillMenu icono={<Calendar size={14} />} rotulo="período"
                                texto={rango ? textoRango(rango) : etiquetaPeriodo}
                                detalle={period !== 'custom' && fechas
                                    ? `${fechas.start.slice(8)}–${fechas.end.slice(8)}` : null}
                                valor={period}
                                opciones={contexto.periodos.map(p => (p.key === 'custom' ? { ...p, quedaAbierto: true } : p))}
                                ancho={period === 'custom' ? 324 : undefined}
                                pie={period === 'custom' ? camposDelPeriodo : null}
                                onChange={elegirPeriodo} />
                            <PillMenu icono={<span className="mut" style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.14em' }}>VS</span>}
                                rotulo="comparación"
                                texto={rangoVs ? textoRango(rangoVs) : contexto.comparaciones.find(c => c.key === compare)?.label}
                                valor={compare}
                                opciones={contexto.comparaciones.map(c => (c.key === 'custom' ? { ...c, quedaAbierto: true } : c))}
                                ancho={compare === 'custom' ? 324 : 250}
                                pie={compare === 'custom' ? camposDeLaComparacion : null}
                                onChange={elegirComparacion} />
                        </div>
                    )}
                </div>

                <div className="vista">
                    {(faltaPeriodo || faltaVs) ? (
                        <section className="panel">
                            <div className="vacio-grande vacio-grande--rango">
                                <p className="t-sm mut">
                                    {faltaPeriodo ? 'Elegí las dos fechas del período.' : 'Elegí las dos fechas de la comparación.'}
                                </p>
                                {faltaPeriodo ? camposDelPeriodo : camposDeLaComparacion}
                            </div>
                        </section>
                    ) : tab === 'comparativas' ? (
                        // Solo lectura: un setter no abre las listas de sus compañeros.
                        <Comparativas datos={comparativas} irAPersona={null} />
                    ) : (
                        <MisDatos datos={datos} irA={onIrALista ? irA : null} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default SetterDatos;
