// Las piezas del Filtro de la bandeja (ADR-W254): opciones en chips con su cuenta, rango de fechas, las fases del
// setting y las etiquetas. Las cuentas las calcula quien las usa (cuántas quedarían con esa opción puesta).
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Chip, Input, InputGroup } from '../../../components/standard';
import { claveEtiqueta, etiquetasDe } from './colas';
import { FASES, colorDe, corto } from './fasesSetting';
import { RANGOS } from './filtros';

export const alternar = (lista, x) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x]);

// Una opción a la vez: tocar la elegida la saca. `opciones`: [[valor, rótulo, cuenta, color]].
export function Opciones({ valor, opciones, onElegir }) {
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

// Hoy · Desde ayer · Esta semana y, con `conRango`, Personalizado con desde y hasta.
export function Rango({ clave, filtro, cambiar, conRango = true, cuenta }) {
    const opciones = conRango ? [...RANGOS, ['rango', 'Personalizado']] : RANGOS;
    return (
        <>
            <Opciones valor={filtro[clave]} onElegir={(v) => cambiar({ [clave]: v })}
                opciones={opciones.map(([v, l]) => [v, l, v === 'rango' || !cuenta ? null : cuenta({ [clave]: v })])} />
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

// Una casilla por fase, en dos columnas, con su número en el color de su etapa y cuántas hay en esa fase.
export function Fases({ elegidas, onCambiar, cuenta }) {
    return (
        <div className="cv-macro-fases">
            {FASES.map((f) => (
                <label key={f.id} className={`cv-macro-fase${elegidas.includes(f.id) ? ' cv-macro-fase--on' : ''}`} style={{ '--c': colorDe(f) }}>
                    <input type="checkbox" checked={elegidas.includes(f.id)} onChange={() => onCambiar(alternar(elegidas, f.id))} />
                    <span className="cv-macro-fase-n">{f.n}</span>
                    <span className="cv-macro-fase-t">{corto(f)}</span>
                    <span className="t-cap mut40">{cuenta(f.id)}</span>
                </label>
            ))}
        </div>
    );
}

// Las etiquetas de la lista, por grupo, con buscador.
export function EtiquetasFiltro({ lista, elegidas, onCambiar }) {
    const [buscar, setBuscar] = useState('');
    const todas = etiquetasDe(lista).filter((e) => `${e.group || ''} ${e.name}`.toLowerCase().includes(buscar.trim().toLowerCase()));
    const grupos = [...new Set(todas.map((e) => e.group || 'Sin grupo'))];
    return (
        <div className="cv-filtro-tags">
            <InputGroup prefix={<Search size={14} />}>
                <label className="sr" htmlFor="cv-tag-buscar">Buscar etiqueta</label>
                <input id="cv-tag-buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar etiqueta" autoComplete="off" />
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
    );
}
