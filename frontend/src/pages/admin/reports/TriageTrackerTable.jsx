import React, { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function TriageTrackerTable() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/triage/tracker');
            setReports(res.data.reports || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando reporte de Triage Tracker...</div>;

    return (
        <Card className="w-full overflow-hidden mt-8 border-gray-200 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-xl font-semibold text-slate-800">
                    Triage Tracker (Nuevo Formato)
                </CardTitle>
                <p className="text-sm text-slate-500">
                    Vista temporal para previsualizar los datos que ingresarán del Google Sheet.
                </p>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                        <thead className="bg-[#1f2937] text-white sticky top-0 z-10">
                            <tr>
                                <th rowSpan="2" className="p-3 border border-gray-600 bg-[#374151] sticky left-0 z-20">Fecha</th>
                                <th rowSpan="2" className="p-3 border border-gray-600 bg-[#374151] sticky left-[80px] z-20">Triage</th>

                                <th colSpan="5" className="p-2 border border-blue-800 text-center bg-blue-900 border-l-2">Starting (1st Call)</th>
                                <th colSpan="5" className="p-2 border border-orange-800 text-center bg-orange-900 border-l-2">Starting (2nd Call)</th>

                                <th colSpan="5" className="p-2 border border-blue-800 text-center bg-blue-900 border-l-2">All (1st Call)</th>
                                <th colSpan="5" className="p-2 border border-orange-800 text-center bg-orange-900 border-l-2">All (2nd Call)</th>

                                <th colSpan="2" className="p-2 border border-emerald-800 text-center bg-emerald-900 border-l-2">PC Hoy</th>
                                <th colSpan="2" className="p-2 border border-teal-800 text-center bg-teal-900 border-l-2">PC All</th>

                                <th colSpan="4" className="p-2 border border-sky-800 text-center bg-sky-900 border-l-2">FU Cold</th>
                                <th colSpan="4" className="p-2 border border-amber-800 text-center bg-amber-900 border-l-2">FU Warm</th>
                                <th colSpan="4" className="p-2 border border-rose-800 text-center bg-rose-900 border-l-2">FU Hot</th>
                            </tr>
                            <tr className="bg-[#4b5563]">
                                {/* ST 1st Call */}
                                <th className="p-2 border border-gray-600 border-l-2 border-l-blue-800">Agendas</th>
                                <th className="p-2 border border-gray-600">Confirmando</th>
                                <th className="p-2 border border-gray-600">Reprog</th>
                                <th className="p-2 border border-gray-600">Confirmadas</th>
                                <th className="p-2 border border-gray-600 border-r-2 border-r-blue-800">Canceladas</th>
                                {/* ST 2nd Call */}
                                <th className="p-2 border border-gray-600 border-l-2 border-l-orange-800">Agendas</th>
                                <th className="p-2 border border-gray-600">Confirmando</th>
                                <th className="p-2 border border-gray-600">Reprog</th>
                                <th className="p-2 border border-gray-600">Confirmadas</th>
                                <th className="p-2 border border-gray-600 border-r-2 border-r-orange-800">Canceladas</th>
                                {/* ALL 1st Call */}
                                <th className="p-2 border border-gray-600 border-l-2 border-l-blue-800">Agendas</th>
                                <th className="p-2 border border-gray-600">Confirmando</th>
                                <th className="p-2 border border-gray-600">Reprog</th>
                                <th className="p-2 border border-gray-600">Confirmadas</th>
                                <th className="p-2 border border-gray-600 border-r-2 border-r-blue-800">Canceladas</th>
                                {/* ALL 2nd Call */}
                                <th className="p-2 border border-gray-600 border-l-2 border-l-orange-800">Agendas</th>
                                <th className="p-2 border border-gray-600">Confirmando</th>
                                <th className="p-2 border border-gray-600">Reprog</th>
                                <th className="p-2 border border-gray-600">Confirmadas</th>
                                <th className="p-2 border border-gray-600 border-r-2 border-r-orange-800">Canceladas</th>
                                {/* PC Hoy */}
                                <th className="p-2 border border-gray-600 border-l-2 border-l-emerald-800">Confirmadas</th>
                                <th className="p-2 border border-gray-600 border-r-2 border-r-emerald-800">PPC Comp</th>
                                {/* PC All */}
                                <th className="p-2 border border-gray-600 border-l-2 border-l-teal-800">Confirmadas</th>
                                <th className="p-2 border border-gray-600 border-r-2 border-r-teal-800">PPC Comp</th>
                                {/* FU Cold */}
                                <th className="p-2 border border-gray-600 border-l-2 border-l-sky-800">Disp FU</th>
                                <th className="p-2 border border-gray-600">Mjs Real</th>
                                <th className="p-2 border border-gray-600">Per Real</th>
                                <th className="p-2 border border-gray-600 border-r-2 border-r-sky-800">Per Resp</th>
                                {/* FU Warm */}
                                <th className="p-2 border border-gray-600 border-l-2 border-l-amber-800">Disp FU</th>
                                <th className="p-2 border border-gray-600">Mjs Real</th>
                                <th className="p-2 border border-gray-600">Per Real</th>
                                <th className="p-2 border border-gray-600 border-r-2 border-r-amber-800">Per Resp</th>
                                {/* FU Hot */}
                                <th className="p-2 border border-gray-600 border-l-2 border-l-rose-800">Disp FU</th>
                                <th className="p-2 border border-gray-600">Mjs Real</th>
                                <th className="p-2 border border-gray-600">Per Real</th>
                                <th className="p-2 border border-gray-600 border-r-2 border-r-rose-800">Per Resp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((r, idx) => (
                                <tr key={r.id || idx} className="hover:bg-blue-50 transition-colors bg-white">
                                    <td className="p-3 border border-gray-200 sticky left-0 z-10 bg-inherit font-medium text-gray-800">{r.date?.substring(0, 10)}</td>
                                    <td className="p-3 border border-gray-200 sticky left-[80px] z-10 bg-inherit font-medium text-gray-800">{r.triage_name}</td>

                                    {/* ST 1st Call */}
                                    <td className="p-2 border border-gray-200 text-center font-semibold text-gray-700 bg-blue-50">{r.starting_1st_call_agendas}</td>
                                    <td className="p-2 border border-gray-200 text-center text-gray-600 bg-blue-50">{r.starting_1st_call_confirmando}</td>
                                    <td className="p-2 border border-gray-200 text-center text-gray-600 bg-blue-50">{r.starting_1st_call_reprogramando}</td>
                                    <td className="p-2 border border-gray-200 text-center text-green-700 font-medium bg-blue-50">{r.starting_1st_call_confirmadas}</td>
                                    <td className="p-2 border border-gray-200 text-center text-red-600 bg-blue-50">{r.starting_1st_call_canceladas}</td>
                                    
                                    {/* ST 2nd Call */}
                                    <td className="p-2 border border-gray-200 text-center font-semibold text-gray-700 bg-orange-50">{r.starting_2nd_call_agendas}</td>
                                    <td className="p-2 border border-gray-200 text-center text-gray-600 bg-orange-50">{r.starting_2nd_call_confirmando}</td>
                                    <td className="p-2 border border-gray-200 text-center text-gray-600 bg-orange-50">{r.starting_2nd_call_reprogramando}</td>
                                    <td className="p-2 border border-gray-200 text-center text-green-700 font-medium bg-orange-50">{r.starting_2nd_call_confirmadas}</td>
                                    <td className="p-2 border border-gray-200 text-center text-red-600 bg-orange-50">{r.starting_2nd_call_canceladas}</td>

                                    {/* ALL 1st Call */}
                                    <td className="p-2 border border-gray-200 text-center font-semibold text-gray-700 bg-blue-100/50">{r.all_1st_call_agendas}</td>
                                    <td className="p-2 border border-gray-200 text-center text-gray-600 bg-blue-100/50">{r.all_1st_call_confirmando}</td>
                                    <td className="p-2 border border-gray-200 text-center text-gray-600 bg-blue-100/50">{r.all_1st_call_reprogramando}</td>
                                    <td className="p-2 border border-gray-200 text-center text-green-700 font-medium bg-blue-100/50">{r.all_1st_call_confirmadas}</td>
                                    <td className="p-2 border border-gray-200 text-center text-red-600 bg-blue-100/50">{r.all_1st_call_canceladas}</td>

                                    {/* ALL 2nd Call */}
                                    <td className="p-2 border border-gray-200 text-center font-semibold text-gray-700 bg-orange-100/50">{r.all_2nd_call_agendas}</td>
                                    <td className="p-2 border border-gray-200 text-center text-gray-600 bg-orange-100/50">{r.all_2nd_call_confirmando}</td>
                                    <td className="p-2 border border-gray-200 text-center text-gray-600 bg-orange-100/50">{r.all_2nd_call_reprogramando}</td>
                                    <td className="p-2 border border-gray-200 text-center text-green-700 font-medium bg-orange-100/50">{r.all_2nd_call_confirmadas}</td>
                                    <td className="p-2 border border-gray-200 text-center text-red-600 bg-orange-100/50">{r.all_2nd_call_canceladas}</td>

                                    {/* PC Hoy */}
                                    <td className="p-2 border border-gray-200 text-center font-medium text-emerald-700 bg-emerald-50">{r.post_hoy_confirmadas}</td>
                                    <td className="p-2 border border-gray-200 text-center text-emerald-800 font-semibold bg-emerald-50">{r.post_hoy_ppc_completo}</td>
                                    
                                    {/* PC All */}
                                    <td className="p-2 border border-gray-200 text-center font-medium text-teal-700 bg-teal-50">{r.post_all_confirmadas}</td>
                                    <td className="p-2 border border-gray-200 text-center text-teal-800 font-semibold bg-teal-50">{r.post_all_ppc_completo}</td>

                                    {/* FU Cold */}
                                    <td className="p-2 border border-gray-200 text-center text-sky-700 bg-sky-50">{r.fu_cold_personas_disp_fu}</td>
                                    <td className="p-2 border border-gray-200 text-center text-sky-800 bg-sky-50">{r.fu_cold_mjes_realizados}</td>
                                    <td className="p-2 border border-gray-200 text-center font-medium text-sky-900 bg-sky-50">{r.fu_cold_personas_realizados}</td>
                                    <td className="p-2 border border-gray-200 text-center font-semibold text-blue-700 bg-sky-50">{r.fu_cold_personas_respondidos}</td>
                                    
                                    {/* FU Warm */}
                                    <td className="p-2 border border-gray-200 text-center text-amber-700 bg-amber-50">{r.fu_warm_personas_disp_fu}</td>
                                    <td className="p-2 border border-gray-200 text-center text-amber-800 bg-amber-50">{r.fu_warm_mjes_realizados}</td>
                                    <td className="p-2 border border-gray-200 text-center font-medium text-amber-900 bg-amber-50">{r.fu_warm_personas_realizados}</td>
                                    <td className="p-2 border border-gray-200 text-center font-semibold text-orange-600 bg-amber-50">{r.fu_warm_personas_respondidos}</td>

                                    {/* FU Hot */}
                                    <td className="p-2 border border-gray-200 text-center text-rose-700 bg-rose-50">{r.fu_hot_personas_disp_fu}</td>
                                    <td className="p-2 border border-gray-200 text-center text-rose-800 bg-rose-50">{r.fu_hot_mjes_realizados}</td>
                                    <td className="p-2 border border-gray-200 text-center font-medium text-rose-900 bg-rose-50">{r.fu_hot_personas_realizados}</td>
                                    <td className="p-2 border border-gray-200 text-center font-semibold text-red-600 bg-rose-50">{r.fu_hot_personas_respondidos}</td>
                                </tr>
                            ))}
                            {reports.length === 0 && (
                                <tr>
                                    <td colSpan="38" className="p-8 text-center text-gray-500 bg-white">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <span className="text-4xl text-gray-300">📊</span>
                                            <p className="font-medium">No hay registros de Triage Tracker aún.</p>
                                            <p className="text-sm">Envía datos al endpoint: <code>POST /api/triage/tracker</code></p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
