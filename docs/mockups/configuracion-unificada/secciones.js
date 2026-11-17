// El contenido de cada sección. Es el mismo en las dos vistas: en Baldosas va en una ventana encima,
// en Pestañas, en el panel de la derecha.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Un control segmentado: cada botón guarda st[k] = v (data-acc="set").
const seg = (k, opciones, valor) => `<div class="seg" role="radiogroup">${opciones.map(([v, label, icon]) =>
  `<button type="button" role="radio" aria-checked="${String(valor) === String(v)}" data-acc="set" data-k="${k}" data-v="${v}">${icon ? ico(icon, 14) : ''}${label}</button>`).join('')}</div>`;
const fila = (titulo, ayuda, control) => `<div class="fila"><div class="fila-tx"><b>${titulo}</b>${ayuda ? `<small>${ayuda}</small>` : ''}</div>${control}</div>`;
const interruptor = (k, valor, label) => `<button type="button" class="sw" role="switch" aria-checked="${!!valor}" aria-label="${label}" data-acc="toggle" data-k="${k}"><i></i></button>`;
const bloque = (titulo, cuerpo) => `<section class="bloque"><p class="eyebrow">${titulo}</p>${cuerpo}</section>`;

const CUERPOS = {
  cuenta(p) {
    return bloque('Identidad', `
      <div class="ident">
        <button type="button" class="foto" title="Cambiar foto o personaje"><span>${esc(p.inicial)}</span><i>${ico('camera', 18)}</i></button>
        <div class="ident-campos">
          <label class="campo"><span>Nombre</span><input value="${esc(p.usuario)}"></label>
          <label class="campo"><span>Email</span><input value="${esc(p.email)}"></label>
          <label class="campo"><span>Teléfono</span><span class="campo-tel"><button type="button" class="bandera" title="Zona horaria: ${p.tz}">${p.tz}</button><input value="${esc(p.tel)}" placeholder="Agregar teléfono"></span></label>
        </div>
      </div>`)
      + bloque('Zona horaria', fila('Tu hora', 'Los horarios de Turnos, agendas y tareas se muestran en esta zona.', `<select class="sel"><option>Argentina (GMT-3)</option><option>Colombia, Ecuador, Perú (GMT-5)</option><option>México (GMT-6)</option><option>España (GMT+1)</option></select>`))
      + bloque('Personaje', `<p class="nota">En Work tu personaje es el avatar del dock; en Academy y Leadership, tu foto. Elegí uno para los tres.</p>
        <div class="personajes">${['🦊', '🐼', '🦉', '🐙', '🦁', '🐢'].map((e, i) => `<button type="button" class="pj${i === 0 ? ' on' : ''}" data-acc="pj">${e}</button>`).join('')}</div>`);
  },

  apariencia(p, st) {
    const temas = TEMAS.map((t) => `<button type="button" role="radio" aria-checked="${st.tema === t.key}" class="tema-op" data-acc="set" data-k="tema" data-v="${t.key}"
        data-tema="${t.key}" data-modo="${st.modo}" data-efectos="${st.efectos}">
        <span class="mini"><span class="mini-aura"></span><span class="mini-dock"></span><span class="mini-tarjeta"><i></i><i></i><em></em></span></span>
        <b>${t.label}</b><small>${t.desc}</small></button>`).join('');
    return bloque('Tema', `<div class="temas" role="radiogroup" aria-label="Tema">${temas}</div>
        <p class="nota">El mismo en Work, Academy y Leadership: se guarda en tu cuenta.</p>`)
      + bloque('Color', fila('Modo', '', seg('modo', [['oscuro', 'Oscuro', 'moon'], ['claro', 'Claro', 'sun'], ['sistema', 'Como el equipo', '']], st.modoElegido))
        + fila('Efectos', 'Aura de fondo y vidrio. Apagados, todo plano.', interruptor('efectosOn', st.efectos === 'si', 'Efectos'))
        + fila('Modo liviano', 'Sin transparencias ni animaciones: para compartir pantalla o equipos lentos. Se prende solo al simular.', interruptor('liviano', st.liviano, 'Modo liviano')))
      + bloque('Pantalla', fila('Ancho', 'Centrado deja el contenido en una columna cómoda de leer.', seg('ancho', [['completo', 'Completo'], ['centrado', 'Centrado']], st.ancho))
        + fila('Márgenes', '', seg('margenes', [['con', 'Con'], ['sin', 'Sin']], st.margenes))
        + fila('Densidad', 'Compacta muestra más filas en tablas y listas.', seg('densidad', [['comoda', 'Cómoda'], ['compacta', 'Compacta']], st.densidad))
        + fila('Tamaño de letra', '', seg('letra', [['90', 'A−'], ['100', 'A'], ['112', 'A+']], st.letra)))
      + bloque('Esta ventana', fila('Vista de Configuración', 'Baldosas como en Academy, o pestañas a la izquierda.', seg('vista', [['baldosas', 'Baldosas', 'grid'], ['pestanas', 'Pestañas', 'list']], st.vista))
        + (p.portal ? fila('Fondo del Portal y del login', '', seg('fondo', [['aura', 'Aura'], ['estrellas', 'Estrellas'], ['simple', 'Simple']], st.fondo)) : ''));
  },

  dock(p, st) {
    return bloque('Navegación', fila('Dónde va', '', seg('nav', [['dock', 'Dock abajo', 'dock'], ['lateral', 'Barra lateral', 'list']], st.nav))
        + (st.nav === 'dock' ? fila('Auto-ocultar', 'Se esconde a los 10 s quieto o al scrollear; vuelve al acercar el mouse.', interruptor('autoOcultar', st.autoOcultar, 'Auto-ocultar'))
          : fila('Barra', '', seg('barra', [['desplegada', 'Desplegada'], ['iconos', 'Solo íconos']], st.barra)))
        + fila('Secciones', 'Ordenar, ocultar o renombrar las secciones de esta pantalla.', `<button type="button" class="boton" data-acc="aviso" data-t="Editar navegación">Editar navegación</button>`))
      + bloque('Celular y tablet', fila('Forma', '', seg('movil', [['barra', 'Barra'], ['burbuja', 'Burbuja']], st.movil))
        + fila('En el celular', '', seg('flota', [['fijo', 'Pegado al borde'], ['flotante', 'Flotante']], st.flota)));
  },

  notificaciones(p, st) {
    const canal = (k, label, ayuda) => fila(label, ayuda, interruptor(k, st[k], label));
    return bloque('Por dónde', canal('nApp', 'En la app', 'La campana del dock.') + canal('nPush', 'En este dispositivo', 'Avisos del navegador, aunque la pestaña esté de fondo.')
        + canal('nWa', 'Por WhatsApp', 'Solo lo urgente: agendas nuevas y sesiones que arrancan.') + canal('nMail', 'Resumen por mail', 'Una vez por día.'))
      + bloque('Silencio', fila('No molestar', 'Fuera de tu horario no suena nada.', seg('silencio', [['nunca', 'Nunca'], ['fuera', 'Fuera de horario'], ['siempre', 'Siempre']], st.silencio)))
      + `<button type="button" class="boton boton--linea" data-acc="aviso" data-t="El centro de notificaciones">Ver las ${p.notis} sin leer</button>`;
  },

  disponibilidad() {
    const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    return bloque('Tus horarios', `<div class="semana">${dias.map((d, i) => `<div class="dia${i > 4 ? ' dia--off' : ''}"><b>${d}</b>${i > 4 ? '<small>No trabajo</small>' : '<span class="franja">09:00 – 13:00</span><span class="franja">15:00 – 19:00</span>'}</div>`).join('')}</div>`)
      + bloque('Sesiones', fila('Máximo por día', '', `<input class="num" type="number" value="6">`) + fila('Pausa entre sesiones', '', seg('pausa', [['0', 'Sin'], ['15', '15 min'], ['30', '30 min']], '15')));
  },

  integraciones(p) {
    const tarjeta = (icon, nombre, ok, detalle, accion) => `<div class="integ${ok ? ' integ--ok' : ''}"><span class="integ-ico">${ico(icon, 20)}</span>
      <div class="fila-tx"><b>${nombre}</b><small>${detalle}</small></div>
      ${ok ? `<span class="chip chip--ok">${ico('check', 12)} Conectado</span>` : `<button type="button" class="boton" data-acc="aviso" data-t="${accion}">${accion}</button>`}</div>`;
    return bloque('Para recibir agendas', tarjeta('calendar', 'Google Calendar', p.calendar, p.calendar ? `${p.email} · Calendario «Trabajo»` : 'Sin conectar: tus horarios no se ofrecen', 'Conectar Calendar')
      + tarjeta('chat', 'WhatsApp', p.whatsapp, p.whatsapp ? `${p.tel} confirmado` : 'Ahí te avisan las sesiones', 'Confirmar WhatsApp'))
      + '<p class="nota">Sin los dos, el sistema de agendas no ofrece tus horarios a los leads.</p>';
  },

  eventos() {
    const ev = [['Llamada de diagnóstico', '30 min', 'learnation.com/a/marlon-diagnostico'], ['Seguimiento', '20 min', 'learnation.com/a/marlon-seguimiento']];
    return bloque('Tus links', ev.map(([n, d, u]) => `<div class="integ"><span class="integ-ico">${ico('link', 18)}</span><div class="fila-tx"><b>${n} · ${d}</b><small>${u}</small></div><button type="button" class="boton boton--linea" data-acc="aviso" data-t="Link copiado">Copiar</button></div>`).join(''));
  },

  examen() {
    return bloque('Tu examen', fila('Programa', '', `<select class="sel"><option>Ace Learners · MIR</option></select>`) + fila('Fecha', 'Ordena tu plan de estudio hacia atrás desde acá.', `<input class="sel" type="date" value="2027-01-24">`));
  },

  equipo() {
    const gente = [['Marlon Pérez', 'Closer', 'Activo'], ['Elias Ruiz', 'Setter', 'Activo'], ['Belu Gómez', 'Consultora', 'Activo'], ['Juliana R.', 'Closer', 'Inactiva']];
    return bloque('Personas', `<div class="buscar">${ico('search', 15)}<input placeholder="Buscar en el equipo"></div>
      <table class="tabla"><tr><th>Nombre</th><th>Rol</th><th>Estado</th></tr>${gente.map(([n, r, e]) => `<tr><td>${n}</td><td>${r}</td><td><span class="chip ${e === 'Activo' ? 'chip--ok' : ''}">${e}</span></td></tr>`).join('')}</table>
      <button type="button" class="boton" data-acc="aviso" data-t="Sumar a alguien">Sumar a alguien</button>`);
  },

  seguridad() {
    return bloque('Contraseña', `<label class="campo"><span>Actual</span><input type="password" value="••••••••"></label><label class="campo"><span>Nueva</span><input type="password"></label>
        <button type="button" class="boton" data-acc="aviso" data-t="Contraseña actualizada">Actualizar</button>`)
      + bloque('Más', fila('Verificación en dos pasos', 'Un código del celular además de la contraseña.', interruptor('dosPasos', false, 'Dos pasos'))
        + fila('Sesiones abiertas', 'Esta compu y 1 celular.', `<button type="button" class="boton boton--linea" data-acc="aviso" data-t="Las otras sesiones se cerraron">Cerrar las otras</button>`));
  },

  ayuda() {
    return bloque('¿Algo anda mal?', `<p class="nota">Contanos qué pasó o qué necesitás. Te contestamos acá mismo.</p>
        <button type="button" class="boton" data-acc="aviso" data-t="Reportar o pedir algo">Reportar o pedir algo</button>`)
      + bloque('Tus reportes', `<div class="integ"><span class="integ-ico">${ico('bug', 18)}</span><div class="fila-tx"><b>El turno de Juliana seguía saliendo</b><small>Resuelto · 17/11</small></div><span class="chip chip--ok">Listo</span></div>`);
  },
};

// Lo que muestra cada baldosa debajo del nombre (como «Liquid · Oscuro» en Academy).
function resumen(key, p, st) {
  const tema = TEMAS.find((t) => t.key === st.tema)?.label;
  return {
    cuenta: p.email,
    apariencia: `${tema} · ${st.modo === 'oscuro' ? 'Oscuro' : 'Claro'}${st.efectos === 'no' ? ' · plano' : ''}`,
    dock: st.nav === 'lateral' ? `Barra lateral · ${st.barra === 'iconos' ? 'solo íconos' : 'desplegada'}` : (st.autoOcultar ? 'Abajo · auto-ocultar' : 'Abajo · siempre visible'),
    notificaciones: p.notis ? `${p.notis} sin leer` : 'Al día',
    disponibilidad: 'Lun a vie · 8 h',
    integraciones: p.calendar && p.whatsapp ? 'Todo conectado' : 'Falta conectar',
    eventos: '2 links',
    examen: '24 ene 2027',
    equipo: '4 personas',
    seguridad: 'Contraseña',
    ayuda: 'Reportar un problema',
  }[key];
}
const falta = (key, p) => key === 'integraciones' && !(p.calendar && p.whatsapp);
