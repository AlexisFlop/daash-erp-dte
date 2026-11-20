package sv.daash.erp.fiscal;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import sv.daash.erp.dominio.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Construcción del JSON del DTE (guía v1.4)")
@SuppressWarnings("unchecked")
class DteBuilderTest {
  private static Configuracion cfg() {
    Configuracion c = new Configuracion();
    c.emisor = Fiscal.m("nit", "0614-010195-101-8", "nrc", "12345-6", "nombre", "Adventure Works El Salvador, S.A. de C.V.", "nombreComercial", "Adventure Works",
        "codActividad", "47630", "descActividad", "Venta al por menor", "tipoEstablecimiento", "01",
        "direccion", Fiscal.m("departamento", "05", "municipio", "24", "complemento", "Antiguo Cuscatlán"), "telefono", "2209-4500",
        "correo", "facturacion@adventureworks.com.sv", "codEstable", "M001", "codPuntoVenta", "P001");
    return c;
  }

  private static Cliente contribuyente() {
    Cliente c = new Cliente();
    c.id = UUID.randomUUID(); c.tipo = "CONTRIBUYENTE"; c.nombre = "Ciclismo Extremo, S.A. de C.V."; c.tipoDocumento = "36";
    c.numDocumento = "0614-150318-102-7"; c.nrc = "254871-3"; c.codActividad = "93120"; c.descActividad = "Clubes deportivos";
    c.correo = "compras@ciclismoextremo.com.sv"; c.departamento = "06"; c.municipio = "20"; c.complemento = "San Salvador";
    return c;
  }

  private static DteBuilder.Datos datos(String tipo) {
    DteBuilder.Datos d = new DteBuilder.Datos();
    d.tipo = tipo; d.config = cfg(); d.correlativo = 7; d.codigoGeneracion = UUID.randomUUID(); d.fecha = Instant.parse("2026-11-20T16:30:00Z");
    d.items = List.of(new ItemVenta(UUID.randomUUID(), "BK-M68B-38", "Mountain-200", 1, new BigDecimal("1150.00")));
    d.metodoPago = "EFECTIVO"; d.vendedor = "QA";
    return d;
  }

  @Test @DisplayName("Número de control: DTE-XX-XXXXXXXX-15 dígitos")
  void numeroControl() { assertTrue(DteBuilder.numeroControl("01", cfg(), 7).matches("^DTE-01-[A-Z0-9]{8}-\\d{15}$")); }

  @Test @DisplayName("Factura: esquema v1, modelo previo y fecha en zona horaria de El Salvador")
  void factura() {
    Map<String, Object> j = DteBuilder.construir(datos("01"));
    Map<String, Object> id = (Map<String, Object>) j.get("identificacion");
    assertEquals(1, id.get("version"));
    assertEquals(1, id.get("tipoModelo"));
    assertEquals("2026-11-20", id.get("fecEmi"));
    assertEquals("10:30:00", id.get("horEmi"));
    assertEquals("06140101951018", ((Map<String, Object>) j.get("emisor")).get("nit"));
  }

  @Test @DisplayName("CCF: esquema v3 con tributo 20 (IVA)")
  void ccf() {
    DteBuilder.Datos d = datos("03"); d.cliente = contribuyente();
    Map<String, Object> r = (Map<String, Object>) DteBuilder.construir(d).get("resumen");
    Map<String, Object> trib = ((List<Map<String, Object>>) r.get("tributos")).get(0);
    assertEquals("20", trib.get("codigo"));
    assertEquals(new BigDecimal("149.50"), trib.get("valor"));
  }

  @Test @DisplayName("Contingencia: modelo diferido y tipo de operación 2 (RF-14)")
  void contingencia() {
    DteBuilder.Datos d = datos("01"); d.tipoContingencia = 1;
    Map<String, Object> id = (Map<String, Object>) DteBuilder.construir(d).get("identificacion");
    assertEquals(2, id.get("tipoModelo"));
    assertEquals(2, id.get("tipoOperacion"));
    assertEquals(1, id.get("tipoContingencia"));
  }

  @Test @DisplayName("Validación previa: CCF sin receptor o sin ítems es rechazado")
  void validacion() {
    assertFalse(DteBuilder.validar("03", null, datos("03").items).isEmpty());
    assertTrue(DteBuilder.validar("03", contribuyente(), datos("03").items).isEmpty());
    assertFalse(DteBuilder.validar("01", null, List.of()).isEmpty());
  }

  @Test @DisplayName("Firma JWS RS512 de tres segmentos")
  void firma() {
    String f = DteBuilder.firmar(DteBuilder.construir(datos("01")), new ObjectMapper());
    assertEquals(3, f.split("\\.").length);
    assertTrue(new String(Base64.getUrlDecoder().decode(f.split("\\.")[0])).contains("RS512"));
  }
}
