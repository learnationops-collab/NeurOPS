import { useState, useEffect } from 'react';
import CloserPerformanceReport from '../components/CloserPerformanceReport';
import SetterPerformanceReport from '../components/SetterPerformanceReport';

const AnalysisPage = ({ defaultTab = 'closers' }) => {
    const [activeTab, setActiveTab] = useState(defaultTab);

    useEffect(() => {
        setActiveTab(defaultTab);
    }, [defaultTab]);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-white italic tracking-tighter">Análisis de Ventas</h1>
                    <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Rendimiento de Equipo Comercial</p>
                </div>

                <div className="flex bg-slate-900/40 p-1.5 rounded-[2rem] border border-slate-800">
                    <button
                        onClick={() => setActiveTab('closers')}
                        className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'closers'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                            : 'text-slate-500 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        Closers
                    </button>
                    <button
                        id="tab-setters"
                        onClick={() => setActiveTab('setters')}
                        className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'setters'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                            : 'text-slate-500 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        Setters
                    </button>
                </div>
            </header>

            {activeTab === 'closers' ? (
                <CloserPerformanceReport />
            ) : (
                <SetterPerformanceReport />
            )}
        </div>
    );
};

export default AnalysisPage;
