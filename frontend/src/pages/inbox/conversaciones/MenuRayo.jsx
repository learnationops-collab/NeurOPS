// El menú del rayito (o «/» en la caja): las variables de la persona, las respuestas rápidas del equipo
// (con sus variables ya completadas) y los pasos del flujo. Un paso lo manda el bot y el flujo sigue
// desde ahí (abre «Continuar desde…» con ese paso elegido).
import { useEffect, useState } from 'react';
import { Bot, Plus, Trash2 } from 'lucide-react';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { Button, Input, LinkButton, Modal, ModalHeader, TextArea, toast } from '../../../components/standard';
import { inboxApi } from '../api';

export const variablesDe = (contacto) => Object.entries(contacto.variables || {}).filter(([k]) => !k.startsWith('_'));
export const completar = (texto, contacto) => texto.replace(/\{(\w+)\}/g, (m, k) => {
    const v = (contacto.variables || {})[k];
    return v == null || v === '' ? m : String(v);
});

export function NuevaRapida({ onCreada, onCerrar }) {
    const [r, setR] = useState({ atajo: '', titulo: '', texto: '' });
    const crear = async (e) => {
        e.preventDefault();
        try {
            onCreada(await inboxApi.crearRapida(r));
        } catch (err) {
            toast(err.response?.data?.message || 'No se pudo guardar', 'error');
        }
    };
    return (
        <Modal onClose={onCerrar} className="cv-rapida-modal" labelledBy="cv-rapida-t">
            <ModalHeader title="Nueva respuesta rápida" titleId="cv-rapida-t" subtitle="Para todo el equipo. Usá {nombre}, {examen}… y se completan solas." onClose={onCerrar} />
            <form className="cv-rapida-form" onSubmit={crear}>
                <Input value={r.atajo} onChange={(e) => setR({ ...r, atajo: e.target.value })} placeholder="Atajo (ej.: precio)" aria-label="Atajo" autoFocus />
                <Input value={r.titulo} onChange={(e) => setR({ ...r, titulo: e.target.value })} placeholder="Título (ej.: Precio y cuotas)" aria-label="Título" />
                <TextArea value={r.texto} onChange={(e) => setR({ ...r, texto: e.target.value })} placeholder="El texto que se pega en el chat" aria-label="Texto" />
                <Button type="submit" variant="primary" disabled={!r.atajo.trim() || !r.titulo.trim() || !r.texto.trim()}>Guardar</Button>
            </form>
        </Modal>
    );
}

export default function MenuRayo({ contacto, filtro, onTexto, onPaso, onNueva }) {
    const pop = useEnPantalla();
    const [rapidas, setRapidas] = useState(null);
    const [pasos, setPasos] = useState(null);
    useEffect(() => {
        inboxApi.rapidas().then(setRapidas).catch(() => setRapidas([]));
        inboxApi.pasos(contacto.id).then(setPasos).catch(() => setPasos({ pasos: [] }));
    }, [contacto.id]);

    const f = (filtro || '').toLowerCase();
    const okV = variablesDe(contacto).filter(([k]) => !f || k.includes(f));
    const okR = (rapidas || []).filter((r) => !f || r.atajo.includes(f) || r.titulo.toLowerCase().includes(f));
    const okP = (pasos?.pasos || []).filter((p) => !f || (p.nombre || '').toLowerCase().includes(f) || `paso ${p.numero}`.includes(f));
    const borrar = async (r) => {
        try {
            await inboxApi.borrarRapida(r.id);
            setRapidas((l) => l.filter((x) => x.id !== r.id));
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo borrar', 'error');
        }
    };

    return (
        <div className="cv-rayo" ref={pop} role="menu">
            {okV.length > 0 && <span className="t-rotulo">Variables</span>}
            {okV.map(([k, v]) => (
                <button key={k} type="button" className="cv-rayo-op" onClick={() => onTexto(String(v))}><b>{`{${k}}`}</b><span>{String(v)}</span></button>
            ))}
            <span className="t-rotulo">Respuestas rápidas</span>
            {rapidas === null && <span className="t-cap mut">Cargando…</span>}
            {okR.map((r) => (
                <div key={r.id} className="cv-rayo-fila">
                    <button type="button" className="cv-rayo-op" onClick={() => onTexto(completar(r.texto, contacto))}>
                        <b>/{r.atajo} · {r.titulo}</b><span>{completar(r.texto, contacto)}</span>
                    </button>
                    {r.puede_borrar && <button type="button" className="cv-rayo-x" aria-label={`Borrar /${r.atajo}`} onClick={() => borrar(r)}><Trash2 size={13} /></button>}
                </div>
            ))}
            <LinkButton icon={<Plus size={13} />} onClick={onNueva}>Nueva respuesta rápida</LinkButton>
            {okP.length > 0 && <span className="t-rotulo">Pasos de {pasos.flujo} · el bot sigue desde ahí</span>}
            {okP.map((p) => (
                <button key={p.id} type="button" className="cv-rayo-op" onClick={() => onPaso(p.id)}>
                    <b><Bot size={13} aria-hidden="true" />Paso {p.numero}{p.nombre ? ` · ${p.nombre}` : ''}</b><span>{p.texto}</span>
                </button>
            ))}
        </div>
    );
}
