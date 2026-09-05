import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import PublicSetterStatsPage from '../../public/PublicSetterStatsPage';
import PublicCloserStatsPage from '../../public/PublicCloserStatsPage';
import PublicTriageStatsPage from '../../public/PublicTriageStatsPage';
import WorkshopDashboardPage from '../workshop/WorkshopDashboardPage';

const AdminSalesHubPage = () => {
    const { user } = useAuth();
    // Workshop es contenido de Marketing (director_marketing lo ve en /admin/workshops):
    // director_comercial se enfoca solo en closing y setting, así que no ve esta pestaña acá.
    // Admin conserva las 3, para seguir viendo todo desde un solo lugar.
    const puedeVerWorkshops = user?.role === 'admin';
    const [tab, setTab] = useState('closer');

    return (
        <div className="relative bg-background min-h-screen">
            <div className="fixed top-8 right-8 z-[100] flex gap-2 bg-surface p-1.5 rounded-2xl border border-base/50 shadow-2xl backdrop-blur-xl">
                 <button 
                    onClick={() => setTab('closer')} 
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'closer' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
                >
                    Closers
                </button>
                 <button 
                    onClick={() => setTab('setter')} 
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'setter' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
                >
                    Setters
                </button>
                 {puedeVerWorkshops && (
                     <button
                        onClick={() => setTab('workshop')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'workshop' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        Workshops
                    </button>
                 )}
            </div>

            <div className="w-full">
                {tab === 'closer' && <PublicCloserStatsPage />}
                {tab === 'setter' && <PublicSetterStatsPage />}
                {tab === 'triage' && <PublicTriageStatsPage />}
                {tab === 'workshop' && puedeVerWorkshops && <WorkshopDashboardPage />}
            </div>
        </div>
    );
};

export default AdminSalesHubPage;

