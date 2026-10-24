import React from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { EsqueletoPanel, FalloCarga, PanelCab, Segmented, fmt } from '../Shared';
import Tip from '../Tip';
import Palanca from './Palanca';
import Resultados, { DatosCentrales } from './Resultados';
import GraficoMensual from './GraficoMensual';
import { GRUPOS, PALANCAS, resultadoDe } from './palancas';
import useSimulador, { DIAS, HORIZONTES } from './useSimulador';
import './simulador.css';

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
        <section className="panel">
            <PanelCab titulo="Proyección: si todo se mantiene"
                tip="Cómo cierran los datos si el ritmo no cambia. Es la base del escenario.">
                <span className="t-cap mut">Elegí con cuál línea comparar</span>
            </PanelCab>
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
        </section>
    );
};

const Controles = ({ s }) => (
    <section className="panel">
        <PanelCab titulo="Simulador"
            tip="Mové las palancas sobre la proyección y mirá cuánto cambia. No se guarda.">
            <span className="t-cap mut">Solo en pantalla: al recargar se borra</span>
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
                <p className="sim-nota">Las palancas mueven solo los días que faltan.</p>
            </div>
            <div className="sim-ctl-b">
                <p className="t-rotulo">Capacidad libre</p>
                <div className="sim-cap">
                    <input type="number" className="pal-in" min={0} max={200} step={5} value={s.holgura}
                        aria-label="Capacidad libre del equipo, en %"
                        onChange={(e) => s.setHolgura(Math.max(0, Number(e.target.value) || 0))} />
                    <span className="t-cap mut">%</span>
                    <Tip texto="Cuánto más podría atender hoy el equipo sin sumar gente."
                        titulo="Capacidad libre" />
                </div>
                <p className="sim-nota">Es un supuesto: ajustalo a cómo está el equipo.</p>
            </div>
            <div className="sim-ctl-b">
                <p className="t-rotulo">Escenario</p>
                <button type="button" className="btn btn--linea btn--sm" disabled={!s.tocadas}
                    onClick={s.restablecer}>
                    <RotateCcw size={14} />Restablecer
                </button>
                <p className="sim-nota">
                    {s.tocadas ? `${s.tocadas} ${s.tocadas === 1 ? 'palanca movida' : 'palancas movidas'}`
                        : 'Todas las palancas mantenidas'}
                </p>
            </div>
        </div>
    </section>
);

const Palancas = ({ s, perfil }) => (
    <div className="sim-pal">
        {GRUPOS.map(g => (
            <section className="panel sim-grupo" key={g.clave}>
                <PanelCab titulo={g.titulo} tip={g.tip} />
                {g.clave === 'anuncios' && !(perfil.ritmo.gasto > 0) && (
                    <p className="sim-nota">Esta línea base no tiene gasto de Meta Ads: no hay sobre qué mover.</p>
                )}
                <div className="sim-grupo-l">
                    {g.palancas.map(clave => {
                        const def = PALANCAS[clave];
                        const estado = s.palancas[clave];
                        return (
                            <Palanca key={`${g.clave}-${clave}`} def={def} base={def.base(perfil)}
                                resultado={resultadoDe(def, perfil, estado)} estado={estado}
                                onCambiar={(e) => s.poner(clave, e)} onQuitar={() => s.poner(clave, null)} />
                        );
                    })}
                </div>
            </section>
        ))}
    </div>
);

/**
 * Simulador (sección del dock, solo la dirección comercial; 24/10/2026).
 *
 * Parte de la PROYECCIÓN —cómo cierran los datos si todo se mantiene— y deja mover palancas del
 * embudo del setter, del closer, del equipo y de los anuncios para ver cuánto cambian cash, ventas y
 * comisiones contra esa base. Las cuentas están en `modelo.js`; los datos, en
 * `GET /comercial/simulador/base`.
 */
const Simulador = ({ permitido }) => {
    const s = useSimulador(permitido);

    if (!permitido) {
        return (
            <section className="panel">
                <div className="vacio-grande">
                    <span className="vacio-icono"><SlidersHorizontal size={24} /></span>
                    <h2 className="t-h2">Sin acceso al Simulador</h2>
                    <p className="t-sm mut">El Simulador es de la dirección comercial.</p>
                </div>
            </section>
        );
    }
    if (s.falla) return <FalloCarga texto="No se pudo cargar el Simulador" onReintentar={s.cargar} />;
    if (!s.base || !s.actual) {
        return s.base
            ? (
                <section className="panel">
                    <div className="vacio-grande">
                        <h2 className="t-h2">Todavía no hay datos para proyectar</h2>
                        <p className="t-sm mut">Hace falta al menos un día hábil cerrado en la línea base elegida.</p>
                    </div>
                </section>
            )
            : <EsqueletoPanel rotulo="Cargando el Simulador…" lineas={8} />;
    }

    const { perfil, proy } = s.actual;
    return (
        <div className="sim">
            <Controles s={s} />
            <LineasBase comparadas={s.comparadas} linea={s.linea} dias={s.dias} onElegir={s.setLinea} />
            <div className="sim-cuerpo">
                <div className="sim-res">
                    <Resultados total={proy.total} perfil={perfil} />
                    <GraficoMensual meses={proy.meses} />
                </div>
                <Palancas s={s} perfil={perfil} />
            </div>
            <DatosCentrales total={proy.total} perfil={perfil} />
        </div>
    );
};

export default Simulador;
