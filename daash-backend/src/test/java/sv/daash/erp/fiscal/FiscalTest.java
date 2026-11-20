package sv.daash.erp.fiscal;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import sv.daash.erp.dominio.ItemVenta;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Lógica fiscal: validaciones, IVA y valor en letras")
class FiscalTest {
  private static final ItemVenta BICI = new ItemVenta(UUID.randomUUID(), "BK-M68B-38", "Mountain-200 Black, 38", 1, new BigDecimal("1150.00"));
  private static final ItemVenta CASCO = new ItemVenta(UUID.randomUUID(), "HL-U509", "Sport-100 Helmet", 2, new BigDecimal("34.99"));

  @Test @DisplayName("DUI con dígito verificador correcto es válido")
  void duiValido() { assertTrue(Fiscal.validarDUI("04512378-8")); }

  @Test @DisplayName("DUI con dígito verificador incorrecto es rechazado")
  void duiInvalido() { assertFalse(Fiscal.validarDUI("04512378-0")); assertFalse(Fiscal.validarDUI("045123786")); }

  @Test @DisplayName("NIT y NRC salvadoreños")
  void nitNrc() {
    assertTrue(Fiscal.validarNIT("0614-150318-102-7"));
    assertFalse(Fiscal.validarNIT("0614-1503-102-7"));
    assertTrue(Fiscal.validarNRC("254871-3"));
    assertFalse(Fiscal.validarNRC("254871"));
  }

  @Test @DisplayName("Factura: precio con IVA incluido e IVA desglosado")
  void factura() {
    var t = Calculadora.calcular(List.of(BICI), BigDecimal.ZERO, "01");
    assertEquals(new BigDecimal("1299.50"), t.lineas().get(0).precioUni());
    assertEquals(new BigDecimal("1299.50"), t.total());
    assertEquals(new BigDecimal("149.50"), t.iva());
  }

  @Test @DisplayName("CCF: IVA 13 % sobre el subtotal")
  void ccf() {
    var t = Calculadora.calcular(List.of(BICI, CASCO), BigDecimal.ZERO, "03");
    assertEquals(new BigDecimal("1219.98"), t.gravada());
    assertEquals(new BigDecimal("158.60"), t.iva());
    assertEquals(new BigDecimal("1378.58"), t.total());
  }

  @Test @DisplayName("Descuento porcentual por línea y límites 0–100 %")
  void descuento() {
    assertEquals(new BigDecimal("115.00"), Calculadora.calcular(List.of(BICI), BigDecimal.TEN, "03").descuento());
    assertEquals(new BigDecimal("1169.55"), Calculadora.calcular(List.of(BICI), BigDecimal.TEN, "03").total());
    assertEquals(new BigDecimal("0.00"), Calculadora.calcular(List.of(BICI), BigDecimal.valueOf(150), "03").total());
    assertEquals(new BigDecimal("1299.50"), Calculadora.calcular(List.of(BICI), BigDecimal.valueOf(-5), "03").total());
  }

  @Test @DisplayName("Factura con varios ítems: gravada + IVA = total")
  void consistencia() {
    var t = Calculadora.calcular(List.of(BICI, CASCO), BigDecimal.valueOf(5), "01");
    assertEquals(t.total(), t.gravada().add(t.iva()));
  }

  @ParameterizedTest(name = "{0} → {1}")
  @CsvSource({"1, UN 00/100 USD", "21000, VEINTIUN MIL 00/100 USD", "100, CIEN 00/100 USD", "1378.58, MIL TRESCIENTOS SETENTA Y OCHO 58/100 USD"})
  void letras(String monto, String esperado) { assertEquals(esperado, Fiscal.numeroALetras(new BigDecimal(monto))); }

  @Test @DisplayName("Sello de recepción simulado de 40 caracteres")
  void sello() { assertEquals(40, Fiscal.generarSello(java.time.Instant.now()).length()); }
}
