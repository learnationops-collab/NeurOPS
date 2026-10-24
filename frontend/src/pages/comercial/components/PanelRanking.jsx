import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { Button, Input, Segmented, Switch } from '../../../components/standard';
import { useEnPantalla } from '../../../components/ui/useEnPantalla';
import Tip from './Tip';
import { cambiosActivos, KEY_PUNTAJE, pesoDe } from './rankingConfig';
import './rankingConfig.css';

/**
 * Configurar el ranking de Comparativas: el botón y su panel.
 *
 * Mismo panel flotante que «Filtro completo» de Revisar (`.config-panel`, anclado al borde izquierdo
 * de la barra, 680px, y debajo de 900px en su propia fila). Cada cambio se guarda en el acto
 * (`useRankingConfig`): no hay «Aplicar». Todo es de quien lo abre: no toca lo que ven los demás.
 *
 * Las metas y los pesos van en la misma tabla que la lista de métricas: una fila por métrica, con
 * mostrar, inicial, peso y meta. El peso solo cuenta con el puntaje compuesto encendido.
 */

const UNIDAD = { pct: '%', money: '$', num: '#' };

// Un campo vacío es «sin valor»; lo que se tipea se guarda como número.
const aNumero = (texto) => (texto === '' ? null : Number(texto));

const CampoNumero = ({ valor, onChange, etiqueta, unidad, disabled }) => (
    <Input variant="number" className="rkc-num" type="number" min="0" inputMode="decimal" step="any"
        aria-label={etiqueta} placeholder={unidad} disabled={disabled}
        value={valor ?? ''} onChange={(e) => onChange(aNumero(e.target.value))} />
);

// Las personas van en columnas que reparten parejo (nunca tres y una suelta): la primera que divide
// exacto la cantidad; si ninguna, dos.
const columnasDe = (n) => [3, 2, 4].find(c => n >= c && n % c === 0) || 2;

const sinClave = (mapa, key) => {
    const { [key]: _quitada, ...resto } = mapa;
    return resto;
};

const PanelRanking = ({ datos, config, onCambiar, onRestablecer, onCerrar, panelRef }) => {
    const enPantalla = useEnPantalla(panelRef);
    const cambios = cambiosActivos(config);
    const set = (parcial) => onCambiar({ ...config, ...parcial });

    const visibles = datos.metricas.filter(m => !config.ocultas.includes(m.key));
    const alternarVisible = (key) => {
        const oculta = config.ocultas.includes(key);
        // Siempre queda una: sin métricas el ranking no tendría qué mostrar.
        if (!oculta && visibles.length <= 1) return;
        set({
            ocultas: oculta ? config.ocultas.filter(k => k !== key) : [...config.ocultas, key],
            inicial: !oculta && config.inicial === key ? null : config.inicial,
        });
    };
    const ponerMeta = (key, valor) => set({
        metas: valor === null ? sinClave(config.metas, key) : { ...config.metas, [key]: valor },
    });

    const alternarPersona = (id) => set({
        excluidos: config.excluidos.includes(id) ? config.excluidos.filter(x => x !== id) : [...config.excluidos, id],
    });

    const sumaPesos = datos.metricas.reduce((a, m) => a + pesoDe(config, datos.rol, m.key), 0);
    const entran = datos.filas.length - config.excluidos.filter(id => datos.filas.some(f => f.id === id)).length;

    return (
        <div ref={enPantalla} className="config-panel rkc" role="dialog" aria-label="Configurar ranking">
            <div className="config-cab">
                <p className="t-h3" style={{ fontSize: 16 }}>Configurar ranking</p>
                {cambios > 0 && <span className="cuenta-burbuja">{cambios}</span>}
                <button type="button" className="ibtn ibtn--sm" style={{ marginLeft: 'auto' }}
                    onClick={onCerrar} aria-label="Cerrar">
                    <X size={15} />
                </button>
            </div>

            <div className="rkc-seccion">
                <div className="rkc-cab">
                    <p className="t-rotulo">Métricas</p>
                    <Tip titulo="Metas" texto="Con meta, la barra va en verde si la alcanza y en ámbar si no." />
                </div>
                <div className="rkc-fila rkc-fila--cab" aria-hidden="true">
                    <span>Mostrar</span><span>Inicial</span><span>Peso</span><span>Meta</span>
                </div>
                {datos.metricas.map(m => {
                    const visible = !config.ocultas.includes(m.key);
                    return (
                        <div key={m.key} className="rkc-fila">
                            <button type="button" className="config-op" role="checkbox" aria-checked={visible}
                                title={m.desc} onClick={() => alternarVisible(m.key)}>
                                <span className="config-caja">{visible ? '✓' : ''}</span>
                                <span className="trunc">{m.label}</span>
                            </button>
                            <button type="button" className="config-op rkc-ini" role="radio" disabled={!visible}
                                aria-checked={config.inicial === m.key} title="Métrica con la que abre"
                                aria-label={`${m.label} como métrica inicial`}
                                onClick={() => set({ inicial: config.inicial === m.key ? null : m.key })}>
                                <span className="config-caja config-caja--radio" />
                                <span className="rkc-ini-txt">Inicial</span>
                            </button>
                            <CampoNumero etiqueta={`Peso de ${m.label}`} unidad="Peso" disabled={!config.compuesto}
                                valor={config.compuesto ? pesoDe(config, datos.rol, m.key) : null}
                                onChange={(v) => set({ pesos: { ...config.pesos, [m.key]: v ?? 0 } })} />
                            <CampoNumero etiqueta={`Meta de ${m.label}`} unidad={`Meta ${UNIDAD[m.formato]}`}
                                valor={config.metas[m.key]} onChange={(v) => ponerMeta(m.key, v)} />
                        </div>
                    );
                })}
            </div>

            <div className="rkc-seccion rkc-puntaje">
                <Switch checked={config.compuesto} label="Puntaje compuesto"
                    onChange={(v) => set({ compuesto: v, inicial: !v && config.inicial === KEY_PUNTAJE ? null : config.inicial })} />
                <span className="t-rotulo">Puntaje compuesto</span>
                <Tip titulo="Puntaje compuesto"
                    texto="Una métrica más: mezcla las de arriba con tus pesos (0 a 100)." />
                {config.compuesto && (
                    <button type="button" className="config-op rkc-ini-puntaje" role="radio"
                        aria-checked={config.inicial === KEY_PUNTAJE}
                        onClick={() => set({ inicial: config.inicial === KEY_PUNTAJE ? null : KEY_PUNTAJE })}>
                        <span className="config-caja config-caja--radio" />
                        <span className="trunc">Abrir con el puntaje</span>
                    </button>
                )}
                {config.compuesto && (
                    <span className="t-cap mut40 num rkc-suma">Pesos: suma {Math.round(sumaPesos * 10) / 10}</span>
                )}
            </div>

            <div className="rkc-dos">
                <div className="rkc-seccion">
                    <p className="t-rotulo">Orden</p>
                    <Segmented size="sm" value={config.orden} onChange={(orden) => set({ orden })}
                        label="Orden del ranking"
                        options={[{ value: 'desc', label: 'Mayor a menor' }, { value: 'asc', label: 'Menor a mayor' }]} />
                </div>
                <div className="rkc-seccion">
                    <div className="rkc-cab">
                        <p className="t-rotulo">Mínimos para entrar</p>
                        <Tip titulo="Mínimos" texto="Quien no llega no aparece en el ranking." />
                    </div>
                    <div className="rkc-minimos">
                        <label className="rkc-min">
                            <span>Agendas</span>
                            <CampoNumero etiqueta="Mínimo de agendas" unidad="0" valor={config.minAgendas || null}
                                onChange={(v) => set({ minAgendas: v ?? 0 })} />
                        </label>
                        <label className="rkc-min">
                            <span>Ventas</span>
                            <CampoNumero etiqueta="Mínimo de ventas" unidad="0" valor={config.minVentas || null}
                                onChange={(v) => set({ minVentas: v ?? 0 })} />
                        </label>
                    </div>
                </div>
            </div>

            <div className="rkc-seccion">
                <div className="rkc-cab">
                    <p className="t-rotulo">Quién entra · {entran} de {datos.filas.length}</p>
                    <Tip titulo="Quién entra" texto="Solo los oculta del ranking; el equipo no cambia." />
                </div>
                <div className="config-lista rkc-personas" style={{ '--cols': columnasDe(datos.filas.length) }}>
                    {datos.filas.map(f => {
                        const entra = !config.excluidos.includes(f.id);
                        return (
                            <button key={f.id} type="button" className="config-op" role="checkbox"
                                aria-checked={entra} onClick={() => alternarPersona(f.id)}>
                                <span className="config-caja">{entra ? '✓' : ''}</span>
                                <span className="trunc">{f.nombre}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="config-pie">
                <span className="t-cap mut40">
                    {cambios === 0 ? 'Como lo ve todo el equipo.' : 'Solo cambia lo que ves vos.'}
                </span>
                <Button style={{ marginLeft: 'auto' }} icon={<RotateCcw size={13} />}
                    disabled={cambios === 0} onClick={onRestablecer}>
                    Restablecer
                </Button>
            </div>
        </div>
    );
};

/**
 * La barra del ranking: el selector de métrica y, a su derecha, el botón que abre el panel.
 *
 * La envoltura (`.config-envoltura`) es la que ancla el panel, así que cubre las dos cosas: anclado
 * al botón, a la derecha, el panel de 680px se salía de la pantalla. Se cierra con clic afuera o
 * Escape, y el foco vuelve al botón.
 */
export const BarraRanking = ({ selector, datos, config, onCambiar, onRestablecer }) => {
    const [abierto, setAbierto] = useState(false);
    const raiz = useRef(null);
    const panel = useRef(null);
    const cambios = cambiosActivos(config);

    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => {
            if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false);
        };
        const escape = (e) => {
            if (e.key !== 'Escape') return;
            setAbierto(false);
            raiz.current?.querySelector('[aria-expanded]')?.focus();
        };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [abierto]);

    return (
        <div ref={raiz} className="config-envoltura rkc-barra">
            {selector}
            <button type="button" className={`pastilla${cambios ? ' pastilla--on' : ''}`}
                aria-expanded={abierto} aria-haspopup="dialog" onClick={() => setAbierto(a => !a)}>
                <SlidersHorizontal size={15} />
                Configurar
                {cambios > 0 && <span className="cuenta-burbuja">{cambios}</span>}
                <ChevronDown size={14} />
            </button>
            {abierto && (
                <PanelRanking datos={datos} config={config} onCambiar={onCambiar} panelRef={panel}
                    onRestablecer={onRestablecer} onCerrar={() => setAbierto(false)} />
            )}
        </div>
    );
};

export default PanelRanking;
