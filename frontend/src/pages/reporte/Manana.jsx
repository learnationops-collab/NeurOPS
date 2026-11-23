// «Mañana»: qué harías mejor, algo de la plataforma que trabó y, para el setter, cómo trabajó.
import { TextArea } from '../../components/standard';
import { CabCard } from './piezas';

export const okManana = (m) => !!String(m?.mejor || '').trim();

export default function Manana({ manana = {}, rol, pasado, editar }) {
    const set = (patch) => editar({ manana: patch });
    return (
        <section className="rp-card ui-panel" id="rp-c-man">
            <CabCard n={2} titulo="Mañana" ok={okManana(manana)} />
            <div className="rp-dos">
                <div className="rp-campo">
                    <label htmlFor="rp-mejor">Qué harías mejor mañana</label>
                    <TextArea id="rp-mejor" value={manana.mejor || ''} placeholder="Una o dos líneas" onChange={(e) => set({ mejor: e.target.value })} />
                </div>
                <div className="rp-campo">
                    <label htmlFor="rp-traba">Algo de la plataforma que te trabó <small>· opcional, les llega a los devs</small></label>
                    <TextArea id="rp-traba" value={manana.traba || ''} placeholder="Por ejemplo: el filtro de Contacto se borra al volver"
                        onChange={(e) => set({ traba: e.target.value })} />
                </div>
            </div>
            {rol === 'setter' && (
                <div className="rp-campo">
                    <label htmlFor="rp-flujo">Cómo trabajaste {pasado ? 'ese día' : 'hoy'} <small>· opcional</small></label>
                    <TextArea id="rp-flujo" value={manana.flujo || ''} placeholder="Tu flujo de trabajo: en qué orden, qué te funcionó"
                        onChange={(e) => set({ flujo: e.target.value })} />
                </div>
            )}
        </section>
    );
}
