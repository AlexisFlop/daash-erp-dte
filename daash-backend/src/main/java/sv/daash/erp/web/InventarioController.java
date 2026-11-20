package sv.daash.erp.web;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import sv.daash.erp.dominio.*;
import sv.daash.erp.servicio.InventarioServicio;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class InventarioController {
  private final InventarioServicio s;
  public InventarioController(InventarioServicio s) { this.s = s; }

  public record Ajuste(int cantidad, String tipo, String justificacion) {}

  // El catálogo es necesario para el POS, el dashboard y el inventario
  @GetMapping("/productos") @PreAuthorize("@perm.alguno('inventario:r','pos:r','dashboard:r','reportes:r','compras:r')")
  public List<Producto> productos() { return s.productos(); }

  @PostMapping("/productos") @PreAuthorize("@perm.puede('inventario','c')")
  public Producto crear(@RequestBody InventarioServicio.ProductoDto d) { return s.guardarProducto(new InventarioServicio.ProductoDto(null, d.sku(), d.codigoBarras(), d.nombre(), d.descripcion(), d.categoria(), d.precio(), d.costo(), d.stock(), d.stockMinimo())); }

  @PutMapping("/productos/{id}") @PreAuthorize("@perm.puede('inventario','u')")
  public Producto editar(@PathVariable UUID id, @RequestBody InventarioServicio.ProductoDto d) { return s.guardarProducto(new InventarioServicio.ProductoDto(id, d.sku(), d.codigoBarras(), d.nombre(), d.descripcion(), d.categoria(), d.precio(), d.costo(), null, d.stockMinimo())); }

  @PatchMapping("/productos/{id}/estado") @PreAuthorize("@perm.puede('inventario','d')")
  public Producto toggle(@PathVariable UUID id) { return s.toggleProducto(id); }

  @PostMapping("/productos/{id}/ajuste") @PreAuthorize("@perm.puede('inventario','u')")
  public Producto ajuste(@PathVariable UUID id, @RequestBody Ajuste a) { return s.ajustar(id, a.cantidad(), a.tipo(), a.justificacion()); }

  @GetMapping("/productos/{id}/kardex") @PreAuthorize("@perm.puede('inventario','r')")
  public List<MovKardex> kardex(@PathVariable UUID id) { return s.kardex(id); }

  @GetMapping("/kardex") @PreAuthorize("@perm.puede('inventario','r')")
  public List<MovKardex> kardexCompleto() { return s.kardexCompleto(); }

  // ----- Clientes
  @GetMapping("/clientes") @PreAuthorize("@perm.alguno('clientes:r','pos:r','dte:r','reportes:r')")
  public List<Cliente> clientes() { return s.clientes(); }

  @PostMapping("/clientes") @PreAuthorize("@perm.puede('clientes','c')")
  public Cliente crearCliente(@RequestBody Cliente c) { c.id = null; return s.guardarCliente(c); }

  @PutMapping("/clientes/{id}") @PreAuthorize("@perm.puede('clientes','u')")
  public Cliente editarCliente(@PathVariable UUID id, @RequestBody Cliente c) { c.id = id; return s.guardarCliente(c); }

  @PatchMapping("/clientes/{id}/estado") @PreAuthorize("@perm.puede('clientes','d')")
  public Cliente toggleCliente(@PathVariable UUID id) { return s.toggleCliente(id); }

  // ----- Proveedores
  @GetMapping("/proveedores") @PreAuthorize("@perm.alguno('proveedores:r','compras:r','reportes:r')")
  public List<Proveedor> proveedores() { return s.proveedores(); }

  @PostMapping("/proveedores") @PreAuthorize("@perm.puede('proveedores','c')")
  public Proveedor crearProveedor(@RequestBody Proveedor p) { p.id = null; return s.guardarProveedor(p); }

  @PutMapping("/proveedores/{id}") @PreAuthorize("@perm.puede('proveedores','u')")
  public Proveedor editarProveedor(@PathVariable UUID id, @RequestBody Proveedor p) { p.id = id; return s.guardarProveedor(p); }

  @PatchMapping("/proveedores/{id}/estado") @PreAuthorize("@perm.puede('proveedores','u')")
  public Proveedor toggleProveedor(@PathVariable UUID id) { return s.toggleProveedor(id); }

  // ----- Compras
  @GetMapping("/compras") @PreAuthorize("@perm.alguno('compras:r','reportes:r')")
  public List<Compra> compras() { return s.compras(); }

  @PostMapping("/compras") @PreAuthorize("@perm.puede('compras','c')")
  public Compra registrar(@RequestBody InventarioServicio.CompraDto d) { return s.registrarCompra(d); }
}
