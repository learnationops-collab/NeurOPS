// El filtro de la bandeja, comprimido en un botón de ícono: abre un panel con la cola, a quién está
// asignada, la sub-etapa, si califica, la etiqueta, el examen, cuándo empezó la última conversación y
// quién mandó el último mensaje (y cuándo). El número sobre el ícono es cuántos hay puestos.
import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { Button, Chip, IconButton, Input, Segmented } from '../../../components/standard';
import { COLAS, ETAPAS, asignados, claveEtiqueta, cumpleFiltro, etiquetasDe, examenes, filtrar } from './colas';
import { VACIO, activos } from './filtros';

const RANGOS = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['rango', 'Personalizado']];

function Opciones({ valor, opciones, onElegir }) {
    return (
        <div className="cv-macro-chips">
            {opciones.map(([v, label, n, color]) => (
                <Chip key={String(v)} as="button" type="button" color={color} aria-pressed={valor === v} onClick={() => onElegir(valor === v ? null : v)}>
                    {label}{n != null && <span className="cv-cuenta">{n}</span>}
                </Chip>
            ))}
        </div>
    );
}

// Hoy · Ayer · Personalizado; con Personalizado, desde y hasta.
function Rango({ clave, filtro, cambiar }) {
    return (
        <>
            <Opciones valor={filtro[clave]} opciones={RANGOS} onElegir={(v) => cambiar({ [clave]: v })} />
            {filtro[clave] === 'rango' && (
                <div className="cv-macro-fechas">
                    <Input variant="date" type="date" aria-label="Desde" value={filtro[`${clave}Desde`]} onChange={(e) => cambiar({ [`${clave}Desde`]: e.target.value })} />
                    <span className="t-cap mut">a</span>
                    <Input variant="date" type="date" aria-label="Hasta" value={filtro[`${clave}Hasta`]} onChange={(e) => cambiar({ [`${clave}Hasta`]: e.target.value })} />
                </div>
            )}
        </>
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
    // Las cuentas de cada cola respetan los otros filtros puestos, no el propio.
    const sinCola = lista.filter((c) => cumpleFiltro(c, filtro, ahora));
    const setters = asignados(lista);
    const etiquetas = etiquetasDe(lista);
    const nombre = (s) => (s.id === yo ? 'Vos' : s.username);
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
                            ...setters.map((s) => [s.id, nombre(s), s.n]),
                            ['ninguno', 'Sin asignar', lista.filter((c) => !c.asignado).length, 'var(--warning)'],
                        ]} />
                        <span className="t-rotulo">Sub-etapa</span>
                        <Opciones valor={filtro.etapa} onElegir={(etapa) => cambiar({ etapa })}
                            opciones={ETAPAS.map((e) => [e.value, e.label, lista.filter((c) => c.etapa === e.value).length, e.color])} />
                        <span className="t-rotulo">Calificación</span>
                        <Opciones valor={filtro.califica} onElegir={(califica) => cambiar({ califica })}
                            opciones={[['si', 'Califica', null, 'var(--success)'], ['no', 'No califica', null, 'var(--error)']]} />
                        {etiquetas.length > 0 && (
                            <>
                                <span className="t-rotulo">Etiqueta</span>
                                <Opciones valor={filtro.etiqueta} onElegir={(etiqueta) => cambiar({ etiqueta })}
                                    opciones={etiquetas.map((e) => [claveEtiqueta(e), e.group ? `${e.group}: ${e.name}` : e.name, e.n, e.color])} />
                            </>
                        )}
                        <span className="t-rotulo">Examen</span>
                        <Opciones valor={filtro.examen} onElegir={(examen) => cambiar({ examen })} opciones={examenes(lista).map(([e, c]) => [e, e, c])} />
                        <span className="t-rotulo">Inicio de la última conversación</span>
                        <Rango clave="inicio" filtro={filtro} cambiar={cambiar} />
                        <span className="t-rotulo">Último mensaje enviado por</span>
                        <Opciones valor={filtro.envioPor} onElegir={(envioPor) => cambiar({ envioPor })}
                            opciones={[...setters.map((s) => [s.id, nombre(s)]), ['bot', 'El bot']]} />
                        <span className="t-cap mut">en</span>
                        <Rango clave="envio" filtro={filtro} cambiar={cambiar} />
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
