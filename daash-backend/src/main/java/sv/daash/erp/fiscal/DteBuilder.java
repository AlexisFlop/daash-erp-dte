package sv.daash.erp.fiscal;

import com.fasterxml.jackson.databind.ObjectMapper;
import sv.daash.erp.dominio.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

import static sv.daash.erp.fiscal.Fiscal.*;

/** Construcción del JSON de los DTE según la Guía de emisión DTE v1.4 del Ministerio de Hacienda. */
public final class DteBuilder {
  private DteBuilder() {}

  public record Esquema(String nombre, String corto, int version) {}
  public static final Map<String, Esquema> TIPOS = Map.of(
      "01", new Esquema("Factura", "FAC", 1),
      "03", new Esquema("Comprobante de Crédito Fiscal", "CCF", 3),
      "05", new Esquema("Nota de Crédito", "NC", 3));

  private static final Map<String, String> FORMA_PAGO = Map.of("EFECTIVO", "01", "TARJETA", "02", "TRANSFERENCIA", "05");

  public static String numeroControl(String tipo, Configuracion cfg, long correlativo) {
    return "DTE-" + tipo + "-" + cfg.emisor("codEstable") + cfg.emisor("codPuntoVenta") + "-" + String.format("%015d", correlativo);
  }

  /** Datos de entrada para construir un DTE */
  public static class Datos {
    public String tipo;
    public Configuracion config;
    public long correlativo;
    public UUID codigoGeneracion;
    public Instant fecha;
    public List<ItemVenta> items;
    public BigDecimal descuentoPct = BigDecimal.ZERO;
    public Cliente cliente;
    public String metodoPago;
    public String vendedor;
    public Integer tipoContingencia;
    public String motivoContingencia;
    public Dte relacionado;
  }

  private static Map<String, Object> emisor(Configuracion c, String tipo) {
    Map<String, Object> e = m(
        "nit", c.emisor("nit").replace("-", ""), "nrc", c.emisor("nrc").replace("-", ""), "nombre", c.emisor("nombre"),
        "codActividad", c.emisor("codActividad"), "descActividad", c.emisor("descActividad"), "nombreComercial", c.emisor("nombreComercial"),
        "tipoEstablecimiento", c.emisor("tipoEstablecimiento"), "direccion", c.emisor.get("direccion"),
        "telefono", c.emisor("telefono"), "correo", c.emisor("correo"));
    if (!"05".equals(tipo)) {
      e.put("codEstableMH", null); e.put("codEstable", c.emisor("codEstable"));
      e.put("codPuntoVentaMH", null); e.put("codPuntoVenta", c.emisor("codPuntoVenta"));
    }
    return e;
  }

  public static Map<String, Object> construir(Datos d) {
    Calculadora.Totales t = Calculadora.calcular(d.items, d.descuentoPct, d.tipo);
    boolean cont = d.tipoContingencia != null;
    Map<String, Object> identificacion = m(
        "version", TIPOS.get(d.tipo).version(), "ambiente", d.config.ambiente, "tipoDte", d.tipo,
        "numeroControl", numeroControl(d.tipo, d.config, d.correlativo), "codigoGeneracion", d.codigoGeneracion.toString().toUpperCase(),
        "tipoModelo", cont ? 2 : 1, "tipoOperacion", cont ? 2 : 1, "tipoContingencia", cont ? d.tipoContingencia : null,
        "motivoContin", cont && d.tipoContingencia == 5 ? d.motivoContingencia : null,
        "fecEmi", fechaISO(d.fecha), "horEmi", horaISO(d.fecha), "tipoMoneda", "USD");
    List<Map<String, Object>> pagos = d.metodoPago == null ? null
        : List.of(m("codigo", FORMA_PAGO.get(d.metodoPago), "montoPago", t.total(), "referencia", null, "plazo", null, "periodo", null));
    Map<String, Object> extension = m("nombEntrega", d.vendedor, "docuEntrega", null, "nombRecibe", null, "docuRecibe", null, "observaciones", null, "placaVehiculo", null);
    Cliente c = d.cliente;

    if ("01".equals(d.tipo)) {
      Map<String, Object> receptor = c != null
          ? m("tipoDocumento", c.tipoDocumento, "numDocumento", c.numDocumento, "nrc", null, "nombre", c.nombre, "codActividad", null, "descActividad", null,
              "direccion", c.getDireccion(), "telefono", vacioANulo(c.telefono), "correo", vacioANulo(c.correo))
          : m("tipoDocumento", null, "numDocumento", null, "nrc", null, "nombre", "Consumidor final", "codActividad", null, "descActividad", null,
              "direccion", null, "telefono", null, "correo", null);
      List<Map<String, Object>> cuerpo = new ArrayList<>();
      int i = 1;
      for (Calculadora.Linea l : t.lineas()) {
        cuerpo.add(m("numItem", i++, "tipoItem", 1, "numeroDocumento", null, "cantidad", l.item().cantidad, "codigo", l.item().sku, "codTributo", null,
            "uniMedida", 59, "descripcion", l.item().nombre, "precioUni", l.precioUni(), "montoDescu", l.montoDescu(), "ventaNoSuj", 0, "ventaExenta", 0,
            "ventaGravada", l.ventaGravada(), "tributos", null, "psv", 0, "noGravado", 0, "ivaItem", l.ivaItem()));
      }
      Map<String, Object> resumen = m("totalNoSuj", 0, "totalExenta", 0, "totalGravada", t.total(), "subTotalVentas", t.total(), "descuNoSuj", 0, "descuExenta", 0,
          "descuGravada", 0, "porcentajeDescuento", 0, "totalDescu", t.descuentoLineas(), "tributos", null, "subTotal", t.total(), "ivaRete1", 0, "reteRenta", 0,
          "montoTotalOperacion", t.total(), "totalNoGravado", 0, "totalPagar", t.total(), "totalLetras", numeroALetras(t.total()), "totalIva", t.iva(),
          "saldoFavor", 0, "condicionOperacion", 1, "pagos", pagos, "numPagoElectronico", null);
      return m("identificacion", identificacion, "documentoRelacionado", null, "emisor", emisor(d.config, d.tipo), "receptor", receptor,
          "otrosDocumentos", null, "ventaTercero", null, "cuerpoDocumento", cuerpo, "resumen", resumen, "extension", extension, "apendice", null);
    }

    Map<String, Object> receptor = m("nit", c.numDocumento.replace("-", ""), "nrc", c.nrc.replace("-", ""), "nombre", c.nombre,
        "codActividad", c.codActividad, "descActividad", c.descActividad, "nombreComercial", vacioANulo(c.nombreComercial), "direccion", c.getDireccion(),
        "telefono", vacioANulo(c.telefono), "correo", c.correo);
    List<Map<String, Object>> tributos = List.of(m("codigo", "20", "descripcion", "Impuesto al Valor Agregado 13%", "valor", t.iva()));
    List<Map<String, Object>> cuerpo = new ArrayList<>();
    int i = 1;
    for (Calculadora.Linea l : t.lineas()) {
      Map<String, Object> it = m("numItem", i++, "tipoItem", 1, "numeroDocumento", "05".equals(d.tipo) ? d.relacionado.id.toString().toUpperCase() : null,
          "cantidad", l.item().cantidad, "codigo", l.item().sku, "codTributo", null, "uniMedida", 59, "descripcion", l.item().nombre, "precioUni", l.precioUni(),
          "montoDescu", l.montoDescu(), "ventaNoSuj", 0, "ventaExenta", 0, "ventaGravada", l.ventaGravada(), "tributos", List.of("20"));
      if ("03".equals(d.tipo)) { it.put("psv", 0); it.put("noGravado", 0); }
      cuerpo.add(it);
    }
    if ("03".equals(d.tipo)) {
      Map<String, Object> resumen = m("totalNoSuj", 0, "totalExenta", 0, "totalGravada", t.gravada(), "subTotalVentas", t.gravada(), "descuNoSuj", 0, "descuExenta", 0,
          "descuGravada", 0, "porcentajeDescuento", 0, "totalDescu", t.descuento(), "tributos", tributos, "subTotal", t.gravada(), "ivaPerci1", 0, "ivaRete1", 0,
          "reteRenta", 0, "montoTotalOperacion", t.total(), "totalNoGravado", 0, "totalPagar", t.total(), "totalLetras", numeroALetras(t.total()), "saldoFavor", 0,
          "condicionOperacion", 1, "pagos", pagos, "numPagoElectronico", null);
      return m("identificacion", identificacion, "documentoRelacionado", null, "emisor", emisor(d.config, d.tipo), "receptor", receptor,
          "otrosDocumentos", null, "ventaTercero", null, "cuerpoDocumento", cuerpo, "resumen", resumen, "extension", extension, "apendice", null);
    }
    // 05 Nota de crédito
    Map<String, Object> resumen = m("totalNoSuj", 0, "totalExenta", 0, "totalGravada", t.gravada(), "subTotalVentas", t.gravada(), "descuNoSuj", 0, "descuExenta", 0,
        "descuGravada", 0, "totalDescu", t.descuento(), "tributos", tributos, "subTotal", t.gravada(), "ivaPerci1", 0, "ivaRete1", 0, "reteRenta", 0,
        "montoTotalOperacion", t.total(), "totalLetras", numeroALetras(t.total()), "condicionOperacion", 1);
    extension.remove("placaVehiculo");
    extension.put("observaciones", "Devolución de mercadería");
    return m("identificacion", identificacion,
        "documentoRelacionado", List.of(m("tipoDocumento", d.relacionado.tipoDte, "tipoGeneracion", 2, "numeroDocumento", d.relacionado.id.toString().toUpperCase(),
            "fechaEmision", d.relacionado.fechaEmi.toString())),
        "emisor", emisor(d.config, d.tipo), "receptor", receptor, "ventaTercero", null, "cuerpoDocumento", cuerpo, "resumen", resumen, "extension", extension, "apendice", null);
  }

  private static String vacioANulo(String s) { return s == null || s.isBlank() ? null : s; }

  /** Validación local previa a la transmisión (simula el validador de esquema) */
  public static List<String> validar(String tipo, Cliente c, List<ItemVenta> items) {
    List<String> e = new ArrayList<>();
    if (items == null || items.isEmpty()) e.add("[cuerpoDocumento] El documento debe contener al menos un ítem");
    if ("03".equals(tipo) || "05".equals(tipo)) {
      if (c == null) e.add("[receptor] El CCF requiere un receptor contribuyente");
      else {
        if (!"CONTRIBUYENTE".equals(c.tipo)) e.add("[receptor] El receptor debe ser contribuyente inscrito en IVA");
        if (!validarNIT(c.numDocumento)) e.add("[receptor.nit] Formato de NIT inválido");
        if (!validarNRC(c.nrc)) e.add("[receptor.nrc] Formato de NRC inválido");
        if (c.codActividad == null || c.codActividad.isBlank()) e.add("[receptor.codActividad] Actividad económica requerida");
      }
    }
    return e;
  }

  /** Firma simulada del documento: JWS compacto RS512 (hash SHA-512 con llave de demostración) */
  public static String firmar(Map<String, Object> json, ObjectMapper om) {
    try {
      Base64.Encoder b64 = Base64.getUrlEncoder().withoutPadding();
      String header = b64.encodeToString("{\"alg\":\"RS512\",\"typ\":\"JWS\"}".getBytes(StandardCharsets.UTF_8));
      String payload = b64.encodeToString(om.writeValueAsBytes(json));
      byte[] sig = MessageDigest.getInstance("SHA-512").digest((header + "." + payload + ".daash-llave-privada-demo").getBytes(StandardCharsets.UTF_8));
      return header + "." + payload + "." + b64.encodeToString(sig);
    } catch (Exception ex) {
      throw new IllegalStateException("No se pudo firmar el documento", ex);
    }
  }

  public static Map<String, Object> eventoContingencia(EventoContingencia ev, Configuracion cfg, List<Dte> dtes, Usuario resp) {
    Instant fin = ev.fFin != null ? ev.fFin : Instant.now();
    Instant ahora = Instant.now();
    List<Map<String, Object>> detalle = new ArrayList<>();
    for (int i = 0; i < dtes.size(); i++)
      detalle.add(m("noItem", i + 1, "codigoGeneracion", dtes.get(i).id.toString().toUpperCase(), "tipoDoc", dtes.get(i).tipoDte));
    return m(
        "identificacion", m("version", 3, "ambiente", cfg.ambiente, "codigoGeneracion", ev.id.toString().toUpperCase(), "fTransmision", fechaISO(ahora), "hTransmision", horaISO(ahora)),
        "emisor", m("nit", cfg.emisor("nit").replace("-", ""), "nombre", cfg.emisor("nombre"), "nombreResponsable", resp.nombre, "tipoDocResponsable", "13",
            "numeroDocResponsable", resp.dui.replace("-", ""), "tipoEstablecimiento", cfg.emisor("tipoEstablecimiento"), "codEstableMH", null,
            "codPuntoVenta", cfg.emisor("codPuntoVenta"), "telefono", cfg.emisor("telefono"), "correo", cfg.emisor("correo")),
        "detalleDTE", detalle,
        "motivo", m("fInicio", fechaISO(ev.fInicio), "fFin", fechaISO(fin), "hInicio", horaISO(ev.fInicio), "hFin", horaISO(fin),
            "tipoContingencia", (int) ev.tipoContingencia, "motivoContingencia", ev.tipoContingencia == 5 ? ev.motivo : null));
  }

  public static Map<String, Object> invalidacion(Dte dte, Configuracion cfg, Cliente c, int tipo, String motivo, Usuario resp, UUID codigo) {
    Instant ahora = Instant.now();
    return m(
        "identificacion", m("version", 2, "ambiente", cfg.ambiente, "codigoGeneracion", codigo.toString().toUpperCase(), "fecAnula", fechaISO(ahora), "horAnula", horaISO(ahora)),
        "emisor", m("nit", cfg.emisor("nit").replace("-", ""), "nombre", cfg.emisor("nombre"), "tipoEstablecimiento", cfg.emisor("tipoEstablecimiento"),
            "nomEstablecimiento", cfg.emisor("nombreComercial"), "codEstableMH", null, "codEstable", cfg.emisor("codEstable"), "codPuntoVentaMH", null,
            "codPuntoVenta", cfg.emisor("codPuntoVenta"), "telefono", cfg.emisor("telefono"), "correo", cfg.emisor("correo")),
        "documento", m("tipoDte", dte.tipoDte, "codigoGeneracion", dte.id.toString().toUpperCase(), "selloRecibido", dte.selloRecibido, "numeroControl", dte.numeroControl,
            "fecEmi", dte.fechaEmi.toString(), "montoIva", dte.iva, "codigoGeneracionR", null, "tipoDocumento", c == null ? null : c.tipoDocumento,
            "numDocumento", c == null ? null : c.numDocumento, "nombre", dte.receptorNombre, "telefono", c == null ? null : c.telefono, "correo", c == null ? null : c.correo),
        "motivo", m("tipoAnulacion", tipo, "motivoAnulacion", tipo == 3 ? motivo : null, "nombreResponsable", resp.nombre, "tipDocResponsable", "13",
            "numDocResponsable", resp.dui.replace("-", ""), "nombreSolicita", resp.nombre, "tipDocSolicita", "13", "numDocSolicita", resp.dui.replace("-", "")));
  }
}
