// Íconos (trazos estilo Lucide) y ayudas de dibujo.
const ICONOS = {
  hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
  flecha: 'm9 18 6-6-6-6',
  buscar: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  cerrar: 'M18 6 6 18M6 6l12 12',
  minimizar: 'M5 12h14',
  maximizar: 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
  chispa: 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2zM19 3v4M21 5h-4',
  bug: 'M8 6a4 4 0 0 1 8 0v8a4 4 0 0 1-8 0zM4 10h4M16 10h4M4 16h4M16 16h4M12 6v12',
  clip: 'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48',
  arroba: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94',
  enviar: 'm22 2-7 20-4-9-9-4zM22 2 11 13',
  responder: 'M9 17 4 12l5-5M20 18v-2a4 4 0 0 0-4-4H4',
  copiar: 'M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  gente: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  llama: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  corazon: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z',
  musculo: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  pulgar: 'M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z',
  check: 'M20 6 9 17l-5-5',
  calendario: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18',
  panel: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 3v18',
  mas: 'M12 5v14M5 12h14',
  mensaje: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  maletin: 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
  birrete: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 3 9 3 12 0v-5',
  codigo: 'm16 18 6-6-6-6M8 6l-6 6 6 6',
  tarea: 'm9 11 3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  campana: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  atras: 'm15 18-6-6 6-6',
};
const REACCIONES = ['llama', 'corazon', 'musculo', 'pulgar', 'check'];

function ic(nombre, t = 18) {
  return `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONOS[nombre]}"/></svg>`;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Negritas y menciones, sobre texto ya escapado.
function formatear(texto) {
  return esc(texto)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/@Learnito/g, '<span class="mencion mencion--l">@Learnito</span>')
    .replace(/@(Valentina|Mario|Kerwin|Elias|Paula|Andrés|Camila|Santiago|Joaquín|todos|ventas|fulfillment|desarrollo)/g, '<span class="mencion">@$1</span>');
}

function avatar(id, tam = '') {
  const p = PERSONAS[id];
  const punto = p.donde ? '<i class="punto"></i>' : '';
  return `<span class="av ${tam}" style="background:${p.color}">${p.nombre[0]}${punto}</span>`;
}

function avatarDonde(id, tam = '') {
  const p = PERSONAS[id];
  if (!p.donde) return avatar(id, tam);
  return `<span class="av ${tam}" style="background:${p.color}">${p.nombre[0]}<i class="punto"></i><i class="donde p-${p.donde}">${PRODUCTOS[p.donde].letra}</i></span>`;
}

function tagProducto(prod) {
  return `<span class="tag p-${prod}" title="Escribió desde ${PRODUCTOS[prod].nombre}">${PRODUCTOS[prod].nombre}</span>`;
}
