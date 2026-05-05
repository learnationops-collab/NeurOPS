import { useState } from 'react';
import { LayoutGrid, Share2 } from 'lucide-react';
import AdManagementPage from '../../public/AdManagementPage';
import UTMGenerator from '../../../components/operations/UTMGenerator';

const AdminMarketingHubPage = () => {
    const [activeTab, setActiveTab] = useState('ads');

    const tabs = [
        { id: 'ads', label: 'Gestión de Anuncios', icon: LayoutGrid },
        { id: 'utms', label: 'Generador UTM', icon: Share2 },
    ];

    return (
        <div className="relative bg-background min-h-screen space-y-6">
            {/* Tab Selector */}
            <div className="p-8 pb-0">
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
            </div>

            <div className="w-full">
                {activeTab === 'ads' ? (
                    <AdManagementPage />
                ) : (
                    <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <UTMGenerator />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminMarketingHubPage;
