// Operaciones › Reuniones (ADR-W196): las notas de Meet que no cuelgan de ninguna agenda, repartidas en
// grupales, con alumnos y otras. Mismo armado que Conflictos: la lista y, al elegir una, su detalle al
// costado. Las de una agenda de venta se ven en la pestaña Reuniones de la ficha.

import { lazy, Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Users, Video } from 'lucide-react';
import { Button, Chip, EmptyState, InputGroup, Panel, Segmented, Select, Skeleton, SkeletonRow } from '../../../components/standard';
import { useTemaDeHoja } from '../../../sesion/temaDeHoja';
import useNotasSinAgenda from './useNotasSinAgenda';
import NotaDetalle from './NotaDetalle';
import { ACLARA, COLOR_CATEGORIA, GRUPOS, cuando, tituloCorto } from './textos';
import '../../agendas_v2/thalamus.css';
import './reuniones.css';

const FichaLeadModal = lazy(() => import('../../../components/ficha/FichaLeadModal'));

const Fila = ({ n, activa, conCategoria, nombres, onElegir }) => {
    const { dia, hora } = cuando(n.fecha);
    return (
        <button type="button" className={`re-fila${activa ? ' is-activo' : ''}`} aria-pressed={activa} onClick={() => onElegir(n.id)}>
            <span className="re-fila__dia" title={n.fecha_del_doc ? 'Fecha del Doc: la nota no trae la hora de la reunión' : undefined}>
                <b>{dia}</b> {hora}{n.fecha_del_doc ? '*' : ''}
            </span>
            <span className="re-fila__titulo">
                {tituloCorto(n.title)}
                {conCategoria && <> <Chip color={COLOR_CATEGORIA[n.category] || COLOR_CATEGORIA.other} subtle>{nombres[n.category] || 'Otra'}</Chip></>}
            </span>
            <span className="re-fila__serie">{n.series || 'Sin serie'}</span>
            <span className="re-fila__extra">
                {n.invitados > 0 && <span title="Invitados"><Users aria-label="Invitados" /> {n.invitados}</span>}
                {n.grabacion && <Video aria-label="Con grabación" />}
            </span>
        </button>
    );
};

export default function PanelReuniones() {
    const [raiz, dataTheme] = useTemaDeHoja();
    const r = useNotasSinAgenda();
    const [ficha, setFicha] = useState(null);
    const notas = r.lista?.notas;
    const nombres = r.lista?.categorias || {};
    const cuentas = r.lista?.cuentas;
    const opcionesSerie = [{ value: '', label: 'Todas las series' },
        ...(r.lista?.series || []).map(s => ({ value: s.serie, label: `${s.serie} · ${s.notas}` }))];

    return (
        <div ref={raiz} className="thalamus operador-panel re-pagina" data-theme={dataTheme}>
            <div className="re-filtros">
                <Segmented value={r.grupo} onChange={r.setGrupo} size="sm" label="Qué reuniones"
                    options={GRUPOS.map(g => ({ ...g, count: cuentas?.[g.value]?.toLocaleString('es-AR') }))} />
                <InputGroup prefix={<Search size={16} />}>
                    <input type="search" value={r.q} onChange={e => r.setQ(e.target.value)}
                        placeholder="Buscar en el título o por un invitado" aria-label="Buscar reuniones" />
                </InputGroup>
                <Select value={r.serie} options={opcionesSerie} size="sm" label="Serie" onChange={r.setSerie} />
            </div>
            <p className="re-aclara">{ACLARA[r.grupo]}</p>
            {r.error && <p className="re-aclara">{r.error}</p>}

            <div className={`re-cuerpo${r.elegida ? ' re-cuerpo--con-detalle' : ''}`}>
                <Panel className="re-lista">
                    <div className="re-fila re-fila--cabeza" aria-hidden="true">
                        <span>Cuándo</span><span>Reunión</span><span>Serie</span><span />
                    </div>
                    {!notas && (
                        <Skeleton label="Cargando las reuniones…">
                            {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} step={i} height={48} />)}
                        </Skeleton>
                    )}
                    {notas?.length === 0 && (
                        <EmptyState icon={<Video size={22} />} title="Sin reuniones">
                            {r.q || r.serie ? 'Nada coincide con la búsqueda.' : 'Cuando Gemini deje notas de estas reuniones, aparecen acá.'}
                        </EmptyState>
                    )}
                    {notas?.map(n => (
                        <Fila key={n.id} n={n} activa={r.elegida === n.id} conCategoria={r.grupo === 'otras'}
                            nombres={nombres} onElegir={r.setElegida} />
                    ))}
                    {notas && notas.length < r.lista.total && (
                        <div className="re-mas">
                            <Button disabled={r.mas} onClick={r.verMas}>
                                {r.mas ? 'Cargando…' : `Ver más (quedan ${(r.lista.total - notas.length).toLocaleString('es-AR')})`}
                            </Button>
                        </div>
                    )}
                </Panel>

                {r.elegida && (
                    <aside className="re-lado" aria-label="Detalle de la reunión">
                        <NotaDetalle nota={r.detalle} nombres={nombres} onElegir={r.elegirCategoria} onAbrirFicha={setFicha} />
                    </aside>
                )}
            </div>

            {ficha && createPortal(
                <Suspense fallback={null}>
                    <FichaLeadModal personUuid={ficha} onCerrar={() => setFicha(null)} />
                </Suspense>,
                document.body,
            )}
        </div>
    );
}
