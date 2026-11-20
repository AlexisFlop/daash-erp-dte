package sv.daash.erp.servicio;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sv.daash.erp.comun.ApiException;
import sv.daash.erp.dominio.*;
import sv.daash.erp.fiscal.Fiscal;
import sv.daash.erp.repo.*;
import sv.daash.erp.seguridad.Permisos;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

/** Inventario, Kardex, clientes, proveedores y compras (RF-05 a RF-08, RF-16 a RF-18) */
@Service
public class InventarioServicio {
  private final ProductoRepo productos;
  private final CategoriaRepo categorias;
  private final KardexRepo kardex;
  private final ClienteRepo clientes;
  private final ProveedorRepo proveedores;
  private final CompraRepo compras;
  private final BitacoraServicio bitacora;

  public InventarioServicio(ProductoRepo productos, CategoriaRepo categorias, KardexRepo kardex, ClienteRepo clientes,
                            ProveedorRepo proveedores, CompraRepo compras, BitacoraServicio bitacora) {
    this.productos = productos; this.categorias = categorias; this.kardex = kardex; this.clientes = clientes;
    this.proveedores = proveedores; this.compras = compras; this.bitacora = bitacora;
  }

  // ===================== Productos =====================
  public List<Producto> productos() { return productos.findAllByOrderByCategoriaIdAscNombreAsc(); }

  public record ProductoDto(UUID id, String sku, String codigoBarras, String nombre, String descripcion, String categoria,
                            BigDecimal precio, BigDecimal costo, Integer stock, Integer stockMinimo) {}

  @Transactional
  public Producto guardarProducto(ProductoDto d) {
    List<String> e = new ArrayList<>();
    if (d.sku() == null || d.sku().isBlank()) e.add("SKU obligatorio");
    if (d.nombre() == null || d.nombre().isBlank()) e.add("Nombre obligatorio");
    if (d.precio() == null || d.precio().signum() <= 0) e.add("Precio de venta debe ser mayor a 0");
    if (d.costo() == null || d.costo().signum() <= 0) e.add("Costo obligatorio");
    if (d.stockMinimo() == null || d.stockMinimo() < 0) e.add("Stock mínimo obligatorio");
    Short cat = d.categoria() == null ? null : categorias.findByNombre(d.categoria()).map(c -> c.id).orElse(null);
    if (cat == null) e.add("Categoría inválida");
    String sku = d.sku() == null ? "" : d.sku().trim().toUpperCase();
    productos.findBySku(sku).filter(p -> !p.id.equals(d.id())).ifPresent(p -> e.add("El SKU ya existe"));
    if (!e.isEmpty()) throw ApiException.invalido("Datos del producto inválidos", e);

    boolean nuevo = d.id() == null;
    Producto p = nuevo ? new Producto() : productos.findById(d.id()).orElseThrow(() -> ApiException.noEncontrado("Producto"));
    if (nuevo) { p.id = UUID.randomUUID(); p.stock = Math.max(0, d.stock() == null ? 0 : d.stock()); }
    p.sku = sku;
    p.codigoBarras = d.codigoBarras() == null || d.codigoBarras().isBlank() ? "7410" + String.format("%09d", System.currentTimeMillis() % 1_000_000_000L) : d.codigoBarras();
    p.nombre = d.nombre().trim();
    p.descripcion = d.descripcion();
    p.categoriaId = cat;
    p.precio = Fiscal.r2(d.precio());
    p.costo = Fiscal.r2(d.costo());
    p.stockMinimo = d.stockMinimo();
    productos.saveAndFlush(p);
    if (nuevo && p.stock > 0) movimiento(p, "INICIAL", p.stock, p.stock, p.costo, "Alta de producto", null);
    bitacora.log("inventario", nuevo ? "Producto creado" : "Producto actualizado", p.sku + " · " + p.nombre, nuevo ? "ok" : "info");
    return productos.findById(p.id).orElseThrow();
  }

  @Transactional
  public Producto toggleProducto(UUID id) {
    Producto p = productos.findById(id).orElseThrow(() -> ApiException.noEncontrado("Producto"));
    p.activo = !p.activo;
    bitacora.log("inventario", p.activo ? "Producto reactivado" : "Producto desactivado", p.sku, "warn");
    return productos.save(p);
  }

  /** RF-06 · Ajuste manual con justificación obligatoria registrada en el Kardex */
  @Transactional
  public Producto ajustar(UUID id, int cantidad, String tipo, String justificacion) {
    if (!"AJUSTE_POS".equals(tipo) && !"AJUSTE_NEG".equals(tipo)) throw ApiException.invalido("Tipo de ajuste inválido");
    if (cantidad <= 0) throw ApiException.invalido("La cantidad debe ser mayor a 0");
    if (justificacion == null || justificacion.trim().length() < 10) throw ApiException.invalido("La justificación debe tener al menos 10 caracteres");
    Producto p = productos.bloquear(List.of(id)).stream().findFirst().orElseThrow(() -> ApiException.noEncontrado("Producto"));
    int saldo = "AJUSTE_POS".equals(tipo) ? p.stock + cantidad : p.stock - cantidad;
    if (saldo < 0) throw ApiException.invalido("El ajuste dejaría el inventario en negativo (existencia actual: " + p.stock + ")");
    p.stock = saldo;
    productos.save(p);
    movimiento(p, tipo, cantidad, saldo, p.costo, "Ajuste manual", justificacion.trim());
    bitacora.log("inventario", "Ajuste manual de inventario", p.sku + ": " + ("AJUSTE_POS".equals(tipo) ? "+" : "−") + cantidad + " · \"" + justificacion.trim() + "\"", "warn");
    return p;
  }

  public void movimiento(Producto p, String tipo, int cantidad, int saldo, BigDecimal costo, String referencia, String justificacion) {
    MovKardex k = new MovKardex();
    k.productoId = p.id; k.tipo = tipo; k.cantidad = cantidad; k.saldo = saldo; k.costoUnit = costo;
    k.referencia = referencia; k.justificacion = justificacion; k.usuarioId = Permisos.actual().id();
    kardex.save(k);
  }

  public List<MovKardex> kardex(UUID productoId) { return kardex.findByProductoIdOrderByFechaDescIdDesc(productoId); }
  public List<MovKardex> kardexCompleto() { return kardex.findAllByOrderByFechaAscIdAsc(); }

  // ===================== Clientes (RF-16) =====================
  public List<Cliente> clientes() { return clientes.findAllByOrderByNombreAsc(); }

  @Transactional
  public Cliente guardarCliente(Cliente c) {
    List<String> e = new ArrayList<>();
    if (c.nombre == null || c.nombre.trim().length() < 3) e.add("Nombre requerido");
    if (!"CONSUMIDOR".equals(c.tipo) && !"CONTRIBUYENTE".equals(c.tipo)) e.add("Tipo de cliente inválido");
    if ("13".equals(c.tipoDocumento)) { if (!Fiscal.validarDUI(c.numDocumento)) e.add("DUI inválido (formato 00000000-0 y dígito verificador)"); }
    else if ("36".equals(c.tipoDocumento)) { if (c.numDocumento == null || !c.numDocumento.matches("^\\d{4}-\\d{6}-\\d{3}-\\d$")) e.add("NIT inválido (0000-000000-000-0)"); }
    else e.add("Tipo de documento inválido");
    boolean contrib = "CONTRIBUYENTE".equals(c.tipo);
    if (contrib && !Fiscal.validarNRC(c.nrc)) e.add("NRC inválido (ej. 123456-7)");
    if (contrib && (c.codActividad == null || c.codActividad.isBlank())) e.add("Seleccione la actividad económica");
    if ((contrib || (c.correo != null && !c.correo.isBlank())) && !Fiscal.validarCorreo(c.correo)) e.add("Correo inválido");
    if (c.departamento == null || c.municipio == null) e.add("Dirección incompleta");
    boolean nuevo = c.id == null;
    if (nuevo) c.id = UUID.randomUUID();
    if (clientes.existsByTipoDocumentoAndNumDocumentoAndIdNot(c.tipoDocumento, c.numDocumento, c.id)) e.add("Ya existe un cliente con ese documento");
    if (!e.isEmpty()) throw ApiException.invalido("Datos del cliente inválidos", e);
    if (!contrib) { c.nrc = null; c.codActividad = null; c.descActividad = null; c.nombreComercial = null; }
    if (c.correo != null && c.correo.isBlank()) c.correo = null;
    c.nombre = c.nombre.trim();
    if (!nuevo) c.creado = clientes.findById(c.id).map(x -> x.creado).orElse(Instant.now());
    Cliente g = clientes.save(c);
    bitacora.log("clientes", nuevo ? "Cliente registrado" : "Cliente actualizado", c.nombre + " · " + c.numDocumento, "ok");
    return g;
  }

  @Transactional
  public Cliente toggleCliente(UUID id) {
    Cliente c = clientes.findById(id).orElseThrow(() -> ApiException.noEncontrado("Cliente"));
    c.activo = !c.activo;
    bitacora.log("clientes", "Estado de cliente modificado", c.nombre, "warn");
    return clientes.save(c);
  }

  // ===================== Proveedores (RF-17) =====================
  public List<Proveedor> proveedores() { return proveedores.findAllByOrderByRazonSocialAsc(); }

  @Transactional
  public Proveedor guardarProveedor(Proveedor p) {
    List<String> e = new ArrayList<>();
    if (p.razonSocial == null || p.razonSocial.trim().length() < 3) e.add("Razón social requerida");
    if (!Fiscal.validarNIT(p.nit)) e.add("NIT inválido (0000-000000-000-0)");
    if (!Fiscal.validarNRC(p.nrc)) e.add("NRC inválido (000000-0)");
    if (p.contacto == null || p.contacto.isBlank()) e.add("Persona de contacto requerida");
    if (p.telefono == null || !p.telefono.matches("^\\d{4}-?\\d{4}$")) e.add("Teléfono inválido (0000-0000)");
    if (p.correo != null && !p.correo.isBlank() && !Fiscal.validarCorreo(p.correo)) e.add("Correo inválido");
    if (!e.isEmpty()) throw ApiException.invalido("Datos del proveedor inválidos", e);
    boolean nuevo = p.id == null;
    if (nuevo) p.id = UUID.randomUUID();
    if (p.correo != null && p.correo.isBlank()) p.correo = null;
    Proveedor g = proveedores.save(p);
    bitacora.log("proveedores", nuevo ? "Proveedor registrado" : "Proveedor actualizado", p.razonSocial + " · NIT " + p.nit, "ok");
    return g;
  }

  @Transactional
  public Proveedor toggleProveedor(UUID id) {
    Proveedor p = proveedores.findById(id).orElseThrow(() -> ApiException.noEncontrado("Proveedor"));
    p.activo = !p.activo;
    bitacora.log("proveedores", "Estado de proveedor modificado", p.razonSocial, "warn");
    return proveedores.save(p);
  }

  // ===================== Compras (RF-18) =====================
  public List<Compra> compras() { return compras.findAllByOrderByFechaDesc(); }

  public record CompraDto(UUID proveedorId, String numeroComprobante, String fecha, List<ItemCompra> items) {}

  @Transactional
  public Compra registrarCompra(CompraDto d) {
    if (d.proveedorId() == null || !proveedores.existsById(d.proveedorId())) throw ApiException.invalido("Proveedor inválido");
    if (d.numeroComprobante() == null || d.numeroComprobante().isBlank()) throw ApiException.invalido("Número de comprobante requerido");
    if (d.items() == null || d.items().isEmpty()) throw ApiException.invalido("La compra debe tener al menos un producto");
    if (compras.existsByProveedorIdAndNumeroComprobante(d.proveedorId(), d.numeroComprobante().trim()))
      throw ApiException.conflicto("El comprobante ya fue registrado para este proveedor");
    for (ItemCompra i : d.items())
      if (i.cantidad <= 0 || i.costoUnit == null || i.costoUnit.signum() <= 0) throw ApiException.invalido("Cantidades y costos deben ser mayores a 0");
    Map<UUID, Producto> bloqueados = new HashMap<>();
    productos.bloquear(d.items().stream().map(i -> i.productoId).toList()).forEach(p -> bloqueados.put(p.id, p));
    Compra c = new Compra();
    c.id = UUID.randomUUID();
    c.fecha = d.fecha() == null ? Instant.now() : java.time.LocalDate.parse(d.fecha()).atTime(java.time.LocalTime.now(Fiscal.SV)).atZone(Fiscal.SV).toInstant();
    c.proveedorId = d.proveedorId();
    c.numeroComprobante = d.numeroComprobante().trim();
    c.usuarioId = Permisos.actual().id();
    BigDecimal subtotal = BigDecimal.ZERO;
    for (ItemCompra i : d.items()) {
      Producto p = bloqueados.get(i.productoId);
      if (p == null) throw ApiException.invalido("Producto inexistente en la compra");
      // Costo promedio ponderado
      p.costo = BigDecimal.valueOf(p.stock).multiply(p.costo).add(BigDecimal.valueOf(i.cantidad).multiply(i.costoUnit))
          .divide(BigDecimal.valueOf(p.stock + i.cantidad), 2, RoundingMode.HALF_UP);
      p.stock += i.cantidad;
      productos.save(p);
      movimiento(p, "ENTRADA", i.cantidad, p.stock, i.costoUnit, "Compra " + c.numeroComprobante, null);
      subtotal = subtotal.add(i.costoUnit.multiply(BigDecimal.valueOf(i.cantidad)));
      c.items.add(i);
    }
    c.subtotal = Fiscal.r2(subtotal);
    c.iva = Fiscal.r2(c.subtotal.multiply(Fiscal.IVA));
    c.total = Fiscal.r2(c.subtotal.add(c.iva));
    compras.save(c);
    bitacora.log("compras", "Compra registrada", c.numeroComprobante + " · " + c.items.size() + " producto(s) · total $" + c.total, "ok");
    return c;
  }
}
