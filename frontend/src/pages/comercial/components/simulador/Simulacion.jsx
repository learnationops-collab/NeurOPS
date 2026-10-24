import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { PanelCab, Segmented } from '../Shared';
import Tip from '../Tip';
import BandaModo from './BandaModo';
import Palanca from './Palanca';
import Resultados, { DatosCentrales } from './Resultados';
import GraficoMensual from './GraficoMensual';
import { GRUPOS, PALANCAS, resultadoDe } from './palancas';
import { tocada } from './modelo';

const VISTAS_RES = [{ key: 'mes', label: 'Mes a mes' }, { key: 'datos', label: 'Datos centrales' }];

const Grupo = ({ grupo, s, perfil }) => (
    <section className="panel sim-grupo">
        <PanelCab titulo={grupo.titulo} tip={grupo.tip} />
        {grupo.clave === 'anuncios' && !(perfil.ritmo.gasto > 0) && (
            <p className="sim-nota">Esta línea base no tiene gasto de Meta Ads: no hay sobre qué mover.</p>
        )}
        <div className="sim-grupo-l">
            {grupo.palancas.map(clave => {
                const def = PALANCAS[clave];
                const estado = s.palancas[clave];
                return (
                    <Palanca key={`${grupo.clave}-${clave}`} def={def} base={def.base(perfil)}
                        resultado={resultadoDe(def, perfil, estado)} estado={estado}
                        onCambiar={(e) => s.poner(clave, e)} onQuitar={() => s.poner(clave, null)} />
                );
            })}
        </div>
    </section>
);

/**
 * Pestaña Simulación: las palancas y, al lado, lo que cambian contra la proyección. Un grupo de
 * palancas por vez (con cuántas lleva movidas cada uno) y el detalle del resultado en dos vistas,
 * para no tener que bajar por toda la página.
 */
const Simulacion = ({ s, onTab }) => {
    const [clave, setClave] = useState(GRUPOS[0].clave);
    const [vista, setVista] = useState('mes');
    const { perfil, proy } = s.actual;
    const grupo = GRUPOS.find(g => g.clave === clave) || GRUPOS[0];
    const opcionesGrupos = GRUPOS.map(g => {
        const n = g.palancas.filter(k => tocada(s.palancas[k])).length;
        return { key: g.clave, label: g.titulo, cuenta: n || undefined };
    });
    const partida = `${s.linea === 'mes' ? 'Ritmo del mes' : `Últimos ${s.dias} días`} · `
        + `${s.horizonte === 1 ? 'este mes' : `${s.horizonte} meses`}`;

    return (
        <div className="sim">
            <BandaModo modo="simulacion">
                <button type="button" className="btn btn--linea btn--sm" disabled={!s.tocadas}
                    onClick={s.restablecer}>
                    <RotateCcw size={14} />Restablecer
                </button>
            </BandaModo>
            <section className="panel sim-parte">
                <div className="sim-parte-b">
                    <p className="t-rotulo">Parte de</p>
                    <p className="sim-parte-n">{partida}</p>
                    {onTab && (
                        <button type="button" className="sim-enlace" onClick={() => onTab('proyeccion')}>
                            Cambiar en Proyección
                        </button>
                    )}
                </div>
                <div className="sim-parte-b">
                    <p className="t-rotulo">Capacidad libre</p>
                    <div className="sim-cap">
                        <input type="number" className="pal-in" min={0} max={200} step={5} value={s.holgura}
                            aria-label="Capacidad libre del equipo, en %"
                            onChange={(e) => s.setHolgura(Math.max(0, Number(e.target.value) || 0))} />
                        <span className="t-cap mut">%</span>
                        <Tip texto="Cuánto más podría atender hoy el equipo sin sumar gente. Es un supuesto."
                            titulo="Capacidad libre" />
                    </div>
                </div>
                <div className="sim-parte-b">
                    <p className="t-rotulo">Escenario</p>
                    <p className="sim-parte-n" data-tocada={s.tocadas ? '1' : ''}>
                        {s.tocadas ? `${s.tocadas} ${s.tocadas === 1 ? 'palanca movida' : 'palancas movidas'}`
                            : 'Todas mantenidas'}
                    </p>
                </div>
            </section>
            <div className="sim-cuerpo">
                <div className="sim-res">
                    <Resultados total={proy.total} perfil={perfil} />
                    <Segmented chico opciones={VISTAS_RES} valor={vista} onChange={setVista}
                        ariaLabel="Detalle del resultado" />
                    {vista === 'mes'
                        ? <GraficoMensual meses={proy.meses} />
                        : <DatosCentrales total={proy.total} perfil={perfil} />}
                </div>
                <div className="sim-pal">
                    <Segmented chico opciones={opcionesGrupos} valor={clave} onChange={setClave}
                        ariaLabel="Grupo de palancas" />
                    <Grupo grupo={grupo} s={s} perfil={perfil} />
                </div>
            </div>
        </div>
    );
};

export default Simulacion;
