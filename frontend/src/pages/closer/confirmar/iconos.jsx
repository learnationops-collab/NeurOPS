import { CalendarDays, List, SquareKanban } from 'lucide-react';

const ICONOS = { tablero: SquareKanban, lista: List, semana: CalendarDays };

export const IconoDeVista = ({ tipo }) => {
    const Icono = ICONOS[tipo] || List;
    return <Icono aria-hidden="true" />;
};
