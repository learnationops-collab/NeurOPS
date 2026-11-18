// El campo para escribir en el canal: «@» abre la lista del equipo (Work y la Academia, y Learnito si lo usás)
// arriba del campo; elegir pone «@Nombre» y, al enviar, quien quedó nombrado recibe el aviso. Enter envía,
// Shift+Enter baja de línea, Esc cierra la lista.
import { useMemo, useState } from 'react';
import { SendHorizontal, Sparkles, X } from 'lucide-react';
import { Avatar, IconButton, TextArea, toast } from '../../../components/standard';
import { colorDe } from './formato';

const LEARNITO = { nombre: 'Learnito', email: null, learnito: true };

export default function Escribir({ personas, conLearnito, respondiendo, setRespondiendo, campo, onEnviar, pensando }) {
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [filtro, setFiltro] = useState(null);      // null = lista cerrada

    const opciones = useMemo(() => {
        if (filtro === null) return [];
        const f = filtro.toLowerCase();
        return [...(conLearnito ? [LEARNITO] : []), ...personas].filter(p => p.nombre.toLowerCase().includes(f)).slice(0, 6);
    }, [filtro, personas, conLearnito]);

    const cambiar = (valor) => {
        setTexto(valor);
        const m = valor.match(/@([^\s@]*)$/);
        setFiltro(m ? m[1] : null);
    };

    const elegir = (p) => {
        setTexto(t => t.replace(/@[^\s@]*$/, `@${p.nombre} `));
        setFiltro(null);
        campo.current?.focus();
    };

    const enviar = async () => {
        const t = texto.trim();
        if (!t || enviando) return;
        // A quién avisar: los del equipo cuyo «@Nombre» sigue en el texto.
        const menciones = personas.filter(p => p.email && t.includes(`@${p.nombre}`)).map(p => p.email);
        setEnviando(true);
        try {
            await onEnviar(t, { parentId: respondiendo?.id, menciones, cita: respondiendo });
            setTexto('');
            setRespondiendo(null);
        } catch (e) {
            toast(e.response?.data?.error || 'No se pudo enviar. Probá de nuevo.', 'error');
        } finally {
            setEnviando(false);
            campo.current?.focus();
        }
    };

    const teclas = (e) => {
        if (e.key === 'Escape' && filtro !== null) { e.stopPropagation(); setFiltro(null); return; }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (opciones.length) elegir(opciones[0]); else enviar();
        }
    };

    return (
        <div className="ch-escribir">
            {opciones.length > 0 && (
                <div className="ch-arroba" role="listbox" aria-label="Etiquetar">
                    {opciones.map(p => (
                        <button key={p.email || 'learnito'} type="button" role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); elegir(p); }}>
                            {p.learnito
                                ? <span className="ch-av-l ch-av-l--s"><Sparkles size={12} aria-hidden="true" /></span>
                                : <Avatar size="xs" name={p.nombre} photo={p.foto} color={colorDe(p.nombre)} />}
                            <span>{p.nombre}<small>{p.learnito ? 'Responde acá, a la vista de todos' : p.email}</small></span>
                        </button>
                    ))}
                </div>
            )}
            {respondiendo && (
                <div className="ch-escribir__resp">
                    Respondiendo a <b>{respondiendo.autor.nombre}</b>
                    <IconButton size="xs" label="No responder" icon={<X size={13} />} onClick={() => setRespondiendo(null)} />
                </div>
            )}
            <div className="ch-escribir__campo">
                <TextArea bare ref={campo} value={texto} placeholder="Escribí en Equipo…" maxLength={4000} aria-label="Mensaje"
                    onChange={(e) => cambiar(e.target.value)} onKeyDown={teclas} />
                <IconButton label="Enviar" icon={<SendHorizontal size={16} />} onClick={enviar} disabled={!texto.trim() || enviando} />
            </div>
            <p className="ch-escribir__pie">
                {pensando ? 'Learnito está respondiendo en el canal…' : `@ etiqueta a alguien${conLearnito ? ' · @Learnito le pregunta en el canal' : ''} · Lo ve todo el equipo, en Work, la Academia y Leadership`}
            </p>
        </div>
    );
}
