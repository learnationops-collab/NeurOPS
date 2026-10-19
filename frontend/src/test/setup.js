import "@testing-library/jest-dom/vitest";

// jsdom no implementa `scrollIntoView`: sin esto, cualquier componente que traiga algo al
// viewport revienta en los tests por una carencia del entorno, no del código.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// La caché de vistas vive en el módulo: cada test arranca sin lo que pidió el anterior.
import { beforeEach } from "vitest";
import { limpiarCache } from "../services/cacheDeVistas";
beforeEach(() => limpiarCache());
