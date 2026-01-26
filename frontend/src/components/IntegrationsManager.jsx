import PayloadConfigModal from './PayloadConfigModal';
import { useState, useEffect } from 'react';
import api from '../services/api';
import { Key, Save, Loader2, Globe, Server, Check, AlertCircle, Trash2, Settings2 } from 'lucide-react';
import Button from './ui/Button';

const IntegrationsManager = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [integrations, setIntegrations] = useState([]);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    // Modal State
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [currentConfigInt, setCurrentConfigInt] = useState(null);

    useEffect(() => {
        fetchIntegrations();
    }, []);

    const fetchIntegrations = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/integrations');
            // If empty, init with default sales webhook structure locally
            if (res.data.length === 0) {
                setIntegrations([{
                    key: 'sales_webhook',
                    name: 'Webhook de Ventas',
                    url_dev: '',
                    url_prod: '',
                    active_env: 'dev'
                }]);
            } else {
                setIntegrations(res.data);
            }
        } catch (err) {
            console.error(err);
            setError("Error cargando integraciones");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (integration) => {
        setSaving(true);
        setMessage(null);
        setError(null);
        try {
            await api.post('/admin/integrations', integration);
            setMessage("Configuración guardada correctamente");
            fetchIntegrations();
        } catch (err) {
            setError(err.response?.data?.error || "Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Seguro que quieres eliminar esta integración?")) return;
        setLoading(true);
        try {
            await api.delete(`/admin/integrations?id=${id}`);
            setMessage("Integración eliminada");
            fetchIntegrations();
        } catch (err) {
            setError(err.response?.data?.error || "Error al eliminar");
            setLoading(false);
        }
    };

    const updateIntegration = (index, field, value) => {
        const newInts = [...integrations];
        newInts[index][field] = value;
        setIntegrations(newInts);
    };

    const openConfigModal = (integration, index) => {
        setCurrentConfigInt({ ...integration, index });
        setConfigModalOpen(true);
    };

    const savePayloadConfig = async (newConfig) => {
        if (!currentConfigInt) return;

        // Update local state first to reflect changes immediately or just save directly
        const updatedInt = { ...currentConfigInt, payload_config: newConfig };

        // Save to backend
        setSaving(true);
        try {
            await api.post('/admin/integrations', updatedInt);
            setMessage("Configuración de datos actualizada");
            setConfigModalOpen(false);
            fetchIntegrations(); // Refresh
        } catch (err) {
            setError("Error al guardar configuración de datos");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <header className="space-y-2">
                <div className="flex items-center gap-3">
                    <Key className="text-primary" size={24} />
                    <h2 className="text-2xl font-black text-base italic uppercase tracking-tighter">Integraciones & Webhooks</h2>
                </div>
                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted font-bold uppercase tracking-widest">Conecta el sistema con herramientas externas (n8n, Make, Zapier)</p>
                    <button
                        onClick={() => setIntegrations([...integrations, { name: '', key: '', url_dev: '', url_prod: '', active_env: 'dev' }])}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20"
                    >
                        + Nueva Integración
                    </button>
                </div>
            </header>

            <div className="grid gap-6">
                {integrations.map((integration, index) => (
                    <div key={index} className="bg-surface p-8 rounded-[2.5rem] border border-base space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="flex-1 mr-4 space-y-2">
                                {integration.id ? (
                                    <>
                                        <h3 className="text-lg font-black text-base">{integration.name}</h3>
                                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Key: {integration.key}</p>
                                    </>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            placeholder="Nombre (Ej: Agenda)"
                                            className="w-full bg-main border border-base rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            value={integration.name}
                                            onChange={(e) => updateIntegration(index, 'name', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Key (Ej: agenda_webhook)"
                                            className="w-full bg-main border border-base rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                                            value={integration.key}
                                            onChange={(e) => updateIntegration(index, 'key', e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                {integration.active_env === 'prod' ? 'Producción' : 'Test / Dev'}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                                    <Globe size={12} /> URL Webhook (Test / Dev)
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://n8n.webhook.com/test..."
                                    className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-xs"
                                    value={integration.url_dev || ''}
                                    onChange={(e) => updateIntegration(index, 'url_dev', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                                    <Server size={12} /> URL Webhook (Producción)
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://n8n.webhook.com/prod..."
                                    className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-xs"
                                    value={integration.url_prod || ''}
                                    onChange={(e) => updateIntegration(index, 'url_prod', e.target.value)}
                                />
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Entorno Activo por Defecto</label>
                                    <div className="flex bg-main rounded-xl p-1 w-fit border border-base">
                                        <button
                                            onClick={() => updateIntegration(index, 'active_env', 'dev')}
                                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${integration.active_env === 'dev' ? 'bg-surface shadow text-primary' : 'text-muted hover:text-base'}`}
                                        >
                                            Test / Dev
                                        </button>
                                        <button
                                            onClick={() => updateIntegration(index, 'active_env', 'prod')}
                                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${integration.active_env === 'prod' ? 'bg-surface shadow text-success' : 'text-muted hover:text-base'}`}
                                        >
                                            Producción
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openConfigModal(integration, index)}
                                        className="p-3 bg-base hover:bg-surface-hover text-muted hover:text-base rounded-xl transition-all border border-transparent hover:border-base"
                                        title="Configurar Datos Enviados"
                                    >
                                        <Settings2 size={20} />
                                    </button>

                                    {integration.id && (
                                        <button
                                            onClick={() => handleDelete(integration.id)}
                                            className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all"
                                            title="Eliminar Integración"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    )}
                                    <Button
                                        onClick={() => handleSave(integration)}
                                        loading={saving}
                                        icon={Save}
                                        variant="primary"
                                    >
                                        Guardar Configuración
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {message && (
                <div className="fixed bottom-8 right-8 p-4 bg-success text-white rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50">
                    <Check size={18} />
                    <span className="text-xs font-bold">{message}</span>
                </div>
            )}
            {error && (
                <div className="fixed bottom-8 right-8 p-4 bg-rose-500 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50">
                    <AlertCircle size={18} />
                    <span className="text-xs font-bold">{error}</span>
                </div>
            )}

            <PayloadConfigModal
                isOpen={configModalOpen}
                onClose={() => setConfigModalOpen(false)}
                onSave={savePayloadConfig}
                initialConfig={currentConfigInt?.payload_config || {}}
                loading={saving}
            />
        </div>
    );
};

export default IntegrationsManager;
