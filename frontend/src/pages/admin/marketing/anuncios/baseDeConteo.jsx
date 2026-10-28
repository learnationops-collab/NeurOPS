import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { PillMenu } from '../../../comercial/components/Shared';

/**
 * «Contar por» (Kerwin, 28/10/2026): por qué fecha se cuentan las agendas de Marketing. Con la fecha de ALTA
 * (la de siempre) se cuentan las que se crearon en el período; con la fecha de REUNIÓN, las citas que caen en
 * él, que son las de Closing, Analizar y Revisar (Setting + Workshop + Otras suman su total). Los costos y el
 * ROAS usan SIEMPRE la fecha de alta: lo que Meta gastó genera agendas al darse de alta. Las cuentas están en
 * `app/services/conteo_agendas_service.py`; acá solo se elige.
 *
 * Vive en la URL (`base`, para compartir el link) y queda recordada en el navegador para las otras
 * pestañas y la próxima visita.
 */
export const BASES = [
    { key: 'alta', label: 'Fecha de alta' },
    { key: 'reunion', label: 'Fecha de reunión' },
];
const POR_DEFECTO = 'alta';
const GUARDADO = 'mk:contar_por';

const recordada = () => {
    try { return localStorage.getItem(GUARDADO); } catch { return null; }
};
const recordar = (key) => {
    try { localStorage.setItem(GUARDADO, key); } catch { /* sin almacenamiento: queda solo en la URL */ }
};

/** `{ base, elegirBase }`: la base de la URL, si no la recordada, si no la de alta. */
export const useBaseDeConteo = () => {
    const [params, setParams] = useSearchParams();
    const deUrl = params.get('base');
    const base = [deUrl, recordada()].find((k) => BASES.some((b) => b.key === k)) || POR_DEFECTO;
    const elegirBase = useCallback((key) => {
        recordar(key);
        const siguiente = new URLSearchParams(params);
        siguiente.set('base', key);
        setParams(siguiente, { replace: true });
    }, [params, setParams]);
    return { base, elegirBase };
};

export const TEXTO_BASE = {
    alta: 'Agendas creadas en el período. Es la base de los costos y del ROAS.',
    reunion: 'Citas cuya reunión cae en el período: las mismas de Closing, Analizar y Revisar.',
};

/** El selector de la cabecera, junto al del período. */
export const SelectorBase = ({ base, onChange }) => {
    const actual = BASES.find((b) => b.key === base) || BASES[0];
    return (
        <span title={`${TEXTO_BASE[actual.key]} Los costos y el ROAS cuentan siempre por fecha de alta.`}>
            <PillMenu icono={<CalendarClock />} texto={`Contar por: ${actual.label.toLowerCase()}`} rotulo="Contar por"
                opciones={BASES} valor={base} ancho={210} onChange={onChange} />
        </span>
    );
};

export default SelectorBase;
