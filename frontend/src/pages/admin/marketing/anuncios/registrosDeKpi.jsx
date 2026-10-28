import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import { formatear } from './metricas';

/**
 * Lo que se abre al tocar un KPI de la tabla de anuncios (`useVerRegistros`): las filas que lo suman, con
 * el aporte de cada una. Son las mismas filas que ve la tabla (mismos filtros y mismo nivel), así que la
 * suma de la columna es el número del KPI.
 */

const columnaNumero = (key, header, formato, moneda) => ({
    key, header, width: '120px', alinear: 'der', valor: (f) => f[key] ?? 0,
    render: (f) => formatear(f[key] ?? 0, formato, moneda),
});

// Qué columnas aporta cada KPI (la primera es la cifra del KPI). `cobrado` y los calificados explican
// de dónde sale el costo o el ROAS que va debajo de la cifra.
const POR_KPI = {
    entrantes: ['entrantes', 'calificados', 'descalificados'],
    gasto: ['gasto', 'entrantes', 'cpl'],
    agendas: ['agendas', 'entrantes', 'costo_agenda'],
    ventas: ['ventas', 'cobrado', 'costo_venta', 'roas'],
};

const COLUMNAS = (moneda) => ({
    entrantes: columnaNumero('entrantes', 'Leads entrantes', 'num'),
    calificados: columnaNumero('calificados', 'Calificados', 'num'),
    descalificados: columnaNumero('descalificados', 'Descalificados', 'num'),
    gasto: columnaNumero('gasto', 'Importe gastado', 'money', moneda),
    cpl: columnaNumero('cpl', 'Costo por lead', 'money', moneda),
    agendas: columnaNumero('agendas', 'Agendas', 'num'),
    costo_agenda: columnaNumero('costo_agenda', 'Costo por agenda', 'money', moneda),
    ventas: columnaNumero('ventas', 'Ventas', 'num'),
    cobrado: columnaNumero('cobrado', 'Cobrado', 'money', moneda),
    costo_venta: columnaNumero('costo_venta', 'Costo por venta', 'money', moneda),
    roas: columnaNumero('roas', 'ROAS', 'veces'),
});

/** `kpi`: entrantes · gasto · agendas · ventas. `nivel`: el rótulo de la primera columna. */
export const contenidoDeKpi = ({ kpi, filas, idDe, nivel, moneda }) => {
    const todas = COLUMNAS(moneda);
    const cifra = POR_KPI[kpi][0];
    const columnas = [
        { key: 'nombre', header: nivel, width: 'minmax(180px,2fr)', fija: true, valor: (f) => f.nombre,
            render: (f) => <b className="trunc">{f.nombre}</b> },
        { key: 'campana', header: 'Campaña', width: 'minmax(120px,1fr)', valor: (f) => f.campana || '—' },
        ...POR_KPI[kpi].map((k) => todas[k]),
    ];
    // Las que no aportan nada a la cifra no son parte de lo que se está abriendo.
    const aportan = filas.filter((f) => (f[cifra] ?? 0) > 0);
    return (
        <ListaConfigurable columnas={columnas} filas={aportan} clave={idDe} claveGuardado={`mk_registros_${kpi}`}
            ordenInicial={{ key: cifra, dir: 'desc' }}
            buscar={(f) => [f.nombre, f.clave, f.campana, f.conjunto].filter(Boolean).join(' ')}
            buscarPlaceholder="Buscar palabra clave o campaña" vacio="Ninguna fila aporta a esta cifra en el período." />
    );
};
