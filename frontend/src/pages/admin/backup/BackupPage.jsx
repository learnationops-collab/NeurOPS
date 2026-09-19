import React, { useState } from 'react';
import { Database, Download, CheckCircle, AlertTriangle, RefreshCw, Table, KeyRound } from 'lucide-react';
import {
    descargarBackup,
    mensajeDeError,
    obtenerVistaPrevia,
    problemaDeLaClave,
} from './backupApi';

// Respaldo de la base (script SQL). Solo admin: la ruta ya lo exige y el servidor lo vuelve a comprobar.
// La clave (BACKUP_SECRET_KEY) la escribe la persona: no está en el código ni se guarda en el navegador.
const BackupPage = () => {
    const [clave, setClave] = useState('');
    const [status, setStatus] = useState('idle'); // idle, previewing, downloading, success, error
    const [tablas, setTablas] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');

    const problema = problemaDeLaClave(clave);
    const ocupado = status === 'previewing' || status === 'downloading';
    const totalRegistros = tablas.reduce((acc, tabla) => acc + tabla.count, 0);

    const fallar = async (err) => {
        console.error('Backup failed:', err);
        setErrorMsg(await mensajeDeError(err));
        setStatus('error');
    };

    const handlePreview = async () => {
        try {
            setStatus('previewing');
            setErrorMsg('');
            const res = await obtenerVistaPrevia(clave);
            setTablas(res.data.tables || []);
            setStatus('idle');
        } catch (err) {
            setTablas([]);
            await fallar(err);
        }
    };

    const handleDownload = async () => {
        try {
            setStatus('downloading');
            setErrorMsg('');
            const res = await descargarBackup(clave);
            const url = window.URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `neurops_backup_${new Date().toISOString().slice(0, 10)}.sql`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setStatus('success');
        } catch (err) {
            await fallar(err);
        }
    };

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
                        <p className="text-neutral-400">Generación de script SQL (PostgreSQL)</p>
                    </div>
                </div>

                {/* Clave */}
                <div className="mb-8">
                    <label htmlFor="clave-de-respaldo" className="text-sm font-medium text-neutral-300 flex items-center gap-2 mb-2">
                        <KeyRound className="w-4 h-4" /> Clave de respaldo
                    </label>
                    <input
                        id="clave-de-respaldo"
                        type="password"
                        autoComplete="off"
                        value={clave}
                        onChange={(e) => { setClave(e.target.value.trim()); setStatus('idle'); }}
                        placeholder="Valor de BACKUP_SECRET_KEY"
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-900/50 px-4 py-3 font-mono text-sm text-white placeholder-neutral-600 focus:border-purple-500 focus:outline-none"
                    />
                    <p className="mt-2 text-xs text-neutral-500">
                        Es la variable BACKUP_SECRET_KEY del servidor (Railway). No se guarda en este navegador.
                    </p>
                    {clave && problema && <p className="mt-1 text-xs text-amber-400">{problema}</p>}
                </div>

                {/* Vista previa */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                            <Table className="w-4 h-4" /> Tablas y Registros
                        </h3>
                        <div className="flex items-center gap-3">
                            {tablas.length > 0 && (
                                <span className="text-xs bg-neutral-700 text-white px-2 py-1 rounded-full">
                                    {totalRegistros} Registros Totales
                                </span>
                            )}
                            <button
                                onClick={handlePreview}
                                disabled={ocupado || Boolean(problema)}
                                className="text-xs font-semibold text-purple-300 hover:text-white disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
                            >
                                Ver tablas
                            </button>
                        </div>
                    </div>

                    <div className="bg-neutral-900/50 rounded-lg border border-neutral-700/50 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                        {status === 'previewing' ? (
                            <div className="p-8 flex justify-center text-neutral-500">
                                <RefreshCw className="w-6 h-6 animate-spin" />
                            </div>
                        ) : tablas.length > 0 ? (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-neutral-800 text-neutral-400 sticky top-0">
                                    <tr>
                                        <th className="p-3 font-medium">Tabla</th>
                                        <th className="p-3 font-medium text-right">Registros</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800">
                                    {tablas.map((tabla) => (
                                        <tr key={tabla.name} className="hover:bg-neutral-800/50 transition-colors">
                                            <td className="p-3 font-mono text-purple-300">{tabla.name}</td>
                                            <td className="p-3 text-right text-white font-bold">{tabla.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-4 text-center text-neutral-500">
                                Escribe la clave y pulsa «Ver tablas» para ver qué se va a respaldar.
                            </div>
                        )}
                    </div>
                </div>

                {/* Acciones */}
                <div className="space-y-4">
                    {status === 'error' && (
                        <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg w-full text-sm">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
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
                        disabled={ocupado || Boolean(problema)}
                        className={`
              w-full py-4 px-6 rounded-lg font-bold flex items-center justify-center gap-3 transition-all
              ${(ocupado || problema)
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
                </div>
            </div>
        </div>
    );
};

export default BackupPage;
