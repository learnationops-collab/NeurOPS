import { useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Button, Chip, FieldError, Panel, Segmented, TextArea } from '../../components/standard';
import { Skeleton, SkeletonText } from '../../components/standard';
import { TIPOS, dia, pesos } from './textos';

const CIERRES = [
    { value: 'resuelto', label: 'Quedó resuelto' },
    { value: 'descartado', label: 'Se descarta' },
];

/** Un momento de la historia: qué pasó ese día y, abierto, lo que se cargó tal cual. */
const Momento = ({ e }) => (
    <li className={`cf-momento${e.mal ? ' cf-momento--mal' : ''}`}>
        <span className="cf-momento__dia">{dia(e.fecha)}</span>
        <div className="cf-momento__cuerpo">
            <div className="cf-momento__titulo">
                {e.mal && <AlertTriangle size={14} aria-label="Acá no cierra" />}
                <strong>{e.titulo}</strong>
                <Chip subtle>{e.fuente}</Chip>
            </div>
            {e.nota && <p className="cf-momento__nota">{e.nota}</p>}
            {e.campos?.length > 0 && (
                <details className="cf-cargado">
                    <summary>Lo que se cargó ese día</summary>
                    <dl>
                        {e.campos.map(c => (
                            <div key={c.campo}><dt>{c.campo}</dt><dd>{String(c.valor)}</dd></div>
                        ))}
                    </dl>
                </details>
            )}
        </div>
    </li>
);

const Cerrar = ({ onCerrar }) => {
    const [estado, setEstado] = useState('resuelto');
    const [texto, setTexto] = useState('');
    const [error, setError] = useState(null);
    const [enviando, setEnviando] = useState(false);
    const enviar = async () => {
        setEnviando(true);
        try {
            await onCerrar({ estado, resolucion: texto });
        } catch (e) {
            setError(e.response?.data?.message || 'No se pudo guardar.');
        } finally {
            setEnviando(false);
        }
    };
    return (
        <div className="cf-cerrar">
            <Segmented value={estado} options={CIERRES} onChange={setEstado} size="sm" label="Cómo se cierra" />
            <TextArea value={texto} onChange={e => { setTexto(e.target.value); setError(null); }}
                placeholder="Qué se hizo o por qué se descarta. Queda en la bitácora de la ficha."
                invalid={!!error} />
            {error && <FieldError>{error}</FieldError>}
            <Button variant="primary" onClick={enviar} disabled={enviando || !texto.trim()}>Cerrar el caso</Button>
        </div>
    );
};

const CasoDetalle = ({ caso, onAbrirFicha, onCerrar, onReabrir }) => {
    if (!caso) {
        return (
            <Skeleton label="Cargando el caso…">
                <SkeletonText lines={8} />
            </Skeleton>
        );
    }
    if (caso.error) return <p className="cf-vacio">No se pudo cargar el caso.</p>;
    const tipo = TIPOS[caso.tipo] || TIPOS.datos;
    return (
        <div className="cf-detalle">
            <header className="cf-detalle__cabeza">
                <Chip color={tipo.color}>{tipo.label}</Chip>
                <h2>{caso.persona}</h2>
                <p className="cf-detalle__que">{caso.titulo}</p>
                {caso.detalle && <p className="cf-detalle__mas">{caso.detalle}</p>}
                <p className="cf-detalle__origen">
                    Viene de <strong>{caso.origen_texto || 'sin origen'}</strong> · {dia(caso.origen_fecha)}
                    {caso.monto != null && <> · <strong>{pesos(caso.monto)}</strong></>}
                </p>
                {caso.person_uuid && (
                    <Button icon={<ExternalLink size={14} />} onClick={() => onAbrirFicha(caso.person_uuid)}>
                        Ver ficha y Fulfillment
                    </Button>
                )}
            </header>

            <Panel size="sm">
                <h3 className="cf-sub">Qué pasó</h3>
                {caso.historia.length
                    ? <ol className="cf-historia">{caso.historia.map((e, i) => <Momento key={i} e={e} />)}</ol>
                    : <p className="cf-vacio">Sin ventas, pagos ni agendas a su nombre.</p>}
            </Panel>

            <Panel size="sm">
                {caso.estado === 'abierto'
                    ? <Cerrar onCerrar={onCerrar} />
                    : (
                        <div className="cf-cerrado">
                            <p><strong>{caso.estado === 'resuelto' ? 'Resuelto' : 'Descartado'}</strong> por {caso.resuelto_por} el {dia(caso.resuelto_at)}</p>
                            <p>{caso.resolucion}</p>
                            <Button onClick={onReabrir}>Reabrir</Button>
                        </div>
                    )}
            </Panel>
        </div>
    );
};

export default CasoDetalle;
