import { useMemo } from 'react';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import { POR_TALLER } from './cuentas';
import { dinero, numero } from '../talleres/formato';

/**
 * La lista de una cifra que se carga o sincroniza por taller (inversión, leads, pasos del embudo): una fila por taller,
 * con su valor y, abajo, el total, que es la cifra que se tocó. Donde se sabe de dónde viene el valor (Meta o a mano)
 * se dice.
 */
const fecha = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

const ContenidoPorTaller = ({ talleres, lista, titulo }) => {
    const { campo, dinero: enDinero, origen } = POR_TALLER[lista];
    const formato = enDinero ? dinero : numero;
    const columnas = useMemo(() => [
        { key: 'taller', header: 'Taller', width: 'minmax(200px,2fr)', valor: (e) => e.name },
        { key: 'fecha', header: 'Fecha', width: '110px', valor: (e) => e.date, render: (e) => fecha(e.date) },
        ...(origen ? [{ key: 'origen', header: 'Viene de', width: '110px', valor: origen }] : []),
        {
            key: 'valor', header: titulo, width: '140px', alinear: 'der', valor: (e) => Number(e[campo]) || 0,
            render: (e) => formato(e[campo] || 0),
            total: (filas) => ({ texto: formato(filas.reduce((s, e) => s + (Number(e[campo]) || 0), 0)), tipo: 'suma' }),
        },
    ], [campo, titulo, origen, formato]);
    const total = talleres.reduce((s, e) => s + (Number(e[campo]) || 0), 0);
    return (
        <>
            <p className="t-body td-fuerte" style={{ margin: '0 0 var(--s3)' }}>
                {talleres.length} {talleres.length === 1 ? 'taller' : 'talleres'} · {formato(total)}
            </p>
            <ListaConfigurable columnas={columnas} filas={talleres} clave={(e) => e.id}
                claveGuardado={`wr_registros_${lista}`} totales={{ etiqueta: 'Total', sub: (filas) => `${filas.length} talleres` }}
                buscar={(e) => e.name} buscarPlaceholder="Buscar un taller" vacio="Ningún taller en esta selección." />
        </>
    );
};

export default ContenidoPorTaller;
