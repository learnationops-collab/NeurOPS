import { useEffect } from 'react';
import { FileText, ShieldCheck, ArrowLeft, Mail, ExternalLink, ShieldAlert, Award, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsOfServicePage = () => {
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
              onClick={() => navigate('/politica-de-privacidad')}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted hover:text-base border border-base rounded-xl hover:bg-surface transition-all"
            >
              <ShieldCheck size={14} /> Política de Privacidad
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="bg-surface backdrop-blur-xl p-8 sm:p-12 rounded-[2rem] border border-base shadow-2xl space-y-8">
          
          {/* Título de la sección */}
          <div className="flex items-center gap-4 pb-4 border-b border-base">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <FileText size={32} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-base uppercase tracking-tight">
                Términos de Servicio
              </h2>
              <p className="text-muted text-sm font-medium mt-1">Última actualización: 24 de julio de 2026</p>
            </div>
          </div>

          <p className="text-base leading-relaxed">
            Te damos la bienvenida a <strong>NeurOPS</strong>, la plataforma de operaciones y admisiones de <strong>Learnation</strong>. Por favor, lee atentamente estos Términos de Servicio antes de utilizar nuestros servicios de agendamiento, diagnóstico y seguimiento. Al acceder o utilizar el subdominio <span className="text-primary underline">work.thelearnation.com</span>, aceptas estar sujeto a las siguientes condiciones.
          </p>

          {/* Grid de Secciones */}
          <div className="space-y-8">
            
            {/* Sección 1 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-base flex items-center gap-2 uppercase tracking-wider border-l-4 border-primary pl-3">
                1. Aceptación de los Términos
              </h3>
              <p className="text-muted text-sm leading-relaxed pl-4">
                El acceso y la navegación en esta plataforma constituyen tu aceptación sin reservas de los presentes términos. Si no estás de acuerdo con alguna de las disposiciones aquí contenidas, te solicitamos abstenerte de hacer uso de la plataforma.
              </p>
            </div>

            {/* Sección 2 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-base flex items-center gap-2 uppercase tracking-wider border-l-4 border-primary pl-3">
                2. Descripción del Servicio y Plataforma
              </h3>
              <p className="text-muted text-sm leading-relaxed pl-4">
                NeurOPS es un entorno de software diseñado para coordinar las admisiones, el agendamiento y el diagnóstico de preparación para los estudiantes y postulantes de Learnation. Su función principal es facilitar la programación de sesiones de consultoría y el procesamiento seguro de formularios de diagnóstico.
              </p>
            </div>

            {/* Sección 3 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-base flex items-center gap-2 uppercase tracking-wider border-l-4 border-primary pl-3">
                3. Uso Aceptable y Responsabilidad
              </h3>
              <p className="text-muted text-sm leading-relaxed pl-4">
                Como usuario de la plataforma, te comprometes a:
              </p>
              <ul className="list-disc pl-8 space-y-2 text-muted text-sm">
                <li>Proporcionar información verídica, exacta y actualizada en todos los formularios y solicitudes de agendamiento.</li>
                <li>No realizar un uso no autorizado o fraudulento de los enlaces de agendamiento (por ejemplo, automatizar solicitudes masivas).</li>
                <li>No comprometer la seguridad de la plataforma ni intentar acceder a áreas restringidas sin la debida autorización.</li>
              </ul>
            </div>

            {/* Sección 4 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-base flex items-center gap-2 uppercase tracking-wider border-l-4 border-primary pl-3">
                4. Propiedad Intelectual
              </h3>
              <p className="text-muted text-sm leading-relaxed pl-4">
                Todos los contenidos expuestos en NeurOPS, incluidos el código fuente, la arquitectura del software, los diseños visuales, los cuestionarios de diagnóstico de preparación y los textos informativos, son propiedad intelectual exclusiva de <strong>Learnation</strong> o de sus respectivos licenciantes, protegidos por las leyes locales e internacionales correspondientes.
              </p>
            </div>

            {/* Sección 5 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-base flex items-center gap-2 uppercase tracking-wider border-l-4 border-primary pl-3">
                5. Limitación de Responsabilidad
              </h3>
              <p className="text-muted text-sm leading-relaxed pl-4">
                Aunque trabajamos constantemente por la estabilidad del sistema:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-4 mt-2">
                <div className="p-4 rounded-2xl bg-main border border-base flex items-start gap-3">
                  <ShieldAlert className="text-primary mt-1 shrink-0" size={18} />
                  <div>
                    <span className="font-bold text-sm text-base block">Disponibilidad del Servicio</span>
                    <span className="text-muted text-xs block mt-1">El servicio se proporciona &quot;tal cual&quot;. No garantizamos un funcionamiento 100% libre de fallos temporales de conexión o caídas de servidores de terceros.</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-main border border-base flex items-start gap-3">
                  <AlertTriangle className="text-primary mt-1 shrink-0" size={18} />
                  <div>
                    <span className="font-bold text-sm text-base block">Sistemas Externos</span>
                    <span className="text-muted text-xs block mt-1">No somos responsables del comportamiento, políticas o fallos en los servicios de Meta (WhatsApp) ni de Calendly, los cuales se rigen por sus propios términos.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sección 6 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-base flex items-center gap-2 uppercase tracking-wider border-l-4 border-primary pl-3">
                6. Modificaciones de los Términos
              </h3>
              <p className="text-muted text-sm leading-relaxed pl-4">
                Learnation se reserva el derecho de actualizar o modificar estos términos en cualquier momento, de acuerdo con nuevas normativas o mejoras en nuestra funcionalidad. El uso continuado de NeurOPS tras la publicación de los cambios implica la aceptación de los nuevos términos.
              </p>
            </div>

            {/* Sección 7 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-base flex items-center gap-2 uppercase tracking-wider border-l-4 border-primary pl-3">
                7. Información de Contacto
              </h3>
              <p className="text-muted text-sm leading-relaxed pl-4">
                Para resolver cualquier consulta relacionada con los términos de servicio, puedes escribirnos al correo de soporte oficial de Learnation:
              </p>
              <div className="pl-4 mt-2">
                <a
                  href="mailto:soporte@thelearnation.com"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-main border border-base hover:border-primary/50 text-base font-bold text-sm hover:bg-surface transition-all"
                >
                  <Mail size={16} className="text-primary" /> soporte@thelearnation.com
                </a>
              </div>
            </div>

          </div>

          {/* Nota al pie */}
          <div className="pt-6 border-t border-base flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted font-medium">
            <span>© 2026 Learnation. Todos los derechos reservados.</span>
            <div className="flex gap-4">
              <span className="cursor-pointer hover:text-base flex items-center gap-1" onClick={() => navigate('/politica-de-privacidad')}>
                Política de Privacidad <ExternalLink size={12} />
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default TermsOfServicePage;
