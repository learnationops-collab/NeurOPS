import "@testing-library/jest-dom/vitest";

// jsdom no implementa `scrollIntoView`: sin esto, cualquier componente que traiga algo al
// viewport revienta en los tests por una carencia del entorno, no del código.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
