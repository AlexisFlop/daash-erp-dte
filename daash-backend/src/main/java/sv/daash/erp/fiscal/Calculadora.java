package sv.daash.erp.fiscal;

import sv.daash.erp.dominio.ItemVenta;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

import static sv.daash.erp.fiscal.Fiscal.*;

/**
 * Cálculo único de totales de un DTE. El backend es la única fuente de verdad (CA-05):
 * los precios provienen del catálogo y se recalculan aquí, ignorando lo enviado por el cliente.
 * Factura (01): precios con IVA incluido. CCF (03) y NC (05): precios sin IVA + tributo 20.
 */
public final class Calculadora {
  private Calculadora() {}

  public record Linea(ItemVenta item, BigDecimal precioUni, BigDecimal montoDescu, BigDecimal ventaGravada, BigDecimal ivaItem) {}

  public record Totales(List<Linea> lineas, BigDecimal subtotal, BigDecimal descuento, BigDecimal gravada, BigDecimal iva, BigDecimal total) {
    public BigDecimal descuentoLineas() { return r2(lineas.stream().map(Linea::montoDescu).reduce(BigDecimal.ZERO, BigDecimal::add)); }
  }

  public static Totales calcular(List<ItemVenta> items, BigDecimal descuentoPct, String tipo) {
    BigDecimal pct = descuentoPct == null ? BigDecimal.ZERO : descuentoPct.max(BigDecimal.ZERO).min(BigDecimal.valueOf(100))
        .divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
    List<Linea> lineas = new ArrayList<>();
    if ("01".equals(tipo)) {
      for (ItemVenta it : items) {
        BigDecimal precioUni = r2(it.precio.multiply(UNO_IVA));
        BigDecimal bruto = r2(precioUni.multiply(BigDecimal.valueOf(it.cantidad)));
        BigDecimal desc = r2(bruto.multiply(pct));
        BigDecimal gravada = r2(bruto.subtract(desc));
        BigDecimal ivaItem = r2(gravada.divide(UNO_IVA, 10, RoundingMode.HALF_UP).multiply(IVA));
        lineas.add(new Linea(it, precioUni, desc, gravada, ivaItem));
      }
      BigDecimal total = r2(lineas.stream().map(Linea::ventaGravada).reduce(BigDecimal.ZERO, BigDecimal::add));
      BigDecimal iva = r2(lineas.stream().map(Linea::ivaItem).reduce(BigDecimal.ZERO, BigDecimal::add));
      BigDecimal descConIva = r2(lineas.stream().map(Linea::montoDescu).reduce(BigDecimal.ZERO, BigDecimal::add));
      BigDecimal descuento = r2(descConIva.divide(UNO_IVA, 10, RoundingMode.HALF_UP));
      BigDecimal gravada = r2(total.subtract(iva));
      return new Totales(lineas, r2(gravada.add(descuento)), descuento, gravada, iva, total);
    }
    for (ItemVenta it : items) {
      BigDecimal precioUni = r2(it.precio);
      BigDecimal bruto = r2(precioUni.multiply(BigDecimal.valueOf(it.cantidad)));
      BigDecimal desc = r2(bruto.multiply(pct));
      BigDecimal gravada = r2(bruto.subtract(desc));
      lineas.add(new Linea(it, precioUni, desc, gravada, r2(gravada.multiply(IVA))));
    }
    BigDecimal gravada = r2(lineas.stream().map(Linea::ventaGravada).reduce(BigDecimal.ZERO, BigDecimal::add));
    BigDecimal descuento = r2(lineas.stream().map(Linea::montoDescu).reduce(BigDecimal.ZERO, BigDecimal::add));
    BigDecimal iva = r2(gravada.multiply(IVA));
    return new Totales(lineas, r2(gravada.add(descuento)), descuento, gravada, iva, r2(gravada.add(iva)));
  }
}
