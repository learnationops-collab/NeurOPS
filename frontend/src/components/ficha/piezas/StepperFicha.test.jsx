import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import StepperFicha from './StepperFicha';

/**
 * El riel verde se dibuja con `width:var(--avance)` DENTRO de `.fi-stepper-riel`, y ese
 * riel va exactamente de centro a centro del primer y del último punto. O sea: `--avance`
 * es la fracción del tramo entre puntas, y el paso N-ésimo cae en N/(pasos-1).
 *
 * El bug que esto blinda: `--avance` se calculaba con un `* 80` heredado de cuando se creía
 * que el porcentaje era sobre el ancho del stepper entero. Como en realidad se mide sobre el
 * riel (que ya es el 80% y pico del stepper), el verde se escalaba dos veces y con las cinco
 * etapas hechas moría 176 px antes del último punto, en el aire.
 *
 * jsdom no hace layout, así que acá se verifica el contrato del número; la geometría real
 * (que el riel arranque y termine en el centro de los puntos) vive en `ficha.css`.
 */
const paso = (key, estado) => ({ key, label: key, estado });

const avanceDe = (pasos) => {
    const { container } = render(<StepperFicha pasos={pasos} />);
    return container.querySelector('.fi-stepper').style.getPropertyValue('--avance');
};

describe('StepperFicha · avance del riel', () => {
    it('sin ningún paso alcanzado el verde no se dibuja', () => {
        expect(avanceDe([
            paso('a', 'actual'), paso('b', 'pendiente'), paso('c', 'pendiente'),
        ])).toBe('0%');
    });

    it('con TODOS los pasos hechos el verde llega al 100%, no al 80%', () => {
        expect(avanceDe([
            paso('a', 'hecho'), paso('b', 'hecho'), paso('c', 'hecho'),
            paso('d', 'hecho'), paso('e', 'hecho'),
        ])).toBe('100%');
    });

    it('el paso actual del medio parte el riel en la fracción exacta', () => {
        // 5 etapas de confirmación, el lead va por la cuarta (VideoAsk): 3/4 del tramo.
        expect(avanceDe([
            paso('a', 'hecho'), paso('b', 'hecho'), paso('c', 'hecho'),
            paso('d', 'actual'), paso('e', 'pendiente'),
        ])).toBe('75%');
    });

    it('un hito en alerta cuenta como alcanzado: el riel llega hasta él', () => {
        // En «Resultado» un hito puede estar alcanzado pero mal (no asistió, no cerró).
        // Sigue siendo hasta dónde llegó la llamada, así que el riel tiene que llegar.
        expect(avanceDe([
            paso('a', 'hecho'), paso('b', 'alerta'), paso('c', 'pendiente'),
        ])).toBe('50%');
    });

    it('no divide por cero cuando hay un solo paso', () => {
        expect(avanceDe([paso('unico', 'hecho')])).toBe('0%');
    });

    it('publica la cantidad de pasos, que es lo que el CSS usa para sangrar el riel', () => {
        const { container } = render(<StepperFicha pasos={[
            paso('a', 'hecho'), paso('b', 'pendiente'), paso('c', 'pendiente'),
        ]} />);
        expect(container.querySelector('.fi-stepper').style.getPropertyValue('--pasos')).toBe('3');
    });
});
