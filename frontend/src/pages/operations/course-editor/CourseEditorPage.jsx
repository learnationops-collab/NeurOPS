import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, GraduationCap, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import AreaGrid from './AreaGrid';
import AreaDetail from './AreaDetail';
import './course-editor.css';

const ACCENT_CYCLE = ['magenta', 'blue', 'green'];

const CourseEditorPage = () => {
    const navigate = useNavigate();
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [openRoadmapId, setOpenRoadmapId] = useState(null);

    const fetchOverview = () => {
        api.get('/playbook/admin/overview')
            .then((res) => setOverview(res.data))
            .catch(() => toast.error('No se pudo cargar el Editor de curso'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchOverview(); }, []);

    const createArea = async (name) => {
        try {
            await api.post('/playbook/roadmaps', { name, accent: ACCENT_CYCLE[(overview?.roadmaps.length || 0) % 3] });
            fetchOverview();
        } catch {
            toast.error('No se pudo crear el área');
        }
    };

    const deleteArea = async (roadmap) => {
        if (!window.confirm(`¿Eliminar el área "${roadmap.name}" con todos sus módulos y lecciones?`)) return;
        try {
            await api.delete(`/playbook/roadmaps/${roadmap.id}`);
            if (openRoadmapId === roadmap.id) setOpenRoadmapId(null);
            fetchOverview();
        } catch {
            toast.error('No se pudo eliminar el área');
        }
    };

    const openRoadmap = openRoadmapId ? overview?.roadmaps.find((r) => r.id === openRoadmapId) : null;

    return (
        <div className="ce-shell">
            <div className="ce-page">
                <div className="ce-header">
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><GraduationCap size={26} /> Editor de curso</h1>
                    <button type="button" className="ce-back-btn" onClick={() => navigate('/ops/dashboard')}>
                        <ArrowLeft size={14} /> Operaciones
                    </button>
                </div>

                {loading ? (
                    <div className="ce-loading"><Loader2 size={28} className="animate-spin" /><p>Cargando el Playbook…</p></div>
                ) : openRoadmap ? (
                    <AreaDetail roadmap={openRoadmap} overview={overview} onBack={() => setOpenRoadmapId(null)} onRefetch={fetchOverview} />
                ) : (
                    <AreaGrid roadmaps={overview?.roadmaps || []} onEnter={(r) => setOpenRoadmapId(r.id)} onDelete={deleteArea} onCreate={createArea} />
                )}
            </div>
        </div>
    );
};

export default CourseEditorPage;
