import { useDatosCacheados } from '../../../services/cacheDeVistas';
import { getPaises } from '../comercialApi';
import { Panel, PanelCab, Vacio } from './PiezasAnalizar';
import './panelPaises.css';

/**
 * Analizar › Por país (Kerwin, 04/11/2026): las agendas del período por el país del lead (el código de su WhatsApp),
 * con show up, ventas, cierre y cash de cada uno. Los países suman el total de arriba. Siempre muestra todos los
 * países, también con el filtro «País» puesto, para poder compararlos; tocar uno activa el filtro (`onElegir`) y las
 * cifras y listas del dashboard se acotan a él. Cuentas en `app/services/paises_comercial.py`.
 */
const POR_ROL = {
    closers: { agendas: 'Agendas', cash: true },
    setters: { agendas: 'Generadas', cash: false },
};

const entero = (n) => Number(n || 0).toLocaleString('es-AR');
const pct = (n) => (n === null || n === undefined ? '—' : `${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`);
const plata = (n) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;

const Celdas = ({ f, cash }) => (
    <>
        <span role="cell" className="num">{entero(f.agendas)}</span>
        <span role="cell" className="num">{entero(f.asistieron)}</span>
        <span role="cell" className="num">{pct(f.show_up)}</span>
        <span role="cell" className="num">{entero(f.ventas)}{f.cierre !== null ? <small> · {pct(f.cierre)}</small> : null}</span>
        {cash && <span role="cell" className="num">{plata(f.cash)}</span>}
    </>
);

const PanelPaises = ({ filtros, rol, elegidos, onElegir, version = 0 }) => {
    const texto = POR_ROL[rol] || POR_ROL.closers;
    const base = { ...filtros, pais: null };
    const clave = JSON.stringify(base);
    const { datos, error } = useDatosCacheados(`comercial:paises:${clave}`, (signal) => getPaises(base, { signal }), { version });
    if (error && !datos) return null;

    const alternar = (key) => onElegir(elegidos.includes(key) ? elegidos.filter((k) => k !== key) : [...elegidos, key]);
    const filas = datos?.paises || [];
    const estilo = { '--pp-cols': `minmax(120px,1.6fr) repeat(${texto.cash ? 5 : 4}, minmax(58px,1fr))` };

    return (
        <Panel id="p-paises" cab={(
            <PanelCab titulo="Por país"
                ayuda={'Las agendas del período por país del lead, según el código de su WhatsApp. Tocá un país para filtrar '
                    + 'todo el dashboard por él. «Sin país» son los leads sin teléfono o con un código que no reconocemos.'} />
        )}>
            {!datos ? <Vacio texto="Cargando los países…" /> : !filas.length ? <Vacio texto="No hay agendas en este período." /> : (
                <div className="pp-tabla" role="table" aria-label="Agendas por país" style={estilo}>
                    <div className="pp-fila pp-cab" role="row">
                        <span role="columnheader">País</span>
                        <span role="columnheader" className="num">{texto.agendas}</span>
                        <span role="columnheader" className="num">Asistieron</span>
                        <span role="columnheader" className="num">Show up</span>
                        <span role="columnheader" className="num">Ventas</span>
                        {texto.cash && <span role="columnheader" className="num">Cash</span>}
                    </div>
                    {filas.map((f) => (
                        <button key={f.pais} type="button" role="row" className="pp-fila" aria-pressed={elegidos.includes(f.pais)}
                            onClick={() => alternar(f.pais)}>
                            <span role="cell" className="trunc">{f.label}</span>
                            <Celdas f={f} cash={texto.cash} />
                        </button>
                    ))}
                    <div className="pp-fila pp-total" role="row">
                        <span role="cell">Total</span>
                        <Celdas f={datos.total} cash={texto.cash} />
                    </div>
                </div>
            )}
        </Panel>
    );
};

export default PanelPaises;
