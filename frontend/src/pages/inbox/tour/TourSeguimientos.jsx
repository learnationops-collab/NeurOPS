// El recorrido de seguimientos del Inbox (ADR-W255): la misma portada y el mismo recorrido que las Novedades del
// Workspace (`closer/novedades/`), con su tanda. Se muestra a quien usa el Inbox hasta que lo termina (después de
// 3 días es obligatorio, como allá). Para volver a verlo: el «?» al lado de la casilla Seguimiento o `?tour=1`.
// Para una tanda nueva se cambia VERSION (o cualquier texto de PASOS: la huella cambia sola).
import { AlarmClock, BarChart3, CheckSquare, Repeat, SlidersHorizontal, BellRing } from 'lucide-react';
import Novedades, { abrirNovedades, huella } from '../../closer/novedades/Novedades';
import Escena from './Escenas';

const VERSION = '2026-11-26-seguimientos';
const EVENTO = 'ln:tour-seguimientos';

const porTexto = (sel, re) => [...document.querySelectorAll(sel)].find((e) => re.test(e.textContent || ''));
const ultimo = (sel) => { const l = document.querySelectorAll(sel); return l[l.length - 1] || null; };
// Para mostrar la casilla y los mensajes hace falta un chat abierto: si no hay, abre la primera conversación.
const abrirUna = () => { if (!document.querySelector('.cv-seg-casilla')) document.querySelector('.cv-item')?.click(); };

const PASOS = [
    {
        id: 'casilla', mock: 'casilla', target: '.cv-seg-casilla', antes: abrirUna,
        titulo: 'Marcá tus seguimientos',
        texto: 'Al lado de Enviar. Viene tildada sola si el lead no contestó tu último mensaje hace más de 1 h. Si no es un seguimiento, destildala antes de mandar.',
    },
    {
        id: 'mensaje', mock: 'mensaje', target: () => ultimo('.cv-burbuja--otro .cv-meta'), antes: abrirUna,
        titulo: '¿Te olvidaste? Marcalo en el mensaje',
        texto: 'Pasá el mouse por un mensaje tuyo y tocá el ícono que aparece al pie. «Seguimiento N» dice que cuenta; tocalo para desmarcarlo.',
    },
    {
        id: 'programar', mock: 'programar', target: '[aria-label="Seguimiento si no responde"]',
        titulo: 'O dejalo programado',
        texto: 'El reloj sigue igual: un texto o un audio que sale solo si no responde en 1 h, 3 h, 24 h o 2 a 3 días. Si escribe antes, se cancela.',
    },
    {
        id: 'toca', mock: 'toca', target: '.cv-item-ico--toca',
        titulo: 'Lo que pide la fase',
        texto: 'Si el embudo tiene la cadencia prendida, la fila y la caja dicen «Toca seguimiento N». Los textos están en Embudos › la fase › Si no contesta.',
    },
    {
        id: 'filtro', mock: 'filtro', target: () => porTexto('.cv-barra button', /^\s*Filtro/),
        titulo: 'Encontrá a quién seguir',
        texto: 'Filtro › Seguimientos: los que tienen ninguno, 1, 2, 3 o más en una etapa, cuándo fue el último y si lo contestaron.',
    },
    {
        id: 'reporte', mock: 'reporte', target: () => porTexto('.cv-barra button', /Stats/),
        titulo: 'Cuenta en tu reporte',
        texto: 'Lo que marcás suma en tus follow-ups, aunque no hayan pasado 12 h. Lo que destildás no cuenta.',
    },
];

export const TANDA_SEGUIMIENTOS = {
    vista: `${VERSION}-${huella(PASOS.map((p) => p.titulo + p.texto).join('|'))}`,
    clave: (user) => `ln_tour_seguimientos_${user?.id ?? 'anon'}`, evento: EVENTO, param: 'tour',
    fecha: '26 nov', titulo: ['Seguimientos,', 'más simples.'], cuenta: 'cosas para tus seguimientos',
    etiqueta: 'Seguimientos en el Inbox', Escena, pasos: PASOS,
    portada: [
        { id: 'casilla', label: 'Marcar' }, { id: 'mensaje', label: 'Después' }, { id: 'programar', label: 'Programar' },
        { id: 'toca', label: 'Toca' }, { id: 'filtro', label: 'Filtro' }, { id: 'reporte', label: 'Reporte' },
    ],
    iconos: { casilla: CheckSquare, mensaje: Repeat, programar: AlarmClock, toca: BellRing, filtro: SlidersHorizontal, reporte: BarChart3 },
};

export const abrirTourSeguimientos = () => abrirNovedades(EVENTO);

export default function TourSeguimientos({ user }) {
    return <Novedades user={user} tanda={TANDA_SEGUIMIENTOS} />;
}
