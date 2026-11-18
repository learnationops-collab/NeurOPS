/**
 * El programa de una campaña de Meta (Leadership 1395, ADR-W177): se elige una vez por campaña y vale para todos sus
 * anuncios. Con él, el gasto entra al CAC y al ROAS de ese programa en «Programas y segmentos». «Varios programas»
 * la marca como revisada sin cargarle el gasto a ninguno. No hay detección automática: lo decide una persona.
 */
export const PROGRAMAS_META = [
    { key: 'AL', label: 'Ace Learners' },
    { key: 'RR', label: 'Residency Roadmap' },
    { key: 'SI', label: 'Specialist Initiative' },
    { key: 'general', label: 'Varios programas' },
];
const SIN = '__sin';

export const etiquetaDePrograma = (key) => PROGRAMAS_META.find((p) => p.key === key)?.label || 'Sin etiquetar';

const SelectorPrograma = ({ campana, guardando, onElegir }) => (
    <select className="mk-select" value={campana.programa || SIN} disabled={guardando === `campana:${campana.campana_id}`}
        aria-label={`Programa de la campaña ${campana.nombre}`}
        onChange={(e) => onElegir(campana, e.target.value === SIN ? null : e.target.value)}>
        <option value={SIN}>Sin etiquetar</option>
        {PROGRAMAS_META.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
    </select>
);

export default SelectorPrograma;
