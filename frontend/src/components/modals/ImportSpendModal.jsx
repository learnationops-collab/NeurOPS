import React, { useState, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { X, UploadCloud, CheckCircle2, AlertCircle, Trash2, ArrowRight } from 'lucide-react';

const ImportSpendModal = ({ isOpen, onClose, onConfirm, campaigns }) => {
    const [file, setFile] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [mappings, setMappings] = useState({}); // csvRowIndex -> setId
    const fileInputRef = useRef(null);

    // Extract all system ad sets for the dropdown
    const systemAdSets = useMemo(() => {
        const sets = [];
        campaigns.forEach(camp => {
            if (camp.ad_sets) {
                camp.ad_sets.forEach(set => {
                    sets.push({
                        ...set,
                        campaign_name: camp.name
                    });
                });
            }
        });
        return sets.sort((a, b) => a.campaign_name.localeCompare(b.campaign_name));
    }, [campaigns]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
        setFile(selectedFile);

        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data.filter(row => {
                    // Only keep rows that have both columns and spend > 0
                    const adSetName = row["Nombre del conjunto de anuncios"];
                    const spend = parseFloat(row["Importe gastado (USD)"]);
                    return adSetName && !isNaN(spend) && spend > 0;
                });
                
                // Auto-match logic
                const initialMappings = {};
                data.forEach((row, idx) => {
                    const csvName = row["Nombre del conjunto de anuncios"]?.trim().toLowerCase();
                    const match = systemAdSets.find(set => set.name.toLowerCase() === csvName);
                    if (match) {
                        initialMappings[idx] = match.id;
                    }
                });

                setParsedData(data);
                setMappings(initialMappings);
            }
        });
    };

    const handleConfirm = () => {
        const results = [];
        parsedData.forEach((row, idx) => {
            const setId = mappings[idx];
            if (setId) {
                results.push({
                    setId,
                    spend: parseFloat(row["Importe gastado (USD)"])
                });
            }
        });
        onConfirm(results);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-4xl shadow-2xl relative flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
                    <h3 className="text-lg font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
                        <UploadCloud className="text-emerald-500" />
                        Importar Inversión (CSV)
                    </h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {!file ? (
                        <div 
                            className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-2xl p-12 text-center cursor-pointer transition-colors bg-slate-900/50"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input 
                                type="file" 
                                accept=".csv" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            <UploadCloud size={48} className="mx-auto mb-4 text-emerald-500 opacity-50" />
                            <h4 className="text-lg font-bold text-white mb-2">Selecciona tu reporte de Meta Ads</h4>
                            <p className="text-sm text-slate-400">Debe contener las columnas "Nombre del conjunto de anuncios" e "Importe gastado (USD)"</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                <div>
                                    <p className="text-sm font-bold text-white">{file.name}</p>
                                    <p className="text-xs text-slate-400">{parsedData.length} conjuntos con gasto detectados</p>
                                </div>
                                <button 
                                    onClick={() => { setFile(null); setParsedData([]); setMappings({}); }}
                                    className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
                                >
                                    <Trash2 size={14} /> Cambiar Archivo
                                </button>
                            </div>

                            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-black tracking-wider">
                                        <tr>
                                            <th className="p-4">Conjunto (CSV)</th>
                                            <th className="p-4 text-right">Gasto</th>
                                            <th className="p-4 w-12 text-center"></th>
                                            <th className="p-4">Conjunto (Sistema NeurOPS)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {parsedData.map((row, idx) => {
                                            const csvName = row["Nombre del conjunto de anuncios"];
                                            const spend = parseFloat(row["Importe gastado (USD)"]).toFixed(2);
                                            const isMatched = !!mappings[idx];

                                            return (
                                                <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                                                    <td className="p-4 font-medium text-slate-300">{csvName}</td>
                                                    <td className="p-4 text-right font-mono font-bold text-amber-400">${spend}</td>
                                                    <td className="p-4 text-center text-slate-600">
                                                        <ArrowRight size={16} className="mx-auto" />
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <select 
                                                                className={`w-full bg-slate-900 border text-sm rounded-lg p-2.5 outline-none transition-colors ${isMatched ? 'border-emerald-500/50 text-emerald-400 font-bold' : 'border-red-500/50 text-slate-400'}`}
                                                                value={mappings[idx] || ""}
                                                                onChange={(e) => setMappings(prev => ({ ...prev, [idx]: parseInt(e.target.value) || null }))}
                                                            >
                                                                <option value="">-- Ignorar / No Asignar --</option>
                                                                {systemAdSets.map(set => (
                                                                    <option key={set.id} value={set.id}>
                                                                        {set.campaign_name} • {set.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            {isMatched ? (
                                                                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                                                            ) : (
                                                                <AlertCircle size={18} className="text-red-500 shrink-0" title="Sin asignar" />
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-slate-800/80 bg-slate-900/50 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-400 hover:text-white transition-colors">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={!file || Object.keys(mappings).length === 0}
                        className="px-6 py-2.5 rounded-xl font-black uppercase text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                    >
                        Confirmar Mapeo
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportSpendModal;
