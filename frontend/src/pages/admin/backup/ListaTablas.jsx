import React from 'react';
import ListaConfigurable from '../../../components/listas/ListaConfigurable';
import '../../comercial/comercial.css';

/* Tablas de la base y su cantidad de registros: la vista previa de Respaldo. */
const COLUMNAS = [
    { key: 'tabla', header: 'Tabla', width: 'minmax(0,1fr)', fija: true, valor: (t) => t.name,
        render: (t) => <span className="trunc font-mono text-xs text-purple-300">{t.name}</span> },
    { key: 'registros', header: 'Registros', alinear: 'der', width: '110px', valor: (t) => t.count,
        render: (t) => <b>{t.count}</b> },
];

const ListaTablas = ({ tablas, claveGuardado }) => (
    <div className="dc-shell dc-shell--embebido">
        <ListaConfigurable columnas={COLUMNAS} filas={tablas} clave={(t) => t.name}
            buscar={(t) => t.name} buscarPlaceholder="Buscar tabla…" claveGuardado={claveGuardado}
            ordenInicial={{ key: 'registros', dir: 'desc' }} vacio="No hay tablas para mostrar." />
    </div>
);

export default ListaTablas;
