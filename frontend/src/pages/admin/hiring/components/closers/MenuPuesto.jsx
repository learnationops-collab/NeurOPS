import React from 'react';
import { Select } from '../../../../../components/standard';
import { PUESTOS } from '../../lib/closers';

/** Al lado del título (Inbox, Analyze, Winners y Stats): qué búsqueda se revisa (1 Asistentes, 2 Closers) y cuántos esperan en cada una. */
const MenuPuesto = ({ valor, cuentas, onCambiar }) => (
    <Select className="tl-puesto" size="sm" label="Búsqueda" value={valor} onChange={onCambiar}
        options={PUESTOS.map((p) => ({
            value: p.id,
            label: `${p.label} · ${cuentas[p.id] ?? 0}`,
            icon: <b className="tl-puesto-n">{p.n}</b>,
            iconColor: p.c,
        }))} />
);

export default MenuPuesto;
