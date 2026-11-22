import { useEffect, useState } from 'react';
import { ExternalLink, User, Video } from 'lucide-react';
import { Button, Chip, FieldError, Panel, Select, Skeleton, SkeletonText, Switch } from '../../../components/standard';
import NotaMarkdown from '../../../components/ficha/tabs/NotaMarkdown';
import { COLOR_CATEGORIA, cuando, tituloCorto } from './textos';

const abrir = (url) => window.open(url, '_blank', 'noopener');

/** La categoría de la nota: para ella sola o para toda su serie (también las que vengan). */
function Categoria({ nota, nombres, onElegir }) {
    const [valor, setValor] = useState(nota.category || 'other');
    const [todas, setTodas] = useState(false);
    const [estado, setEstado] = useState({});
    useEffect(() => { setValor(nota.category || 'other'); setTodas(false); setEstado({}); }, [nota.id, nota.category]);

    const guardar = async () => {
        setEstado({ guardando: true });
        try {
            const n = await onElegir(valor, todas);
            setEstado({ aviso: todas ? `Listo: cambiaron ${n} notas de «${nota.series}».` : 'Listo.' });
        } catch (e) {
            setEstado({ error: e.response?.data?.error || 'No se pudo guardar. Probá de nuevo.' });
        }
    };
    const opciones = Object.entries(nombres).map(([value, label]) => ({ value, label }));
    return (
        <Panel size="sm" className="re-cat">
            <h3 className="re-sub">Categoría</h3>
            <div className="re-cat__fila">
                <Select value={valor} options={opciones} size="sm" label="Categoría de esta reunión" onChange={setValor} />
                {nota.series && (
                    <span className="re-cat__fila">
                        <Switch checked={todas} onChange={setTodas} label={`Todas las de «${nota.series}»`} />
                        Todas las de «{nota.series}»
                    </span>
                )}
            </div>
            <p>{nota.series
                ? 'Con «Todas» vale para la serie entera y para las que vengan (lo mismo que Integraciones › Categorías).'
                : 'Esta nota no tiene serie: el cambio vale solo para ella.'}</p>
            <Button variant="primary" disabled={estado.guardando || (valor === nota.category && !todas)} onClick={guardar}>Guardar</Button>
            {estado.error && <FieldError>{estado.error}</FieldError>}
            {estado.aviso && <FieldError role="note" icon={false}>{estado.aviso}</FieldError>}
        </Panel>
    );
}

export default function NotaDetalle({ nota, nombres, onElegir, onAbrirFicha }) {
    if (!nota) return <Skeleton label="Cargando la reunión…"><SkeletonText lines={10} /></Skeleton>;
    if (nota.error) return <p className="re-aclara">No se pudo cargar la reunión.</p>;
    const { dia, hora } = cuando(nota.fecha);
    const invitados = nota.guests || [];
    return (
        <div className="re-detalle">
            <header className="re-detalle__cabeza">
                <Chip color={COLOR_CATEGORIA[nota.category] || COLOR_CATEGORIA.other} subtle>{nombres[nota.category] || 'Otra'}</Chip>
                <h2>{tituloCorto(nota.title)}</h2>
                <p className="re-detalle__meta">
                    {nota.fecha_del_doc ? 'Fecha del Doc: ' : ''}{dia} · {hora}
                    {' · '}{invitados.length ? `${invitados.length} ${invitados.length === 1 ? 'invitado' : 'invitados'}` : 'sin invitados de afuera'}
                    {nota.account_email && <> · Drive de {nota.account_email}</>}
                </p>
                <div className="re-links">
                    <Button size="sm" icon={<ExternalLink />} onClick={() => abrir(nota.doc_url)}>Abrir notas</Button>
                    {nota.recording_url && <Button size="sm" icon={<Video />} onClick={() => abrir(nota.recording_url)}>Grabación</Button>}
                    {nota.person_uuid && <Button size="sm" icon={<User />} onClick={() => onAbrirFicha(nota.person_uuid)}>Ver ficha</Button>}
                </div>
            </header>

            <Panel size="sm">
                <h3 className="re-sub">Resumen</h3>
                <p className="re-resumen">{nota.summary || 'Gemini no dejó resumen en esta nota.'}</p>
                {nota.content && (
                    <details className="re-mas-datos">
                        <summary>Nota completa</summary>
                        <NotaMarkdown texto={nota.content} />
                    </details>
                )}
                {invitados.length > 0 && (
                    <details className="re-mas-datos">
                        <summary>Invitados ({invitados.length})</summary>
                        <ul>{invitados.map(g => <li key={g}>{g}</li>)}</ul>
                    </details>
                )}
            </Panel>

            <Categoria nota={nota} nombres={nombres} onElegir={onElegir} />
        </div>
    );
}
