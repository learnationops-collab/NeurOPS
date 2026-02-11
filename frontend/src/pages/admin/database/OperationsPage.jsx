import { useState } from 'react';
import { Zap, MessageSquare, Database, FileUp, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import OperationsSection from '../dashboard/components/OperationsSection';
import DatabaseTools from '../dashboard/components/DatabaseTools';
import SetterMetricManager from '../../../components/admin/SetterMetricManager';

const OperationsPage = () => {
    const [activeTab, setActiveTab] = useState('messaging');

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-4 sm:p-8 font-sans selection:bg-primary/30">
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/40 p-8 rounded-[32px] border border-white/5 backdrop-blur-xl">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 mb-2">
                            <Link to="/admin" className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-muted hover:text-white group">
                                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                            </Link>
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Panel Administrativo</span>
                        </div>
                        <h1 className="text-4xl font-black text-white italic tracking-tighter flex items-center gap-3">
                            <Zap className="text-primary fill-primary/20" />
                            Operaciones
                        </h1>
                        <p className="text-muted font-bold uppercase text-[10px] tracking-[0.2em] ml-1">Configuración técnica y herramientas de sistema</p>
                    </div>

                    <div className="flex bg-black/40 p-1.5 rounded-[20px] border border-white/5 backdrop-blur-md overflow-x-auto max-w-full">
                        <button
                            onClick={() => setActiveTab('messaging')}
                            className={`px-6 py-3 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'messaging'
                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'text-muted hover:text-white'
                                }`}
                        >
                            <MessageSquare size={14} />
                            Mensajería
                        </button>
                        <button
                            onClick={() => setActiveTab('database')}
                            className={`px-6 py-3 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'database'
                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'text-muted hover:text-white'
                                }`}
                        >
                            <Database size={14} />
                            DB Tools
                        </button>
                        <button
                            onClick={() => setActiveTab('metrics')}
                            className={`px-6 py-3 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'metrics'
                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'text-muted hover:text-white'
                                }`}
                        >
                            <ListOrdered size={14} />
                            KPIs & Metricas
                        </button>
                        <button
                            onClick={() => setActiveTab('import')}
                            className={`px-6 py-3 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'import'
                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'text-muted hover:text-white'
                                }`}
                        >
                            <FileUp size={14} />
                            Importar
                        </button>
                    </div>
                </header>

                {/* Content Section */}
                <main className="animate-in fade-in zoom-in-95 duration-500 delay-150">
                    <div className="bg-slate-900/20 backdrop-blur-sm rounded-[40px] border border-white/5 p-4 sm:p-8">
                        {activeTab === 'messaging' && <OperationsSection />}
                        {activeTab === 'database' && <DatabaseTools />}
                        {activeTab === 'metrics' && <SetterMetricManager />}
                        {activeTab === 'import' && (
                            <div className="space-y-8">
                                <header className="space-y-2">
                                    <h2 className="text-2xl font-black italic text-white uppercase tracking-tight">Importación Avanzada</h2>
                                    <p className="text-xs font-bold text-muted uppercase tracking-widest">Carga masiva de datos mediante CSV/Excel</p>
                                </header>
                                <AdvancedImportTool targetFilter={['leads', 'sales', 'agendas']} />
                            </div>
                        )}
                    </div>
                </main>

                {/* Footer Info */}
                <footer className="text-center py-8">
                    <p className="text-[9px] font-bold text-muted/30 uppercase tracking-[0.5em]">
                        NeurOPS System v2.0 • Management Operations Center
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default OperationsPage;
