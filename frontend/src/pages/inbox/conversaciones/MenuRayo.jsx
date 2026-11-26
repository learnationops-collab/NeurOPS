// El menú del rayito (o «/» en la caja): las variables de la persona, los links de agenda del setter, las
// respuestas rápidas del equipo (con sus variables ya completadas), los audios del equipo (tocar uno lo manda,
// `onAudio`; sin él, con la ventana cerrada, no aparecen) y los pasos del flujo. Un paso lo manda el
// bot y el flujo sigue desde ahí (abre «Continuar desde…» con ese paso elegido). Arriba, los pasos de la Guía de la etapa
// del lead (ADR-W197); escribiendo un atajo, los de todas las etapas (`onGuia` lo pega en la caja).
import { useEffect, useState } from 'react';
import { Bot, Braces, Compass, Link2, Mic, Plus, Trash2, Zap } from 'lucide-react';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { Button, Input, Modal, ModalHeader, TextArea, toast } from '../../../components/standard';
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

    // La vista previa de la opción bajo el mouse, a la derecha (como Notion): el texto entero y qué hace.
    const [vista, setVista] = useState(null);
    const ver = (titulo, texto, que) => ({ onMouseEnter: () => setVista({ titulo, texto, que }), onFocus: () => setVista({ titulo, texto, que }) });
    const variante = (g) => (g.p.porRespuesta ? g.o.si : g.p.op.length > 1 ? LETRAS[g.j] : null);

    return (
        <div className="cv-rayo" ref={pop} role="menu">
            <div className="cv-rayo-lista">
                {okG.length > 0 && <Seccion icono={Compass} color="var(--brand-secondary)" titulo="Guía" nota={f ? 'todas las etapas' : faseDe(fase).label} />}
                {okG.map((g) => (
                    <Op key={`${g.id}:${g.p.id}:${g.j}`} icono={Compass} color="var(--brand-secondary)" titulo={g.p.t} atajo={g.p.atajo} chip={variante(g)}
                        extra={f && g.id !== fase ? faseDe(g.id).label : null} texto={g.o.x} onClick={() => guiaElegida(g)}
                        {...ver(g.p.t, g.o.x, g.p.avanza ? 'Se pega en la caja y, al mandarlo, pasa a la etapa siguiente' : 'Se pega en la caja para que lo revises')} />
                ))}
                {okV.length > 0 && <Seccion icono={Braces} color="var(--info)" titulo="Variables" nota="lo que sabemos del lead" />}
                {okV.map(([k, v]) => (
                    <Op key={k} icono={Braces} color="var(--info)" titulo={k} texto={String(v)} onClick={() => onTexto(String(v))}
                        {...ver(`{${k}}`, String(v), 'Pega el valor en la caja')} />
                ))}
                {okL.length > 0 && <Seccion icono={Link2} color="var(--success)" titulo="Links de agenda" nota="closing o triage según el formulario" />}
                {okL.map((l) => {
                    const url = window.location.origin + l.ruta;
                    return <Op key={l.ruta} icono={Link2} color="var(--success)" titulo={rotuloDeLink(l)} texto={url} onClick={() => onTexto(url)}
                        {...ver(rotuloDeLink(l), url, 'Pega tu link de agendamiento')} />;
                })}
                <Seccion icono={Zap} color="var(--warning)" titulo="Respuestas rápidas" nota="del equipo" />
                {rapidas === null && <span className="cv-rayo-cargando">Cargando…</span>}
                {okR.map((r) => (
                    <Op key={r.id} icono={Zap} color="var(--warning)" titulo={r.titulo} atajo={r.atajo} texto={<Resaltado texto={r.texto} contacto={contacto} />}
                        onClick={() => onTexto(completar(r.texto, contacto))} {...ver(r.titulo, completar(r.texto, contacto), 'Se pega con las variables ya completadas')}
                        quitar={r.puede_borrar ? () => borrar(r) : null} />
                ))}
                <button type="button" className="cv-rayo-nueva" onClick={onNueva}><Plus size={13} aria-hidden="true" />Nueva respuesta rápida</button>
                {okA.length > 0 && <Seccion icono={Mic} color="#8B5CF6" titulo="Audios" nota="tocá uno para mandarlo" />}
                {okA.map((a) => (
                    <Op key={a.id} icono={Mic} color="#8B5CF6" titulo={a.nombre} texto={a.autor ? `subido por ${a.autor}` : 'Audio del equipo'} onClick={() => onAudio(a)}
                        {...ver(a.nombre, a.autor ? `Subido por ${a.autor}` : 'Audio del equipo', 'Sale al toque como audio')} />
                ))}
                {okP.length > 0 && <Seccion icono={Bot} color="var(--text-muted)" titulo={`Pasos de ${pasos.flujo}`} nota="el bot sigue desde ahí" />}
                {okP.map((p) => (
                    <Op key={p.id} icono={Bot} color="var(--text-muted)" titulo={`Paso ${p.numero}${p.nombre ? ` · ${p.nombre}` : ''}`} texto={p.texto} onClick={() => onPaso(p.id)}
                        {...ver(`Paso ${p.numero}`, p.texto, 'Lo manda el bot y el flujo sigue desde ahí')} />
                ))}
            </div>
            <aside className="cv-rayo-vista" aria-hidden="true">
                {vista ? (
                    <div key={vista.titulo} className="cv-rayo-vista-in">
                        <b>{vista.titulo}</b>
                        <p>{vista.texto}</p>
                        <small>{vista.que}</small>
                    </div>
                ) : <p className="cv-rayo-vista-vacia">Pasá el mouse por una opción para verla entera.</p>}
            </aside>
        </div>
    );
}

function Seccion({ icono: Icono, color, titulo, nota }) {
    return (
        <span className="cv-rayo-sec" style={{ '--c': color }}>
            <Icono size={12} aria-hidden="true" />{titulo}{nota && <small>{nota}</small>}
        </span>
    );
}

// Una opción: el ícono en su color, el título, el atajo como tecla y una línea del texto.
function Op({ icono: Icono, color, titulo, atajo, chip, extra, texto, onClick, quitar, ...rest }) {
    return (
        <div className="cv-rayo-fila">
            <button type="button" className="cv-rayo-op" role="menuitem" style={{ '--c': color }} onClick={onClick} {...rest}>
                <span className="cv-rayo-ico"><Icono size={14} aria-hidden="true" /></span>
                <span className="cv-rayo-txt">
                    <b>{titulo}{chip && <i className="cv-rayo-chip">{chip}</i>}{extra && <i className="cv-rayo-chip cv-rayo-chip--suave">{extra}</i>}</b>
                    <span>{texto}</span>
                </span>
                {atajo && <kbd className="cv-rayo-kbd">/{atajo}</kbd>}
            </button>
            {quitar && <button type="button" className="cv-rayo-x" aria-label={`Borrar /${atajo}`} onClick={quitar}><Trash2 size={13} /></button>}
        </div>
    );
}
