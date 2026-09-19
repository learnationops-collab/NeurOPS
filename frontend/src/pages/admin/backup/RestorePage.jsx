import React, { useState } from 'react';
import { Upload, AlertTriangle, CheckCircle, Database, FileText, KeyRound } from 'lucide-react';
import { mensajeDeError, problemaDeLaClave, restaurarBackup } from './backupApi';

// Para pedir esta palabra antes de ejecutar: una restauración BORRA todos los datos actuales.
const PALABRA_DE_CONFIRMACION = 'RESTAURAR';

// Restauración de la base desde un script SQL. Solo admin: la ruta ya lo exige y el servidor lo vuelve a
// comprobar. La clave (BACKUP_SECRET_KEY) la escribe la persona: no está en el código ni se guarda en el
// navegador.
const RestorePage = () => {
    const [clave, setClave] = useState('');
    const [file, setFile] = useState(null);
    const [previewStats, setPreviewStats] = useState([]);
    const [confirmacion, setConfirmacion] = useState('');
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const problema = problemaDeLaClave(clave);
    const confirmado = confirmacion.trim() === PALABRA_DE_CONFIRMACION;
    const puedeRestaurar = Boolean(file) && !problema && confirmado && status !== 'uploading' && status !== 'success';

    const parseFileStats = (fileObj) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Lee los comentarios "-- Table: nombre (N records)" que genera nuestra herramienta de respaldo.
            const stats = [];
            e.target.result.split('\n').forEach((line) => {
                const coincidencia = line.match(/-- Table: (\w+) \((\d+) records\)/);
                if (coincidencia) stats.push({ name: coincidencia[1], count: parseInt(coincidencia[2], 10) });
            });
            setPreviewStats(stats);
        };
        reader.readAsText(fileObj);
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setStatus('idle');
            setErrorMsg('');
            setSuccessMsg('');
            parseFileStats(selectedFile);
        }
    };

    const handleRestore = async () => {
        if (!puedeRestaurar) return;
        try {
            setStatus('uploading');
            setErrorMsg('');
            const res = await restaurarBackup(clave, file);
            setStatus('success');
            setSuccessMsg(`${res.data.message} (${res.data.tables_affected} tablas afectadas). Vuelve a iniciar sesión: los usuarios pueden haber cambiado.`);
        } catch (err) {
            console.error('Restore failed:', err);
            setErrorMsg(await mensajeDeError(err));
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4 font-sans text-neutral-200">
            <div className="max-w-2xl w-full bg-neutral-800 rounded-xl border border-red-900/50 p-8 shadow-2xl">

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

                <div className="space-y-6">

                    {/* Clave */}
                    <div>
                        <label htmlFor="clave-de-restauracion" className="text-sm font-medium text-neutral-300 flex items-center gap-2 mb-2">
                            <KeyRound className="w-4 h-4" /> Clave de respaldo
                        </label>
                        <input
                            id="clave-de-restauracion"
                            type="password"
                            autoComplete="off"
                            value={clave}
                            onChange={(e) => { setClave(e.target.value.trim()); setStatus('idle'); }}
                            placeholder="Valor de BACKUP_SECRET_KEY"
                            className="w-full rounded-lg border border-neutral-700 bg-neutral-900/50 px-4 py-3 font-mono text-sm text-white placeholder-neutral-600 focus:border-red-500 focus:outline-none"
                        />
                        <p className="mt-2 text-xs text-neutral-500">
                            Es la variable BACKUP_SECRET_KEY del servidor (Railway). No se guarda en este navegador.
                        </p>
                        {clave && problema && <p className="mt-1 text-xs text-amber-400">{problema}</p>}
                    </div>

                    {/* Archivo */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-neutral-300">Seleccionar Archivo de Respaldo (.sql)</label>
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

                    {/* Vista previa del archivo */}
                    {file && (
                        <div className="bg-neutral-900/50 rounded-lg border border-neutral-700/50 overflow-hidden">
                            <div className="p-3 bg-neutral-800 border-b border-neutral-700/50 flex justify-between items-center">
                                <div className="flex items-center gap-2 text-xs text-green-400">
                                    <FileText className="w-3 h-3" />
                                    {file.name} ({(file.size / 1024).toFixed(2)} KB)
                                </div>
                                <span className="text-xs text-neutral-500">Vista Previa del Contenido</span>
                            </div>

                            {previewStats.length > 0 ? (
                                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-neutral-800/50 text-neutral-500 sticky top-0">
                                            <tr>
                                                <th className="p-2 font-medium pl-4">Tabla Detectada</th>
                                                <th className="p-2 font-medium text-right pr-4">Reg.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-800">
                                            {previewStats.map((stat, i) => (
                                                <tr key={i} className="hover:bg-neutral-800/30">
                                                    <td className="p-2 pl-4 text-purple-300 font-mono text-xs">{stat.name}</td>
                                                    <td className="p-2 pr-4 text-right text-white text-xs">{stat.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-4 text-center text-xs text-neutral-500 italic">
                                    No se detectaron metadatos en el archivo (quizás es un SQL genérico).
                                </div>
                            )}
                        </div>
                    )}

                    {/* Confirmación escrita */}
                    <div>
                        <label htmlFor="confirmacion-de-restauracion" className="text-sm font-medium text-neutral-300 mb-2 block">
                            Para confirmar, escribe <span className="font-mono font-bold text-red-400">{PALABRA_DE_CONFIRMACION}</span>
                        </label>
                        <input
                            id="confirmacion-de-restauracion"
                            type="text"
                            autoComplete="off"
                            value={confirmacion}
                            onChange={(e) => setConfirmacion(e.target.value)}
                            className="w-full rounded-lg border border-neutral-700 bg-neutral-900/50 px-4 py-3 font-mono text-sm text-white focus:border-red-500 focus:outline-none"
                        />
                    </div>

                    {status === 'error' && (
                        <div className="flex items-start gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg w-full text-sm font-mono whitespace-pre-wrap break-all">
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
                        disabled={!puedeRestaurar}
                        className={`
              w-full py-4 px-6 rounded-lg font-bold flex items-center justify-center gap-3 transition-all
              ${!puedeRestaurar
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
                </div>
            </div>
        </div>
    );
};

export default RestorePage;
