import { useEffect } from 'react';
import { ShieldCheck, FileText, ArrowLeft, Mail, ExternalLink, MessageSquare, Calendar, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const root = window.document.documentElement;
    const previousClasses = Array.from(root.classList);
    const previousThemeStyle = root.getAttribute('data-theme-style');

    root.classList.add('dark', 'theme-custom');
    root.classList.remove('theme-elegant', 'theme-clean');
    root.setAttribute('data-theme-style', 'glass');

    return () => {
      root.className = '';
      previousClasses.forEach(cls => root.classList.add(cls));
      if (previousThemeStyle) {
        root.setAttribute('data-theme-style', previousThemeStyle);
      } else {
        root.removeAttribute('data-theme-style');
      }
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-main flex flex-col items-center justify-start py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="w-full max-w-4xl">
        
        {/* Cabecera superior / Logo */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4 pb-6 border-b border-base">
          <div className="text-center sm:text-left cursor-pointer" onClick={() => navigate('/login')}>
            <h1 className="text-3xl font-black text-base tracking-widest uppercase">
              LEARNATION<span className="text-primary"> WORKERS</span>
            </h1>
            <p className="text-muted text-xs font-bold uppercase tracking-widest mt-1">Portal Operativo</p>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted hover:text-base border border-base rounded-xl hover:bg-surface transition-all"
            >
              <ArrowLeft size={14} /> Volver al Inicio
            </button>
            <button
              onClick={() => navigate('/terminos-de-servicio')}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted hover:text-base border border-base rounded-xl hover:bg-surface transition-all"
            >
              <FileText size={14} /> Términos de Servicio
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="bg-surface backdrop-blur-xl p-8 sm:p-12 rounded-[2rem] border border-base shadow-2xl space-y-8">
          
          {/* Título de la sección */}
          <div className="flex items-center gap-4 pb-4 border-b border-base">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-base uppercase tracking-tight">
                Política de Privacidad
              </h2>
              <p className="text-muted text-sm font-medium mt-1">Última actualización: 24 de julio de 2026</p>
            </div>
          </div>

          <p className="text-base leading-relaxed">
            En <strong>Learnation</strong> nos tomamos muy en serio la seguridad y confidencialidad de tus datos personales. Esta Política de Privacidad describe cómo recopilamos, utilizamos, almacenamos y protegemos la información obtenida a través de nuestra plataforma operativa <strong>NeurOPS</strong> (accesible en <span className="text-primary underline">work.thelearnation.com</span>), cumpliendo con el Reglamento General de Protección de Datos (GDPR) y los requisitos del ecosistema de Meta.
          </p>

          {/* Grid de Secciones */}
          <div className="space-y-8">
            
            {/* Sección 1 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-base flex items-center gap-2 uppercase tracking-wider border-l-4 border-primary pl-3">
                1. Identificación del Responsable del Tratamiento
              </h3>
              <p className="text-muted text-sm leading-relaxed pl-4">
                El responsable del tratamiento de los datos personales es <strong>Learnation</strong> (en adelante, &quot;nosotros&quot; o &quot;la plataforma&quot;), titular del subdominio de operaciones <strong>work.thelearnation.com</strong>.
              </p>
            </div>

            {/* Sección 2 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-base flex items-center gap-2 uppercase tracking-wider border-l-4 border-primary pl-3">
                2. Datos Personales Recopilados
              </h3>
              <p className="text-muted text-sm leading-relaxed pl-4">
                Para brindar nuestros servicios de formación y consultoría, recopilamos únicamente los datos estrictamente necesarios, que incluyen:
              </p>
              <ul className="list-disc pl-8 space-y-2 text-muted text-sm">
                <li><strong>Datos de Identificación y Contacto:</strong> Nombres completos, direcciones de correo electrónico y números de teléfono.</li>
                <li><strong>Información de Agendamiento:</strong> Fechas, horas, zonas horarias y detalles logísticos de las sesiones programadas.</li>
                <li><strong>Datos de Diagnóstico:</strong> Respuestas suministradas en nuestros cuestionarios de diagnóstico de preparación o formularios de admisión.</li>
              </ul>
            </div>

            {/* Sección 3 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-base flex items-center gap-2 uppercase tracking-wider border-l-4 border-primary pl-3">
                3. Finalidad del Tratamiento de Datos
              </h3>
              <p className="text-muted text-sm leading-relaxed pl-4">
                Los datos recolectados se procesan para las siguientes finalidades operativas:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 mt-2">
                <div className="p-4 rounded-2xl bg-main border border-base flex items-start gap-3">
                  <Calendar className="text-primary mt-1 shrink-0" size={18} />
                  <div>
                    <span className="font-bold text-sm text-base block">Coordinación de Sesiones</span>
                    <span className="text-muted text-xs block mt-1">Gestión, confirmación y ejecución de las Sesiones de Diagnóstico y Aceleración de Learnation.</span>
                  </div>
                </div>
                
                <div className="p-4 rounded-2xl bg-main border border-base flex items-start gap-3">
                  <MessageSquare className="text-primary mt-1 shrink-0" size={18} />
                  <div>
                    <span className="font-bold text-sm text-base block">Automatizaciones de Asistencia</span>
                    <span className="text-muted text-xs block mt-1">Envío de recordatorios y confirmación de citas mediante canales como WhatsApp o plataformas de agendamiento como Calendly.</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-main border border-base flex items-start gap-3 md:col-span-2">
                  <ShieldAlert className="text-primary mt-1 shrink-0" size={18} />
                  <div>
                    <span className="font-bold text-sm text-base block">Seguimiento y Admisiones</span>
                    <span className="text-muted text-xs block mt-1">Contacto personalizado por parte de nuestro equipo de admisiones y coordinación operativa interna para garantizar la calidad del servicio.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sección 4 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-base flex items-center gap-2 uppercase tracking-wider border-l-4 border-primary pl-3">
                4. Proveedores y Transferencias a Terceros
              </h3>
              <p className="text-muted text-sm leading-relaxed pl-4">
                Para el correcto funcionamiento de la plataforma, nos integramos con proveedores de servicios de confianza que actúan bajo estrictas medidas de seguridad y privacidad:
              </p>
              <ul className="list-disc pl-8 space-y-2 text-muted text-sm">
                <li><strong>Meta Platforms, Inc. (WhatsApp Cloud API):</strong> Usado exclusivamente para el envío automatizado de notificaciones de asistencia y confirmaciones operativas.</li>
                <li><strong>Calendly LLC:</strong> Para la gestión integrada y automatizada de los calendarios de citas.</li>
                <li><strong>Servicios Cloud e Infraestructura:</strong> Albergamos y procesamos datos en entornos en la nube seguros (como Railway), que cumplen con certificaciones internacionales de seguridad.</li>
              </ul>
            </div>

            {/* Sección 5 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-base flex items-center gap-2 uppercase tracking-wider border-l-4 border-primary pl-3">
                5. Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)
              </h3>
              <p className="text-muted text-sm leading-relaxed pl-4">
                Como titular de los datos, tienes derecho a acceder, rectificar, limitar, oponerte o solicitar la eliminación total de tu información en cualquier momento. Para ejercer estos derechos, puedes enviar una solicitud formal por correo electrónico a:
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pl-4 mt-2">
                <a
                  href="mailto:privacidad@thelearnation.com"
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-main border border-base hover:border-primary/50 text-base font-bold text-sm hover:bg-surface transition-all"
                >
                  <Mail size={16} className="text-primary" /> privacidad@thelearnation.com
                </a>
                <a
                  href="mailto:soporte@thelearnation.com"
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-main border border-base hover:border-primary/50 text-base font-bold text-sm hover:bg-surface transition-all"
                >
                  <Mail size={16} className="text-primary" /> soporte@thelearnation.com
                </a>
              </div>
            </div>

            {/* Sección 6 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-base flex items-center gap-2 uppercase tracking-wider border-l-4 border-primary pl-3">
                6. Seguridad de la Información
              </h3>
              <p className="text-muted text-sm leading-relaxed pl-4">
                Toda la transferencia de información dentro de nuestra plataforma se realiza de forma cifrada utilizando protocolos criptográficos <strong>HTTPS (SSL/TLS)</strong> de extremo a extremo. Limitamos el acceso a los datos únicamente al personal autorizado que requiera realizar tareas de soporte o admisiones.
              </p>
            </div>

          </div>

          {/* Nota al pie */}
          <div className="pt-6 border-t border-base flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted font-medium">
            <span>© 2026 Learnation. Todos los derechos reservados.</span>
            <div className="flex gap-4">
              <span className="cursor-pointer hover:text-base flex items-center gap-1" onClick={() => navigate('/terminos-de-servicio')}>
                Términos de Servicio <ExternalLink size={12} />
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
