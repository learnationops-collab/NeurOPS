import React from 'react';
import { PanelCab, Segmented, fmt } from '../Shared';
import BandaModo from './BandaModo';
import Resultados, { DatosCentrales } from './Resultados';
import GraficoMensual from './GraficoMensual';
import { DIAS, HORIZONTES } from './useSimulador';

const LINEAS = [{ key: 'mes', label: 'Ritmo del mes' }, { key: 'dias', label: 'Últimos N días' }];
const OPCIONES_DIAS = DIAS.map(d => ({ key: d, label: `${d} días` }));
const OPCIONES_HORIZONTE = HORIZONTES.map(n => ({ key: String(n), label: n === 1 ? 'Este mes' : `${n} meses` }));

const dinero = (v) => fmt.money(v);

/** Las dos líneas base contra la misma proyección: cada una es una tarjeta y se elige tocándola. */
const LineasBase = ({ comparadas, linea, dias, onElegir }) => {
    const filas = [
        { clave: 'mes', titulo: 'Ritmo del mes', datos: comparadas.mes },
        { clave: 'dias', titulo: `Últimos ${dias} días`, datos: comparadas.dias },
    ];
    return (
        <div className="sim-lineas pareja">
            {filas.map(({ clave, titulo, datos }) => (
                <button key={clave} type="button" className="sim-linea" aria-pressed={linea === clave}
                    onClick={() => onElegir(clave)}>
                    <span className="t-rotulo">{titulo}</span>
                    <span className="sim-linea-n">{datos ? dinero(datos.proy.total.base.cash) : '—'}</span>
                    <span className="t-cap mut num">
                        {datos
                            ? `${fmt.num(Math.round(datos.proy.total.base.ventas * 10) / 10)} ventas · comisiones ${dinero(datos.proy.total.base.comCloser + datos.proy.total.base.comSetter)}`
                            : 'Sin días hábiles todavía'}
                    </span>
                    <span className="t-cap mut40">
                        {datos?.respaldo ? 'El mes lleva pocos días: usa los últimos 14.'
                            : clave === 'mes' ? 'Lo que va del mes, extrapolado por días hábiles.'
                                : 'Promedio por día hábil de esa ventana.'}
                    </span>
                </button>
            ))}
        </div>
    );
};

/**
 * Pestaña Proyección: cómo cierran los datos si NADA cambia. No usa las palancas: aunque haya
 * alguna movida en la Simulación, acá se ve siempre la base pura (`comparadas` va sin palancas).
 */
const Proyeccion = ({ s }) => {
    const elegida = s.comparadas[s.linea];
    return (
        <div className="sim">
            <BandaModo modo="proyeccion" />
            <section className="panel">
                <PanelCab titulo="Punto de partida"
                    tip="Con qué ritmo se proyecta y hasta cuándo. La Simulación parte de lo mismo.">
                    <span className="t-cap mut">Elegí con cuál línea proyectar</span>
                </PanelCab>
                <div className="sim-ctl pareja">
                    <div className="sim-ctl-b">
                        <p className="t-rotulo">Línea base</p>
                        <Segmented chico opciones={LINEAS} valor={s.linea} onChange={s.setLinea} ariaLabel="Línea base" />
                        {s.linea === 'dias' && (
                            <Segmented chico opciones={OPCIONES_DIAS} valor={s.dias} onChange={s.setDias}
                                ariaLabel="Días de la línea base" />
                        )}
                    </div>
                    <div className="sim-ctl-b">
                        <p className="t-rotulo">Horizonte</p>
                        <Segmented chico opciones={OPCIONES_HORIZONTE} valor={String(s.horizonte)}
                            onChange={(k) => s.setHorizonte(Number(k))} ariaLabel="Horizonte" />
                    </div>
                </div>
                <LineasBase comparadas={s.comparadas} linea={s.linea} dias={s.dias} onElegir={s.setLinea} />
            </section>
            {elegida ? (
                <>
                    <Resultados total={elegida.proy.total} perfil={elegida.perfil} soloBase />
                    <div className="sim-dos">
                        <GraficoMensual meses={elegida.proy.meses} soloBase />
                        <DatosCentrales total={elegida.proy.total} perfil={elegida.perfil} soloBase />
                    </div>
                </>
            ) : (
                <section className="panel">
                    <div className="vacio-grande">
                        <h2 className="t-h2">Todavía no hay datos para proyectar</h2>
                        <p className="t-sm mut">Hace falta al menos un día hábil cerrado en la línea base elegida.</p>
                    </div>
                </section>
            )}
        </div>
    );
};

export default Proyeccion;
