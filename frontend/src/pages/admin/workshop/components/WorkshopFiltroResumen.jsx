import { Check, SlidersHorizontal } from 'lucide-react';
import { FILTRO_TODOS, filtrarTalleres } from '../filtroTalleres';

/**
 * Qué talleres analiza el Resumen (16/10/2026): todos, los últimos N, los de un período o los que se
 * eligen a mano. Las tarjetas y el diagnóstico de abajo se calculan solo con esos. La lógica (y contra
 * qué se compara cada modo) vive en `filtroTalleres.js`.
 */

const MODOS = [
    { modo: 'todos', etiqueta: 'Todos' },
    { modo: 'ultimos', etiqueta: 'Últimos' },
    { modo: 'periodo', etiqueta: 'Período' },
    { modo: 'elegidos', etiqueta: 'Elegir talleres' },
];
const CANTIDADES = [3, 5, 10];

const WorkshopFiltroResumen = ({ talleres, filtro, onCambiar, formatDate, cantidad, cantidadAnterior }) => {
    const ordenados = filtrarTalleres(talleres, FILTRO_TODOS);
    const opciones = CANTIDADES.filter((n) => n < ordenados.length);

    // Al cambiar de modo se arranca de lo que ya se estaba mirando, no de cero.
    const cambiarModo = (modo) => {
        if (modo === filtro.modo) return;
        const actuales = filtrarTalleres(talleres, filtro);
        if (modo === 'todos') onCambiar(FILTRO_TODOS);
        else if (modo === 'ultimos') onCambiar({ modo, n: opciones.includes(5) ? 5 : (opciones[opciones.length - 1] || 1) });
        else if (modo === 'periodo') {
            const base = filtro.modo === 'todos' ? ordenados.slice(0, 4) : actuales;
            onCambiar({ modo, desde: base[base.length - 1]?.date || '', hasta: base[0]?.date || '' });
        } else onCambiar({ modo, ids: actuales.map((t) => t.id) });
    };

    const elegidos = new Set(filtro.ids || []);
    const alternarTaller = (id) => {
        const ids = elegidos.has(id) ? [...elegidos].filter((x) => x !== id) : [...elegidos, id];
        onCambiar({ ...filtro, ids });
    };

    return (
        <section className="panel ws-filtro" aria-label="Qué talleres analizar">
            <div className="ws-filtro-fila">
                <div className="ws-filtro-modo">
                    <p className="eyebrow"><SlidersHorizontal size={12} aria-hidden="true" /> Analizar</p>
                    <div className="pill-toggle" role="group" aria-label="Qué talleres analizar">
                        {MODOS.map((m) => (
                            <button key={m.modo} type="button" className={filtro.modo === m.modo ? 'active' : ''}
                                aria-pressed={filtro.modo === m.modo} onClick={() => cambiarModo(m.modo)}>
                                {m.etiqueta}
                            </button>
                        ))}
                    </div>
                </div>

                {filtro.modo === 'ultimos' && (
                    <div className="ws-filtro-controles">
                        <span>Cantidad de talleres</span>
                        <div className="pill-toggle" role="group" aria-label="Cantidad de talleres">
                            {[...opciones, ordenados.length].map((n) => (
                                <button key={n} type="button" className={filtro.n === n ? 'active' : ''}
                                    aria-pressed={filtro.n === n} onClick={() => onCambiar({ ...filtro, n })}>
                                    {n === ordenados.length ? `Los ${n}` : n}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {filtro.modo === 'periodo' && (
                    <div className="ws-filtro-controles ws-filtro-fechas">
                        <label>
                            <span>Desde</span>
                            <input type="date" value={filtro.desde} max={filtro.hasta || undefined}
                                onChange={(e) => onCambiar({ ...filtro, desde: e.target.value })} />
                        </label>
                        <label>
                            <span>Hasta</span>
                            <input type="date" value={filtro.hasta} min={filtro.desde || undefined}
                                onChange={(e) => onCambiar({ ...filtro, hasta: e.target.value })} />
                        </label>
                    </div>
                )}

                {filtro.modo === 'elegidos' && (
                    <div className="ws-filtro-controles ws-filtro-acciones">
                        <button type="button" className="text-action" onClick={() => onCambiar({ ...filtro, ids: ordenados.map((t) => t.id) })}>
                            Marcar todos
                        </button>
                        <button type="button" className="text-action" onClick={() => onCambiar({ ...filtro, ids: [] })}>
                            Ninguno
                        </button>
                    </div>
                )}
            </div>

            {filtro.modo === 'elegidos' && (
                <div className="ws-filtro-talleres" role="group" aria-label="Talleres a analizar">
                    {ordenados.map((t) => (
                        <label key={t.id} className={elegidos.has(t.id) ? 'elegido' : ''}>
                            <input type="checkbox" checked={elegidos.has(t.id)} onChange={() => alternarTaller(t.id)} />
                            <i aria-hidden="true"><Check size={11} /></i>
                            <span>
                                <strong>{formatDate(t.date)}</strong>
                                <small>{t.name}</small>
                            </span>
                            <b>{(t.roas || 0).toFixed(2)}x</b>
                        </label>
                    ))}
                </div>
            )}

            <p className="ws-filtro-nota" role="status">
                {cantidad === 0
                    ? 'Ningún taller en esta selección.'
                    : `${cantidad} ${cantidad === 1 ? 'taller' : 'talleres'} en el análisis`}
                {cantidadAnterior
                    ? ` · las flechas comparan el promedio por taller con ${filtro.modo === 'ultimos'
                        ? `los ${cantidadAnterior} anteriores`
                        : `el período anterior del mismo largo (${cantidadAnterior} ${cantidadAnterior === 1 ? 'taller' : 'talleres'})`}`
                    : ''}
            </p>
        </section>
    );
};

export default WorkshopFiltroResumen;
