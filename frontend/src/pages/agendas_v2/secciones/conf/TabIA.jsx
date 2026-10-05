// Configuración › Con IA: un funnel completo armado con Claude o ChatGPT.
//   1. Copiar el prompt (lo arma el servidor con el equipo real de Team) y pegarlo en la IA.
//   2. La IA pregunta lo que falta y devuelve un JSON («paquete», ver app/agendas_v2/paquete.py).
//   3. Pegar el JSON acá: «Revisar» lo valida sin escribir nada; «Crear todo» crea prioridades,
//      formulario, funnel y evento de una vez. El evento queda sin publicar para revisarlo.

import { useState } from 'react';
import { Icono } from '../../ui/base';
import { almacen } from '../../data/hooks';
import { ui } from '../../ui/estadoUi';
import { copiarTexto, toast } from '../../ui/toast';

// Lo que pega la persona puede venir con el bloque ```json de la IA, o con texto alrededor.
export function leerPaquete(texto) {
    const t = String(texto || '').trim();
    const bloque = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const crudo = bloque ? bloque[1] : t.slice(Math.max(0, t.indexOf('{')), t.lastIndexOf('}') + 1);
    try { return { paquete: JSON.parse(crudo) }; } catch { return { error: 'No es un JSON válido. Copiá el bloque completo que te dio la IA.' }; }
}

const ESTRATEGIA = { llenar: 'llenar en orden', horario: 'por horario', repartir: 'repartir parejo' };

function Resumen({ r }) {
    return (
        <div className="ia-resumen" role="status">
            <p className="t-sm"><b>Se va a crear:</b></p>
            <ul className="t-sm">
                <li>Funnel <b>{r.funnel}</b> (<code>/{r.slug}</code>) con {r.origenes} {r.origenes === 1 ? 'origen' : 'orígenes'}</li>
                <li>{r.prioridades.length} {r.prioridades.length === 1 ? 'prioridad' : 'prioridades'}: {r.prioridades.map(g => `${g.nombre} (${ESTRATEGIA[g.estrategia] || g.estrategia}, ${g.closers} ${g.closers === 1 ? 'closer' : 'closers'})`).join(' · ')}</li>
                <li>Formulario <b>{r.formulario}</b> con {r.preguntas} {r.preguntas === 1 ? 'pregunta' : 'preguntas'} y {r.reglas} {r.reglas === 1 ? 'regla' : 'reglas'}</li>
                <li>Evento <b>{r.evento}</b> de {r.duracion} min, <b>sin publicar</b></li>
            </ul>
        </div>
    );
}

export default function TabIA() {
    const ad = almacen.adaptador;
    const [texto, setTexto] = useState('');
    const [estado, setEstado] = useState({ paso: 'editar' }); // editar | revisando | listo | creando
    const [errores, setErrores] = useState([]);
    const [resumen, setResumen] = useState(null);

    if (!ad.promptPaquete) {
        return <div className="panel vacio"><p className="t-sm mut">La configuración con IA necesita el servidor (no funciona en modo local).</p></div>;
    }

    const copiarPrompt = async () => {
        try { copiarTexto(await ad.promptPaquete(), 'Prompt copiado: pegalo en Claude o ChatGPT'); }
        catch { toast('No se pudo armar el prompt. Revisá la conexión.', 'error'); }
    };

    const enviar = async (simular) => {
        const { paquete, error } = leerPaquete(texto);
        if (error) { setErrores([error]); setResumen(null); return; }
        setEstado({ paso: simular ? 'revisando' : 'creando' });
        try {
            const r = await ad.importarPaquete(paquete, simular);
            setErrores([]);
            setResumen(r.resumen);
            if (simular) { setEstado({ paso: 'listo' }); return; }
            await almacen.recargar();
            toast('Funnel creado. Revisá el evento y publicalo.');
            setTexto(''); setResumen(null); setEstado({ paso: 'editar' });
            ui.set({ conf: null, seccion: 'eventos', ev: { id: r.creados.evento, tab: 'config', nodo: null, calor: true } });
        } catch (e) {
            setErrores(e.errores && e.errores.length ? e.errores : [e.message || 'No se pudo importar.']);
            setResumen(null);
            setEstado({ paso: 'editar' });
        }
    };

    const ocupado = estado.paso === 'revisando' || estado.paso === 'creando';
    return (
        <div className="ia">
            <section className="int">
                <div className="int-cab"><span className="icono-m"><Icono n="rayo" s={19} /></span><b>1. Pedile el funnel a la IA</b></div>
                <p className="t-sm mut">Copiá el prompt y pegalo en Claude o ChatGPT. La IA te va a preguntar por el formulario, la segmentación y los closers, y al final te devuelve un JSON. Ya trae a tu equipo de Team.</p>
                <button type="button" className="btn btn--cta btn--sm" onClick={copiarPrompt}><Icono n="copiar" />Copiar prompt</button>
            </section>
            <section className="int">
                <div className="int-cab"><span className="icono-m"><Icono n="importar" s={19} /></span><b>2. Pegá el JSON que te dio</b></div>
                <label className="sr" htmlFor="ia-json">JSON del funnel</label>
                <textarea id="ia-json" className="input" rows={10} spellCheck={false} placeholder='{ "paquete_thalamus": 1, ... }' value={texto}
                    aria-invalid={errores.length > 0 || undefined} aria-describedby={errores.length ? 'ia-errores' : undefined}
                    onChange={e => { setTexto(e.target.value); setEstado({ paso: 'editar' }); setResumen(null); setErrores([]); }}
                    style={{ fontFamily: 'ui-monospace, monospace', width: '100%' }} />
                {errores.length > 0 && (
                    <div className="campo-err" id="ia-errores" role="alert">
                        <Icono n="alerta" s={14} />
                        <div><b>Hay que corregir esto (podés pedírselo a la IA):</b><ul>{errores.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
                    </div>
                )}
                {resumen && <Resumen r={resumen} />}
                <div className="der" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn--linea btn--sm" disabled={!texto.trim() || ocupado} onClick={() => enviar(true)}>
                        {estado.paso === 'revisando' ? 'Revisando…' : 'Revisar'}
                    </button>
                    <button type="button" className="btn btn--cta btn--sm" disabled={estado.paso !== 'listo'} onClick={() => enviar(false)}>
                        <Icono n="plus" />{estado.paso === 'creando' ? 'Creando…' : 'Crear todo'}
                    </button>
                </div>
            </section>
        </div>
    );
}
