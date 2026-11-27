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
        texto: 'Un seguimiento es volver a escribirle a quien no te contestó. Si pasó más de 1 h desde tu último mensaje, la casilla al lado de Enviar ya viene tildada. ¿No es un seguimiento? Destildala antes de mandar.',
    },
    {
        id: 'mensaje', mock: 'mensaje', target: () => ultimo('.cv-burbuja--otro .cv-meta'), antes: abrirUna,
        titulo: '¿Te olvidaste de marcarlo?',
        texto: 'Pasá el mouse por tu mensaje y tocá el ícono que aparece al pie. Queda «Seguimiento N» y ya cuenta. Para sacarlo, tocalo de nuevo.',
    },
    {
        id: 'programar', mock: 'programar', target: '[aria-label="Seguimiento si no responde"]',
        titulo: 'Dejalo programado',
        texto: 'Con el reloj, escribí un texto o grabá un audio y elegí cuándo sale: 1 h, 3 h, 24 h o 2 a 3 días. Si el lead contesta antes, no se manda.',
    },
    {
        id: 'toca', mock: 'toca', target: '.cv-item-ico--toca',
        titulo: 'Work te avisa cuándo toca',
        texto: 'Si la fase tiene cadencia, la fila y la caja de escribir dicen «Toca seguimiento N». El mensaje sugerido se edita en Embudos › la fase › Si no contesta.',
    },
    {
        id: 'filtro', mock: 'filtro', target: () => porTexto('.cv-barra button', /^\s*Filtro/),
        titulo: 'Encontrá a quién seguir',
        texto: 'En Filtro › Seguimientos elegís cuántos lleva cada lead (ninguno, 1, 2, 3 o más) y en qué etapa, cuándo fue el último y si contestó.',
    },
    {
        id: 'reporte', mock: 'reporte', target: () => porTexto('.cv-barra button', /Stats/),
        titulo: 'Suma en tu reporte',
        texto: 'Cada seguimiento marcado cuenta en tus follow-ups del día, aunque no hayan pasado 12 h. Lo que destildás no cuenta.',
    },
];

export const TANDA_SEGUIMIENTOS = {
    vista: `${VERSION}-${huella(PASOS.map((p) => p.titulo + p.texto).join('|'))}`,
    // Textos reescritos (ADR-W263): quien ya lo había terminado con los de antes no lo vuelve a ver.
    anterior: `${VERSION}-18ksj35`,
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
