// El Filtro de la bandeja (ADR-W184; desde ADR-W247 es el botón «Filtro» de la barra de arriba; desde ADR-W254, por
// secciones). A la izquierda, las secciones: Rápidos y guardados primero, y cada una con lo que tiene elegido debajo de
// su nombre. A la derecha, la sección abierta (`seccionesFiltro.jsx`). Arriba, lo puesto en chips con su ×; al pie,
// Limpiar, cuántas quedan y guardar con un nombre (queda en Guardados). El número sobre el botón: cuántas hay.
import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, Star } from 'lucide-react';
import { vistaActual } from './VistasFiltro';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { Button, InputGroup, toast } from '../../../components/standard';
import { contar } from './colas';
import { useGuardados } from './guardados';
import Resumen, { partesDe } from './Resumen';
import SeccionFiltro, { SECCIONES } from './seccionesFiltro';
import { VACIO, activos } from './filtros';
import './filtro.css';

function Guardar({ filtro, onGuardado }) {
    const guardados = useGuardados();
    const [nombre, setNombre] = useState('');
    const guardar = (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        guardados.guardar(nombre.trim(), filtro);
        toast('Filtro guardado: queda en Rápidos y guardados');
        setNombre('');
        onGuardado();
    };
    return (
        <form className="cv-macro-guardar" onSubmit={guardar}>
            <InputGroup prefix={<Star size={14} />}>
                <label className="sr" htmlFor="cv-filtro-nombre">Nombre del filtro</label>
                <input id="cv-filtro-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre, ej.: Dolor con 2 seguimientos" autoComplete="off" />
            </InputGroup>
            <Button type="submit" variant="primary" disabled={!nombre.trim()}>Guardar</Button>
        </form>
    );
}

// La columna de las secciones: el nombre, lo elegido debajo y cuántos filtros tiene puestos.
function Secciones({ sec, onSec, partes, vista }) {
    return (
        <nav className="cv-filtro-secs" aria-label="Secciones del filtro">
            {SECCIONES.map((s) => {
                const suyas = partes.filter((p) => p.sec === s.key);
                const eleg = s.key === 'rapidos' ? (vista && vista.id !== 'todos' ? vista.label : '') : suyas.map((p) => p.texto).join(' · ');
                return (
                    <button key={s.key} type="button" className={`cv-filtro-sec${sec === s.key ? ' cv-filtro-sec--on' : ''}`}
                        aria-current={sec === s.key ? 'true' : undefined} onClick={() => onSec(s.key)}>
                        <span className="cv-filtro-sec-t">
                            <span>{s.label}</span>
                            {eleg && <small>{eleg}</small>}
                        </span>
                        {suyas.length > 0 && <span className="cv-filtro-sec-n">{suyas.length}</span>}
                    </button>
                );
            })}
        </nav>
    );
}

export default function MacroFiltro({ lista, filtro, onCambiar, ahora, yo }) {
    const [abierto, setAbierto] = useState(false);
    const [sec, setSec] = useState('rapidos');
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
    const n = activos(filtro);
    const guardados = useGuardados();
    const vista = vistaActual(filtro, yo, guardados.lista);
    const cuantas = contar(lista, { ...filtro, ahora });
    const partes = abierto ? partesDe(lista, filtro, yo) : [];

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
                <div className="cv-macro-pop cv-filtro-pop" ref={pop} role="dialog" aria-label="Filtros">
                    <Resumen partes={partes} filtro={filtro} onCambiar={onCambiar} />
                    <Secciones sec={sec} onSec={setSec} partes={partes} vista={vista} />
                    <div className="cv-filtro-panel">
                        <SeccionFiltro sec={sec} lista={lista} filtro={filtro} cambiar={cambiar} onCambiar={onCambiar} ahora={ahora} yo={yo} />
                    </div>
                    <div className="cv-macro-pie">
                        <Button variant="ghost" disabled={!n} onClick={() => onCambiar({ ...VACIO, orden: filtro.orden })}>Limpiar</Button>
                        <span className="t-cap mut">{cuantas} conversaciones</span>
                        <Guardar filtro={filtro} onGuardado={() => setSec('rapidos')} />
                    </div>
                </div>
            )}
        </div>
    );
}
