// El WhatsApp del closer: ahí le llega el aviso de cada agenda nueva (Whatchimp) y los recordatorios de
// seguimiento. Para recibir agendas tiene que confirmarlo: guarda el número, se manda un mensaje de
// prueba y confirma que le llegó (app/api/auth.py, /auth/me/whatsapp). Cambiar el número lo vuelve a pedir.

import { useEffect, useState } from 'react';
import { Check, MessageCircle, Send } from 'lucide-react';
import api from '../../../services/api';
import Button from '../../../components/ui/Button';

export default function WhatsappCloser({ onCambio }) {
    const [estado, setEstado] = useState(null); // { numero, confirmado }
    const [numero, setNumero] = useState('');
    const [paso, setPaso] = useState('editar'); // editar | enviado
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    const [aviso, setAviso] = useState(null);

    const aplicar = (datos) => { setEstado(datos); setNumero(datos.numero || ''); onCambio?.(datos); };

    useEffect(() => {
        api.get('/auth/me/whatsapp').then((r) => aplicar(r.data)).catch(() => setError('No se pudo leer tu número.'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const correr = async (fn) => {
        setOcupado(true); setError(null); setAviso(null);
        try { await fn(); } catch (e) { setError(e?.response?.data?.message || 'Algo falló. Probá de nuevo.'); } finally { setOcupado(false); }
    };

    const guardarYProbar = () => correr(async () => {
        const r = await api.put('/auth/me/whatsapp', { numero });
        aplicar(r.data);
        await api.post('/auth/me/whatsapp/prueba');
        setPaso('enviado');
        setAviso('Te mandamos un WhatsApp de prueba. ¿Te llegó?');
    });

    const confirmar = () => correr(async () => {
        const r = await api.post('/auth/me/whatsapp/confirmar');
        aplicar(r.data);
        setPaso('editar');
        setAviso('Listo: tu WhatsApp quedó confirmado.');
    });

    if (!estado && !error) return <div className="p-6 text-sm text-slate-400 animate-pulse">Cargando tu WhatsApp…</div>;
    const cambio = estado && numero.replace(/\D/g, '') !== (estado.numero || '');

    return (
        <div className="bg-surface p-6 rounded-[2rem] border border-base space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><MessageCircle size={20} /></div>
                    <div>
                        <h3 className="text-base font-black">WhatsApp</h3>
                        <p className="text-xs text-muted">Te avisamos cada agenda nueva con los datos del lead.</p>
                    </div>
                </div>
                {estado?.confirmado && !cambio
                    ? <span className="px-3 py-1 bg-success/10 text-success rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><Check size={10} />Confirmado</span>
                    : <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-[10px] font-black uppercase tracking-widest">Sin confirmar</span>}
            </div>

            <label className="block space-y-1">
                <span className="text-[11px] font-bold text-muted">Tu número, con código de país, sin + ni espacios</span>
                <input type="tel" inputMode="numeric" className="w-full px-4 py-3 bg-main border border-base rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="5491122334455" value={numero} onChange={(e) => { setNumero(e.target.value); setPaso('editar'); }} />
            </label>

            {error && <p role="alert" className="text-xs font-bold text-rose-400">{error}</p>}
            {aviso && <p role="status" className="text-xs font-bold text-emerald-400">{aviso}</p>}

            <div className="flex flex-wrap justify-end gap-2">
                {paso === 'enviado' && (
                    <>
                        <Button variant="ghost" onClick={guardarYProbar} disabled={ocupado}>No me llegó, reenviar</Button>
                        <Button variant="primary" icon={Check} onClick={confirmar} disabled={ocupado}>Sí, me llegó</Button>
                    </>
                )}
                {paso === 'editar' && (!estado?.confirmado || cambio) && (
                    <Button variant="primary" icon={Send} onClick={guardarYProbar} disabled={ocupado || numero.replace(/\D/g, '').length < 8}>
                        Mandarme una prueba
                    </Button>
                )}
            </div>
        </div>
    );
}
