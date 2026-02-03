import { useState } from 'react';
import { Database, Trash2, Zap, RefreshCw, CheckCircle, AlertTriangle, FileUp, Download, Upload } from 'lucide-react';
import axios from 'axios';
import Button from '../../../components/ui/Button';
import Card, { CardHeader, CardContent } from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import AdvancedImportTool from '../../../components/AdvancedImportTool';

const OperationsPage = () => {
    const [activeTab, setActiveTab] = useState('tools');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [counts, setCounts] = useState({ leads: 20, agendas: 15, sales: 5 });

    const handleClear = async () => {
        if (!window.confirm("¿ESTÁS SEGURO? Esta acción borrará todos los leads, agendas y ventas de forma irreversible.")) return;

        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await axios.post('/api/admin/ops/clear');
            setMessage({ type: 'success', text: res.data.message });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error al limpiar base de datos' });
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await axios.post('/api/admin/ops/generate', counts);
            setMessage({ type: 'success', text: res.data.message });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error al generar datos' });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await axios.get('/api/admin/db/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            const filename = `neurops_backup_${new Date().toISOString().split('T')[0]}.json`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setMessage({ type: 'success', text: 'Base de datos exportada correctamente. Revisa tus descargas.' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Error al exportar base de datos.' });
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.confirm("¿IMPORTAR BASE DE DATOS? Esto reemplazará todos los datos actuales por los del archivo. Esta acción es irreversible.")) return;

        setLoading(true);
        setMessage({ type: '', text: '' });
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post('/api/admin/db/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMessage({ type: 'success', text: res.data.message });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || 'Error al importar base de datos.' });
        } finally {
            setLoading(false);
            e.target.value = ''; // Reset input
        }
    };

    const inputClass = "w-full bg-main border border-base rounded-2xl px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold";

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-base italic tracking-tighter flex items-center gap-3">
                        <Database className="text-primary" />
                        Operaciones de Sistema
                    </h1>
                    <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Gestión de datos masivos y herramientas de desarrollo</p>
                </div>
                <div className="flex bg-surface p-1 rounded-2xl border border-base">
                    <button
                        onClick={() => setActiveTab('tools')}
                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'tools' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-base'}`}
                    >
                        <Zap size={14} />
                        Herramientas
                    </button>
                    <button
                        onClick={() => setActiveTab('import_general')}
                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'import_general' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-base'}`}
                    >
                        <FileUp size={14} />
                        Importación General
                    </button>
                    <button
                        onClick={() => setActiveTab('import_setters')}
                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'import_setters' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-base'}`}
                    >
                        <Database size={14} />
                        Importación Setters
                    </button>
                </div>
            </header>

            {activeTab === 'tools' ? (
                <>
                    {message.text && (
                        <div className={`p-5 rounded-2xl flex items-center gap-4 border transition-all ${message.type === 'success' ? 'bg-success/10 text-success border-success/20' : 'bg-accent/10 text-accent border-accent/20'}`}>
                            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                            <span className="text-[10px] font-black uppercase tracking-widest leading-relaxed">{message.text}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Mock Data Generator */}
                        <Card variant="surface" className="relative group">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-4 bg-primary/10 rounded-2xl">
                                    <Zap className="text-primary" size={24} />
                                </div>
                                <h2 className="text-xl font-black text-base italic tracking-tighter uppercase">Generador de Datos Ficticios</h2>
                            </div>

                            <div className="space-y-6 mb-10">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Cant. de Leads (Clientes)</label>
                                    <input
                                        type="number"
                                        value={counts.leads}
                                        onChange={(e) => setCounts({ ...counts, leads: parseInt(e.target.value) })}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Cant. de Agendas</label>
                                    <input
                                        type="number"
                                        value={counts.agendas}
                                        onChange={(e) => setCounts({ ...counts, agendas: parseInt(e.target.value) })}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Cant. de Ventas (Enrollments)</label>
                                    <input
                                        type="number"
                                        value={counts.sales}
                                        onChange={(e) => setCounts({ ...counts, sales: parseInt(e.target.value) })}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={handleGenerate}
                                loading={loading}
                                variant="primary"
                                className="w-full h-16"
                                icon={Zap}
                            >
                                Generar Datos de Prueba
                            </Button>
                            <p className="text-[10px] text-muted mt-6 text-center font-bold uppercase tracking-widest opacity-50">
                                * Los datos se distribuirán aleatoriamente entre los Closers.
                            </p>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
                        {/* Backup & Restore Tool */}
                        <Card variant="surface" className="relative group">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-4 bg-secondary/10 rounded-2xl">
                                    <Database className="text-secondary" size={24} />
                                </div>
                                <h2 className="text-xl font-black text-base italic tracking-tighter uppercase">Backup & Restauración</h2>
                            </div>

                            <p className="text-muted mb-10 leading-relaxed font-bold uppercase text-[10px] tracking-widest">
                                Exporta toda la base de datos a un archivo JSON o restaura un respaldo anterior.
                                <span className="text-accent ml-1 italic">* La restauración borrará los datos actuales.</span>
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <Button
                                    onClick={handleExport}
                                    loading={loading}
                                    variant="secondary"
                                    className="flex-1 h-16"
                                    icon={Download}
                                >
                                    Descargar Backup
                                </Button>

                                <div className="flex-1 relative">
                                    <input
                                        type="file"
                                        accept=".json"
                                        onChange={handleImport}
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        disabled={loading}
                                    />
                                    <Button
                                        variant="outline"
                                        className="w-full h-16 pointer-events-none"
                                        icon={Upload}
                                        loading={loading}
                                    >
                                        Importar JSON
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* Danger Zone */}
                        <Card variant="surface" className="relative group border-accent/20">
                            <div className="absolute top-8 right-8">
                                <Badge variant="accent" className="font-black px-4 py-1.5">PELIGRO</Badge>
                            </div>

                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-4 bg-accent/10 rounded-2xl">
                                    <Trash2 className="text-accent" size={24} />
                                </div>
                                <h2 className="text-xl font-black text-base italic tracking-tighter uppercase">Zona de Limpieza</h2>
                            </div>

                            <p className="text-muted mb-10 leading-relaxed font-bold uppercase text-[10px] tracking-widest">
                                Esta herramienta eliminará <span className="text-base">TODOS</span> los registros de Clientes, Agendas, Ventas, Pagos y Encuestas.
                                Los usuarios administradores y closers <span className="text-base">NO</span> serán afectados.
                            </p>

                            <div className="p-5 bg-accent/5 rounded-2xl border border-accent/10 mb-10">
                                <div className="flex gap-4 text-accent">
                                    <AlertTriangle size={20} className="shrink-0" />
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-relaxed">Esta acción es irreversible. Se recomienda usar solo en entornos de desarrollo o pruebas.</span>
                                </div>
                            </div>

                            <Button
                                onClick={handleClear}
                                loading={loading}
                                variant="ghost"
                                className="w-full h-16 border-accent/20 text-accent hover:bg-accent hover:text-white hover:border-accent"
                                icon={Trash2}
                            >
                                Limpiar Base de Datos
                            </Button>
                        </Card>
                    </div>
                </>
            ) : activeTab === 'import_general' ? (
                <AdvancedImportTool targetFilter={['leads', 'sales', 'agendas']} />
            ) : (
                <AdvancedImportTool targetFilter={['setters']} />
            )}
        </div>
    );
};

export default OperationsPage;
