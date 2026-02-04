import React, { useState } from 'react';
import { Upload, AlertTriangle, CheckCircle, Database, FileText } from 'lucide-react';

const RestorePage = () => {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const SECRET_KEY = 'neurops_secret_backup_2024';
    const RESTORE_URL = `/api/backup/secret-restore-import/${SECRET_KEY}`;

    const handleFileChange = (e) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setErrorMsg('');
        }
    };

    const handleRestore = async () => {
        if (!file) return;

        const confirm1 = window.confirm("PELIGRO: ¿Estás seguro de que quieres RESTAURAR la base de datos?");
        if (!confirm1) return;

        const confirm2 = window.confirm("ESTA ACCIÓN BORRARÁ TODOS LOS DATOS ACTUALES y los reemplazará con el archivo subido. ¿Continuar?");
        if (!confirm2) return;

        try {
            setStatus('uploading');

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(RESTORE_URL, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Error ${response.status}`);
            }

            setStatus('success');
            setSuccessMsg(`${data.message} (${data.tables_affected} tablas afectadas)`);

        } catch (err) {
            console.error("Restore failed:", err);
            setErrorMsg(err.message);
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4 font-sans text-neutral-200">
            <div className="max-w-md w-full bg-neutral-800 rounded-xl border border-red-900/50 p-8 shadow-2xl">

                {/* Header */}
                <div className="flex flex-col items-center text-center space-y-6 mb-8">
                    <div className="p-4 bg-red-500/10 rounded-full animate-pulse">
                        <Upload className="w-12 h-12 text-red-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2">Restaurar Base de Datos</h1>
                        <p className="text-red-400 font-bold border border-red-500/20 bg-red-500/5 p-2 rounded">
                            ⚠ ADVERTENCIA: Esta acción es destructiva
                        </p>
                        <p className="text-neutral-400 text-sm mt-2">
                            Se borrarán todos los datos actuales y se importará el contenido del archivo SQL.
                        </p>
                    </div>
                </div>

                {/* File Upload */}
                <div className="space-y-6">

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-neutral-300">Seleccionar Archivo de Respaldo (.sql)</label>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".sql"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-neutral-400
                  file:mr-4 file:py-2.5 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-neutral-700 file:text-neutral-200
                  hover:file:bg-neutral-600 cursor-pointer
                  border border-neutral-700 rounded-lg bg-neutral-900/50"
                            />
                        </div>
                        {file && (
                            <div className="flex items-center gap-2 text-xs text-green-400 mt-1">
                                <FileText className="w-3 h-3" />
                                {file.name} ({(file.size / 1024).toFixed(2)} KB)
                            </div>
                        )}
                    </div>

                    {status === 'error' && (
                        <div className="flex items-start gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg w-full text-sm">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex items-start gap-2 text-green-400 bg-green-400/10 p-3 rounded-lg w-full text-sm">
                            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-bold">¡Restauración Completada!</p>
                                <p className="opacity-80">{successMsg}</p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleRestore}
                        disabled={status === 'uploading' || !file || status === 'success'}
                        className={`
              w-full py-4 px-6 rounded-lg font-bold flex items-center justify-center gap-3 transition-all
              ${(status === 'uploading' || !file || status === 'success')
                                ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-lg hover:shadow-red-500/25'}
            `}
                    >
                        {status === 'uploading' ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Restaurando... (No cierres)</span>
                            </>
                        ) : status === 'success' ? (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                <span>Restaurado</span>
                            </>
                        ) : (
                            <>
                                <Database className="w-5 h-5" />
                                <span>EJECUTAR RESTAURACIÓN</span>
                            </>
                        )}
                    </button>

                    <div className="text-center pt-2">
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

export default RestorePage;
