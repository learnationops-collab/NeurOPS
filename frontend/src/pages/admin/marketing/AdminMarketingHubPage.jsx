import { useState } from 'react';
import { LayoutGrid, Share2, Activity } from 'lucide-react';
import AdManagementPage from '../../public/AdManagementPage';
import UTMGenerator from '../../../components/operations/UTMGenerator';
import LandingTrafficTable from '../../../components/marketing/LandingTrafficTable';

const AdminMarketingHubPage = () => {
    const [activeTab, setActiveTab] = useState('ads');

    const tabs = [
        { id: 'ads', label: 'Gestión de Anuncios', icon: LayoutGrid },
        { id: 'utms', label: 'Generador UTM', icon: Share2 },
        { id: 'traffic', label: 'Tráfico Landings', icon: Activity },
    ];

    return (
        <div className="relative bg-background min-h-screen space-y-6">
            {/* Tab Selector & Title inline */}
            <div className="p-8 pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex gap-2 p-1 bg-surface border border-base rounded-2xl w-fit">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeTab === tab.id 
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                    : 'text-muted hover:text-white'
                            }`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Title on the top-right corner */}
                <div className="text-right pr-2 hidden md:block">
                    <p className="text-emerald-400 font-bold tracking-widest text-[9px] uppercase leading-none mb-1">NeurOPS High Performance</p>
                    <h1 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Gestor de Marketing
                    </h1>
                </div>
            </div>

            <div className="w-full">
                {activeTab === 'ads' && <AdManagementPage />}
                
                {activeTab === 'utms' && (
                    <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <UTMGenerator />
                    </div>
                )}

                {activeTab === 'traffic' && (
                    <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <LandingTrafficTable />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminMarketingHubPage;
