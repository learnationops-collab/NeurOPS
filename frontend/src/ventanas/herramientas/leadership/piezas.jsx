// Piezas propias de Leadership rápido (solo se usan en esta ventana): la R, los arquetipos y la casilla.
import { Check, Flame, Landmark, FileText, Moon, Sprout, TrendingUp, Zap } from 'lucide-react';
import { Chip } from '../../../components/standard';
import { COLOR_R, NOMBRE_R, rDe } from './formato';

const ICONOS = { victoria: Zap, pilar: Landmark, incendio: Flame, apuesta: Sprout, mejora: TrendingUp, tramite: FileText, algun_dia: Moon };

export const RChip = ({ r, largo = false }) => (r ? (
    <Chip color={COLOR_R[r]} subtle>{largo ? `${r} · ${NOMBRE_R[r]}` : r}</Chip>
) : null);

export function Arquetipos({ arquetipos, valor, fecha, onElegir }) {
    return (
        <div className="lr-arqs" role="radiogroup" aria-label="Cómo es">
            {arquetipos.map(a => {
                const Icono = ICONOS[a.clave] || Zap;
                return (
                    <button key={a.clave} type="button" className="lr-arq" role="radio" aria-checked={valor === a.clave}
                        onClick={() => onElegir(a.clave)}>
                        <span className="lr-arq__ic"><Icono size={15} aria-hidden="true" /></span>
                        <b>{a.nombre}</b>
                        <span className="lr-arq__d">{a.descripcion}</span>
                        <span className="lr-arq__r"><RChip r={rDe(a, fecha)} /></span>
                    </button>
                );
            })}
        </div>
    );
}

/** La casilla redonda de completar (cuadrada para un ritual). */
export const Casilla = ({ hecha, onClick, label, cuadrada = false, disabled = false }) => (
    <button type="button" className={`lr-check${cuadrada ? ' lr-check--cuadro' : ''}`} aria-pressed={hecha}
        aria-label={label} title={label} onClick={onClick} disabled={disabled}>
        <Check size={13} aria-hidden="true" />
    </button>
);
