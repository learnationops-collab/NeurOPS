// «Configuración» del closer: se abre en una hoja (HojaModal) desde el menú de sesión del dock, al
// estilo del settings center de learnation-leadership: su perfil arriba y debajo cada ajuste.
// Google Calendar y el WhatsApp confirmado son obligatorios para recibir agendas del sistema de
// agendas 2.0 (sin ellos, sus horarios no se ofrecen a los leads; ver app/agendas_v2/servicio.py,
// solo_elegibles). La disponibilidad es el horario de su persona de Team en Agendamiento.
//
// Google vuelve del permiso a /closer/deck?vista=configuracion&google_connected=success
// (app/api/google_calendar.py): la página abre esta hoja y GoogleCalendarSettings muestra el «conectado».

import GoogleCalendarSettings from '../../../components/GoogleCalendarSettings';
import { rotuloDeRol } from '../../../utils/cuentasVinculadas';
import WhatsappCloser from './WhatsappCloser';
import DisponibilidadCloser from './DisponibilidadCloser';

const iniciales = (nombre) => (nombre || '?').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

function Perfil({ user }) {
    const roles = user.roles?.length ? user.roles : [user.role];
    return (
        <header className="flex items-center gap-4">
            <span className="flex size-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-pink-500 text-2xl font-bold text-white shadow-lg">
                {iniciales(user.username)}
            </span>
            <div className="min-w-0 space-y-1">
                <p className="truncate text-base font-bold">{user.username}</p>
                {user.email && <p className="truncate text-xs text-muted">{user.email}</p>}
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {roles.map((r) => (
                        <span key={r} className={'rounded-full border px-2.5 py-1 text-xs font-semibold '
                            + (r === user.role ? 'border-primary bg-primary/10 text-primary' : 'border-base bg-main text-muted')}>
                            {rotuloDeRol(r)}
                        </span>
                    ))}
                </div>
            </div>
        </header>
    );
}

function Seccion({ titulo, texto, children }) {
    return (
        <section className="space-y-3">
            <h3 className="text-center text-xs font-black uppercase tracking-widest text-muted">{titulo}</h3>
            {texto && <p className="text-center text-sm text-muted">{texto}</p>}
            {children}
        </section>
    );
}

export default function ConfiguracionCloser({ user = null }) {
    return (
        <div className="space-y-8" aria-label="Configuración">
            {user && <Perfil user={user} />}
            <Seccion titulo="Calendario" texto="Conectá tu Google Calendar para recibir agendas: sin él, el sistema de agendas no te ofrece a los leads.">
                <GoogleCalendarSettings />
            </Seccion>
            <Seccion titulo="WhatsApp" texto="Confirmá tu número: ahí te llega cada agenda nueva. Sin confirmarlo, el sistema de agendas no te ofrece a los leads.">
                <WhatsappCloser />
            </Seccion>
            <Seccion titulo="Disponibilidad">
                <DisponibilidadCloser />
            </Seccion>
        </div>
    );
}
