package sv.daash.erp.web;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import sv.daash.erp.dominio.*;
import sv.daash.erp.servicio.CajaServicio;
import sv.daash.erp.servicio.FacturacionServicio;
import sv.daash.erp.seguridad.Permisos;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class FacturacionController {
  private final FacturacionServicio f;
  private final CajaServicio caja;

  public FacturacionController(FacturacionServicio f, CajaServicio caja) { this.f = f; this.caja = caja; }

  public record Apertura(BigDecimal fondoInicial, String caja) {}
  public record Cierre(BigDecimal efectivoContado) {}
  public record InvalidacionSolicitud(int tipo, String motivo) {}
  public record NcSolicitud(List<FacturacionServicio.ItemSolicitud> items) {}
  public record EstadoMH(boolean enLinea, Integer tipo, String motivo) {}

  // ----- Caja
  @GetMapping("/turnos") @PreAuthorize("@perm.alguno('caja:r','dashboard:r')")
  public List<Turno> turnos() { return caja.historial(); }

  @GetMapping("/turnos/actual") @PreAuthorize("@perm.alguno('caja:r','pos:r')")
  public Map<String, Object> actual() { return java.util.Collections.singletonMap("turno", caja.abierto(Permisos.actual().id()).orElse(null)); }

  @PostMapping("/turnos/abrir") @PreAuthorize("@perm.puede('caja','c')")
  public Turno abrir(@RequestBody Apertura a) { return caja.abrir(a.fondoInicial(), a.caja()); }

  @PostMapping("/turnos/cerrar") @PreAuthorize("@perm.puede('caja','c')")
  public Turno cerrar(@RequestBody Cierre c) { return caja.cerrar(c.efectivoContado()); }

  // ----- Ventas
  @GetMapping("/ventas") @PreAuthorize("@perm.alguno('dashboard:r','pos:r','caja:r','dte:r','reportes:r')")
  public List<Venta> ventas() { return f.ventas(); }

  @PostMapping("/ventas") @PreAuthorize("@perm.puede('pos','c')")
  public FacturacionServicio.Resultado emitir(@RequestBody FacturacionServicio.VentaSolicitud s) { return f.emitirVenta(s); }

  // ----- DTE
  @GetMapping("/dtes") @PreAuthorize("@perm.alguno('dte:r','dashboard:r','reportes:r','contingencia:r')")
  public List<Dte> dtes() { return f.listar(); }

  @GetMapping("/dtes/{id}") @PreAuthorize("@perm.alguno('dte:r','pos:r')")
  public Dte dte(@PathVariable UUID id) { return f.obtener(id); }

  @GetMapping("/dtes/{id}/bitacora") @PreAuthorize("@perm.puede('dte','r')")
  public List<DteBitacora> bitacora(@PathVariable UUID id) { return f.bitacoraDte(id); }

  @PostMapping("/dtes/{id}/retransmitir") @PreAuthorize("@perm.alguno('dte:c','pos:c')")
  public Dte retransmitir(@PathVariable UUID id) { return f.retransmitir(id); }

  @PostMapping("/dtes/{id}/invalidar") @PreAuthorize("@perm.puede('dte','d')")
  public Dte invalidar(@PathVariable UUID id, @RequestBody InvalidacionSolicitud s) { return f.invalidar(id, s.tipo(), s.motivo()); }

  @PostMapping("/dtes/{id}/nota-credito") @PreAuthorize("@perm.puede('dte','u')")
  public FacturacionServicio.Resultado notaCredito(@PathVariable UUID id, @RequestBody NcSolicitud s) { return f.notaCredito(id, s.items()); }

  @PostMapping("/dtes/{id}/correo") @PreAuthorize("@perm.alguno('dte:r','pos:r')")
  public Dte correo(@PathVariable UUID id, @RequestBody Map<String, String> b) { return f.enviarCorreo(id, b.get("para")); }

  // ----- Contingencia (el estado lo consulta toda la interfaz)
  @GetMapping("/contingencia")
  public Map<String, Object> contingencia() { return f.estadoContingencia(); }

  @PostMapping("/contingencia/mh") @PreAuthorize("@perm.puede('contingencia','u')")
  public Map<String, Object> mh(@RequestBody EstadoMH e) { return f.cambiarEstadoMH(e.enLinea(), e.tipo(), e.motivo()); }

  @PostMapping("/contingencia/reintentar") @PreAuthorize("@perm.puede('contingencia','r')")
  public FacturacionServicio.ResultadoReintento reintentar() { return f.reintentar(true); }

  // ----- Correo simulado
  @GetMapping("/correos")
  public List<CorreoSimulado> correos() { return f.correos(); }

  @PatchMapping("/correos/{id}/leido")
  public CorreoSimulado leido(@PathVariable UUID id) { return f.marcarLeido(id); }
}
