// Sección Conversaciones, como bandeja de triage: a la izquierda las colas (por defecto, las que
// esperan respuesta, de la que más espera a la que menos) y el filtro por examen; después la lista, el
// chat y la ficha del lead. El buscador va en la cabecera; las colas filtran lo que trae la búsqueda.
import { useEffect, useState } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import { Chip, EmptyState, HeaderActions, InputGroup, Panel, Segmented } from '../../components/standard';
import { inboxApi } from './api';
import { COLAS, examenes, filtrar } from './conversaciones/colas';
import Detalle from './conversaciones/Detalle';
import Fila from './conversaciones/Fila';

// La espera se recalcula sola cada minuto.
function useAhora() {
    const [ahora, setAhora] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setAhora(new Date()), 60000);
        return () => clearInterval(t);
    }, []);
    return ahora;
}

function Colas({ lista, cola, onCola, examen, onExamen, ahora, mediana }) {
    const porExamen = examenes(lista);
    return (
        <Panel as="nav" size="sm" className="cv-colas" aria-label="Colas">
            <span className="t-rotulo">Colas</span>
            <Segmented orientation="vertical" label="Colas" value={cola} onChange={onCola}
                options={COLAS.map((c) => ({ value: c.value, label: c.label, count: lista.filter((x) => c.cumple(x, ahora)).length }))} />
            {porExamen.length > 0 && (
                <>
                    <span className="t-rotulo">Examen</span>
                    <div className="cv-examenes">
                        {porExamen.map(([e, n]) => (
                            <Chip key={e} as="button" type="button" aria-pressed={examen === e} onClick={() => onExamen(examen === e ? null : e)}>
                                {e} <span className="cv-cuenta">{n}</span>
                            </Chip>
                        ))}
                    </div>
                </>
            )}
            <div className="cv-mediana" data-tip="Respuesta del equipo|Mediana de lo que tarda una persona del equipo en contestarle a un lead, en las últimas 24 h. El bot no cuenta.">
                <span className="t-cap mut">Mediana de respuesta · 24 h</span>
                <b className={mediana == null ? 'mut40' : undefined}>{mediana == null ? 'Sin respuestas' : `${mediana} min`}</b>
            </div>
        </Panel>
    );
}

export default function Conversaciones() {
    const [datos, setDatos] = useState(null);
    const [buscar, setBuscar] = useState('');
    const [cola, setCola] = useState('esperan');
    const [examen, setExamen] = useState(null);
    const [elegida, setElegida] = useState(null);
    const [error, setError] = useState(null);
    const ahora = useAhora();

    useEffect(() => {
        const t = setTimeout(() => {
            inboxApi.conversaciones(buscar.trim()).then(setDatos).catch(() => setError('No se pudieron cargar las conversaciones'));
        }, 250);
        return () => clearTimeout(t);
    }, [buscar]);

    const lista = datos?.conversaciones || [];
    const visibles = filtrar(lista, { cola, examen, ahora });
    const nombreCola = COLAS.find((c) => c.value === cola).label;

    let listado;
    if (error) listado = <EmptyState>{error}</EmptyState>;
    else if (!datos) listado = <EmptyState>Cargando…</EmptyState>;
    else if (!lista.length) {
        listado = (
            <EmptyState icon={<MessageSquare size={22} />}>
                {buscar.trim() ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay conversaciones. Aparecen cuando el motor empieza a procesar los mensajes de Instagram.'}
            </EmptyState>
        );
    } else if (!visibles.length) {
        listado = <EmptyState>{cola === 'esperan' && !examen ? 'Nadie espera respuesta. 🎉' : `No hay conversaciones en «${nombreCola}»${examen ? ` de ${examen}` : ''}.`}</EmptyState>;
    } else {
        listado = (
            <>
                <p className="cv-lista-cab t-cap mut">
                    {visibles.length === 1 ? '1 conversación' : `${visibles.length} conversaciones`}
                    {COLAS.find((c) => c.value === cola).porEspera ? ' · por espera' : ' · por último mensaje'}
                </p>
                <ul>{visibles.map((c) => <Fila key={c.id} c={c} ahora={ahora} elegida={elegida === c.id} onElegir={setElegida} />)}</ul>
            </>
        );
    }

    return (
        <>
            <HeaderActions>
                <div className="barra">
                    <InputGroup className="cv-buscar" prefix={<Search size={16} />}>
                        <label className="sr" htmlFor="cv-buscar">Buscar por usuario</label>
                        <input id="cv-buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por usuario o nombre" autoComplete="off" />
                    </InputGroup>
                </div>
            </HeaderActions>
            <div className={`cv${elegida ? ' cv--abierta' : ''}`}>
                <Colas lista={lista} cola={cola} onCola={setCola} examen={examen} onExamen={setExamen} ahora={ahora} mediana={datos?.mediana_respuesta} />
                <Panel as="section" size="sm" className="cv-lista" aria-label="Conversaciones">{listado}</Panel>
                {elegida
                    ? <Detalle key={elegida} id={elegida} />
                    : <Panel size="sm" className="cv-detalle cv-detalle--vacio"><EmptyState icon={<MessageSquare size={22} />}>Elegí una conversación.</EmptyState></Panel>}
            </div>
        </>
    );
}
