import { lazy, Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Scale } from 'lucide-react';
import { Chip, EmptyState, Grid, Kpi, PageHeader, Panel, Segmented } from '../../components/standard';
import { Skeleton, SkeletonKpi, SkeletonRow } from '../../components/standard';
import useConflictos from './useConflictos';
import CasoDetalle from './CasoDetalle';
import { TIPOS, dia, pesos } from './textos';
import './conflictos.css';

const FichaLeadModal = lazy(() => import('../../components/ficha/FichaLeadModal'));

const ESTADOS = [
    { value: 'abierto', label: 'Abiertos' },
    { value: 'cerrado', label: 'Cerrados' },
];

/** Cada caso en una fila: de dónde viene con fecha, para que el closer lo ubique sin buscar el número. */
const Fila = ({ c, activo, onElegir, conResponsable }) => {
    const tipo = TIPOS[c.tipo] || TIPOS.datos;
    return (
        <button type="button" className={`cf-fila${activo ? ' is-activo' : ''}`} onClick={() => onElegir(c.id)}
            aria-pressed={activo}>
            <span><Chip color={tipo.color} subtle>{tipo.label}</Chip></span>
            <strong className="cf-fila__persona">{c.persona}</strong>
            <span className="cf-fila__origen"><small>{dia(c.origen_fecha)}</small> {c.origen_texto || '—'}</span>
            <span className="cf-fila__que">{c.titulo}</span>
            <span className="cf-fila__monto">{pesos(c.monto)}</span>
            {conResponsable && <span className="cf-fila__resp">{c.responsable || '—'}</span>}
        </button>
    );
};

const Resumen = ({ r }) => (
    <Grid variant="kpis">
        <Kpi label="Abiertos" value={r.abiertos}><small>casos que no cierran</small></Kpi>
        <Kpi label="En juego" value={pesos(r.en_juego)}><small>deuda y cobros sin venta</small></Kpi>
        <Kpi label="Cerrados" value={r.resueltos_semana}><small>en los últimos 7 días</small></Kpi>
    </Grid>
);

const ConflictosPage = () => {
    const c = useConflictos();
    const [ficha, setFicha] = useState(null);
    const casos = c.lista?.casos;
    const conResponsable = !!c.lista?.ve_todos;

    return (
        <div className="cf-pagina">
            <PageHeader title="Conflictos" logo={<Scale size={22} aria-hidden="true" />}
                actions={<Segmented value={c.estado} options={ESTADOS} onChange={c.setEstado} size="sm" />} />

            {c.lista
                ? <Resumen r={c.lista.resumen} />
                : <Skeleton label="Cargando el resumen…"><Grid variant="kpis">{[0, 1, 2].map(i => <SkeletonKpi key={i} step={i} />)}</Grid></Skeleton>}

            {c.error && <p className="cf-vacio">{c.error}</p>}

            <div className={`cf-cuerpo${c.elegido ? ' cf-cuerpo--con-detalle' : ''}`}>
                <Panel className="cf-lista">
                    <div className={`cf-fila cf-fila--cabeza${conResponsable ? '' : ' cf-fila--sin-resp'}`} aria-hidden="true">
                        <span>Tipo</span><span>Persona</span><span>De dónde viene</span><span>Qué no cierra</span>
                        <span>Monto</span>{conResponsable && <span>Responsable</span>}
                    </div>
                    {!casos && (
                        <Skeleton label="Cargando los casos…">
                            {[0, 1, 2, 3].map(i => <SkeletonRow key={i} step={i} height={52} />)}
                        </Skeleton>
                    )}
                    {casos?.length === 0 && (
                        <EmptyState icon={<CheckCircle2 size={22} />} title={c.estado === 'abierto' ? 'Nada que revisar' : 'Todavía no se cerró ninguno'}>
                            {c.estado === 'abierto' ? 'Todos los casos están cerrados.' : 'Los casos cerrados aparecen acá con lo que se hizo.'}
                        </EmptyState>
                    )}
                    <div className={conResponsable ? '' : 'cf-sin-resp'}>
                        {casos?.map(x => (
                            <Fila key={x.id} c={x} activo={c.elegido === x.id} onElegir={c.setElegido} conResponsable={conResponsable} />
                        ))}
                    </div>
                </Panel>

                {c.elegido && (
                    <aside className="cf-lado" aria-label="Detalle del caso">
                        <CasoDetalle caso={c.detalle} onAbrirFicha={setFicha} onCerrar={c.cerrar} onReabrir={c.reabrir} />
                    </aside>
                )}
            </div>

            {ficha && createPortal(
                <Suspense fallback={null}>
                    <FichaLeadModal personUuid={ficha} pestanaInicial="ful" onCerrar={() => setFicha(null)} />
                </Suspense>,
                document.body,
            )}
        </div>
    );
};

export default ConflictosPage;
