// El lead que vuelve: después del correo se lo reconoce. Si tiene una sesión próxima elige si la
// reprograma o agenda otra; después confirma los datos que ya tenemos (tapados) y no los escribe de nuevo.

import { CONTACTO } from '../core/catalogos';
import { fechaTs, horaTxt } from '../core/tiempo';
import { Icono } from '../ui/base';

const DETECTAMOS = 'Detectamos que no es tu primera vez agendando una sesión con nosotros.';

/** reco: lo que devolvió proveedor.conocido. paso: 'proxima' | 'datos'. */
export default function PasoConocido({ ids, reco, paso, tz, acc }) {
    const { datos, proxima } = reco;
    const hola = datos.nombre ? 'Hola de nuevo, ' + datos.nombre + '.' : 'Hola de nuevo.';
    const eyebrow = <p className="rv-ok-eyebrow"><span className="rv-ok-punto" aria-hidden="true"><Icono n="check" s={14} /></span>{hola}</p>;

    if (paso === 'proxima') {
        return (
            <div className="rv-paso rv-paso--entra rv-conocido">
                {eyebrow}
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

    const filas = CONTACTO.filter(c => c.k !== 'email' && datos[c.k]).map(c => (
        <div key={c.k} className="rv-dato">
            <span className="rv-dato-ico" aria-hidden="true"><Icono n={c.ico} s={17} /></span>
            <dt>{c.n}</dt><dd>{datos[c.k]}</dd>
        </div>
    ));
    return (
        <div className="rv-paso rv-paso--entra rv-conocido">
            {eyebrow}
            <h1 className="rv-q rv-q--l1" id={ids.q}>{proxima ? '¿Son correctos tus datos?' : DETECTAMOS}</h1>
            <section className="rv-datos" aria-label="Tus datos">
                {!proxima && <header className="rv-datos-cab"><h2>¿Son correctos tus datos?</h2><p>Con estos te contacta tu consultor.</p></header>}
                <dl className="rv-dl">{filas}</dl>
            </section>
            <div className="rv-acc rv-acc--ok">
                <button type="button" className="rv-seguir" onClick={acc.datosOk}>Sí, son correctos<Icono n="check" s={18} /></button>
                <button type="button" className="rv-sec" onClick={acc.datosNo}><Icono n="edit" s={16} />Cambiarlos</button>
            </div>
        </div>
    );
}
