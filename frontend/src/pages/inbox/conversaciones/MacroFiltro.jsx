// El Filtro de la bandeja (ADR-W184; desde ADR-W247 es el botón «Filtro» de la barra de arriba, con las vistas en
// tarjetas arriba y el número de conversaciones que deja). Dos columnas. A la izquierda, la cola; a la
// derecha, la etapa del setting, la etiqueta (un subdesplegable con buscador: pueden ser muchas), a quién está
// asignada, si califica, cuándo empezó la última conversación y quién mandó el último mensaje. Al pie se guarda
// con un nombre: queda en los chips de arriba de la lista y en la cabecera. El número sobre el ícono: cuántos hay.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal, Star } from 'lucide-react';
import VistasFiltro, { vistaActual } from './VistasFiltro';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { Button, Chip, Input, InputGroup, Segmented, toast } from '../../../components/standard';
import { COLAS, asignados, claveEtiqueta, cumpleFiltro, esWhatsapp, etiquetasDe, filtrar } from './colas';
import { FASES, colorDe, corto } from './fasesSetting';
import { useGuardados } from './guardados';
import Resumen from './Resumen';
import { VACIO, activos } from './filtros';

const RANGOS = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['rango', 'Personalizado']];
const alternar = (lista, x) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x]);

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

// Una casilla por fase, en dos columnas, con su número en el color de su etapa y cuántas hay.
function Fases({ lista, elegidas, onCambiar }) {
    return (
        <div className="cv-macro-fases">
            {FASES.map((f) => (
                <label key={f.id} className={`cv-macro-fase${elegidas.includes(f.id) ? ' cv-macro-fase--on' : ''}`} style={{ '--c': colorDe(f) }}>
                    <input type="checkbox" checked={elegidas.includes(f.id)} onChange={() => onCambiar(alternar(elegidas, f.id))} />
                    <span className="cv-macro-fase-n">{f.n}</span>
                    <span className="cv-macro-fase-t">{corto(f)}</span>
                    <span className="t-cap mut40">{lista.filter((c) => c.fase === f.id).length}</span>
                </label>
            ))}
        </div>
    );
}

// Las etiquetas de la lista, por grupo, en un subdesplegable con buscador.
function EtiquetasFiltro({ lista, elegidas, onCambiar }) {
    const [abierto, setAbierto] = useState(false);
    const [buscar, setBuscar] = useState('');
    const todas = etiquetasDe(lista).filter((e) => `${e.group || ''} ${e.name}`.toLowerCase().includes(buscar.trim().toLowerCase()));
    const grupos = [...new Set(todas.map((e) => e.group || 'Sin grupo'))];
    const nombre = (k) => k.split(':').slice(1).join(':');
    return (
        <div className="cv-macro-sub">
            <button type="button" className="cv-macro-sub-btn" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
                <span>{elegidas.length ? elegidas.map(nombre).join(', ') : 'Cualquier etiqueta'}</span>
                {elegidas.length > 0 && <Chip subtle>{elegidas.length}</Chip>}
                <ChevronDown size={14} aria-hidden="true" />
            </button>
            {abierto && (
                <div className="cv-macro-sub-pop">
                    <InputGroup prefix={<Search size={14} />}>
                        <label className="sr" htmlFor="cv-tag-buscar">Buscar etiqueta</label>
                        <input id="cv-tag-buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar etiqueta" autoComplete="off" autoFocus />
                    </InputGroup>
                    {!todas.length && <p className="t-cap mut">Ninguna etiqueta en la lista{buscar ? ' con ese nombre' : ''}.</p>}
                    {grupos.map((g) => (
                        <div key={g} className="cv-macro-sub-grupo">
                            <span className="t-rotulo">{g}</span>
                            {todas.filter((e) => (e.group || 'Sin grupo') === g).map((e) => {
                                const k = claveEtiqueta(e);
                                return (
                                    <label key={k} className="cv-macro-fase">
                                        <input type="checkbox" checked={elegidas.includes(k)} onChange={() => onCambiar(alternar(elegidas, k))} />
                                        <Chip subtle color={e.color}>{e.name}</Chip>
                                        <span className="t-cap mut40">{e.n}</span>
                                    </label>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function Guardar({ filtro, onGuardado }) {
    const guardados = useGuardados();
    const [nombre, setNombre] = useState('');
    const guardar = (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        guardados.guardar(nombre.trim(), filtro);
        toast('Filtro guardado: queda en las vistas del Filtro');
        onGuardado();
    };
    return (
        <form className="cv-macro-guardar" onSubmit={guardar}>
            <InputGroup prefix={<Star size={14} />}>
                <label className="sr" htmlFor="cv-filtro-nombre">Nombre del filtro</label>
                <input id="cv-filtro-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre, ej.: Propuestas sin respuesta" autoComplete="off" />
            </InputGroup>
            <Button type="submit" variant="primary" disabled={!nombre.trim()}>Guardar</Button>
        </form>
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
    const nombre = (s) => (s.id === yo ? 'Vos' : s.username);
    const n = activos(filtro);
    const guardados = useGuardados();
    const vista = vistaActual(filtro, yo, guardados.lista);
    const cuantas = filtrar(lista, { ...filtro, ahora }).length;

    return (
        <div className="cv-macro" ref={caja}>
            <button type="button" className={`cv-barra-btn cv-filtro-btn${n ? ' cv-filtro-btn--activo' : ''}`} aria-expanded={abierto}
                data-tip={`Filtro · ${vista ? vista.label : 'a medida'}|${n ? `${n} ${n === 1 ? 'filtro puesto' : 'filtros puestos'}` : 'Sin filtros'}: ${cuantas} conversaciones`}
                onClick={() => setAbierto((a) => !a)}>
                <SlidersHorizontal size={15} aria-hidden="true" />Filtro
                <span className="cv-filtro-n" key={cuantas}>{cuantas}</span>
                {n > 0 && <span className="cv-filtro-puntos" aria-hidden="true">{Array.from({ length: Math.min(n, 4) }, (_, i) => <i key={i} style={{ '--i': i }} />)}</span>}
            </button>
            {abierto && (
                <div className="cv-macro-pop" ref={pop} role="dialog" aria-label="Filtros">
                    <VistasFiltro lista={lista} filtro={filtro} onCambiar={onCambiar} ahora={ahora} yo={yo} />
                    <Resumen lista={lista} filtro={filtro} onCambiar={onCambiar} yo={yo} />
                    <div className="cv-macro-col">
                        <span className="t-rotulo">Cola</span>
                        <Segmented orientation="vertical" label="Cola" value={filtro.cola} onChange={(cola) => cambiar({ cola })}
                            options={COLAS.map((c) => ({ value: c.value, label: c.label, count: sinCola.filter((x) => c.cumple(x, ahora)).length }))} />
                    </div>
                    <div className="cv-macro-col">
                        <span className="t-rotulo">Canal</span>
                        <Opciones valor={filtro.canal} onElegir={(canal) => cambiar({ canal })} opciones={[
                            ['ig', 'Instagram', lista.filter((c) => !esWhatsapp(c)).length],
                            ['wa', 'WhatsApp', lista.filter(esWhatsapp).length, 'var(--success)'],
                        ]} />
                        <span className="t-rotulo">Etapa del setting</span>
                        <Fases lista={lista} elegidas={filtro.fases || []} onCambiar={(fases) => cambiar({ fases })} />
                        <span className="t-rotulo">Etiqueta</span>
                        <EtiquetasFiltro lista={lista} elegidas={filtro.etiquetas || []} onCambiar={(etiquetas) => cambiar({ etiquetas })} />
                        <span className="t-rotulo">Asignado a</span>
                        <Opciones valor={filtro.asignado} onElegir={(asignado) => cambiar({ asignado })} opciones={[
                            ...setters.map((s) => [s.id, nombre(s), s.n]),
                            ['ninguno', 'Sin asignar', lista.filter((c) => !c.asignado).length, 'var(--warning)'],
                        ]} />
                        <span className="t-rotulo">Calificación</span>
                        <Opciones valor={filtro.califica} onElegir={(califica) => cambiar({ califica })}
                            opciones={[['si', 'Califica', null, 'var(--success)'], ['no', 'No califica', null, 'var(--error)']]} />
                        <span className="t-rotulo">Inicio de la última conversación</span>
                        <Rango clave="inicio" filtro={filtro} cambiar={cambiar} />
                        <span className="t-rotulo">Último mensaje enviado por</span>
                        <Opciones valor={filtro.envioPor} onElegir={(envioPor) => cambiar({ envioPor })}
                            opciones={[['lead', 'El lead', null, 'var(--brand-secondary)'], ...setters.map((s) => [s.id, nombre(s)]), ['bot', 'El bot']]} />
                        <span className="t-cap mut">en</span>
                        <Rango clave="envio" filtro={filtro} cambiar={cambiar} />
                    </div>
                    <div className="cv-macro-pie">
                        <Button variant="ghost" disabled={!n} onClick={() => onCambiar({ ...VACIO, orden: filtro.orden })}>Limpiar</Button>
                        <span className="t-cap mut">{cuantas} conversaciones</span>
                        <Guardar filtro={filtro} onGuardado={() => setAbierto(false)} />
                    </div>
                </div>
            )}
        </div>
    );
}
