package sv.daash.erp.servicio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import sv.daash.erp.dominio.*;
import sv.daash.erp.fiscal.Fiscal;
import sv.daash.erp.repo.RolRepo;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Carga los datos de demostración (exportados del prototipo) cuando la base de datos está vacía.
 * Las fechas se desplazan para que el historial termine el día de hoy.
 */
@Service
public class SeedServicio implements ApplicationRunner {
  private static final Logger log = LoggerFactory.getLogger(SeedServicio.class);
  private static final List<String[]> SUCURSALES = List.of(
      new String[]{"Casa Matriz · Antiguo Cuscatlán", "M001"}, new String[]{"Sucursal Santa Tecla", "M002"}, new String[]{"Sucursal San Miguel", "M003"});
  private static final List<String> CATEGORIAS = List.of("Bicicletas", "Componentes", "Accesorios", "Ropa", "Repuestos");
  private static final DateTimeFormatter FH = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

  @PersistenceContext private EntityManager em;
  private final RolRepo roles;
  private final PasswordEncoder encoder;
  private final ObjectMapper om;
  private final TransactionTemplate tx;
  private final boolean habilitado;
  private final String url, owner, ownerPassword;

  public SeedServicio(RolRepo roles, PasswordEncoder encoder, ObjectMapper om, TransactionTemplate tx,
                      @Value("${daash.seed.habilitado}") boolean habilitado, @Value("${spring.datasource.url}") String url,
                      @Value("${spring.flyway.user}") String owner, @Value("${spring.flyway.password}") String ownerPassword) {
    this.roles = roles; this.encoder = encoder; this.om = om; this.tx = tx; this.habilitado = habilitado;
    this.url = url; this.owner = owner; this.ownerPassword = ownerPassword;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (habilitado && roles.count() == 0) cargar();
  }

  /** Reinicio de datos demo: vacía las tablas con el usuario dueño (TRUNCATE no dispara los disparadores de inmutabilidad) */
  public void reiniciar() {
    JdbcTemplate admin = new JdbcTemplate(new DriverManagerDataSource(url, owner, ownerPassword));
    admin.execute("TRUNCATE daash.dte_bitacora, daash.dte_encabezado, daash.evento_contingencia, daash.venta_detalle, daash.venta, daash.turno_caja, "
        + "daash.compra_detalle, daash.compra, daash.kardex, daash.producto, daash.categoria, daash.cliente, daash.proveedor, daash.reset_token, "
        + "daash.usuario, daash.permiso, daash.rol, daash.sucursal, daash.correlativo, daash.configuracion, daash.bitacora, daash.correo_simulado, "
        + "daash.auditoria RESTART IDENTITY CASCADE");
    cargar();
  }

  private static UUID id(String viejo) {
    if (viejo == null || viejo.isEmpty()) return null;
    try { return UUID.fromString(viejo); } catch (IllegalArgumentException e) {
      return UUID.nameUUIDFromBytes(("daash:" + viejo).getBytes(StandardCharsets.UTF_8));
    }
  }
  private static String txt(JsonNode n, String k) { JsonNode v = n.get(k); return v == null || v.isNull() ? null : v.asText(); }
  private static BigDecimal num(JsonNode n, String k) { JsonNode v = n.get(k); return v == null || v.isNull() ? null : v.decimalValue(); }

  public void cargar() {
    tx.executeWithoutResult(s -> {
      try (InputStream in = new ClassPathResource("seed/demo.json").getInputStream()) {
        cargarDatos(om.readTree(in));
      } catch (Exception e) {
        throw new IllegalStateException("No se pudieron cargar los datos demo", e);
      }
    });
  }

  @SuppressWarnings("unchecked")
  private void cargarDatos(JsonNode d) {
    long dias = ChronoUnit.DAYS.between(Instant.parse(d.get("generado").asText()).atZone(Fiscal.SV).toLocalDate(), LocalDate.now(Fiscal.SV));
    java.util.function.Function<String, Instant> t = v -> v == null ? null : Instant.parse(v).plus(dias, ChronoUnit.DAYS);

    Map<String, Short> suc = new HashMap<>();
    for (String[] x : SUCURSALES) {
      Sucursal s = new Sucursal(); s.nombre = x[0]; s.codEstablecimiento = x[1]; s.codPuntoVenta = "P001";
      em.persist(s); suc.put(s.nombre, s.id);
    }
    Map<String, Short> cat = new HashMap<>();
    for (String n : CATEGORIAS) { Categoria c = new Categoria(); c.nombre = n; em.persist(c); cat.put(n, c.id); }

    for (JsonNode r : d.get("roles")) {
      Rol rol = new Rol();
      rol.id = txt(r, "id"); rol.nombre = txt(r, "nombre"); rol.descripcion = txt(r, "descripcion");
      rol.sistema = r.get("sistema").asBoolean(); rol.autorizaDescuentos = r.get("autorizaDescuentos").asBoolean();
      r.get("permisos").fields().forEachRemaining(e -> rol.permisos.put(e.getKey(),
          new Acciones(e.getValue().get("c").asBoolean(), e.getValue().get("r").asBoolean(), e.getValue().get("u").asBoolean(), e.getValue().get("d").asBoolean())));
      em.persist(rol);
    }
    for (JsonNode u : d.get("usuarios")) {
      Usuario x = new Usuario();
      x.id = id(txt(u, "id")); x.nombre = txt(u, "nombre"); x.correo = txt(u, "correo"); x.dui = txt(u, "dui"); x.rolId = txt(u, "rolId");
      x.sucursalId = suc.get(txt(u, "sucursal")); x.passwordHash = encoder.encode(txt(u, "password"));
      em.persist(x);
    }
    for (JsonNode c : d.get("clientes")) {
      Cliente x = new Cliente();
      x.id = id(txt(c, "id")); x.tipo = txt(c, "tipo"); x.nombre = txt(c, "nombre"); x.nombreComercial = txt(c, "nombreComercial");
      x.tipoDocumento = txt(c, "tipoDocumento"); x.numDocumento = txt(c, "numDocumento"); x.nrc = txt(c, "nrc");
      x.codActividad = txt(c, "codActividad"); x.descActividad = txt(c, "descActividad"); x.correo = txt(c, "correo"); x.telefono = txt(c, "telefono");
      x.setDireccion(om.convertValue(c.get("direccion"), Map.class));
      em.persist(x);
    }
    for (JsonNode p : d.get("proveedores")) {
      Proveedor x = new Proveedor();
      x.id = id(txt(p, "id")); x.razonSocial = txt(p, "razonSocial"); x.nit = txt(p, "nit"); x.nrc = txt(p, "nrc");
      x.contacto = txt(p, "contacto"); x.telefono = txt(p, "telefono"); x.correo = txt(p, "correo");
      em.persist(x);
    }
    for (JsonNode p : d.get("productos")) {
      Producto x = new Producto();
      x.id = id(txt(p, "id")); x.sku = txt(p, "sku"); x.codigoBarras = txt(p, "codigoBarras"); x.nombre = txt(p, "nombre");
      x.descripcion = txt(p, "descripcion"); x.categoriaId = cat.get(txt(p, "categoria")); x.precio = num(p, "precio"); x.costo = num(p, "costo");
      x.stock = p.get("stock").asInt(); x.stockMinimo = p.get("stockMinimo").asInt();
      em.persist(x);
    }
    em.flush();
    for (JsonNode k : d.get("kardex")) {
      MovKardex x = new MovKardex();
      x.fecha = t.apply(txt(k, "fecha")); x.productoId = id(txt(k, "productoId")); x.tipo = txt(k, "tipo"); x.cantidad = k.get("cantidad").asInt();
      x.saldo = k.get("saldo").asInt(); x.costoUnit = num(k, "costoUnit"); x.referencia = txt(k, "referencia"); x.justificacion = txt(k, "justificacion");
      x.usuarioId = id(txt(k, "usuarioId"));
      em.persist(x);
    }
    for (JsonNode tr : d.get("turnos")) {
      Turno x = new Turno();
      x.id = id(txt(tr, "id")); x.usuarioId = id(txt(tr, "usuarioId")); x.caja = txt(tr, "caja"); x.apertura = t.apply(txt(tr, "apertura"));
      x.fondoInicial = num(tr, "fondoInicial"); x.cierre = t.apply(txt(tr, "cierre")); x.efectivoContado = num(tr, "efectivoContado"); x.estado = txt(tr, "estado");
      JsonNode r = tr.get("resumen");
      if (r != null && !r.isNull()) {
        x.totalVentas = num(r, "ventas"); x.transacciones = r.get("transacciones").asInt(); x.esperadoEfectivo = num(r, "esperadoEfectivo"); x.diferencia = num(r, "diferencia");
        x.totalEfectivo = num(r.get("porMetodo"), "EFECTIVO"); x.totalTarjeta = num(r.get("porMetodo"), "TARJETA"); x.totalTransferencia = num(r.get("porMetodo"), "TRANSFERENCIA");
      }
      em.persist(x);
    }
    em.flush();
    for (JsonNode v : d.get("ventas")) {
      Venta x = new Venta();
      x.id = id(txt(v, "id")); x.fecha = t.apply(txt(v, "fecha")); x.turnoId = id(txt(v, "turnoId")); x.usuarioId = id(txt(v, "usuarioId"));
      x.clienteId = id(txt(v, "clienteId")); x.tipoDte = txt(v, "tipoDte"); x.metodoPago = txt(v, "metodoPago"); x.descuentoPct = num(v, "descuentoPct");
      x.subtotal = num(v, "subtotal"); x.descuento = num(v, "descuento"); x.iva = num(v, "iva"); x.total = num(v, "total"); x.dteId = id(txt(v, "dteId"));
      for (JsonNode it : v.get("items"))
        x.items.add(new ItemVenta(id(txt(it, "productoId")), txt(it, "sku"), txt(it, "nombre"), it.get("cantidad").asInt(), num(it, "precio")));
      em.persist(x);
    }
    for (JsonNode n : d.get("dtes")) {
      Dte x = new Dte();
      x.id = id(txt(n, "id")); x.tipoDte = txt(n, "tipoDte"); x.numeroControl = txt(n, "numeroControl");
      x.fechaEmi = LocalDate.parse(txt(n, "fechaEmi")).plusDays(dias); x.horaEmi = LocalTime.parse(txt(n, "horaEmi"));
      x.creado = t.apply(txt(n, "creado")); x.ventaId = id(txt(n, "ventaId")); x.clienteId = id(txt(n, "clienteId")); x.usuarioId = id(txt(n, "usuarioId"));
      x.receptorNombre = txt(n, "receptorNombre"); x.total = num(n, "total"); x.iva = num(n, "iva"); x.totalGravada = Fiscal.r2(x.total.subtract(x.iva));
      x.estado = txt(n, "estado"); x.selloRecibido = txt(n, "selloRecibido");
      String fh = txt(n, "fhProcesamiento");
      x.fhProcesamiento = fh == null ? null : LocalDateTime.parse(fh, FH).plusDays(dias).format(FH);
      x.json = om.convertValue(n.get("json"), Map.class);
      ((Map<String, Object>) x.json.get("identificacion")).put("fecEmi", x.fechaEmi.toString());
      x.tipoModelo = ((Number) ((Map<String, Object>) x.json.get("identificacion")).get("tipoModelo")).shortValue();
      x.ambiente = String.valueOf(((Map<String, Object>) x.json.get("identificacion")).get("ambiente"));
      x.firma = txt(n, "firma"); x.intentos = n.get("intentos").asInt(); x.ultimoIntento = t.apply(txt(n, "ultimoIntento"));
      em.persist(x);
    }
    for (JsonNode c : d.get("compras")) {
      Compra x = new Compra();
      x.id = id(txt(c, "id")); x.fecha = t.apply(txt(c, "fecha")); x.proveedorId = id(txt(c, "proveedorId")); x.numeroComprobante = txt(c, "numeroComprobante");
      x.subtotal = num(c, "subtotal"); x.iva = num(c, "iva"); x.total = num(c, "total"); x.usuarioId = id(txt(c, "usuarioId"));
      for (JsonNode it : c.get("items")) {
        ItemCompra i = new ItemCompra(); i.productoId = id(txt(it, "productoId")); i.cantidad = it.get("cantidad").asInt(); i.costoUnit = num(it, "costoUnit");
        x.items.add(i);
      }
      em.persist(x);
    }
    JsonNode cfg = d.get("config");
    Configuracion c = new Configuracion();
    c.emisor = om.convertValue(cfg.get("emisor"), Map.class);
    c.ambiente = txt(cfg, "ambiente"); c.mhEnLinea = cfg.get("mhEnLinea").asBoolean(); c.simularRechazo = cfg.get("simularRechazo").asBoolean();
    c.latenciaMs = cfg.get("latenciaMs").asInt(); c.descuentoBase = num(cfg, "descuentoBase"); c.modoDemo = cfg.get("modoDemo").asBoolean();
    em.persist(c);
    cfg.get("correlativos").fields().forEachRemaining(e -> { Correlativo k = new Correlativo(); k.tipoDte = e.getKey(); k.ultimo = e.getValue().asLong(); em.persist(k); });
    Bitacora b = new Bitacora();
    b.usuarioId = "sistema"; b.modulo = "configuracion"; b.accion = "Inicialización"; b.nivel = "info";
    b.detalle = "Base de datos demo cargada: " + d.get("ventas").size() + " ventas y " + d.get("dtes").size() + " DTE históricos";
    em.persist(b);
    log.info("Datos demo cargados (desplazamiento de {} día(s))", dias);
  }
}
