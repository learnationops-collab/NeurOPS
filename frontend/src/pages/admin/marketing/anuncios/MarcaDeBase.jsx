import { CalendarRange, Presentation } from 'lucide-react';
import { Chip } from '../../../../components/standard';
import './marcaDeBase.css';

/**
 * La marca de base de un ROAS (Kerwin, 29/10/2026, ADR-W027): dos cuentas se llaman igual y no son la misma, así que cada
 * tarjeta lleva un ícono que dice sobre qué base se calculó y, al pasarle el mouse, la cuenta en una línea.
 *
 *  · `periodo`: todo lo cobrado en el período de los clientes de la fuente ÷ el gasto de Meta del período (Marketing).
 *  · `taller`: lo que trajo la cohorte de los talleres elegidos ÷ lo invertido en ellos (Workshop).
 *
 * `color`: el de la fuente (Setting rosa, Workshop azul). `detalle`: «$4.143 de $685», sin repetir el título. Una sola línea: el tooltip del DS (`[data-tip]`) no parte textos.
 */
const BASES = {
    periodo: { Icono: CalendarRange, titulo: 'Cobrado del período' },
    taller: { Icono: Presentation, titulo: 'Cohorte de los talleres' },
};

const MarcaDeBase = ({ base, color = 'var(--info)', titulo = null, detalle = '' }) => {
    const { Icono, titulo: porDefecto } = BASES[base];
    const nombre = titulo || porDefecto;
    // El tooltip (`[data-tip]::after`) va en un envoltorio: el Chip recorta lo que se sale de él.
    return (
        <span className="mk-base" data-tip={detalle ? `${nombre}: ${detalle}` : nombre} tabIndex={0} role="img"
            aria-label={`${nombre}${detalle ? `: ${detalle}` : ''}`}>
            <Chip square subtle color={color} icon={<Icono aria-hidden="true" />} />
        </span>
    );
};

export default MarcaDeBase;
