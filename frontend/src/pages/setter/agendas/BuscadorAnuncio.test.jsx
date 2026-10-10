import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BuscadorAnuncio, { filtrarAnuncios } from './BuscadorAnuncio';

/**
 * El buscador del anuncio de «Mis agendas» (pedido del 10/10/2026: "comenzar a escribir el anuncio y
 * seleccionarlo mucho más rápidamente"). Es un combobox ARIA y se maneja entero con el teclado: lo
 * que se prueba es ese camino, porque es el que vacía la bandeja.
 */

const ANUNCIOS = [
    { id: 1, keyword: 'CURSO GRATUITO', nombre: 'CURSO GRATUITO', activo: true, usos: 60 },
    { id: 2, keyword: 'GUIA', nombre: 'GUIA', activo: true, usos: 0 },
    { id: 3, keyword: 'CODIFICACIÓN', nombre: 'CODIFICACIÓN', activo: true, usos: 0 },
    { id: 4, keyword: 'PROTOCOLO', nombre: 'Protocolo de estudio', activo: true, usos: 11 },
    { id: 5, keyword: 'VIEJO', nombre: 'VIEJO', activo: false, usos: 0 },
];

/** El buscador con su estado, como lo usa una tarjeta. */
const Montado = ({ onConfirmar }) => {
    const [elegido, setElegido] = useState(null);
    return (
        <>
            <BuscadorAnuncio anuncios={ANUNCIOS} elegido={elegido} onElegir={setElegido} onConfirmar={onConfirmar} />
            <output data-testid="elegido">{elegido?.keyword || 'nada'}</output>
        </>
    );
};

const montar = () => {
    const onConfirmar = vi.fn();
    render(<Montado onConfirmar={onConfirmar} />);
    return { campo: screen.getByRole('combobox', { name: 'Palabra clave del anuncio' }), onConfirmar };
};

const escribir = (campo, texto) => fireEvent.change(campo, { target: { value: texto } });
const tecla = (campo, key) => fireEvent.keyDown(campo, { key });
const opciones = () => screen.getAllByRole('option').map(o => o.textContent);
const activa = (campo) => document.getElementById(campo.getAttribute('aria-activedescendant'))?.textContent;

describe('BuscadorAnuncio', () => {
    it('filtra sin mayúsculas ni tildes y pone primero lo que empieza con lo escrito', () => {
        expect(filtrarAnuncios(ANUNCIOS, 'codificacion').map(a => a.id)).toEqual([3]);
        // "co": CODIFICACIÓN empieza así; CURSO GRATUITO y PROTOCOLO solo lo contienen.
        expect(filtrarAnuncios(ANUNCIOS, 'co').map(a => a.id)).toEqual([3, 4]);
        expect(filtrarAnuncios(ANUNCIOS, '  ').map(a => a.id)).toEqual([1, 2, 3, 4, 5]);
    });

    it('escribir abre la lista filtrada y resalta la coincidencia', () => {
        const { campo } = montar();
        expect(campo).toHaveAttribute('aria-expanded', 'false');

        escribir(campo, 'proto');

        expect(campo).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('listbox')).toHaveAttribute('id', campo.getAttribute('aria-controls'));
        expect(opciones()).toHaveLength(1);
        expect(screen.getAllByText('PROTO', { selector: 'mark' })).toHaveLength(1);
    });

    it('con un solo resultado, Enter lo elige y asigna en el mismo golpe', () => {
        const { campo, onConfirmar } = montar();

        escribir(campo, 'guí');
        tecla(campo, 'Enter');

        expect(screen.getByTestId('elegido')).toHaveTextContent('GUIA');
        expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
        expect(campo).toHaveValue('GUIA');
        expect(campo).toHaveAttribute('aria-expanded', 'false');
    });

    it('con varios, las flechas eligen, Enter elige y el segundo Enter asigna', () => {
        const { campo, onConfirmar } = montar();

        escribir(campo, 'co');
        expect(activa(campo)).toContain('CODIFICACIÓN');
        tecla(campo, 'ArrowDown');
        expect(activa(campo)).toContain('PROTOCOLO');
        tecla(campo, 'ArrowDown');
        expect(activa(campo)).toContain('CODIFICACIÓN');

        tecla(campo, 'ArrowUp');
        tecla(campo, 'Enter');
        expect(screen.getByTestId('elegido')).toHaveTextContent('PROTOCOLO');
        expect(onConfirmar).not.toHaveBeenCalled();

        tecla(campo, 'Enter');
        expect(onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }));
    });

    it('Escape cierra la lista y, ya cerrada, borra lo escrito', () => {
        const { campo } = montar();
        escribir(campo, 'gu');

        tecla(campo, 'Escape');
        expect(campo).toHaveAttribute('aria-expanded', 'false');
        expect(campo).toHaveValue('gu');

        tecla(campo, 'Escape');
        expect(campo).toHaveValue('');
    });

    it('la flecha abajo abre la lista entera en el orden del backend', () => {
        const { campo } = montar();

        tecla(campo, 'ArrowDown');

        expect(opciones().map(t => t.replace(/×\d+|pausado/g, '').trim()))
            .toEqual(['CURSO GRATUITO', 'GUIA', 'CODIFICACIÓN', 'PROTOCOLOProtocolo de estudio', 'VIEJO']);
        expect(screen.getByTitle('Lo usaste 60 veces')).toBeInTheDocument();
        expect(screen.getByText('pausado')).toBeInTheDocument();
    });

    it('cambiar lo escrito suelta el anuncio elegido', () => {
        const { campo } = montar();
        escribir(campo, 'guia');
        tecla(campo, 'Enter');
        expect(screen.getByTestId('elegido')).toHaveTextContent('GUIA');

        escribir(campo, 'gui');

        expect(screen.getByTestId('elegido')).toHaveTextContent('nada');
    });
});
