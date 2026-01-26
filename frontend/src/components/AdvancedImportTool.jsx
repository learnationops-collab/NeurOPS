import { useState, useEffect } from 'react';
import {
    FileUp,
    Table as TableIcon,
    Link as LinkIcon,
    AlertCircle,
    Settings,
    CheckCircle2,
    ArrowRight,
    Database,
    ChevronRight,
    Search,
    UserPlus,
    Plus
} from 'lucide-react';
import api from '../services/api';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';

const AdvancedImportTool = () => {
    const [step, setStep] = useState(1);
    const [target, setTarget] = useState('leads');
    const [file, setFile] = useState(null);
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [csvPreview, setCsvPreview] = useState([]);
    const [mapping, setMapping] = useState({});
    const [config, setConfig] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [options, setOptions] = useState({
        dry_run: false,
        update_existing: true,
        skip_errors: false
    });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    // Conflict Resolution State
    const [unresolved, setUnresolved] = useState(null);
    const [missingRequired, setMissingRequired] = useState([]);
    const [missingCounts, setMissingCounts] = useState({});
    const [resolutions, setResolutions] = useState({});
    const [defaults, setDefaults] = useState({});
    const [systemUsers, setSystemUsers] = useState([]);
    const [systemPrograms, setSystemPrograms] = useState([]);
    const [systemPaymentMethods, setSystemPaymentMethods] = useState([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoadError(null);
        try {
            const [configRes, usersRes, progsRes, methodsRes] = await Promise.all([
                api.get('/admin/import/config'),
                api.get('/admin/users'),
                api.get('/admin/db/programs'),
                api.get('/admin/db/payment-methods')
            ]);
            setConfig(configRes.data);
            setSystemUsers(usersRes.data);
            setSystemPrograms(progsRes.data.data || progsRes.data);
            setSystemPaymentMethods(methodsRes.data);
        } catch (err) {
            console.error("Error loading import config", err);
            setLoadError("Fallo al conectar con el servidor. Verifica tus permisos de administrador.");
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
        setFile(selectedFile);

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const lines = text.split('\n').filter(l => l.trim() !== '');
            if (lines.length === 0) return;

            const firstLine = lines[0];
            const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            setCsvHeaders(headers);

            // Preview logic (first 5 rows)
            const previewData = lines.slice(1, 6).map(line => {
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const obj = {};
                headers.forEach((h, i) => obj[h] = values[i]);
                return obj;
            });
            setCsvPreview(previewData);

            // Auto-mapping logic
            const newMapping = {};
            const targetFields = config[target].fields;
            targetFields.forEach(field => {
                const match = headers.find(h =>
                    h.toLowerCase() === field.name.toLowerCase() ||
                    h.toLowerCase() === field.label.toLowerCase() ||
                    h.toLowerCase() === field.label.toLowerCase().replace('usuario del ', '')
                );
                if (match) newMapping[field.name] = match;
            });
            setMapping(newMapping);
            setStep(3);
        };
        reader.readAsText(selectedFile);
    };

    const handleValidate = async () => {
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('target', target);
        formData.append('mapping', JSON.stringify(mapping));

        try {
            const res = await api.post('/admin/import/validate', formData);
            setMissingCounts(res.data.missing_counts || {});
            setMissingRequired(res.data.missing_required || []);

            const hasUnresolved = res.data.unresolved && Object.keys(res.data.unresolved).length > 0;
            const hasMissingReq = res.data.missing_required && res.data.missing_required.length > 0;

            if (hasUnresolved || hasMissingReq) {
                setUnresolved(res.data.unresolved);
                setStep(4);
            } else {
                setStep(5);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Error en la validación');
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('target', target);
        formData.append('mapping', JSON.stringify(mapping));
        formData.append('options', JSON.stringify({
            ...options,
            resolutions: resolutions,
            defaults: defaults
        }));

        try {
            const res = await api.post('/admin/import/execute', formData);
            setResult(res.data);
            setStep(6);
        } catch (err) {
            alert(err.response?.data?.message || 'Error en la importación');
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">
                        <Card
                            variant="surface"
                            className={`p-10 cursor-pointer border-2 transition-all group ${target === 'leads' ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10' : 'border-base hover:border-primary/30'}`}
                            onClick={() => { setTarget('leads'); setStep(2); }}
                        >
                            <div className="flex flex-col items-center text-center space-y-6">
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all ${target === 'leads' ? 'bg-primary text-white scale-110' : 'bg-surface text-muted group-hover:text-primary'}`}>
                                    <Database size={40} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black italic uppercase tracking-tighter">Leads & Clientes</h3>
                                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-2 leading-relaxed">Importa prospectos masivamente con detección de duplicados</p>
                                </div>
                            </div>
                        </Card>
                        <Card
                            variant="surface"
                            className={`p-10 cursor-pointer border-2 transition-all group ${target === 'sales' ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10' : 'border-base hover:border-primary/30'}`}
                            onClick={() => { setTarget('sales'); setStep(2); }}
                        >
                            <div className="flex flex-col items-center text-center space-y-6">
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all ${target === 'sales' ? 'bg-primary text-white scale-110' : 'bg-surface text-muted group-hover:text-primary'}`}>
                                    <CheckCircle2 size={40} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black italic uppercase tracking-tighter">Ventas (Enrolls)</h3>
                                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-2 leading-relaxed">Carga cierres y pagos vinculados a programas y closers</p>
                                </div>
                            </div>
                        </Card>
                        <Card
                            variant="surface"
                            className={`p-10 cursor-pointer border-2 transition-all group ${target === 'agendas' ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10' : 'border-base hover:border-primary/30'}`}
                            onClick={() => { setTarget('agendas'); setStep(2); }}
                        >
                            <div className="flex flex-col items-center text-center space-y-6">
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all ${target === 'agendas' ? 'bg-primary text-white scale-110' : 'bg-surface text-muted group-hover:text-primary'}`}>
                                    <LinkIcon size={40} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black italic uppercase tracking-tighter">Agendas (Appts)</h3>
                                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-2 leading-relaxed">Sincroniza citas históricas o futuras con estados y closers</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                );
            case 2:
                return (
                    <div className="animate-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
                        <Card variant="surface" className="p-16 border-dashed border-2 border-primary/30 bg-primary/5 relative overflow-hidden group">
                            <div className="relative z-10 flex flex-col items-center text-center space-y-8">
                                <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-white shadow-2xl shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
                                    <FileUp size={48} />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black italic tracking-tighter uppercase">Selecciona tu archivo CSV</h3>
                                    <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Protocolo: {target.toUpperCase()}</p>
                                </div>
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    id="csv-upload"
                                    onChange={handleFileChange}
                                />
                                <Button
                                    as="label"
                                    htmlFor="csv-upload"
                                    variant="primary"
                                    className="px-10 h-14 cursor-pointer"
                                    icon={Search}
                                >
                                    Explorar Archivos
                                </Button>
                            </div>
                            <div className="absolute -right-20 -bottom-20 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity duration-1000">
                                <FileUp size={300} />
                            </div>
                        </Card>
                        <Button variant="ghost" className="mt-8 mx-auto" onClick={() => setStep(1)}>Cambiar Objetivo</Button>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center bg-surface p-6 rounded-[2rem] border border-base shadow-lg">
                            <div className="space-y-1">
                                <h3 className="text-lg font-black italic tracking-tighter uppercase leading-none">Mapeo de Campos</h3>
                                <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Protocolo Activo: {target.toUpperCase()}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setStep(2)}>Atrás</Button>
                                <Button variant="primary" onClick={handleValidate} loading={loading} icon={ArrowRight}>Validar Datos</Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2">
                                <div className="bg-surface rounded-[2rem] border border-base overflow-hidden shadow-sm">
                                    <div className="p-6 border-b border-base bg-surface-hover/30">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted">Alineación de Columnas</p>
                                    </div>
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-surface-hover/20">
                                                <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest">Campo neurOPS</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest">Columna CSV</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-base">
                                            {config[target].fields.map(field => (
                                                <tr key={field.name} className="hover:bg-surface-hover/10 transition-all">
                                                    <td className="px-8 py-5">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-base italic">{field.label}</span>
                                                            {field.required && <span className="text-[8px] text-accent font-black uppercase mt-1">Obligatorio</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <select
                                                            className="w-full bg-main border border-base rounded-xl px-4 py-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-primary shadow-sm"
                                                            value={mapping[field.name] || ''}
                                                            onChange={(e) => setMapping({ ...mapping, [field.name]: e.target.value })}
                                                        >
                                                            <option value="">-- Ignorar --</option>
                                                            {csvHeaders.map(h => (
                                                                <option key={h} value={h}>{h}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        {mapping[field.name] ? (
                                                            <Badge variant="success">OK</Badge>
                                                        ) : (
                                                            <Badge variant="neutral">SALTAR</Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <Card variant="surface" className="p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Search size={14} className="text-primary" />
                                        <h4 className="text-[10px] font-black uppercase tracking-widest">Vista Previa CSV</h4>
                                    </div>
                                    <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                        {csvPreview.map((row, i) => (
                                            <div key={i} className="p-4 bg-main rounded-2xl border border-base text-[10px] font-bold space-y-2 group hover:border-primary/30 transition-all">
                                                <div className="flex justify-between items-center opacity-50">
                                                    <span>Fila {i + 2}</span>
                                                    <ChevronRight size={12} />
                                                </div>
                                                {Object.entries(row).slice(0, 4).map(([k, v]) => (
                                                    <div key={k} className="flex justify-between gap-4">
                                                        <span className="text-muted shrink-0">{k}:</span>
                                                        <span className="truncate text-base italic">"{v}"</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center bg-surface p-6 rounded-[2rem] border border-base shadow-lg">
                            <div className="space-y-1">
                                <h3 className="text-lg font-black italic tracking-tighter uppercase leading-none">Resolución de Entidades</h3>
                                <p className="text-muted text-[10px] font-bold uppercase tracking-widest">Sincronización de Identidades</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setStep(3)}>Atrás</Button>
                                <Button
                                    variant="primary"
                                    onClick={() => setStep(5)}
                                    icon={ArrowRight}
                                    disabled={missingRequired.some(f => !defaults[f] || defaults[f].trim() === '')}
                                >
                                    Confirmar Entidades
                                </Button>
                            </div>
                        </div>

                        {unresolved && Object.entries(unresolved).map(([field, values]) => (
                            <div key={field} className="space-y-6">
                                <div className="flex items-center gap-3 ml-2">
                                    <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent">
                                        <UserPlus size={16} />
                                    </div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-base">
                                        {field === 'closer_username' ? 'Closer' :
                                            field === 'program_name' ? 'Programa' :
                                                field === 'payment_method_name' ? 'Método de Pago' : field} No Identificados
                                    </h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {values.map(val => (
                                        <Card key={val} variant="surface" className="p-6 border-accent/20 group hover:border-accent transition-all">
                                            <p className="text-xs font-black italic mb-4 truncate text-accent">"{val}"</p>
                                            <select
                                                className="w-full bg-main border border-base rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-accent shadow-sm"
                                                value={resolutions[field]?.[val] || ''}
                                                onChange={(e) => {
                                                    const newResolutions = { ...resolutions };
                                                    if (!newResolutions[field]) newResolutions[field] = {};
                                                    newResolutions[field][val] = e.target.value;
                                                    setResolutions(newResolutions);
                                                }}
                                            >
                                                <option value="">Mapear a...</option>
                                                <option value="__CREATE__" className="text-primary font-black">✨ Crear como nuevo</option>
                                                {field === 'closer_username' && systemUsers.map(u => (
                                                    <option key={u.id} value={u.username}>{u.username}</option>
                                                ))}
                                                {field === 'program_name' && systemPrograms.map(p => (
                                                    <option key={p.id} value={p.name}>{p.name}</option>
                                                ))}
                                                {field === 'payment_method_name' && systemPaymentMethods.map(m => (
                                                    <option key={m.id} value={m.name}>{m.name}</option>
                                                ))}
                                            </select>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {missingRequired && missingRequired.length > 0 && (
                            <div className="space-y-6 mt-12 pt-12 border-t border-base">
                                <h4 className="text-xs font-black uppercase tracking-widest text-base ml-2">Valores por Defecto Requeridos</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {missingRequired.map(field => {
                                        const fieldMeta = config[target].fields.find(f => f.name === field);
                                        return (
                                            <Card key={field} variant="surface" className="p-6 border-primary/20 bg-primary/5">
                                                <div className="flex justify-between items-start mb-3">
                                                    <p className="text-xs font-black italic text-primary">{fieldMeta?.label || field}</p>
                                                    <Badge variant="primary">{missingCounts[field]} vacíos</Badge>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Valor de respaldo..."
                                                    className="w-full bg-main border border-base rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-1 focus:ring-primary"
                                                    value={defaults[field] || ''}
                                                    onChange={(e) => setDefaults({ ...defaults, [field]: e.target.value })}
                                                />
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 5:
                return (
                    <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                        <Card variant="surface" className="p-12 shadow-2xl">
                            <div className="flex items-center gap-4 mb-12 pb-8 border-b border-base text-center flex-col md:flex-row">
                                <div className="p-5 bg-primary/10 rounded-3xl text-primary">
                                    <Settings size={32} />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Despliegue de Datos</h3>
                                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-2">Configuración de seguridad final</p>
                                </div>
                            </div>

                            <div className="space-y-10">
                                <div className="flex items-center justify-between group">
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-base uppercase italic">Modo Simulación</p>
                                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">No guardará cambios en la BD</p>
                                    </div>
                                    <div
                                        onClick={() => setOptions({ ...options, dry_run: !options.dry_run })}
                                        className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-all ${options.dry_run ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-base'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-full bg-white transition-all transform ${options.dry_run ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between group">
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-base uppercase italic">Actualización Atómica</p>
                                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">Cruzar datos con registros existentes</p>
                                    </div>
                                    <div
                                        onClick={() => setOptions({ ...options, update_existing: !options.update_existing })}
                                        className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-all ${options.update_existing ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-base'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-full bg-white transition-all transform ${options.update_existing ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-16 space-y-4">
                                <Button variant="primary" className="w-full h-16 text-lg tracking-widest" onClick={handleImport} loading={loading} icon={CheckCircle2}>
                                    {options.dry_run ? 'Iniciar Simulación' : 'Ejecutar Sincronización'}
                                </Button>
                                <Button variant="ghost" className="w-full" onClick={() => setStep(unresolved || missingRequired.length > 0 ? 4 : 3)}>Ajustar Mapeo</Button>
                            </div>
                        </Card>
                    </div>
                );
            case 6:
                return (
                    <div className="animate-in zoom-in-95 duration-500 max-w-2xl mx-auto">
                        <Card variant="surface" className="p-16 text-center space-y-10 shadow-2xl relative overflow-hidden">
                            <div className="relative z-10 w-24 h-24 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-success/20">
                                <CheckCircle2 size={48} />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Operación Completada</h3>
                                <p className="text-muted text-[10px] font-bold uppercase tracking-[0.2em] mt-4">Protocolo de {target} ejecutado con éxito</p>
                            </div>

                            <div className="relative z-10 grid grid-cols-3 gap-8 py-10 border-y border-base bg-main/50 rounded-[2rem]">
                                <div className="space-y-2">
                                    <p className="text-4xl font-black italic text-base leading-none">{result.processed}</p>
                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">Leídos</p>
                                </div>
                                <div className="space-y-2 border-x border-base">
                                    <p className="text-4xl font-black italic text-success leading-none">{result.success}</p>
                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">Escritos</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-4xl font-black italic text-accent leading-none">{result.errors?.length || 0}</p>
                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">Fallas</p>
                                </div>
                            </div>

                            <div className="relative z-10 flex gap-4">
                                <Button variant="primary" className="flex-1 h-14" onClick={() => setStep(1)}>Nueva Importación</Button>
                                {result.errors?.length > 0 && <Button variant="ghost" className="flex-1">Ver Errores</Button>}
                            </div>
                        </Card>
                    </div>
                );
            default:
                return null;
        }
    };

    if (loadError) return (
        <div className="p-20 text-center flex flex-col items-center space-y-6">
            <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center">
                <AlertCircle size={32} />
            </div>
            <p className="text-base font-black italic uppercase tracking-tighter">{loadError}</p>
            <Button variant="primary" onClick={fetchInitialData}>Reintentar Protocolo</Button>
        </div>
    );

    if (!config) return (
        <div className="p-20 flex flex-col items-center justify-center space-y-10">
            <div className="relative">
                <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Database size={24} className="text-primary animate-pulse" />
                </div>
            </div>
            <div className="space-y-2 text-center">
                <p className="text-[12px] font-black uppercase tracking-[0.3em] text-primary animate-pulse">Sincronizando Sistemas</p>
                <p className="text-[10px] text-muted font-bold uppercase tracking-widest italic leading-relaxed">neurOPS_CORE // Cargando Protocolos de Importación...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-12 pb-20">
            {/* Horizontal Stepper UI Optimized */}
            <div className="flex justify-between max-w-2xl mx-auto relative px-4">
                <div className="absolute top-5 left-0 w-full h-[2px] bg-base -z-10" />
                {[1, 2, 3, 4, 5].map(s => (
                    <div
                        key={s}
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-700 border-2 ${step === s ? 'bg-primary border-primary text-white scale-125 shadow-xl shadow-primary/20 rotate-12' : step > s ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-base text-muted'}`}
                    >
                        {step > s ? <CheckCircle2 size={16} /> : <span className="text-xs font-black italic">{s}</span>}
                    </div>
                ))}
            </div>

            <div className="min-h-[600px]">
                {renderStep()}
            </div>
        </div>
    );
};

export default AdvancedImportTool;
