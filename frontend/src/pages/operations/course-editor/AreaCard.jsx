import * as LucideIcons from 'lucide-react';
import { ArrowRight, Trash2 } from 'lucide-react';
import { DEFAULT_ICON } from './constants';
import { chipTone } from './treeHelpers';

const ACCENT_TONE = { magenta: '', blue: 'tone-blue', green: 'tone-green' };
const ACCENT_LABEL = { magenta: 'Técnica', blue: 'Procesos', green: 'Crecimiento' };

const AreaCard = ({ roadmap, onEnter, onDelete }) => {
    const Icon = LucideIcons[roadmap.icon] || LucideIcons[DEFAULT_ICON];
    const tone = ACCENT_TONE[roadmap.accent] || '';
    const pct = roadmap.avg_progress_pct ?? 0;

    return (
        <article className="area-card">
            <div className="area-card__top">
                <span className={`area-card__icon ${tone}`}><Icon size={20} /></span>
                <span className="area-card__actions">
                    <button type="button" className="icon-btn danger" title="Eliminar área" aria-label={`Eliminar ${roadmap.name}`} onClick={(e) => { e.stopPropagation(); onDelete(roadmap); }}>
                        <Trash2 size={13} />
                    </button>
                </span>
            </div>

            <div>
                <p className="area-card__eyebrow">Área · {ACCENT_LABEL[roadmap.accent] || 'General'}</p>
                <h3 className="area-card__name">{roadmap.name}</h3>
            </div>

            <p className="area-card__desc">{roadmap.description || 'Sin descripción todavía.'}</p>

            <div className="chip-row">
                <span className="chip">{roadmap.module_count ?? 0} módulo{roadmap.module_count === 1 ? '' : 's'}</span>
                <span className="chip">{roadmap.lesson_count ?? 0} {roadmap.lesson_count === 1 ? 'lección' : 'lecciones'}</span>
                <span className={`chip tone-${chipTone(pct)}`}>{pct}% de avance</span>
            </div>

            <div className="progress-bar"><div className={`progress-bar__fill ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>

            <div className="area-card__foot">
                <span className="area-card__caption">Promedio de lecciones vistas por el equipo</span>
                <button type="button" className="area-card__enter" onClick={() => onEnter(roadmap)}>
                    Entrar <ArrowRight size={13} />
                </button>
            </div>
        </article>
    );
};

export default AreaCard;
