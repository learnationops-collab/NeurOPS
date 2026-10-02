import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Pedido del 02/10/2026: «que el closer pueda ver un ícono para ir al link de Fathom, y agregá ahí
// mismo la fuente del lead, que no está». La cabecera sola: no hay escritura de por medio.
import FichaHeader from './FichaHeader';
import { fichaConDeuda, fichaPrecall } from './__fixtures__/ficha';

const LINK = 'https://fathom.video/share/AbC123xyz';
const con = (ficha, identidad) => ({ ...ficha, identidad: { ...ficha.identidad, ...identidad } });
const pintar = (ficha) => render(<FichaHeader ficha={ficha} onAccion={vi.fn()} onCerrar={vi.fn()} />);
const datoFuente = () => screen.getByText('Fuente').closest('.fi-dato');

describe('el ícono de la grabación', () => {
    it('con link, abre Fathom en otra pestaña', () => {
        pintar(con(fichaPrecall, { fathom_url: LINK }));

        const enlace = screen.getByRole('link', { name: 'Ver grabación en Fathom' });
        expect(enlace).toHaveAttribute('href', LINK);
        expect(enlace).toHaveAttribute('target', '_blank');
        expect(enlace).toHaveAttribute('rel', 'noopener noreferrer');
        expect(enlace).toHaveAttribute('title', 'Ver grabación en Fathom');
    });

    it('sin link no hay ícono', () => {
        pintar(con(fichaPrecall, { fathom_url: null }));
        expect(screen.queryByRole('link', { name: /grabación/ })).not.toBeInTheDocument();
    });

    it('un link de otra herramienta no se anuncia como Fathom', () => {
        pintar(con(fichaPrecall, { fathom_url: 'https://drive.google.com/file/d/1' }));
        expect(screen.getByRole('link', { name: 'Ver grabación de la llamada' }))
            .toHaveAttribute('href', 'https://drive.google.com/file/d/1');
    });

    it('se va mientras se editan los datos, como copiar', async () => {
        const usuario = userEvent.setup();
        pintar(con(fichaPrecall, { fathom_url: LINK }));
        await usuario.click(screen.getByRole('button', { name: 'Editar los datos del lead' }));
        expect(screen.queryByRole('link', { name: 'Ver grabación en Fathom' })).not.toBeInTheDocument();
    });
});

describe('la fuente en la franja', () => {
    it('se lee con la etiqueta del catálogo', () => {
        pintar(con(fichaPrecall, { fuente: 'workshop_landing', fuente_label: 'Workshop · grabación' }));
        expect(datoFuente()).toHaveTextContent('Workshop · grabación');
        expect(datoFuente()).not.toHaveTextContent('workshop_landing');
    });

    it('sin etiqueta, la clave tal cual', () => {
        pintar(con(fichaPrecall, { fuente: 'Webinar', fuente_label: undefined }));
        expect(datoFuente()).toHaveTextContent('Webinar');
    });

    it('sin fuente, una raya como el examen', () => {
        pintar(con(fichaPrecall, { fuente: null, fuente_label: null }));
        expect(datoFuente()).toHaveTextContent('—');
    });

    it('va con los otros cuatro datos, también en un cliente', () => {
        pintar(con(fichaConDeuda, { fuente_label: 'VSL' }));
        const rotulos = [...document.querySelectorAll('.fi-cab-datos > .fi-dato > .t-rotulo')]
            .map(r => r.textContent);
        expect(rotulos).toEqual(['Programa', 'Ingresó', 'Closer', 'Teléfono', 'Fuente']);
    });
});
