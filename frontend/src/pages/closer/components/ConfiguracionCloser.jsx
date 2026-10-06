// «Configuración» del mazo del closer (se abre desde el menú de sesión del dock): los ajustes de su cuenta.
// Google Calendar y el WhatsApp confirmado son obligatorios para recibir agendas del sistema de
// agendas 2.0 (sin ellos, sus horarios no se ofrecen a los leads; ver app/agendas_v2/servicio.py,
// solo_elegibles).
//
// Google vuelve del permiso a /closer/deck?vista=configuracion&google_connected=success
// (app/api/google_calendar.py) y GoogleCalendarSettings muestra el «conectado».

import GoogleCalendarSettings from '../../../components/GoogleCalendarSettings';
import WhatsappCloser from './WhatsappCloser';
import DisponibilidadCloser from './DisponibilidadCloser';

export default function ConfiguracionCloser() {
    return (
        <section className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6" aria-labelledby="conf-closer-titulo">
            <header className="space-y-1">
                <h2 id="conf-closer-titulo" className="text-2xl font-black tracking-tight">Configuración</h2>
                <p className="text-sm text-slate-400">Los ajustes de tu cuenta.</p>
            </header>
            <div className="space-y-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Calendario</h3>
                <p className="text-sm text-slate-300">
                    Conectá tu Google Calendar para recibir agendas: sin él, el sistema de agendas no te ofrece a los leads.
                </p>
                <GoogleCalendarSettings />
            </div>
            <div className="space-y-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">WhatsApp</h3>
                <p className="text-sm text-slate-300">
                    Confirmá tu número: ahí te llega cada agenda nueva. Sin confirmarlo, el sistema de agendas no te ofrece a los leads.
                </p>
                <WhatsappCloser />
            </div>
            <div className="space-y-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Disponibilidad</h3>
                <DisponibilidadCloser />
            </div>
        </section>
    );
}
