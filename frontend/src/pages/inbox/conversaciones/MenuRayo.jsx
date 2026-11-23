// El menú del rayito (o «/» en la caja): las variables de la persona, los links de agenda del setter, las
// respuestas rápidas del equipo (con sus variables ya completadas), los audios del equipo (tocar uno lo manda,
// `onAudio`; sin él, con la ventana cerrada, no aparecen) y los pasos del flujo. Un paso lo manda el
// bot y el flujo sigue desde ahí (abre «Continuar desde…» con ese paso elegido). Arriba, los pasos de la Guía de la etapa
// del lead (ADR-W197); escribiendo un atajo, los de todas las etapas (`onGuia` lo pega en la caja).
import { useEffect, useState } from 'react';
import { Bot, Link2, Mic, Plus, Trash2 } from 'lucide-react';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { Button, Input, LinkButton, Modal, ModalHeader, TextArea, toast } from '../../../components/standard';
import api from '../../../services/api';
import { rotuloDeLink } from '../../setter/MisLinks';
import { inboxApi } from '../api';
import { LETRAS, completarGuia, siguienteId, useGuia, useLinkAgenda, visibles } from '../guia/useGuia';
import { faseDe } from './fasesSetting';

export const variablesDe = (contacto) => Object.entries(contacto.variables || {}).filter(([k]) => !k.startsWith('_'));
export const completar = (texto, contacto) => texto.replace(/\{(\w+)\}/g, (m, k) => {
    const v = (contacto.variables || {})[k];
    return v == null || v === '' ? m : String(v);
});

// La vista previa: el texto con lo que salió de la ficha resaltado, para ver qué se completó y qué no.
function Resaltado({ texto, contacto }) {
    const partes = texto.split(/(\{\w+\})/);
    return partes.map((p, i) => {
        const m = /^\{(\w+)\}$/.exec(p);
        if (!m) return p;
        const v = (contacto.variables || {})[m[1]];
        return v == null || v === '' ? <span key={i} className="cv-var-falta">{p}</span> : <mark key={i} className="cv-var-ok">{String(v)}</mark>;
    });
}

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

export default function MenuRayo({ contacto, fase, filtro, onTexto, onGuia, onPaso, onNueva, onAudio }) {
    const guia = useGuia();
    const linkAgenda = useLinkAgenda();
    const pop = useEnPantalla();
    const [rapidas, setRapidas] = useState(null);
    const [pasos, setPasos] = useState(null);
    const [audios, setAudios] = useState([]);
    // Los links de agenda del setter, a mano en la conversación (Sales Team, 07/11/2026). Quien no es setter
    // no tiene: el pedido falla y la sección no aparece.
    const [links, setLinks] = useState([]);
    useEffect(() => {
        inboxApi.rapidas().then(setRapidas).catch(() => setRapidas([]));
        inboxApi.pasos(contacto.id).then(setPasos).catch(() => setPasos({ pasos: [] }));
    }, [contacto.id]);
    useEffect(() => { if (onAudio) inboxApi.audios().then(setAudios).catch(() => setAudios([])); }, [onAudio]);
    useEffect(() => {
        api.get('/setter/agendas-links').then((r) => setLinks(Array.isArray(r?.data?.links) ? r.data.links : []), () => {});
    }, []);

    const f = (filtro || '').toLowerCase();
    const okV = variablesDe(contacto).filter(([k]) => !f || k.includes(f));
    const okL = links.filter((l) => !f || 'link agenda'.includes(f) || rotuloDeLink(l).toLowerCase().includes(f));
    const okR = (rapidas || []).filter((r) => !f || r.atajo.includes(f) || r.titulo.toLowerCase().includes(f));
    const okA = onAudio ? audios.filter((a) => !f || 'audio'.includes(f) || a.nombre.toLowerCase().includes(f)) : [];
    const okP = (pasos?.pasos || []).filter((p) => !f || (p.nombre || '').toLowerCase().includes(f) || `paso ${p.numero}`.includes(f));
    // Sin filtro, los pasos de su etapa; con filtro, los de cualquier etapa cuyo atajo o nombre coincida.
    const okG = Object.entries(guia?.contenido?.etapas || {}).flatMap(([id, e]) => visibles(e.pasos || [])
        .filter((p) => (f ? p.atajo.includes(f) || p.t.toLowerCase().includes(f) : id === fase))
        .flatMap((p) => p.op.map((o, j) => ({ id, p, o, j }))));
    const guiaElegida = ({ id, p, j }) => onGuia({ texto: completarGuia(p.op[j].x, contacto, linkAgenda), clave: `${id}:${p.id}:${j}`,
        pasaA: p.avanza ? siguienteId(id) : null });
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
            {okG.length > 0 && <span className="t-rotulo">Guía · {f ? 'todas las etapas' : faseDe(fase).label}</span>}
            {okG.map((g) => (
                <button key={`${g.id}:${g.p.id}:${g.j}`} type="button" className="cv-rayo-op" onClick={() => guiaElegida(g)}>
                    <b>/{g.p.atajo} · {g.p.t}{g.p.porRespuesta ? ` · ${g.o.si}` : g.p.op.length > 1 ? ` · ${LETRAS[g.j]}` : ''}{f && g.id !== fase ? ` (${faseDe(g.id).label})` : ''}</b>
                    <span>{g.o.x}</span>
                </button>
            ))}
            {okV.length > 0 && <span className="t-rotulo">Variables</span>}
            {okV.map(([k, v]) => (
                <button key={k} type="button" className="cv-rayo-op" onClick={() => onTexto(String(v))}><b>{`{${k}}`}</b><span>{String(v)}</span></button>
            ))}
            {okL.length > 0 && <span className="t-rotulo">Links de agenda · el formulario lo manda a closing o a triage</span>}
            {okL.map((l) => {
                const url = window.location.origin + l.ruta;
                return (
                    <button key={l.ruta} type="button" className="cv-rayo-op" onClick={() => onTexto(url)}>
                        <b><Link2 size={13} aria-hidden="true" />{rotuloDeLink(l)}</b><span>{url}</span>
                    </button>
                );
            })}
            <span className="t-rotulo">Respuestas rápidas</span>
            {rapidas === null && <span className="t-cap mut">Cargando…</span>}
            {okR.map((r) => (
                <div key={r.id} className="cv-rayo-fila">
                    <button type="button" className="cv-rayo-op" onClick={() => onTexto(completar(r.texto, contacto))}>
                        <b>/{r.atajo} · {r.titulo}</b><span><Resaltado texto={r.texto} contacto={contacto} /></span>
                    </button>
                    {r.puede_borrar && <button type="button" className="cv-rayo-x" aria-label={`Borrar /${r.atajo}`} onClick={() => borrar(r)}><Trash2 size={13} /></button>}
                </div>
            ))}
            <LinkButton icon={<Plus size={13} />} onClick={onNueva}>Nueva respuesta rápida</LinkButton>
            {okA.length > 0 && <span className="t-rotulo">Audios · tocá uno para mandarlo</span>}
            {okA.map((a) => (
                <button key={a.id} type="button" className="cv-rayo-op" onClick={() => onAudio(a)}>
                    <b><Mic size={13} aria-hidden="true" />{a.nombre}</b><span>{a.autor ? `subido por ${a.autor}` : 'Audio del equipo'}</span>
                </button>
            ))}
            {okP.length > 0 && <span className="t-rotulo">Pasos de {pasos.flujo} · el bot sigue desde ahí</span>}
            {okP.map((p) => (
                <button key={p.id} type="button" className="cv-rayo-op" onClick={() => onPaso(p.id)}>
                    <b><Bot size={13} aria-hidden="true" />Paso {p.numero}{p.nombre ? ` · ${p.nombre}` : ''}</b><span>{p.texto}</span>
                </button>
            ))}
        </div>
    );
}
