// Lo que abre cada control de la barra de Confirmar (ADR-W201): propiedades, filtro, orden, agrupación y
// tipo de vista. Cada cambio se aplica al momento sobre la vista activa.
import { useState } from 'react';
import { Check, GripVertical } from 'lucide-react';
import { Switch } from '../../../components/standard';
import { ETAPAS_CONFIRMACION } from './etapas';
import { AGRUPACIONES, ORDENES } from './propiedades';
import { TIPOS_DE_VISTA } from './vistasConfirmar';
import { IconoDeVista } from './iconos';

const Titulo = ({ children, accion }) => (
    <div className="cv-pop__tit"><span>{children}</span>{accion}</div>
);

function Propiedades({ vista, catalogo, onCambio }) {
    const [q, setQ] = useState('');
    const [arrastrada, setArrastrada] = useState(null);
    const [sobre, setSobre] = useState(null);
    const visibles = vista.props.filter(k => catalogo.some(p => p.clave === k));
    const orden = [...visibles, ...catalogo.map(p => p.clave).filter(k => !visibles.includes(k))];
    const de = (formulario) => orden.map(k => catalogo.find(p => p.clave === k))
        .filter(p => !!p.formulario === formulario && p.titulo.toLowerCase().includes(q.trim().toLowerCase()));
    const alternar = (k) => onCambio({ props: visibles.includes(k) ? visibles.filter(x => x !== k) : [...visibles, k] });
    const soltar = (destino) => {
        if (!arrastrada || arrastrada === destino) return;
        const sin = visibles.filter(x => x !== arrastrada);
        const i = sin.indexOf(destino);
        sin.splice(i < 0 ? sin.length : i, 0, arrastrada);
        onCambio({ props: sin });
    };
    const fila = (p) => (
        <div key={p.clave} className={`cv-op${arrastrada === p.clave ? ' cv-op--arr' : ''}${sobre === p.clave ? ' cv-op--sobre' : ''}`}
            draggable onDragStart={() => setArrastrada(p.clave)} onDragEnd={() => { setArrastrada(null); setSobre(null); }}
            onDragOver={(e) => { e.preventDefault(); setSobre(p.clave); }} onDragLeave={() => setSobre(null)}
            onDrop={(e) => { e.preventDefault(); soltar(p.clave); setSobre(null); }}>
            <GripVertical className="cv-op__asa" aria-hidden="true" />
            <span className="cv-op__t" title={p.titulo}>{p.titulo}</span>
            <Switch checked={visibles.includes(p.clave)} onChange={() => alternar(p.clave)} label={`Mostrar ${p.titulo}`} />
        </div>
    );
    const agenda = de(false), formulario = de(true);
    return (
        <>
            <input className="cv-pop__q" placeholder="Buscar una propiedad" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            <Titulo accion={visibles.length > 0 && <button type="button" onClick={() => onCambio({ props: [] })}>Ocultar todas</button>}>Agenda</Titulo>
            <div className="cv-op cv-op--fija"><span className="cv-op__t">Nombre</span><small>siempre</small></div>
            {agenda.map(fila)}
            <Titulo accion={formulario.length > 0 && (
                <button type="button" onClick={() => onCambio({ props: [...new Set([...visibles, ...formulario.map(p => p.clave)])] })}>Mostrar todas</button>
            )}>Respuestas del formulario</Titulo>
            {formulario.length ? formulario.map(fila) : <p className="cv-pop__nada">Ningún lead del tablero respondió un formulario.</p>}
        </>
    );
}

function Filtro({ vista, closers, segmentos, onCambio }) {
    const f = vista.filtro;
    const alternar = (campo, valor) => {
        const lista = f[campo] || [];
        onCambio({ filtro: { ...f, [campo]: lista.includes(valor) ? lista.filter(x => x !== valor) : [...lista, valor] } });
    };
    const opcion = (campo, valor, titulo, cuenta) => {
        const on = (f[campo] || []).includes(valor);
        return (
            <button key={valor} type="button" className="cv-op" onClick={() => alternar(campo, valor)} aria-pressed={on}>
                <span className={`cv-chk${on ? ' cv-chk--on' : ''}`}>{on && <Check aria-hidden="true" />}</span>
                <span className="cv-op__t">{titulo}</span>{cuenta != null && <small>{cuenta}</small>}
            </button>
        );
    };
    const algo = f.closers.length + f.etapas.length + f.segmentos.length > 0;
    return (
        <>
            {closers.length > 1 && [['triage', 'Triage'], ['closer', 'Closing']].map(([rol, titulo]) => {
                const del = closers.filter(c => c.rol === rol);
                if (!del.length) return null;
                const valores = del.map(c => c.valor);
                const solo = valores.length === f.closers.length && valores.every(v => f.closers.includes(v));
                return (
                    <div key={rol}>
                        <Titulo accion={<button type="button" onClick={() => onCambio({ filtro: { ...f, closers: solo ? [] : valores } })}>{solo ? 'Ver todos' : 'Solo ' + titulo.toLowerCase()}</button>}>
                            {titulo}
                        </Titulo>
                        {del.map(c => opcion('closers', c.valor, c.titulo, c.cuenta))}
                    </div>
                );
            })}
            <Titulo>Etapa</Titulo>
            {ETAPAS_CONFIRMACION.map(e => opcion('etapas', e.clave, e.titulo))}
            {segmentos.length > 0 && <><Titulo>Segmento</Titulo>{segmentos.map(s => opcion('segmentos', s.valor, s.titulo, s.cuenta))}</>}
            {algo && <Titulo accion={<button type="button" onClick={() => onCambio({ filtro: { closers: [], etapas: [], segmentos: [] } })}>Sacar filtros</button>} />}
        </>
    );
}

const Radio = ({ on, titulo, detalle, onClick }) => (
    <button type="button" className="cv-op" onClick={onClick} aria-pressed={on}>
        <span className={`cv-rad${on ? ' cv-rad--on' : ''}`} /><span className="cv-op__t">{titulo}</span>{detalle && <small>{detalle}</small>}
    </button>
);

function Orden({ vista, onCambio }) {
    return (
        <>
            <Titulo>Ordenar por</Titulo>
            {ORDENES.map(o => <Radio key={o.valor} on={vista.orden === o.valor} titulo={o.titulo} onClick={() => onCambio({ orden: o.valor })} />)}
            <Titulo>Sentido</Titulo>
            <Radio on={vista.asc} titulo="Ascendente" onClick={() => onCambio({ asc: true })} />
            <Radio on={!vista.asc} titulo="Descendente" onClick={() => onCambio({ asc: false })} />
        </>
    );
}

export const agrupacionesDe = (vista, esTriage) => AGRUPACIONES
    .filter(a => (vista.tipo === 'lista' || !a.soloLista) && (esTriage || !a.soloTriage));

function Agrupar({ vista, esTriage, onCambio }) {
    const ops = agrupacionesDe(vista, esTriage);
    const actual = ops.some(a => a.valor === vista.agrupar) ? vista.agrupar : 'etapa';
    return (
        <>
            <Titulo>{vista.tipo === 'tablero' ? 'Columnas por' : 'Agrupar por'}</Titulo>
            {ops.map(a => <Radio key={a.valor} on={actual === a.valor} titulo={a.titulo} detalle={a.detalle} onClick={() => onCambio({ agrupar: a.valor })} />)}
        </>
    );
}

function Tipo({ nueva, onElegir, onRestablecer }) {
    return (
        <>
            <Titulo>{nueva ? 'Nueva vista' : 'Cambiar esta vista a'}</Titulo>
            <div className="cv-tipos">
                {Object.entries(TIPOS_DE_VISTA).map(([tipo, titulo]) => (
                    <button key={tipo} type="button" onClick={() => onElegir(tipo)}><IconoDeVista tipo={tipo} />{titulo}</button>
                ))}
            </div>
            {!nueva && <Titulo accion={<button type="button" onClick={onRestablecer}>Volver a las vistas de fábrica</button>} />}
        </>
    );
}

export default function PopoverVista({ tipo, ...props }) {
    if (tipo === 'props') return <Propiedades {...props} />;
    if (tipo === 'filtro') return <Filtro {...props} />;
    if (tipo === 'orden') return <Orden {...props} />;
    if (tipo === 'agrupar') return <Agrupar {...props} />;
    return <Tipo nueva={tipo === 'nueva'} onElegir={props.onElegirTipo} onRestablecer={props.onRestablecer} />;
}
