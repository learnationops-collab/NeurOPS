// Configuración › Apariencia, la de los tres servicios (ADR-W167, mockup docs/mockups/configuracion-unificada):
// los cuatro temas únicos con su vista previa (pintada con sus propios colores en el modo elegido); el modo,
// los efectos y el modo liviano; el tamaño de letra; la vista de esta ventana y el fondo del Portal y del login
// (pages/auth/FondoEntrada.jsx). Se guarda en el navegador y en la cuenta.

import { Segmented, Switch } from '../components/standard';
import { LETRAS, VISTAS, useApariencia } from '../context/AparienciaContext';
import { FONDOS, movimientoReducido, useFondo } from '../pages/auth/FondoEntrada';

const Fila = ({ titulo, ayuda, children }) => (
    <div className="ap-fila">
        <span className="ap-fila-tx"><b>{titulo}</b>{ayuda && <small>{ayuda}</small>}</span>
        {children}
    </div>
);

export default function TabApariencia() {
    const { tema, setTema, temas, modos, setModo, modoGuardado, modo, ajustes, setAjuste, livianoPorSimular } = useApariencia();
    const modoVista = modo ?? (modoGuardado === 'claro' ? 'claro' : 'oscuro');
    const [, setFondo, fondo] = useFondo();
    return (
        <div className="ap">
            <section className="ap-bloque" aria-label="Tema">
                <p className="t-eyebrow">Tema</p>
                <div className="ap-temas" role="radiogroup" aria-label="Tema">
                    {temas.map(t => (
                        <button key={t.id} type="button" role="radio" aria-label={t.nombre} aria-checked={tema === t.id}
                            data-tema={t.id} data-tema-modo={modoVista} className="ap-tema" onClick={() => setTema(t.id)}>
                            <span className="ap-muestra" aria-hidden="true">
                                <span className="ap-muestra-linea ap-muestra-linea--corta" />
                                <span className="ap-muestra-fila"><span className="ap-muestra-tarjeta" /><span className="ap-muestra-btn" /></span>
                                <span className="ap-muestra-linea" />
                            </span>
                            <span className="ap-nombre">{t.nombre}</span>
                            <span className="ap-modo">{t.descripcion}</span>
                        </button>
                    ))}
                </div>
                <p className="t-sm mut">El mismo en Work, Academy y Leadership: se guarda en tu cuenta.</p>
            </section>

            <section className="ap-bloque" aria-label="Color">
                <p className="t-eyebrow">Color</p>
                <Fila titulo="Modo">
                    <Segmented label="Modo" radio value={tema ? modoGuardado : null} onChange={setModo}
                        options={modos.map(m => ({ value: m.id, label: m.nombre }))} />
                </Fila>
                <Fila titulo="Efectos" ayuda="El humo de fondo y el vidrio. Apagados, todo plano.">
                    <Switch label="Efectos" checked={ajustes.efectos} onChange={(v) => setAjuste('efectos', v)} />
                </Fila>
                <Fila titulo="Modo liviano" ayuda={livianoPorSimular ? 'Prendido porque estás simulando.' : 'Sin transparencias ni animaciones: para compartir pantalla o equipos lentos.'}>
                    <Switch label="Modo liviano" checked={ajustes.liviano} disabled={livianoPorSimular}
                        onChange={(v) => setAjuste('liviano', v)} />
                </Fila>
            </section>

            <section className="ap-bloque" aria-label="Pantalla">
                <p className="t-eyebrow">Pantalla</p>
                <Fila titulo="Tamaño de letra">
                    <Segmented label="Tamaño de letra" radio value={ajustes.letra} onChange={(v) => setAjuste('letra', v)}
                        options={LETRAS.map(l => ({ value: l.id, label: l.nombre }))} />
                </Fila>
                <Fila titulo="Vista de Configuración" ayuda="Pestañas a la izquierda, o baldosas como en Academy.">
                    <Segmented label="Vista de Configuración" radio value={ajustes.vista} onChange={(v) => setAjuste('vista', v)}
                        options={VISTAS.map(v => ({ value: v.id, label: v.nombre }))} />
                </Fila>
            </section>

            <section className="ap-bloque" aria-label="Fondo del Portal">
                <p className="t-eyebrow">Fondo del Portal y del login</p>
                <div className="ap-fondos" role="radiogroup" aria-label="Fondo del Portal">
                    {FONDOS.map(([id, nombre, descripcion]) => (
                        <button key={id} type="button" role="radio" aria-label={nombre} aria-checked={fondo === id}
                            className="ap-fondo" onClick={() => setFondo(id)}>
                            <span className={`ap-fondo-muestra ap-fondo-muestra--${id}`} aria-hidden="true" />
                            <span className="ap-nombre">{nombre}</span>
                            <span className="ap-modo">{descripcion}</span>
                        </button>
                    ))}
                </div>
                {movimientoReducido() && (
                    <p className="t-sm mut">Tu equipo tiene activado «reducir movimiento»: el Portal se ve con el fondo Simple.</p>
                )}
            </section>
        </div>
    );
}
