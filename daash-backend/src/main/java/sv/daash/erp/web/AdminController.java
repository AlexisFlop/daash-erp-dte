package sv.daash.erp.web;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import sv.daash.erp.dominio.*;
import sv.daash.erp.repo.BitacoraRepo;
import sv.daash.erp.servicio.ConfigServicio;
import sv.daash.erp.servicio.SeedServicio;
import sv.daash.erp.servicio.UsuarioServicio;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class AdminController {
  private final UsuarioServicio usuarios;
  private final ConfigServicio config;
  private final SeedServicio seed;
  private final BitacoraRepo bitacora;

  public AdminController(UsuarioServicio usuarios, ConfigServicio config, SeedServicio seed, BitacoraRepo bitacora) {
    this.usuarios = usuarios; this.config = config; this.seed = seed; this.bitacora = bitacora;
  }

  @GetMapping("/usuarios") @PreAuthorize("@perm.puede('usuarios','r')")
  public List<Usuario> usuarios() { return usuarios.listar(); }

  /** Directorio de nombres (sin datos sensibles) para mostrar autores en pantallas operativas */
  @GetMapping("/usuarios/directorio")
  public List<Map<String, Object>> directorio() { return usuarios.directorio(); }

  @PostMapping("/usuarios") @PreAuthorize("@perm.puede('usuarios','c')")
  public Usuario crear(@RequestBody UsuarioServicio.UsuarioDto d) { return usuarios.guardar(new UsuarioServicio.UsuarioDto(null, d.nombre(), d.correo(), d.dui(), d.rolId(), d.sucursal(), d.password())); }

  @PutMapping("/usuarios/{id}") @PreAuthorize("@perm.puede('usuarios','u')")
  public Usuario editar(@PathVariable UUID id, @RequestBody UsuarioServicio.UsuarioDto d) { return usuarios.guardar(new UsuarioServicio.UsuarioDto(id, d.nombre(), d.correo(), d.dui(), d.rolId(), d.sucursal(), d.password())); }

  @PatchMapping("/usuarios/{id}/estado") @PreAuthorize("@perm.puede('usuarios','d')")
  public Usuario toggle(@PathVariable UUID id) { return usuarios.toggle(id); }

  @GetMapping("/roles")
  public List<Rol> roles() { return usuarios.roles(); }

  @PostMapping("/roles") @PreAuthorize("@perm.puede('roles','c')")
  public Rol crearRol(@RequestBody Rol r) { r.id = null; return usuarios.guardarRol(r); }

  @PutMapping("/roles/{id}") @PreAuthorize("@perm.puede('roles','u')")
  public Rol editarRol(@PathVariable String id, @RequestBody Rol r) { r.id = id; return usuarios.guardarRol(r); }

  @DeleteMapping("/roles/{id}") @PreAuthorize("@perm.puede('roles','d')")
  public Map<String, Object> eliminarRol(@PathVariable String id) { usuarios.eliminarRol(id); return Map.of("ok", true); }

  @GetMapping("/bitacora") @PreAuthorize("@perm.puede('auditoria','r')")
  public List<Bitacora> bitacora() { return bitacora.findTop1500ByOrderByFechaDescIdDesc(); }

  @GetMapping("/configuracion")
  public Configuracion configuracion() { return config.obtener(); }

  @PutMapping("/configuracion") @PreAuthorize("@perm.puede('configuracion','u')")
  public Configuracion actualizar(@RequestBody Map<String, Object> cambios) { return config.actualizar(cambios); }

  @PostMapping("/configuracion/reiniciar-demo") @PreAuthorize("@perm.puede('configuracion','d')")
  public Map<String, Object> reiniciar() { seed.reiniciar(); return Map.of("ok", true); }
}
