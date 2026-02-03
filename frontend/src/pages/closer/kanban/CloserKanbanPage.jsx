import { useState, useEffect } from 'react';
import api from '../../../services/api';
import {
    Kanban,
    RefreshCw,
    Search,
    Filter,
    ArrowRight,
    Loader2
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import CloserKanbanBoard from '../../../components/CloserKanbanBoard';

const CloserKanbanPage = () => {
    const [data, setData] = useState({ stages: [], board: {} });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchKanbanData();
    }, []);

    const fetchKanbanData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/closer/kanban');
            setData(res.data);
            setError(null);
        } catch (err) {
            console.error("Error fetching kanban data", err);
            setError("Error al cargar el embudo de ventas.");
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchKanbanData();
        setRefreshing(false);
    };

    const handleMove = async (id, fromStage, toStage) => {
        // Optimistic UI update
        const newBoard = { ...data.board };
        const itemIndex = newBoard[fromStage].findIndex(i => i.id === id);
        const [movedItem] = newBoard[fromStage].splice(itemIndex, 1);

        if (!newBoard[toStage]) newBoard[toStage] = [];
        newBoard[toStage].push({ ...movedItem, last_stage: toStage });

        setData({ ...data, board: newBoard });

        try {
            await api.patch(`/closer/appointments/${id}/stage`, { stage: toStage });
        } catch (err) {
            console.error("Error updating stage", err);
            // Revert on error
            fetchKanbanData();
        }
    };

    if (loading && !refreshing) {
        return (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-primary" size={40} />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Sincronizando Embudo...</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-muted font-black uppercase text-[10px] tracking-[0.3em]">Gestión de Llamadas</span>
                    </div>
                    <h1 className="text-4xl font-black text-base italic tracking-tighter uppercase flex items-center gap-4">
                        Embudo de Closers
                        <ArrowRight size={32} className="text-primary/30" />
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="bg-surface border-base h-14 px-6 gap-3"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted group-hover:text-base">Sincronizar</span>
                    </Button>
                </div>
            </header>

            {error && (
                <div className="p-10 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] text-rose-400 text-center space-y-4">
                    <p className="font-black uppercase tracking-widest text-xs">{error}</p>
                    <Button onClick={fetchKanbanData} variant="ghost" className="border-rose-500/20 text-rose-400">Reintentar</Button>
                </div>
            )}

            {!loading && (
                <div className="relative">
                    {/* Shadow indicators for scrolling */}
                    <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-main to-transparent z-10 pointer-events-none opacity-50" />
                    <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-main to-transparent z-10 pointer-events-none opacity-50" />

                    <CloserKanbanBoard
                        stages={data.stages}
                        board={data.board}
                        onMove={handleMove}
                    />
                </div>
            )}
        </div>
    );
};

export default CloserKanbanPage;
