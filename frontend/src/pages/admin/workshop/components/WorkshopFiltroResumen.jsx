import React from 'react';
import { Check, Layers } from 'lucide-react';
import { PillMenu, fmt } from '../../../comercial/components/Shared';
import RangoFechas, { esFecha, rangoAnterior, textoRango } from '../../../comercial/components/RangoFechas';
import { COMPARACIONES, FILTRO_TODOS, filtrarTalleres, rangoDeSeleccion } from '../filtroTalleres';

/**
 * Las dos pastillas del Resumen, como las de la cabecera del dashboard comercial: qué talleres se
 * analizan (todos, los últimos N, un período o elegidos a mano) y contra qué se comparan («VS»).
 * La lógica vive en `filtroTalleres.js`; acá solo se elige.
 *
 * Período, «Elegir talleres» y «Personalizado» dejan el menú abierto con lo que hace falta debajo
 * (las fechas o la lista de talleres).
 */

const CANTIDADES = [3, 5, 10, 20];

const talleresTexto = (n) => fmt.plural(n, 'taller', 'talleres');

/** La lista de talleres con su casilla: la de «Elegir talleres» de las dos pastillas. */
export const ListaTalleres = ({ talleres, elegidos, onCambiar, rotulo }) => {
    const marcados = new Set(elegidos || []);
    const alternar = (id) => onCambiar(marcados.has(id) ? [...marcados].filter((x) => x !== id) : [...marcados, id]);
    return (
        <div className="wr-lista" role="group" aria-label={rotulo}>
            <div className="wr-lista-acc">
                <button type="button" className="wr-lista-btn" onClick={() => onCambiar(talleres.map((t) => t.id))}>Todos</button>
                <button type="button" className="wr-lista-btn" onClick={() => onCambiar([])}>Ninguno</button>
                <span className="wr-lista-cuenta num">{marcados.size}/{talleres.length}</span>
            </div>
            <div className="wr-lista-filas">
                {talleres.map((t) => (
                    <label key={t.id} className={`wr-lista-fila${marcados.has(t.id) ? ' wr-lista-fila--on' : ''}`}>
                        <input type="checkbox" checked={marcados.has(t.id)} onChange={() => alternar(t.id)} />
                        <i aria-hidden="true"><Check size={11} /></i>
                        <span className="wr-lista-dia num">{fmt.fecha(t.date)}</span>
                        <span className="wr-lista-nombre trunc" title={t.name}>{t.name}</span>
                        <span className="wr-lista-roas num">{(t.roas || 0).toFixed(2)}x</span>
                    </label>
                ))}
            </div>
        </div>
    );
};

const WorkshopFiltroResumen = ({ talleres, filtro, comparacion, comparado, onFiltro, onComparacion }) => {
    const ordenados = filtrarTalleres(talleres, FILTRO_TODOS);
    const analizados = filtrarTalleres(talleres, filtro);
    const rangoSel = rangoDeSeleccion(talleres, filtro);

    // ---- Qué se analiza
    const cantidades = CANTIDADES.filter((n) => n < ordenados.length);
    if (filtro.modo === 'ultimos' && !cantidades.includes(filtro.n)) cantidades.push(filtro.n);
    cantidades.sort((a, b) => a - b);
    const claveFiltro = filtro.modo === 'ultimos' ? `u${filtro.n}` : filtro.modo;
    const opcionesFiltro = [
        { key: 'todos', label: 'Todos los talleres' },
        ...cantidades.map((n) => ({ key: `u${n}`, label: `Últimos ${n}` })),
        { key: 'periodo', label: 'Período', quedaAbierto: true },
        { key: 'elegidos', label: 'Elegir talleres', quedaAbierto: true },
    ];

    // Al cambiar de modo se arranca de lo que ya se estaba mirando, no de cero.
    const elegirFiltro = (key) => {
        if (key === claveFiltro) return;
        if (key === 'todos') onFiltro(FILTRO_TODOS);
        else if (key.startsWith('u')) onFiltro({ modo: 'ultimos', n: Number(key.slice(1)) });
        else if (key === 'periodo') {
            const base = filtro.modo === 'todos' ? ordenados.slice(0, 4) : analizados;
            onFiltro({ modo: 'periodo', desde: base[base.length - 1]?.date || '', hasta: base[0]?.date || '' });
        } else onFiltro({ modo: 'elegidos', ids: analizados.map((t) => t.id) });
    };

    const textoFiltro = filtro.modo === 'ultimos' ? `Últimos ${filtro.n}`
        : filtro.modo === 'periodo' ? (rangoSel ? textoRango(rangoSel) : 'Período')
            : filtro.modo === 'elegidos' ? `${analizados.length} elegidos`
                : 'Todos los talleres';

    const pieFiltro = filtro.modo === 'periodo' ? (
        <RangoFechas rotulo="Período" desde={filtro.desde} hasta={filtro.hasta}
            onCambiar={({ desde, hasta }) => {
                if (esFecha(desde) && esFecha(hasta)) onFiltro({ modo: 'periodo', desde, hasta });
            }} />
    ) : filtro.modo === 'elegidos' ? (
        <ListaTalleres talleres={ordenados} elegidos={filtro.ids} rotulo="Talleres a analizar"
            onCambiar={(ids) => onFiltro({ modo: 'elegidos', ids })} />
    ) : null;

    // ---- Contra qué
    const opcionesVs = COMPARACIONES.map((c) => ({
        ...c,
        label: c.key === 'anteriores' && analizados.length ? `Los ${analizados.length} anteriores` : c.label,
        quedaAbierto: c.key === 'custom' || c.key === 'elegidos',
    }));

    const elegirComparacion = (key) => {
        if (key === comparacion.modo) return;
        if (key === 'custom') {
            const inicial = comparado?.rango || (rangoSel ? rangoAnterior(rangoSel) : { desde: '', hasta: '' });
            onComparacion({ modo: 'custom', desde: inicial.desde, hasta: inicial.hasta });
        } else if (key === 'elegidos') {
            onComparacion({ modo: 'elegidos', ids: (comparado?.talleres || []).map((t) => t.id) });
        } else onComparacion({ modo: key });
    };

    const textoVs = comparacion.modo === 'none' ? 'Sin comparar'
        : comparacion.modo === 'custom' && comparado ? textoRango(comparado.rango)
            : opcionesVs.find((o) => o.key === comparacion.modo)?.label;
    const detalleVs = comparacion.modo === 'none' ? null
        : comparado ? talleresTexto(comparado.talleres.length) : 'sin talleres';

    const pieVs = comparacion.modo === 'custom' ? (
        <RangoFechas rotulo="Comparación" desde={comparacion.desde} hasta={comparacion.hasta}
            onCambiar={({ desde, hasta }) => {
                if (esFecha(desde) && esFecha(hasta)) onComparacion({ modo: 'custom', desde, hasta });
            }} />
    ) : comparacion.modo === 'elegidos' ? (
        <ListaTalleres talleres={ordenados} elegidos={comparacion.ids} rotulo="Talleres a comparar"
            onCambiar={(ids) => onComparacion({ modo: 'elegidos', ids })} />
    ) : null;

    const conLista = (modo) => modo === 'elegidos' ? 340 : modo === 'periodo' || modo === 'custom' ? 324 : 240;

    return (
        <div className="wr-filtros" role="group" aria-label="Qué talleres analizar">
            <PillMenu icono={<Layers />} rotulo="talleres" texto={textoFiltro}
                detalle={talleresTexto(analizados.length)}
                opciones={opcionesFiltro} valor={claveFiltro} onChange={elegirFiltro}
                ancho={conLista(filtro.modo)} pie={pieFiltro} />
            <PillMenu icono={<small className="wr-vs" aria-hidden="true">VS</small>} rotulo="comparación"
                texto={textoVs} detalle={detalleVs}
                opciones={opcionesVs} valor={comparacion.modo} onChange={elegirComparacion}
                ancho={conLista(comparacion.modo)} pie={pieVs} />
        </div>
    );
};

export default WorkshopFiltroResumen;
