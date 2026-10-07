// El lead que vuelve: después del correo se lo reconoce. Si tiene una sesión próxima elige si la
// reprograma o agenda otra. Sus datos no se le preguntan: si están completos no los escribe de nuevo.

import { fechaTs, horaTxt } from '../core/tiempo';
import { Icono } from '../ui/base';

const DETECTAMOS = 'Detectamos que no es tu primera vez agendando una sesión con nosotros.';

/** reco: lo que devolvió proveedor.conocido (con proxima). */
export default function PasoConocido({ ids, reco, tz, acc }) {
    const { datos, proxima } = reco;
    const hola = datos.nombre ? 'Hola de nuevo, ' + datos.nombre + '.' : 'Hola de nuevo.';

    return (
        <div className="rv-paso rv-paso--entra rv-conocido">
            <p className="rv-ok-eyebrow"><span className="rv-ok-punto" aria-hidden="true"><Icono n="check" s={14} /></span>{hola}</p>
            <h1 className="rv-q rv-q--l1" id={ids.q}>{DETECTAMOS}</h1>
            <p className="rv-ayuda">
                Ya tenés una sesión el <b>{fechaTs(proxima.inicio, tz)}</b> a las {horaTxt(proxima.inicio, tz)}. ¿Qué querés hacer?
            </p>
            <div className="rv-acc rv-acc--ok">
                <button type="button" className="rv-seguir" onClick={() => acc.elegirProxima('reprogramar')}>Quiero reprogramarla<Icono n="calendar" s={18} /></button>
                <button type="button" className="rv-sec" onClick={() => acc.elegirProxima('adicional')}>Agendar una nueva</button>
            </div>
        </div>
    );
}
