import { useState } from 'react';
import PublicSetterStatsPage from '../../public/PublicSetterStatsPage';
import PublicCloserStatsPage from '../../public/PublicCloserStatsPage';
import PublicTriageStatsPage from '../../public/PublicTriageStatsPage';

const AdminSalesHubPage = () => {
    const [tab, setTab] = useState('closer');

    return (
        <div className="relative bg-background min-h-screen">
            {/* Tabs Dropdown/Selector Overlaying Top */}
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
                 <button 
                    onClick={() => setTab('triage')} 
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'triage' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
                >
                    Triage
                </button>
            </div>
            
            <div className="w-full">
                {tab === 'closer' && <PublicCloserStatsPage />}
                {tab === 'setter' && <PublicSetterStatsPage />}
                {tab === 'triage' && <PublicTriageStatsPage />}
            </div>
        </div>
    );
};

export default AdminSalesHubPage;
