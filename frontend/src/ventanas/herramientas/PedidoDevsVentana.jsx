// La herramienta «Pedido a los devs» (ADR-W181): una sugerencia, un cambio o una consulta de la plataforma va
// directo al Inbox de Leadership de un dev (los de LEADERSHIP_DEVS), por Leadership rápido (`/crear` con `para`).
// Pedido de Jean Carlo en la reunión del 19/11: registrar cambios y consultas sin salir de Work.
import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import api from '../../services/api';
import { Button, Input, Select, TextArea, toast } from '../../components/standard';
import { mensajeDe } from './leadership/useLeadershipRapido';

const SILENCIOSO = { skipBugReport: true };

export default function PedidoDevsVentana() {
    const [devs, setDevs] = useState(null);     // null = cargando
    const [error, setError] = useState(null);
    const [para, setPara] = useState('');
    const [titulo, setTitulo] = useState('');
    const [detalle, setDetalle] = useState('');
    const [mandando, setMandando] = useState(false);
    const [enviado, setEnviado] = useState(null);

    useEffect(() => {
        api.get('/leadership/rapido/opciones', SILENCIOSO)
            .then(({ data }) => {
                const lista = Array.isArray(data?.devs) ? data.devs : [];
                setDevs(lista);
                if (lista.length) setPara(lista[0].email);
            })
            .catch(e => { setError(mensajeDe(e)); setDevs([]); });
    }, []);

    const mandar = async (e) => {
        e.preventDefault();
        if (!titulo.trim() || !para || mandando) return;
        setMandando(true);
        try {
            await api.post('/leadership/rapido/crear', {
                titulo: titulo.trim(), tipo: 'quick', para, descripcion: detalle.trim() || null,
            }, SILENCIOSO);
            const quien = devs.find(d => d.email === para)?.nombre || 'el dev';
            setEnviado(quien);
            setTitulo('');
            setDetalle('');
            toast(`Le llegó a ${quien}`, 'success');
        } catch (err) {
            toast(mensajeDe(err), 'error');
        } finally {
            setMandando(false);
        }
    };

    if (devs === null) return <p className="bl-nota">Cargando…</p>;
    if (error) return <p className="bl-nota">{error}</p>;
    if (!devs.length) return <p className="bl-nota">Todavía no hay devs cargados en Leadership.</p>;

    return (
        <form className="bl" onSubmit={mandar}>
            <p className="bl-nota">Un cambio, un error o una duda de la plataforma: le llega al Inbox de Leadership del dev.</p>
            {devs.length > 1 && (
                <Select label="Para" value={para} onChange={setPara}
                    options={devs.map(d => ({ value: d.email, label: d.nombre }))} />
            )}
            <Input autoFocus value={titulo} maxLength={255} onChange={(e) => { setTitulo(e.target.value); setEnviado(null); }}
                placeholder="Qué querés que cambie o qué no anda" aria-label="Qué pedís" />
            <TextArea value={detalle} maxLength={5000} onChange={(e) => setDetalle(e.target.value)} rows={4}
                placeholder="Detalle (opcional): dónde, qué pasó, qué esperabas" aria-label="Detalle" />
            <Button type="submit" variant="primary" icon={<Send size={15} />} disabled={!titulo.trim() || mandando}>
                {mandando ? 'Mandando…' : `Mandar a ${devs.find(d => d.email === para)?.nombre || 'los devs'}`}
            </Button>
            {enviado && <p className="bl-nota">Listo: está en el Inbox de {enviado}. Podés mandar otro.</p>}
        </form>
    );
}
