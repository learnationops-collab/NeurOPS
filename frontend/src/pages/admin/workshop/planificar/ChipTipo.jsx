import { Flame, Snowflake } from 'lucide-react';
import { Chip } from '../../../../components/standard';
import { TIPOS } from './grupos';

const ICONO = { frio: Snowflake, caliente: Flame };

/** El tipo de un taller como etiqueta. Sin tipo no dibuja nada, salvo con `aviso` (un taller por delante). */
const ChipTipo = ({ tipo, aviso = false }) => {
    const t = TIPOS[tipo];
    if (!t) return aviso ? <Chip color="var(--warning)" data-tip="Falta elegir si es frío o caliente">Sin tipo</Chip> : null;
    const Icono = ICONO[tipo];
    return <Chip color={t.color} icon={<Icono aria-hidden="true" />} data-tip={t.ayuda}>{t.texto}</Chip>;
};

export default ChipTipo;
