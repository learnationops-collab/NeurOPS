import { describe, expect, it } from "vitest";
import { fmt } from "./Shared";

// Primer test del frontend: además de cubrir `fmt`, deja verificado que el runner, el alias y
// el JSX del repo cargan bien.
describe("fmt", () => {
  it("un 0 se muestra como 0, no como vacío", () => {
    expect(fmt.money(0)).toBe("$0");
    expect(fmt.num(0)).toBe("0");
    expect(fmt.pct(0)).toBe("0%");
  });

  it("sin dato se muestra el guion largo", () => {
    expect(fmt.money(null)).toBe("—");
    expect(fmt.num(undefined)).toBe("—");
    expect(fmt.fecha(null)).toBe("—");
  });

  it("el dinero se redondea y se separa por miles", () => {
    expect(fmt.money(1234.6)).toBe("$1,235");
  });

  it("la fecha se lee como día/mes", () => {
    expect(fmt.fecha("2026-09-25T18:00:00")).toBe("25/09");
    expect(fmt.hora("2026-09-25T18:30:00")).toBe("18:30");
  });

  it("las iniciales toman como máximo dos palabras", () => {
    expect(fmt.iniciales("angeles valerio ruiz")).toBe("AV");
    expect(fmt.iniciales("")).toBe("?");
  });

  it("el plural concuerda con la cantidad", () => {
    expect(fmt.plural(1, "venta", "ventas")).toBe("1 venta");
    expect(fmt.plural(2, "venta", "ventas")).toBe("2 ventas");
  });
});
