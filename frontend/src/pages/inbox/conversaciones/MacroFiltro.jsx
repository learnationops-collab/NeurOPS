// El filtro de la bandeja, comprimido en un botón de ícono: abre un panel con la cola, a quién está
// asignada, el examen y si el último mensaje es de hoy. El número sobre el ícono es cuántos hay puestos.
import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { Button, Chip, IconButton, Segmented } from '../../../components/standard';
import { COLAS, asignados, claveEtiqueta, cumpleFiltro, etiquetasDe, examenes, filtrar } from './colas';
import { VACIO, activos } from './filtros';

function Opciones({ valor, opciones, onElegir }) {
    return (
        <div className="cv-macro-chips">
            {opciones.map(([v, label, n, color]) => (
                <Chip key={String(v)} as="button" type="button" color={color} aria-pressed={valor === v} onClick={() => onElegir(v)}>
                    {label}{n != null && <span className="cv-cuenta">{n}</span>}
                </Chip>
            ))}
        </div>
    );
}

export default function MacroFiltro({ lista, filtro, onCambiar, ahora, yo }) {
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

    const cambiar = (parte) => onCambiar({ ...filtro, ...parte });
    // Las cuentas de cada opción respetan los otros filtros puestos, no el propio.
    const sinCola = lista.filter((c) => cumpleFiltro(c, filtro, ahora));
    const setters = asignados(lista);
    const etiquetas = etiquetasDe(lista);
    const n = activos(filtro);

    return (
        <div className="cv-macro" ref={caja}>
            <IconButton label="Filtros" data-tip="Filtros" pressed={abierto} onClick={() => setAbierto((a) => !a)}
                className={n ? 'cv-macro-btn cv-macro-btn--activo' : 'cv-macro-btn'}
                icon={<><SlidersHorizontal size={16} />{n > 0 && <span className="cv-macro-n">{n}</span>}</>} />
            {abierto && (
                <div className="cv-macro-pop" ref={pop} role="dialog" aria-label="Filtros">
                    <div className="cv-macro-col">
                        <span className="t-rotulo">Cola</span>
                        <Segmented orientation="vertical" label="Cola" value={filtro.cola} onChange={(cola) => cambiar({ cola })}
                            options={COLAS.map((c) => ({ value: c.value, label: c.label, count: sinCola.filter((x) => c.cumple(x, ahora)).length }))} />
                    </div>
                    <div className="cv-macro-col">
                        <span className="t-rotulo">Asignado a</span>
                        <Opciones valor={filtro.asignado} onElegir={(asignado) => cambiar({ asignado })} opciones={[
                            [null, 'Todos'],
                            ...setters.map((s) => [s.id, s.id === yo ? 'Vos' : s.username, s.n]),
                            ['ninguno', 'Sin asignar', lista.filter((c) => !c.asignado).length, 'var(--warning)'],
                        ]} />
                        {etiquetas.length > 0 && (
                            <>
                                <span className="t-rotulo">Etiqueta</span>
                                <Opciones valor={filtro.etiqueta} onElegir={(etiqueta) => cambiar({ etiqueta })}
                                    opciones={[[null, 'Todas'], ...etiquetas.map((e) => [claveEtiqueta(e), e.group ? `${e.group}: ${e.name}` : e.name, e.n, e.color])]} />
                            </>
                        )}
                        <span className="t-rotulo">Examen</span>
                        <Opciones valor={filtro.examen} onElegir={(examen) => cambiar({ examen })}
                            opciones={[[null, 'Todos'], ...examenes(lista).map(([e, c]) => [e, e, c])]} />
                        <span className="t-rotulo">Último mensaje</span>
                        <Opciones valor={filtro.hoy} onElegir={(hoy) => cambiar({ hoy })} opciones={[[false, 'Cuando sea'], [true, 'Hoy']]} />
                    </div>
                    <div className="cv-macro-pie">
                        <Button variant="ghost" disabled={!n} onClick={() => onCambiar({ ...VACIO })}>Limpiar</Button>
                        <span className="t-cap mut">{filtrar(lista, { ...filtro, ahora }).length} conversaciones</span>
                    </div>
                </div>
            )}
        </div>
    );
}
