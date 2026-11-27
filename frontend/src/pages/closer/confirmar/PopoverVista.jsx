// Lo que abre cada control de la barra de Confirmar (ADR-W201): propiedades, filtro, orden, agrupación y
// tipo de vista. Cada cambio se aplica al momento sobre la vista activa.
import { Check } from 'lucide-react';
import { ETAPAS_CONFIRMACION } from './etapas';
import { AGRUPACIONES, ORDENES } from './propiedades';
import { TIPOS_DE_VISTA } from './vistasConfirmar';
import { IconoDeVista } from './iconos';
import Propiedades from './PopoverPropiedades';

const Titulo = ({ children, accion }) => (
    <div className="cv-pop__tit"><span>{children}</span>{accion}</div>
);

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
