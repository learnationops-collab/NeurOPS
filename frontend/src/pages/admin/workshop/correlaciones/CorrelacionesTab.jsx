import React, { useMemo, useState } from 'react';
import { Button, EmptyState, Segmented, Select, Skeleton, SkeletonBlock } from '../../../../components/standard';
import { Tip } from '../../../comercial/components/Shared';
import { EnCabecera } from '../components/CabeceraWorkshop';
import MapaCalor from './MapaCalor';
import RankingObjetivo from './RankingObjetivo';
import Dispersion from './Dispersion';
import useCorrelaciones from './useCorrelaciones';
import {
    METODOS, TIP_LIGADA, TIP_METODO, etiquetaConfianza, formatoR, frasePar, setLigadas, valorDe,
} from './correlaciones';
import './correlaciones.css';

const VENTANAS = [
    { value: 0, label: 'Todos los talleres' },
    { value: 6, label: 'Últimos 6' },
    { value: 10, label: 'Últimos 10' },
    { value: 15, label: 'Últimos 15' },
];

const OBJETIVO_INICIAL = 'cash_collected';
// Lo que Kerwin quiere ver de entrada: show up del taller contra cash collected.
const PAR_INICIAL = { a: 'show_up_workshop', b: 'cash_collected' };

// Atajos a los pares que más se piden; el resto se elige en el mapa o en el ranking.
const ATAJOS = [
    { label: 'Show up vs cash', par: { a: 'show_up_workshop', b: 'cash_collected' } },
    { label: 'Show up: taller vs citas', par: { a: 'show_up_workshop', b: 'show_up_citas' } },
    { label: 'Show up vs close rate', par: { a: 'show_up_workshop', b: 'close_rate' } },
];

const EsqueletoCorrelaciones = () => (
    <Skeleton label="Calculando las correlaciones…" className="wc-esqueleto">
        <SkeletonBlock height={420} radius={16} />
        <SkeletonBlock height={420} radius={16} step={1} />
    </Skeleton>
);

/**
 * Correlaciones: qué métricas de los talleres se mueven parecido entre sí (por ejemplo, show up
 * contra cash collected). Es exploración, no una conclusión: con pocos talleres y tantas parejas
 * comparadas, algunas salen fuertes por azar, y una correlación no dice quién causa a quién.
 */
const CorrelacionesTab = () => {
    const [ventana, setVentana] = useState(0);
    const [metodo, setMetodo] = useState('pearson');
    const [objetivo, setObjetivo] = useState(OBJETIVO_INICIAL);
    const [par, setPar] = useState(PAR_INICIAL);
    const { datos, falla, recargando, reintentar } = useCorrelaciones(ventana);

    const metricas = datos?.metricas;
    const porClave = useMemo(
        () => Object.fromEntries((metricas || []).map((m) => [m.key, m])), [metricas]);

    // Elegir una métrica en el ranking cambia el par y, si es otro objetivo, también el ranking.
    const elegir = (a, b) => setPar({ a, b });
    const ligadas = useMemo(() => setLigadas(datos?.ligadas), [datos]);

    const filtros = (
        <EnCabecera>
            <div className="wc-filtros">
                <Select value={ventana} options={VENTANAS} onChange={setVentana} size="sm" label="Talleres a analizar" />
                <Segmented value={metodo} options={METODOS} onChange={setMetodo} size="sm" label="Método" />
                <Tip titulo="Método" texto={TIP_METODO} />
            </div>
        </EnCabecera>
    );

    if (falla && !datos) {
        return (
            <div className="dc-shell dc-shell--embebido">
                {filtros}
                <EmptyState title="No se pudieron calcular las correlaciones"
                    action={<Button onClick={reintentar}>Reintentar</Button>}>
                    Revisá la conexión y volvé a intentar.
                </EmptyState>
            </div>
        );
    }
    if (!datos) {
        return <div className="dc-shell dc-shell--embebido">{filtros}<EsqueletoCorrelaciones /></div>;
    }

    // Los avisos de lectura van en un tooltip del mapa (antes, un panel arriba de todo).
    const aviso = [...datos.avisos, ...datos.notas, `${datos.n_talleres} talleres realizados en el análisis.`].join(' ');
    const celdaPar = datos.matriz[par.a]?.[par.b];
    const a = porClave[par.a];
    const b = porClave[par.b];
    const r = valorDe(celdaPar, metodo);

    return (
        <div className="dc-shell dc-shell--embebido">
            {filtros}
            <div className={`vista wc-vista${recargando ? ' wc-recargando' : ''}`}>
                {datos.n_talleres < 3 ? (
                    <section className="panel wc-vacio" role="status">
                        <p className="t-h3">Todavía no hay datos para correlacionar</p>
                        <p className="t-sm mut">Hacen falta al menos 3 talleres realizados.</p>
                    </section>
                ) : (
                    <div className="wc-cuerpo">
                        <section className="panel wc-panel wc-panel--mapa">
                            <div className="panel-cab">
                                <h3 className="t-h3">Mapa de correlaciones</h3>
                                <Tip titulo="Cómo leerlo"
                                    texto="Verde: suben juntas. Rojo: una sube y la otra baja. Clic para ver el par." />
                                <Tip titulo="Leelo con cuidado" texto={aviso} />
                            </div>
                            <MapaCalor metricas={datos.metricas} matriz={datos.matriz} metodo={metodo} par={par}
                                onElegir={elegir} ligadas={ligadas} />
                            <p className="wc-leyenda">
                                <i className="wc-leyenda-neg" /> −1 <i className="wc-leyenda-cero" /> 0
                                <i className="wc-leyenda-pos" /> +1 · <i className="wc-firme wc-firme--ley" /> menos probable que sea azar · borde punteado: por construcción
                            </p>
                        </section>

                        <div className="wc-lado">
                            <section className="panel wc-panel">
                                <RankingObjetivo metricas={datos.metricas} matriz={datos.matriz} metodo={metodo}
                                    objetivo={objetivo} onObjetivo={(k) => { setObjetivo(k); setPar({ a: k, b: par.b === k ? par.a : par.b }); }}
                                    par={par} onElegir={elegir} ligadas={ligadas} />
                                <div className="wc-atajos">
                                    {ATAJOS.map((t) => (
                                        <Button key={t.label} variant="ghost" size="sm" onClick={() => setPar(t.par)}>
                                            {t.label}
                                        </Button>
                                    ))}
                                </div>
                            </section>

                            {a && b && (
                                <section className="panel wc-panel wc-par">
                                    <div className="panel-cab">
                                        <h3 className="t-h3">{a.label} vs {b.label}</h3>
                                        <div className="panel-cab-der">
                                            <span className="chip num">{formatoR(r)}</span>
                                            <span className="wc-n">n={celdaPar?.n ?? 0} · {etiquetaConfianza(celdaPar?.confianza)}</span>
                                        </div>
                                    </div>
                                    <p className="t-sm mut wc-frase">{frasePar(a.label, b.label, celdaPar, metodo)}
                                        {ligadas.has(`${par.a}|${par.b}`) && ` ${TIP_LIGADA}`}</p>
                                    <Dispersion talleres={datos.talleres} a={a} b={b} />
                                </section>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CorrelacionesTab;
