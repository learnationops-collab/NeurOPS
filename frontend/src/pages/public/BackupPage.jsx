import React, { useState, useEffect } from 'react';
import { Database, Download, CheckCircle, AlertTriangle, RefreshCw, Table } from 'lucide-react';

const BackupPage = () => {
    const [status, setStatus] = useState('idle'); // idle, downloading, success, error
    const [loadingPreview, setLoadingPreview] = useState(true);
    const [previewData, setPreviewData] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');

    const SECRET_KEY = 'neurops_secret_backup_2024';
    const EXPORT_URL = `/api/backup/secret-backup-export/${SECRET_KEY}`;
    const PREVIEW_URL = `/api/backup/secret-backup-preview/${SECRET_KEY}`;

    useEffect(() => {
        fetchPreview();
    }, []);

    const fetchPreview = async () => {
        try {
            setLoadingPreview(true);
            const response = await fetch(PREVIEW_URL);
            if (!response.ok) throw new Error("Error cargando vista previa");
            const data = await response.json();
            setPreviewData(data.tables || []);
        } catch (err) {
            console.error(err);
            setErrorMsg("No se pudo conectar con el servidor de backup.");
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleDownload = async () => {
        try {
            setStatus('downloading');

            const response = await fetch(EXPORT_URL);

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `neurops_backup_${new Date().toISOString().slice(0, 10)}.sql`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setStatus('success');
        } catch (err) {
            console.error("Backup failed:", err);
            setErrorMsg(err.message);
            setStatus('error');
        }
    };

    // Calculate totals
    const totalRecords = previewData.reduce((acc, curr) => acc + curr.count, 0);

    return (
        <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4 font-sans text-neutral-200">
            <div className="max-w-2xl w-full bg-neutral-800 rounded-xl border border-neutral-700 p-8 shadow-2xl">

                {/* Header */}
                <div className="flex flex-col items-center text-center space-y-4 mb-8">
                    <div className="p-4 bg-purple-500/10 rounded-full">
                        <Database className="w-12 h-12 text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2">Respaldo de Base de Datos</h1>
                        <p className="text-neutral-400">
                            Generación de script SQL (PostgreSQL)
                        </p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                            <Table className="w-4 h-4" /> Tablas y Registros
                        </h3>
                        <span className="text-xs bg-neutral-700 text-white px-2 py-1 rounded-full">
                            {loadingPreview ? "..." : `${totalRecords} Registros Totales`}
                        </span>
                    </div>

                    <div className="bg-neutral-900/50 rounded-lg border border-neutral-700/50 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                        {loadingPreview ? (
                            <div className="p-8 flex justify-center text-neutral-500">
                                <RefreshCw className="w-6 h-6 animate-spin" />
                            </div>
                        ) : previewData.length > 0 ? (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-neutral-800 text-neutral-400 sticky top-0">
                                    <tr>
                                        <th className="p-3 font-medium">Tabla</th>
                                        <th className="p-3 font-medium text-right">Registros</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800">
                                    {previewData.map((table) => (
                                        <tr key={table.name} className="hover:bg-neutral-800/50 transition-colors">
                                            <td className="p-3 font-mono text-purple-300">{table.name}</td>
                                            <td className="p-3 text-right text-white font-bold">{table.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-4 text-center text-neutral-500">No se encontraron datos.</div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-4">
                    {status === 'error' && (
                        <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg w-full text-sm animate-pulse">
                            <AlertTriangle className="w-4 h-4" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex items-center gap-2 text-green-400 bg-green-400/10 p-3 rounded-lg w-full text-sm">
                            <CheckCircle className="w-4 h-4" />
                            <span>¡Archivo SQL descargado correctamente!</span>
                        </div>
                    )}

                    <button
                        onClick={handleDownload}
                        disabled={status === 'downloading' || loadingPreview}
                        className={`
              w-full py-4 px-6 rounded-lg font-bold flex items-center justify-center gap-3 transition-all
              ${(status === 'downloading' || loadingPreview)
                                ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg hover:shadow-purple-500/25'}
            `}
                    >
                        {status === 'downloading' ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Generando SQL...</span>
                            </>
                        ) : (
                            <>
                                <Download className="w-5 h-5" />
                                <span>Descargar Backup SQL</span>
                            </>
                        )}
                    </button>

                    <div className="text-center">
                        <button
                            onClick={() => window.location.href = '/login'}
                            className="text-neutral-500 hover:text-white text-sm transition-colors"
                        >
                            ← Volver al Login
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BackupPage;
