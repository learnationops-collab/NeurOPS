// Las etiquetas de la conversación, en la cabecera del chat: se sacan con su × y se ponen desde «+ Etiqueta»,
// que muestra los grupos (p. ej. «Temperatura») con sus etiquetas y deja crear una etiqueta o un grupo nuevo.
// En un grupo exclusivo, poner una saca la otra (lo resuelve el servidor).
import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { Button, Chip, Input, LinkButton, Switch, toast } from '../../../components/standard';
import { inboxApi } from '../api';

export function Etiqueta({ e, onSacar }) {
    return (
        <Chip subtle color={e.color || 'var(--text-muted)'} className="cv-etiqueta" data-tip={e.group ? `${e.group}|${e.name}` : undefined}>
            {e.name}
            {onSacar && <button type="button" className="cv-etiqueta-x" aria-label={`Sacar ${e.name}`} onClick={() => onSacar(e)}><X size={11} /></button>}
        </Chip>
    );
}

function NuevoGrupo({ onCreado }) {
    const [nombre, setNombre] = useState('');
    const [exclusivo, setExclusivo] = useState(true);
    const crear = async (ev) => {
        ev.preventDefault();
        try {
            onCreado(await inboxApi.crearGrupoEtiquetas({ name: nombre.trim(), exclusive: exclusivo }));
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo crear el grupo', 'error');
        }
    };
    return (
        <form className="cv-tag-form" onSubmit={crear}>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del grupo (ej.: Temperatura)" aria-label="Nombre del grupo" autoFocus />
            <span className="cv-tag-check">
                <Switch checked={exclusivo} onChange={setExclusivo} label="Una sola por conversación" />
                <span className="t-cap">Una sola por conversación (como Caliente o Frío)</span>
            </span>
            <Button type="submit" variant="primary" disabled={!nombre.trim()}>Crear grupo</Button>
        </form>
    );
}

function Menu({ puestas, onPoner }) {
    const [catalogo, setCatalogo] = useState(null);
    const [grupo, setGrupo] = useState(null);
    const [nombre, setNombre] = useState('');
    const [creandoGrupo, setCreandoGrupo] = useState(false);
    useEffect(() => { inboxApi.etiquetas().then(setCatalogo).catch(() => setCatalogo({ grupos: [], sueltas: [] })); }, []);
    const tiene = (gid, n) => puestas.some((e) => (e.group_id || null) === gid && e.name === n);
    const agregar = (ev) => {
        ev.preventDefault();
        const n = nombre.trim();
        if (!n) return;
        onPoner(grupo, n);
        setNombre('');
        // Que aparezca en su grupo sin volver a pedir el catálogo.
        const nueva = (lista) => (lista.some((t) => t.name.toLowerCase() === n.toLowerCase()) ? lista : [...lista, { name: n, n: 1 }]);
        setCatalogo((c) => (grupo === null
            ? { ...c, sueltas: nueva(c.sueltas) }
            : { ...c, grupos: c.grupos.map((g) => (g.id === grupo ? { ...g, tags: nueva(g.tags) } : g)) }));
    };
    if (!catalogo) return <p className="t-cap mut">Cargando…</p>;
    const grupos = catalogo.grupos;
    return (
        <>
            {grupos.map((g) => (
                <div key={g.id} className="cv-tag-grupo">
                    <span className="t-rotulo">{g.name}{g.exclusive && <span className="mut40"> · una sola</span>}</span>
                    <div className="cv-tag-opciones">
                        {g.tags.map((t) => (
                            <Chip key={t.name} as="button" type="button" subtle color={g.color} aria-pressed={tiene(g.id, t.name)}
                                onClick={() => onPoner(g.id, t.name)}>{t.name}</Chip>
                        ))}
                        {!g.tags.length && <span className="t-cap mut40">Todavía sin etiquetas</span>}
                    </div>
                </div>
            ))}
            {catalogo.sueltas.length > 0 && (
                <div className="cv-tag-grupo">
                    <span className="t-rotulo">Sin grupo</span>
                    <div className="cv-tag-opciones">
                        {catalogo.sueltas.map((t) => (
                            <Chip key={t.name} as="button" type="button" subtle aria-pressed={tiene(null, t.name)} onClick={() => onPoner(null, t.name)}>{t.name}</Chip>
                        ))}
                    </div>
                </div>
            )}
            <form className="cv-tag-form" onSubmit={agregar}>
                <span className="t-rotulo">Etiqueta nueva</span>
                <div className="cv-tag-opciones">
                    <Chip as="button" type="button" aria-pressed={grupo === null} onClick={() => setGrupo(null)}>Sin grupo</Chip>
                    {grupos.map((g) => <Chip key={g.id} as="button" type="button" color={g.color} aria-pressed={grupo === g.id} onClick={() => setGrupo(g.id)}>{g.name}</Chip>)}
                </div>
                <div className="cv-tag-fila">
                    <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej.: Caliente)" aria-label="Nombre de la etiqueta" />
                    <Button type="submit" disabled={!nombre.trim()}>Agregar</Button>
                </div>
            </form>
            {creandoGrupo
                ? <NuevoGrupo onCreado={(g) => { setCatalogo({ ...catalogo, grupos: [...grupos, g] }); setGrupo(g.id); setCreandoGrupo(false); }} />
                : <LinkButton icon={<Plus size={13} />} onClick={() => setCreandoGrupo(true)}>Grupo nuevo</LinkButton>}
        </>
    );
}

export default function Etiquetas({ contactoId, etiquetas, onCambio }) {
    const [abierto, setAbierto] = useState(false);
    const caja = useRef(null);
    const pop = useEnPantalla();

    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
        const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', tecla);
        return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
    }, [abierto]);

    const pedir = async (llamada) => {
        try {
            await llamada;
            onCambio();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo cambiar la etiqueta', 'error');
        }
    };
    const poner = (grupoId, nombre) => {
        const puesta = etiquetas.find((e) => (e.group_id || null) === grupoId && e.name === nombre);
        pedir(puesta ? inboxApi.sacarEtiqueta(contactoId, puesta.id) : inboxApi.ponerEtiqueta(contactoId, { group_id: grupoId, name: nombre }));
    };

    return (
        <div className="cv-etiquetas" ref={caja}>
            {etiquetas.map((e) => <Etiqueta key={e.id} e={e} onSacar={(x) => pedir(inboxApi.sacarEtiqueta(contactoId, x.id))} />)}
            <button type="button" className="cv-tag-add" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>+ Etiqueta</button>
            {abierto && (
                <div className="cv-tag-pop" ref={pop} role="dialog" aria-label="Etiquetas">
                    <Menu puestas={etiquetas} onPoner={poner} />
                </div>
            )}
        </div>
    );
}
