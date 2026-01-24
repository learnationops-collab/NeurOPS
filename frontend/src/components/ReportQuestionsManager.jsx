const ReportQuestionsManager = () => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ text: '', type: 'text', order: 0, is_active: true });

    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/db/questions');
            setQuestions(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/db/questions', editingId ? { ...formData, id: editingId } : formData);
            setEditingId(null);
            setFormData({ text: '', type: 'text', order: (questions.length + 1) * 10, is_active: true });
            fetchQuestions();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar esta pregunta?')) return;
        try {
            await api.delete(`/admin/db/questions/${id}`);
            fetchQuestions();
        } catch (err) {
            console.error(err);
        }
    };

    const startEdit = (q) => {
        setEditingId(q.id);
        setFormData({ text: q.text, type: q.type, order: q.order, is_active: q.is_active });
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>;

    return (
        <div className="space-y-8">
            <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 space-y-6">
                <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">
                    {editingId ? 'Editar Pregunta' : 'Nueva Pregunta'}
                </h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Texto de la Pregunta</label>
                        <input
                            type="text"
                            required
                            className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                            placeholder="Ej: ¿Cuál fue el win del día?"
                            value={formData.text}
                            onChange={e => setFormData({ ...formData, text: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Respuesta</label>
                        <select
                            className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                            value={formData.type}
                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="text">Texto Corto</option>
                            <option value="number">Número</option>
                            <option value="boolean">Si / No</option>
                            <option value="long_text">Texto Largo</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Orden</label>
                        <input
                            type="number"
                            className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                            value={formData.order}
                            onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) })}
                        />
                    </div>
                    <div className="flex gap-4 md:col-span-2">
                        <button
                            type="submit"
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                        >
                            {editingId ? 'Actualizar Pregunta' : 'Crear Pregunta'}
                        </button>
                        {editingId && (
                            <button
                                type="button"
                                onClick={() => { setEditingId(null); setFormData({ text: '', type: 'text', order: 0, is_active: true }); }}
                                className="px-8 bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <div className="bg-slate-900/40 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-800 bg-slate-800/20">
                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Orden</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Pregunta</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {questions.map(q => (
                            <tr key={q.id} className="hover:bg-slate-800/30 transition-all group">
                                <td className="px-8 py-6 text-slate-400 font-bold">{q.order}</td>
                                <td className="px-8 py-6">
                                    <p className="text-white font-bold">{q.text}</p>
                                </td>
                                <td className="px-8 py-6">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                                        {q.type}
                                    </span>
                                </td>
                                <td className="px-8 py-6">
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${q.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {q.is_active ? 'Activa' : 'Inactiva'}
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => startEdit(q)}
                                            className="p-3 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all"
                                        >
                                            <Settings size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(q.id)}
                                            className="p-3 text-slate-400 hover:text-rose-400 bg-slate-800 rounded-xl transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
