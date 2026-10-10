import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MisDatos from './MisDatos';
import { misDatosEjemplo } from './misDatosEjemplo';

/**
 * «Mis datos» del setter (10/10/2026): el reporte y el sistema, cada uno con su nombre.
 *
 * Kerwin: «hay datos que no cuadran». Lo que se fija acá es que la pantalla no los mezcle: las
 * agendas reportadas y las generadas van juntas con su diferencia, los números del sistema abren su
 * lista y los del reporte no (no son filas), y lo de los reportes viejos va aparte como «sin canal».
 */

const seccion = (titulo) => screen.getByRole('heading', { name: titulo }).closest('section');

describe('MisDatos', () => {
    it('muestra lo que reportó, con la cualificación y las agendas', async () => {
        render(<MisDatos datos={misDatosEjemplo()} irA={null} />);

        // Las cifras suben con rAF (`Cifra`): se esperan.
        const reportado = seccion('Lo que reportaste');
        await waitFor(() => expect(within(reportado).getByText('90')).toBeInTheDocument());
        await waitFor(() => expect(within(reportado).getByText('80%')).toBeInTheDocument());
        expect(within(reportado).getByText('72 de 90')).toBeInTheDocument();
        expect(within(reportado).getByText('8 de 20 respondieron')).toBeInTheDocument();
        expect(within(reportado).getByText('3 reportes')).toBeInTheDocument();
    });

    it('pone lo reportado al lado de lo que registra el sistema, con la diferencia', async () => {
        render(<MisDatos datos={misDatosEjemplo()} irA={null} />);

        const cuadra = seccion('¿Cuadra con el sistema?');
        await waitFor(() => expect(within(cuadra).getByText('9')).toBeInTheDocument());
        await waitFor(() => expect(within(cuadra).getByText('7')).toBeInTheDocument());
        expect(within(cuadra).getByText('2 más en tu reporte')).toBeInTheDocument();
        expect(within(cuadra).getByText('20 más en tu reporte')).toBeInTheDocument();
    });

    it('cuando cuadra, lo dice', () => {
        const d = misDatosEjemplo();
        d.contraste[0] = { ...d.contraste[0], sistema: 9, diferencia: 0 };
        render(<MisDatos datos={d} irA={null} />);

        expect(within(seccion('¿Cuadra con el sistema?')).getByText('Cuadra')).toBeInTheDocument();
    });

    it('los números del sistema abren su lista; los del reporte no', () => {
        const irA = vi.fn();
        render(<MisDatos datos={misDatosEjemplo()} irA={irA} />);

        fireEvent.click(screen.getByRole('button', { name: 'Ver en la lista: agendas del sistema, 7' }));
        expect(irA).toHaveBeenLastCalledWith({ tabla: 'generadas', filtro: {}, de: 'Agendas generadas' });
        fireEvent.click(screen.getByRole('button', { name: 'Ver en la lista: entrantes del sistema, 70' }));
        expect(irA).toHaveBeenLastCalledWith({ tabla: 'leads', filtro: {}, de: 'Leads de ManyChat' });
        fireEvent.click(screen.getByRole('button', { name: 'Ver en la lista: ventas originadas, 1' }));
        expect(irA).toHaveBeenLastCalledWith({ tabla: 'generadas', filtro: { post_call: 'Venta' }, de: 'Ventas originadas' });
        // En el embudo, solo las tres etapas del sistema.
        expect(screen.getAllByRole('button', { name: /^Ver la lista: / }).map(b => b.getAttribute('aria-label')))
            .toEqual(['Ver la lista: Generadas, 7', 'Ver la lista: Asistieron, 4', 'Ver la lista: Ventas, 1']);
    });

    it('sin a dónde ir, ningún número es un botón', () => {
        render(<MisDatos datos={misDatosEjemplo()} irA={null} />);

        expect(screen.queryByRole('button', { name: /^Ver (en )?la lista/ })).toBeNull();
    });

    it('lo de los reportes viejos va aparte, como «sin canal», solo si lo hay', () => {
        const { unmount } = render(<MisDatos datos={misDatosEjemplo()} irA={null} />);
        expect(within(seccion('Por canal')).queryByText('Sin canal')).toBeNull();
        unmount();

        const d = misDatosEjemplo();
        d.reporte.sin_canal = { ...d.reporte.sin_canal, entrantes: 40, cualificados: 30, agendas: 3 };
        render(<MisDatos datos={d} irA={null} />);
        const canales = seccion('Por canal');
        expect(within(canales).getByText('Sin canal')).toBeInTheDocument();
        expect(within(canales).getByText('Reportes de antes del formulario nuevo: no separaban por canal.')).toBeInTheDocument();
    });

    it('cuenta los días reportados contra los hábiles y muestra los wins', async () => {
        render(<MisDatos datos={misDatosEjemplo()} irA={null} />);

        const constancia = seccion('Constancia');
        expect(within(constancia).getByText('/ 5')).toBeInTheDocument();
        expect(within(constancia).getByText('Cerré 6 agendas en el día')).toBeInTheDocument();
        expect(within(constancia).getAllByRole('listitem').map(d => d.getAttribute('aria-label')).slice(0, 2))
            .toEqual(['05/10, reportado', '06/10, sin reporte']);
    });

    it('sin wins lo dice, en vez de dejar el hueco', () => {
        render(<MisDatos datos={misDatosEjemplo({ wins: [] })} irA={null} />);

        expect(screen.getByText('Sin wins cargados en el período.')).toBeInTheDocument();
    });

    it('el embudo va de los entrantes a las ventas, con el resumen de punta a punta', () => {
        render(<MisDatos datos={misDatosEjemplo()} irA={null} />);

        const embudo = seccion('Tu embudo, de punta a punta');
        expect(within(embudo).getByText('90 entrantes → 1 venta · 1.1%')).toBeInTheDocument();
        ['ENTRANTES', 'DOLOR', 'OFERTA', 'LINK', 'GENERADAS', 'ASISTIERON', 'VENTAS']
            .forEach(r => expect(within(embudo).getByText(r)).toBeInTheDocument());
    });

    it('mientras carga, el esqueleto', () => {
        render(<MisDatos datos={null} irA={null} />);

        expect(screen.getByRole('status', { name: 'Cargando tus datos…' })).toBeInTheDocument();
    });
});
