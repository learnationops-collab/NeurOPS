import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowRight } from 'lucide-react';
import Card from '../ui/Card';

// La gestión completa del Playbook (áreas, módulos, lecciones, quiz) vive en
// su propia pantalla full-bleed (/ops/course-editor, ver CourseEditorPage.jsx)
// desde el rediseño del panel -- acá solo queda el lanzador hacia esa ruta.
const PlaybookAdminPanel = () => {
    const navigate = useNavigate();

    return (
        <Card variant="surface" className="p-8 bg-surface/30 border-white/5 flex flex-col items-center text-center gap-4">
            <div className="p-4 rounded-2xl bg-primary/10 text-primary"><GraduationCap size={28} /></div>
            <div>
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">Playbook — Formación interna</h2>
                <p className="text-xs text-muted mt-1">Áreas, módulos, lecciones y quiz de comprensión.</p>
            </div>
            <button
                type="button"
                onClick={() => navigate('/ops/course-editor')}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
                Abrir Editor de Curso <ArrowRight size={15} />
            </button>
        </Card>
    );
};

export default PlaybookAdminPanel;
