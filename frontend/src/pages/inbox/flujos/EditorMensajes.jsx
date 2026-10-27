// Editar solo los textos de los mensajes de un flujo publicado: lo que puede tocar el setter. Los pasos van
// en orden y agrupados por etapa; los botones, las esperas y las condiciones se ven con candado. Publica una
// versión nueva a partir de la publicada (no del borrador de la dirección) y no cambia el estado del flujo.
import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, GitBranch, Info, Lock, Zap } from 'lucide-react';
import { Button, Card, Chip, EmptyState, HeaderActions, IconButton, LinkButton, TextArea, toast } from '../../../components/standard';
import { inboxApi } from '../api';

const LARGO = 1000;
const FIJO = { esperar: [Clock, (p) => `Esperar ${p.minutos} min si no contesta`], condicion: [GitBranch, () => 'Condición'], accion: [Zap, () => 'Acción'] };

function Mensaje({ paso, textos, editado, onCambiar, onRestaurar }) {
    return (
        <Card as="section" className={`em-paso${editado ? ' em-paso--editado' : ''}`}>
            <div className="em-paso-cab">
                <span className="t-rotulo">Mensaje · Paso {paso.numero}</span>
                {paso.nombre && <b>{paso.nombre}</b>}
                {editado && <Chip subtle color="var(--warning)">Editado</Chip>}
            </div>
            {textos.map((t, i) => (
                <div key={i} className="em-texto">
                    <TextArea value={t} aria-label={`Texto ${i + 1} del paso ${paso.numero}`} invalid={t.length > LARGO}
                        onChange={(e) => onCambiar(textos.map((x, j) => (j === i ? e.target.value : x)))} />
                    <span className={`em-largo${t.length > LARGO ? ' em-largo--pasado' : ''}`}>{t.length} / {LARGO}</span>
                </div>
            ))}
            {paso.botones.length > 0 && (
                <div className="em-botones">
                    <span className="t-cap mut40">Botones</span>
                    {paso.botones.map((b) => <Chip key={b} subtle icon={<Lock />} data-tip="Los botones definen el camino del flujo">{b}</Chip>)}
                </div>
            )}
            {paso.guarda && <p className="t-cap mut40">La respuesta se guarda en <b>{paso.guarda}</b></p>}
            {editado && <LinkButton onClick={onRestaurar}>Volver al publicado</LinkButton>}
        </Card>
    );
}

export default function EditorMensajes({ id, onVolver }) {
    const [datos, setDatos] = useState(null);
    const [cambios, setCambios] = useState({});
    const [publicando, setPublicando] = useState(false);
    useEffect(() => { inboxApi.mensajesFlujo(id).then(setDatos).catch(() => setDatos({ error: true })); }, [id]);

    const n = Object.keys(cambios).length;
    const pasado = Object.values(cambios).some((l) => l.some((t) => t.length > LARGO));
    const cambiar = (paso, textos) => setCambios((c) => {
        const { [paso.id]: _, ...resto } = c;
        return textos.every((t, i) => t === paso.textos[i]) ? resto : { ...resto, [paso.id]: textos };
    });
    const restaurar = (paso) => setCambios(({ [paso.id]: _, ...resto }) => resto);
    const publicar = async () => {
        setPublicando(true);
        try {
            const r = await inboxApi.guardarMensajes(id, cambios);
            toast(`${datos.nombre} publicado como v${r.version}`);
            onVolver();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo publicar', 'error');
            setPublicando(false);
        }
    };

    let cuerpo;
    if (!datos) cuerpo = <EmptyState>Cargando…</EmptyState>;
    else if (datos.error) cuerpo = <EmptyState>No se pudieron cargar los mensajes.</EmptyState>;
    else {
        cuerpo = datos.pasos.map((p, i) => {
            const etapa = p.etapa && p.etapa !== datos.pasos[i - 1]?.etapa ? <p key={`e${p.id}`} className="em-etapa">Etapa · {p.etapa}</p> : null;
            if (p.tipo === 'mensaje') {
                return [etapa, <Mensaje key={p.id} paso={p} textos={cambios[p.id] || p.textos} editado={Boolean(cambios[p.id])}
                    onCambiar={(t) => cambiar(p, t)} onRestaurar={() => restaurar(p)} />];
            }
            const [Icono, texto] = FIJO[p.tipo] || [Lock, () => p.tipo];
            return [etapa, (
                <div key={p.id} className="em-fijo"><Icono size={13} aria-hidden="true" />{p.nombre || texto(p)}<Lock size={12} aria-hidden="true" className="em-fijo-candado" /></div>
            )];
        });
    }

    return (
        <>
            <HeaderActions replaceTitle>
                <div className="barra em-barra">
                    <IconButton label="Volver a los flujos" icon={<ArrowLeft size={16} />} onClick={onVolver} />
                    <div className="em-titulo">
                        <strong>{datos?.nombre || 'Flujo'}</strong>
                        <span className="t-cap mut">Editar mensajes{datos?.version ? ` · publicado v${datos.version}` : ''}</span>
                    </div>
                    <div className="barra-der">
                        {n > 0 && <span className="em-cambios">{n === 1 ? '1 mensaje cambiado' : `${n} mensajes cambiados`}</span>}
                        {n > 0 && <Button onClick={() => setCambios({})}>Descartar</Button>}
                        <Button variant="primary" disabled={!n || pasado || publicando} onClick={publicar}>
                            Publicar{datos?.version ? ` como v${datos.version + 1}` : ''}
                        </Button>
                    </div>
                </div>
            </HeaderActions>
            <div className="em">
                <p className="em-nota"><Info size={15} aria-hidden="true" />Podés cambiar el texto de los mensajes. Los pasos, los botones y las condiciones
                    los arma la dirección comercial: cambiarlos movería a la gente de camino.</p>
                {cuerpo}
            </div>
        </>
    );
}
