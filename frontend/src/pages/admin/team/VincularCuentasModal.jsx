import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Unlink, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { rotuloDeRol } from '../../../utils/cuentasVinculadas';

/**
 * Vincular cuentas: una persona con varios roles (p. ej. administrador comercial y closer) conserva
 * una cuenta por rol, con su historial, y las cuentas se enlazan como la misma persona. Desde
 * cualquiera de ellas se pasa a la otra con el selector de rol del dock. Lo gestionan los
 * operadores; las cuentas vinculadas nunca se fusionan, así que desvincular no pierde nada.
 */
const VincularCuentasModal = ({ users, onCerrar, onCambio }) => {
    const [personas, setPersonas] = useState(null);
    const [elegidas, setElegidas] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [guardando, setGuardando] = useState(false);

    const cargar = useCallback(async () => {
        try {
            const res = await api.get('/auth/personas');
            setPersonas(res.data.personas || []);
        } catch (e) {
            toast.error(e?.response?.data?.message || 'No se pudieron cargar los vínculos');
            setPersonas([]);
        }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const candidatos = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return users
            .filter((u) => u.is_active)
            .filter((u) => !q || `${u.username} ${u.email} ${u.role}`.toLowerCase().includes(q));
    }, [users, busqueda]);

    const alternar = (id) => setElegidas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const accion = async (ruta, cuerpo, ok) => {
        setGuardando(true);
        try {
            const res = await api.post(ruta, cuerpo);
            setPersonas(res.data.personas || []);
            setElegidas([]);
            toast.success(ok);
            onCambio?.();
        } catch (e) {
            toast.error(e?.response?.data?.message || 'No se pudo guardar');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Modal
            tono="tema"
            ancho="xl"
            titulo="Vincular cuentas"
            subtitulo="Una persona con varios roles cambia de uno a otro desde el dock"
            onCerrar={onCerrar}
            cerrable={!guardando}
            cuerpoClassName="space-y-6"
        >
            <section className="space-y-3">
                <small className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Vinculadas hoy</small>
                {personas === null && <Loader2 size={18} className="animate-spin text-muted" />}
                {personas && personas.length === 0 && (
                    <p className="text-sm text-muted">Todavía no hay personas con varios roles.</p>
                )}
                {personas && personas.map((p) => (
                    <div key={p.persona_id} className="rounded-2xl border border-base p-4 space-y-2">
                        {p.cuentas.map((c) => (
                            <div key={c.id} className="flex items-center justify-between gap-3">
                                <span className="text-sm font-bold text-base">
                                    {c.username} <span className="text-muted font-normal">· {rotuloDeRol(c.role)}</span>
                                    {!c.is_active && <span className="text-muted font-normal"> · inactiva</span>}
                                </span>
                                <Button variant="outline" disabled={guardando}
                                    onClick={() => accion('/auth/personas/desvincular', { user_id: c.id }, 'Cuenta desvinculada')}
                                    className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                    <Unlink size={14} /> Desvincular
                                </Button>
                            </div>
                        ))}
                    </div>
                ))}
            </section>

            <section className="space-y-3">
                <small className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Vincular nuevas</small>
                <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre, correo o rol"
                    aria-label="Buscar cuenta"
                    className="w-full h-11 px-4 rounded-2xl bg-main border border-base text-sm"
                />
                <div className="max-h-64 overflow-y-auto rounded-2xl border border-base divide-y divide-base/50">
                    {candidatos.map((u) => (
                        <label key={u.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5">
                            <input type="checkbox" checked={elegidas.includes(u.id)} onChange={() => alternar(u.id)} />
                            <span className="text-sm text-base">
                                <b>{u.username}</b> <span className="text-muted">· {rotuloDeRol(u.role)} · {u.email}</span>
                                {u.persona_id && <span className="text-muted"> · ya vinculada</span>}
                            </span>
                        </label>
                    ))}
                    {candidatos.length === 0 && <p className="px-4 py-3 text-sm text-muted">Sin resultados.</p>}
                </div>
                <div className="flex justify-end">
                    <Button variant="primary" disabled={guardando || elegidas.length < 2}
                        onClick={() => accion('/auth/personas/vincular', { user_ids: elegidas }, 'Cuentas vinculadas')}
                        className="h-11 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                        {guardando ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                        Vincular {elegidas.length >= 2 ? `${elegidas.length} cuentas` : 'cuentas'}
                    </Button>
                </div>
            </section>
        </Modal>
    );
};

export default VincularCuentasModal;
