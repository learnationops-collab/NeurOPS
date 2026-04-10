import { useState } from 'react';
import PublicSalesAttributionPage from '../../public/PublicSalesAttributionPage';
import PublicCallsBoardPage from '../../public/PublicCallsBoardPage';

const AdminSheetsHubPage = () => {
    const [tab, setTab] = useState('sales-board');

    return (
        <div className="relative bg-background min-h-screen">
            {/* Tabs Dropdown/Selector Overlaying Top */}
            <div className="fixed top-8 right-8 z-[100] flex gap-2 bg-surface p-1.5 rounded-2xl border border-base/50 shadow-2xl backdrop-blur-xl">
                 <button 
                    onClick={() => setTab('sales-board')} 
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'sales-board' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
                >
                    Ventas DB (Atribución)
                </button>
                 <button 
                    onClick={() => setTab('calls-board')} 
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'calls-board' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
                >
                    Agendas DB (Tablero)
                </button>
            </div>
            
            <div className="w-full">
                {tab === 'sales-board' && <PublicSalesAttributionPage />}
                {tab === 'calls-board' && <PublicCallsBoardPage />}
            </div>
        </div>
    );
};

export default AdminSheetsHubPage;
