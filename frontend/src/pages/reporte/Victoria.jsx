// «Tu victoria»: con quién fue (o por qué no hubo leads), qué pasó, por qué, prueba y otras victorias.
import { useState } from 'react';
import { Link2, X } from 'lucide-react';
import { Avatar, InputGroup, LinkButton, TextArea } from '../../components/standard';
import { CabCard } from './piezas';

export const okVictoria = (v) => (v?.tipo === 'sin_gente'
    ? String(v.motivo || '').trim().length >= 5
    : !!v?.persona && !!String(v.que || '').trim());

function Elegido({ p, children }) {
    return (
        <div className="rp-elegido">
            <Avatar name={p.nombre} size="sm" />
            <span><b>{p.nombre}</b>{p.detalle && <><br /><small>{p.detalle}</small></>}</span>
            {children}
        </div>
    );
}

export default function Victoria({ victoria = {}, candidatos = [], pasado, editar }) {
    const [buscar, setBuscar] = useState('');
    const [conLink, setConLink] = useState(false);
    const cuando = pasado ? 'ese día' : 'hoy';
    const v = { tipo: 'persona', persona: null, que: '', por: '', prueba_url: '', motivo: '', mas: [], ...victoria };
    const set = (patch, ya = false) => editar({ victoria: patch }, ya);
    const mas = v.mas || [];
    const usados = new Set([v.persona?.id, ...mas.map((m) => m.persona?.id)].filter(Boolean));
    const libres = candidatos.filter((c) => !usados.has(c.id));

    let cuerpo;
    if (v.tipo === 'sin_gente') {
        cuerpo = (
            <>
                <div className="rp-campo">
                    <label htmlFor="rp-motivo">Por qué no hubo leads {cuando}</label>
                    <TextArea id="rp-motivo" value={v.motivo || ''} placeholder="Por ejemplo: estuve todo el día armando el workshop"
                        onChange={(e) => set({ motivo: e.target.value })} />
                </div>
                <LinkButton className="rp-solo" onClick={() => set({ tipo: 'persona' }, true)}>Mejor elijo un lead</LinkButton>
            </>
        );
    } else if (!v.persona) {
        const q = buscar.trim().toLowerCase();
        const lista = q ? candidatos.filter((c) => c.nombre.toLowerCase().includes(q)) : candidatos;
        cuerpo = (
            <>
                <p className="rp-sub">¿Con quién fue? Elegí un lead con el que trabajaste {cuando}.</p>
                {lista.length > 0 && (
                    <div className="rp-lista">
                        {lista.map((c) => (
                            <button key={c.id} type="button" className="rp-persona" onClick={() => set({ persona: c }, true)}>
                                <Avatar name={c.nombre} size="sm" />
                                <span><b>{c.nombre}</b><small>{c.detalle}</small></span>
                            </button>
                        ))}
                    </div>
                )}
                {q && lista.length === 0 && <p className="rp-sub">Ningún lead de {cuando} coincide con «{buscar}».</p>}
                <div className="rp-fila-acc">
                    {candidatos.length > 0 && (
                        <input className="rp-buscar" placeholder="Buscar otro lead" aria-label="Buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
                    )}
                    <LinkButton onClick={() => set({ tipo: 'sin_gente' }, true)}>Hoy no trabajé con leads</LinkButton>
                </div>
            </>
        );
    } else {
        cuerpo = (
            <>
                <Elegido p={v.persona}><button type="button" onClick={() => set({ persona: null }, true)}>Cambiar</button></Elegido>
                <div className="rp-dos">
                    <div className="rp-campo">
                        <label htmlFor="rp-que">Qué pasó</label>
                        <TextArea id="rp-que" value={v.que || ''} placeholder="Lo concreto: qué hizo, qué logró" onChange={(e) => set({ que: e.target.value })} />
                    </div>
                    <div className="rp-campo">
                        <label htmlFor="rp-por">Por qué es una victoria <small>· opcional</small></label>
                        <TextArea id="rp-por" value={v.por || ''} placeholder="Qué cambia para esa persona o para el equipo" onChange={(e) => set({ por: e.target.value })} />
                    </div>
                </div>
                <div className="rp-prueba">
                    {conLink || v.prueba_url ? (
                        <InputGroup prefix={<Link2 size={16} />} className="rp-prueba__in">
                            <input value={v.prueba_url || ''} placeholder="Link a la captura, el chat o el archivo" aria-label="Link de la prueba"
                                autoFocus={conLink && !v.prueba_url} onChange={(e) => set({ prueba_url: e.target.value })} />
                        </InputGroup>
                    ) : (
                        <button type="button" onClick={() => setConLink(true)}><Link2 size={16} />Sumar link o captura</button>
                    )}
                    <span className="rp-nota">Prueba opcional</span>
                </div>
                {mas.map((m, i) => (
                    <div key={m.persona?.id || i} className="rp-mas">
                        <Elegido p={m.persona || { nombre: 'Otra victoria' }}>
                            <button type="button" aria-label="Quitar esta victoria" onClick={() => set({ mas: mas.filter((_, j) => j !== i) }, true)}><X size={14} /></button>
                        </Elegido>
                        <TextArea value={m.que || ''} placeholder="Qué pasó" aria-label={`Qué pasó con ${m.persona?.nombre || 'esta persona'}`}
                            onChange={(e) => set({ mas: mas.map((x, j) => (j === i ? { ...x, que: e.target.value } : x)) })} />
                    </div>
                ))}
                {libres.length > 0 && (
                    <button className="rp-sumar" type="button" onClick={() => set({ mas: [...mas, { persona: libres[0], que: '' }] }, true)}>+ Sumar otra victoria</button>
                )}
            </>
        );
    }
    return (
        <section className="rp-card ui-panel" id="rp-c-vic">
            <CabCard n={1} titulo="Tu victoria" ok={okVictoria(v)} />
            {cuerpo}
        </section>
    );
}
