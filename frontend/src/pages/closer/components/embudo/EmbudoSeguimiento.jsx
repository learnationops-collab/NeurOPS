import { useState } from 'react';
import { Button } from '../../../../components/standard';
import { Esqueleto, Hueso } from '../../../../components/huesos/Huesos';
import useEmbudo from './useEmbudo';
import FilaEmbudo from './FilaEmbudo';
import DiasDelEmbudo from './DiasDelEmbudo';
import './embudo.css';

// Lo que la ficha necesita para abrirse. `fase`: 'seg' abre el seguimiento en Resultado (otra
// llamada, descartar…); 'venta', Resultado en «Registrar una venta».
const aFicha = (f, fase) => ({
    id: f.id, client_id: f.client_id, person_uuid: f.person_uuid, lead_name: f.lead_name,
    instagram: f.instagram, phone: f.phone, examen: f.examen, origin: f.origin, fase,
    tipo: (f.closer_result || '').toLowerCase() === 'show up' ? 'tomada' : 'no_tomada',
    closer_notes: f.closer_notes, call_date: f.call_date,
});

const Cifra = ({ rotulo, valor, de }) => (
    <div className="emb-cifra">
        <small>{rotulo}</small>
        <b>{valor}{de != null && <span> de {de}</span>}</b>
    </div>
);

/**
 * Embudo de seguimiento (ADR-W121): una columna por día desde la llamada, con una fila por persona
 * y «Registrar» para anotar el seguimiento de hoy o abrir la ficha en el pago, otra llamada o el
 * descarte.
 */
const EmbudoSeguimiento = ({ refreshKey, onOpenLead }) => {
    const { datos, ultimo, ocupado, registrar, deshacer, guardarDias, olvidarUltimo } = useEmbudo(refreshKey);
    const [menu, setMenu] = useState(null);

    if (!datos) {
        return (
            <Esqueleto rotulo="Cargando el embudo…" className="emb">
                <div className="emb-cifras">{[0, 1, 2].map(i => <Hueso key={i} alto={58} radio={14} paso={i} />)}</div>
                <div className="emb-cols" style={{ '--cols': 3 }}>{[0, 1, 2].map(i => <Hueso key={i} alto={220} radio={18} paso={i} />)}</div>
            </Esqueleto>
        );
    }
    if (datos.error) return <div className="emb-vacio">No se pudo cargar el embudo de seguimiento.</div>;

    const { resumen, dias } = datos;
    const alRegistrar = (f, resultado) => registrar(f, resultado,
        `${f.lead_name}: ${resultado === 'respondio' ? 'respondió' : 'no respondió'} (día ${f.dia}).`);

    return (
        <div className="emb">
            <div className="emb-cifras">
                <Cifra rotulo="Seguidos hoy" valor={resumen.seguidos_hoy} de={resumen.total} />
                <Cifra rotulo="Respondieron" valor={resumen.respondieron} de={resumen.total} />
                <Cifra rotulo="Pagaron" valor={resumen.pagaron} />
            </div>

            {ultimo && (
                <div className="emb-deshacer">
                    <span>{ultimo.texto}</span>
                    <span className="emb-l1">
                        <Button variant="ghost" disabled={ocupado} onClick={deshacer}>Deshacer</Button>
                        <button type="button" className="emb-x" aria-label="Cerrar" onClick={olvidarUltimo}>×</button>
                    </span>
                </div>
            )}

            <div className="emb-cols" style={{ '--cols': dias.length }}>
                {datos.columnas.map(c => {
                    const porSeguir = c.filas.filter(f => f.estado === 'pendiente').length;
                    return (
                        <section key={c.dia} className="emb-col">
                            <header className="emb-ch">
                                <b>{c.dia === 1 ? '1 día' : `${c.dia} días`}</b>
                                <small>desde la llamada · {c.filas.length}</small>
                                {porSeguir > 0 && <span className="emb-pend">{porSeguir} por seguir</span>}
                            </header>
                            {c.filas.length
                                ? c.filas.map((f, i) => (
                                    <FilaEmbudo key={f.id} f={f} orden={i} abierto={menu === f.id} ocupado={ocupado}
                                        onMenu={setMenu} onRegistrar={alRegistrar}
                                        onFicha={(x, fase) => onOpenLead(aFicha(x, fase))} />
                                ))
                                : <div className="emb-vacio">Nadie tuvo llamada hace {c.dia === 1 ? '1 día' : `${c.dia} días`}.</div>}
                        </section>
                    );
                })}
            </div>

            <DiasDelEmbudo dias={dias} editable={datos.puede_editar} onGuardar={guardarDias} />
        </div>
    );
};

export default EmbudoSeguimiento;
