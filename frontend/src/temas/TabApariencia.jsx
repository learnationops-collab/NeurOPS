// Pestaña Apariencia de Configuración, como en academy: el tema, con su vista previa pintada con sus
// propios colores en el modo elegido, debajo el modo, claro u oscuro, y el fondo del Portal y del login
// (pages/auth/FondoEntrada.jsx). Todo queda guardado en este navegador.

import { useApariencia } from '../context/AparienciaContext';
import { FONDOS, movimientoReducido, useFondo } from '../pages/auth/FondoEntrada';

export default function TabApariencia() {
    const { tema, setTema, temas, modos, setModo, modoGuardado, modo } = useApariencia();
    const modoVista = modo ?? modoGuardado ?? 'oscuro';
    const [, setFondo, fondo] = useFondo();
    return (
        <section className="panel cu-tarjeta">
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
            <p className="t-eyebrow">Modo</p>
            <div className="apariencia ap-modos" role="radiogroup" aria-label="Modo">
                {modos.map(m => (
                    <button key={m.id} type="button" role="radio" aria-checked={modo === m.id} onClick={() => setModo(m.id)}>
                        {m.nombre}
                    </button>
                ))}
            </div>
            <p className="t-eyebrow">Fondo del Portal</p>
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
    );
}
