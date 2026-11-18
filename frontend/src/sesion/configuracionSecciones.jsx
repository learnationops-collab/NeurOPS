// Las piezas de Configuración que no son tarjetas de Agendamiento (ADR-W167): Tu cuenta, Notificaciones,
// Seguridad, Ayuda, la identidad de la vista Baldosas y el resumen de cada baldosa. Notificaciones y
// Seguridad todavía no tienen ajustes propios en Work: muestran lo que hay y dicen lo que viene.

import { Bell, History, LifeBuoy, Moon, Sun } from 'lucide-react';
import { Button, Segmented } from '../components/standard';
import Mascota from '../components/mascota/Mascota';
import { mascotaDe } from '../components/mascota/mascotas';
import ElegirPersonaje from '../components/mascota/ElegirPersonaje';
import { DatosCuenta } from '../pages/agendas_v2/secciones/conf/cuenta';
import { TEMAS, useApariencia } from '../context/AparienciaContext';
import { abrirAvisos, useAvisosSinLeer } from '../utils/avisosBus';
import { abrirMisReportes, abrirReporteDeBug } from '../utils/bugReportBus';
import { rotuloDeSesion } from './menuSesion';

export const TabCuenta = ({ user }) => (user ? <><ElegirPersonaje /><DatosCuenta user={user} /></> : null);

const Pronto = ({ children }) => <p className="t-sm mut cu-pronto">{children}</p>;

export function TabNotificaciones() {
    const sinLeer = useAvisosSinLeer();
    return (
        <section className="panel cu-tarjeta">
            <p className="t-eyebrow">Tus avisos</p>
            <p className="t-sm">{sinLeer ? `Tenés ${sinLeer} ${sinLeer === 1 ? 'aviso sin leer' : 'avisos sin leer'}.` : 'Estás al día.'}</p>
            <div><Button icon={<Bell size={15} aria-hidden="true" />} onClick={abrirAvisos}>Ver los avisos</Button></div>
            <Pronto>Pronto: elegir por dónde te avisa (la app, este dispositivo, WhatsApp o un resumen por mail) y un horario de no molestar.</Pronto>
        </section>
    );
}

export function TabSeguridad({ user }) {
    return (
        <section className="panel cu-tarjeta">
            <p className="t-eyebrow">Cómo entrás</p>
            <p className="t-sm">Entrás con {user?.email ? <b>{user.email}</b> : 'tu cuenta'}, con Google o con tu contraseña. Para cambiar la contraseña, pedíselo a un admin.</p>
            <Pronto>Pronto: cambiar tu contraseña desde acá, la verificación en dos pasos y cerrar las sesiones de otros equipos.</Pronto>
        </section>
    );
}

export function TabAyuda() {
    return (
        <section className="panel cu-tarjeta">
            <p className="t-eyebrow">¿Algo anda mal?</p>
            <p className="t-sm">Contanos qué pasó o qué necesitás: te contestamos en tus reportes.</p>
            <div className="cu-botones">
                <Button variant="primary" icon={<LifeBuoy size={15} aria-hidden="true" />} onClick={abrirReporteDeBug}>Reportar o pedir algo</Button>
                <Button icon={<History size={15} aria-hidden="true" />} onClick={abrirMisReportes}>Mis reportes</Button>
            </div>
        </section>
    );
}

const saludo = () => {
    const h = new Date().getHours();
    return h < 6 ? 'Buenas noches' : h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
};

/** La columna de la izquierda en Baldosas: tu personaje (abre Tu cuenta), tu nombre, tu rol y el modo. */
export function IdentidadConfiguracion({ user, onElegir }) {
    const { modo, setModo } = useApariencia();
    const nombre = user?.name || user?.username || '';
    return (
        <aside className="cu-yo">
            <button type="button" className="cu-yo-foto" onClick={() => onElegir('datos')} aria-label="Tu cuenta: personaje y datos" title="Tu cuenta">
                <Mascota personaje={mascotaDe(user, nombre)} size={64} />
            </button>
            <p className="cu-yo-hola">{saludo()},</p>
            <h2 className="cu-yo-nombre">{nombre}</h2>
            {user?.email && <p className="cu-yo-dato trunc">{user.email}</p>}
            <span className="cu-yo-rol">{rotuloDeSesion(user)}</span>
            <div className="cu-yo-modo">
                <Segmented label="Modo" radio size="sm" value={modo} onChange={setModo}
                    options={[{ value: 'oscuro', label: 'Oscuro', icon: <Moon size={14} aria-hidden="true" /> }, { value: 'claro', label: 'Claro', icon: <Sun size={14} aria-hidden="true" /> }]} />
            </div>
        </aside>
    );
}

/** Lo que dice cada baldosa debajo del nombre (como «Liquid · Oscuro» en Academy). */
export function resumenDe(id, { ajustes }) {
    if (id === 'apariencia') {
        const tema = TEMAS.find(t => t.id === ajustes?.tema)?.nombre;
        if (!tema) return 'Como siempre';
        const modo = { oscuro: 'Oscuro', claro: 'Claro', sistema: 'Como el equipo' }[ajustes.modo];
        return [tema, modo, ajustes.efectos === false && 'plano'].filter(Boolean).join(' · ');
    }
    return null;
}
