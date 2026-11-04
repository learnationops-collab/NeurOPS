// «Por closer» del Triage Dashboard (pedido de la dirección comercial, 02/11/2026): de las llamadas que el triage
// pasó a closing, cuántas asistieron con cada closer y cuántas cerraron (pago completo o split; la seña no cuenta), con las señas y el cash (lo cobrado de esos leads desde la llamada),
// con los dos porcentajes. Cada cifra abre la lista que la suma (`cl:<closer>:<cuenta>` de triageFiltros).

import { Porcentaje, ROTULO, TARJETA, Titulo, dinero } from './TriagePaneles';

const COLUMNAS = 'minmax(110px,1.6fr) repeat(7,minmax(0,1fr))';
const RUTULOS = ['PASARON', 'ASISTIERON', '% ASIST.', 'CERRARON', '% CONV.', 'SEÑAS', 'CASH'];

/** `por_closer` (un renglón por triage y closer) en un renglón por closer: de una persona o de todas. */
export function closersDe(filas = [], persona = null) {
    const por = new Map();
    filas.filter((f) => persona == null || f.triage_id === persona).forEach((f) => {
        const s = por.get(f.closer_id) || { id: f.closer_id, nombre: f.closer, pasaron: 0, asistieron: 0, cerraron: 0, senas: 0, cobrado: 0, no_asistieron: 0 };
        s.pasaron += f.pasaron;
        s.asistieron += f.asistieron;
        s.cerraron += f.cerraron;
        s.senas += f.senas || 0;
        s.no_asistieron += f.no_asistieron || 0;
        s.cobrado += f.cobrado || 0;
        por.set(f.closer_id, s);
    });
    return [...por.values()].sort((a, b) => b.pasaron - a.pasaron || a.nombre.localeCompare(b.nombre));
}

// Un número que abre su lista; con cero no hay nada que listar y queda quieto y atenuado.
const Cifra = ({ n, clave, onVer }) => (n ? (
    <button type="button" onClick={() => onVer(clave)}
        style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 800, color: 'inherit', cursor: 'pointer', textAlign: 'right' }}>{n}</button>
) : <span style={{ color: 'var(--text-muted-40)' }}>0</span>);

function Fila({ nombre, id, pasaron, asistieron, cerraron, senas, cobrado, no_asistieron: noAsistieron = 0, onVer, total = false, color }) {
    const clave = (cuenta) => (total ? { pasaron: 'pasaron', asistieron: 'closer_asistieron', cerraron: 'closer_cerraron', senas: 'closer_senas' }[cuenta] : `cl:${id}:${cuenta}`);
    const titulo = (t) => (total ? t : `${t} · ${nombre}`);
    // El % de asistencia es sobre quienes ya tuvieron la llamada: los pendientes de llamada no restan (igual que la tarjeta).
    const conResultado = { n: asistieron + noAsistieron, texto: 'con resultado', clave: undefined, titulo: titulo('Con resultado') };
    const asistieronParte = { n: asistieron, texto: 'asistieron', clave: clave('asistieron'), titulo: titulo('Asistieron al closer') };
    const cerraronParte = { n: cerraron, texto: 'cerraron', clave: clave('cerraron'), titulo: titulo('Cerraron con el closer') };
    return (
        <div style={{ display: 'grid', gridTemplateColumns: COLUMNAS, gap: '0 8px', alignItems: 'baseline', padding: '12px 0', borderTop: '1px solid var(--border-subtle)',
            fontSize: 15, fontWeight: total ? 900 : 700 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {color && <i style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />}{nombre}
            </span>
            <span style={{ textAlign: 'right' }}><Cifra n={pasaron} clave={clave('pasaron')} onVer={onVer} /></span>
            <span style={{ textAlign: 'right' }}><Cifra n={asistieron} clave={asistieronParte.clave} onVer={onVer} /></span>
            <span style={{ textAlign: 'right', color: 'var(--info)' }}><Porcentaje a={asistieronParte} b={conResultado} onVer={onVer} /></span>
            <span style={{ textAlign: 'right' }}><Cifra n={cerraron} clave={cerraronParte.clave} onVer={onVer} /></span>
            <span style={{ textAlign: 'right', color: 'var(--success)' }}><Porcentaje a={cerraronParte} b={asistieronParte} onVer={onVer} /></span>
            <span style={{ textAlign: 'right' }}><Cifra n={senas} clave={clave('senas')} onVer={onVer} /></span>
            <span style={{ textAlign: 'right', color: cobrado ? 'var(--success)' : 'var(--text-muted-40)' }}>{dinero(cobrado)}</span>
        </div>
    );
}

export default function PorCloser({ closers, onVer, colores = {} }) {
    const suma = (k) => closers.reduce((n, c) => n + c[k], 0);
    return (
        <div style={{ ...TARJETA, gap: 12 }}>
            <Titulo texto="Por closer" lado="Lo que el triage pasó a closing" />
            {closers.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nadie pasó a closing en este período.</span>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: COLUMNAS, gap: '0 8px', paddingBottom: 10 }}>
                        <small style={{ ...ROTULO, letterSpacing: '.1em' }}>CLOSER</small>
                        {RUTULOS.map((r) => <small key={r} style={{ ...ROTULO, letterSpacing: '.1em', textAlign: 'right' }}>{r}</small>)}
                    </div>
                    {closers.map((c) => <Fila key={c.id} {...c} color={colores[c.id]} onVer={onVer} />)}
                    {closers.length > 1 && <Fila nombre="Total" pasaron={suma('pasaron')} asistieron={suma('asistieron')} cerraron={suma('cerraron')} senas={suma('senas')} no_asistieron={suma('no_asistieron')} cobrado={suma('cobrado')} onVer={onVer} total />}
                </div>
            )}
        </div>
    );
}
