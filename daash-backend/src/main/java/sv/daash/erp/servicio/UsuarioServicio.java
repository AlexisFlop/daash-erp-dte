package sv.daash.erp.servicio;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sv.daash.erp.comun.ApiException;
import sv.daash.erp.dominio.Acciones;
import sv.daash.erp.dominio.Rol;
import sv.daash.erp.dominio.Usuario;
import sv.daash.erp.fiscal.Fiscal;
import sv.daash.erp.repo.RolRepo;
import sv.daash.erp.repo.SucursalRepo;
import sv.daash.erp.repo.UsuarioRepo;
import sv.daash.erp.seguridad.Permisos;

import java.util.*;

/** Usuarios, roles y permisos (RF-03, RF-04) */
@Service
public class UsuarioServicio {
  public static final List<String> MODULOS = List.of("dashboard", "pos", "caja", "dte", "contingencia", "inventario", "compras", "proveedores",
      "clientes", "reportes", "usuarios", "roles", "auditoria", "configuracion");

  private final UsuarioRepo usuarios;
  private final RolRepo roles;
  private final SucursalRepo sucursales;
  private final PasswordEncoder encoder;
  private final BitacoraServicio bitacora;

  public UsuarioServicio(UsuarioRepo usuarios, RolRepo roles, SucursalRepo sucursales, PasswordEncoder encoder, BitacoraServicio bitacora) {
    this.usuarios = usuarios; this.roles = roles; this.sucursales = sucursales; this.encoder = encoder; this.bitacora = bitacora;
  }

  public List<Usuario> listar() { return usuarios.findAll(org.springframework.data.domain.Sort.by("nombre")); }

  /** Directorio mínimo (id y nombre) para mostrar autores en pantallas operativas */
  public List<Map<String, Object>> directorio() {
    return usuarios.findAll().stream().map(u -> Map.<String, Object>of("id", u.id, "nombre", u.nombre, "rolId", u.rolId)).toList();
  }

  public record UsuarioDto(UUID id, String nombre, String correo, String dui, String rolId, String sucursal, String password) {}

  @Transactional
  public Usuario guardar(UsuarioDto d) {
    boolean nuevo = d.id() == null;
    List<String> e = new ArrayList<>();
    String correo = d.correo() == null ? "" : d.correo().trim().toLowerCase();
    if (d.nombre() == null || d.nombre().trim().length() < 5) e.add("Nombre completo requerido");
    if (!Fiscal.validarCorreo(correo)) e.add("Correo inválido");
    usuarios.findByCorreoIgnoreCase(correo).filter(u -> !u.id.equals(d.id())).ifPresent(u -> e.add("Correo ya registrado"));
    if (!Fiscal.validarDUI(d.dui())) e.add("DUI inválido");
    if (d.rolId() == null || !roles.existsById(d.rolId())) e.add("Rol inválido");
    Short suc = d.sucursal() == null ? null : sucursales.findByNombre(d.sucursal()).map(s -> s.id).orElse(null);
    if (suc == null) e.add("Sucursal inválida");
    if (nuevo || (d.password() != null && !d.password().isEmpty())) e.addAll(AuthServicio.politica(d.password()));
    if (!e.isEmpty()) throw ApiException.invalido("Datos del usuario inválidos", e);
    Usuario u = nuevo ? new Usuario() : usuarios.findById(d.id()).orElseThrow(() -> ApiException.noEncontrado("Usuario"));
    if (nuevo) u.id = UUID.randomUUID();
    if (!nuevo && u.id.equals(Permisos.actual().id()) && !u.rolId.equals(d.rolId())) throw ApiException.invalido("No puedes cambiar tu propio rol");
    u.nombre = d.nombre().trim();
    u.correo = correo;
    u.dui = d.dui();
    u.rolId = d.rolId();
    u.sucursalId = suc;
    if (d.password() != null && !d.password().isEmpty()) u.passwordHash = encoder.encode(d.password());
    usuarios.saveAndFlush(u);
    bitacora.log("usuarios", nuevo ? "Usuario creado" : "Usuario actualizado", u.nombre + " · " + u.correo + " · rol " + u.rolId, nuevo ? "ok" : "info");
    return usuarios.findById(u.id).orElseThrow();
  }

  /** Baja lógica (soft delete): se conserva el historial de ventas y documentos */
  @Transactional
  public Usuario toggle(UUID id) {
    if (id.equals(Permisos.actual().id())) throw ApiException.invalido("No puedes darte de baja a ti mismo");
    Usuario u = usuarios.findById(id).orElseThrow(() -> ApiException.noEncontrado("Usuario"));
    u.activo = !u.activo;
    usuarios.save(u);
    bitacora.log("usuarios", u.activo ? "Reactivación de usuario" : "Baja lógica de usuario", u.nombre + " (soft delete — se conserva el historial)", u.activo ? "ok" : "warn");
    return u;
  }

  public List<Rol> roles() { return roles.findAll(org.springframework.data.domain.Sort.by("nombre")); }

  @Transactional
  public Rol guardarRol(Rol r) {
    if (r.nombre == null || r.nombre.isBlank()) throw ApiException.invalido("Nombre del rol requerido");
    boolean nuevo = r.id == null || r.id.isBlank() || !roles.existsById(r.id);
    if (nuevo && (r.id == null || r.id.isBlank())) r.id = "rol-" + UUID.randomUUID().toString().substring(0, 8);
    if (!nuevo) r.sistema = roles.findById(r.id).map(x -> x.sistema).orElse(false);
    else r.sistema = false;
    Map<String, Acciones> p = new HashMap<>();
    for (String m : MODULOS) {
      Acciones a = r.permisos.getOrDefault(m, new Acciones());
      if (a.c || a.u || a.d) a.r = true; // no se puede escribir sin leer
      p.put(m, a);
    }
    r.permisos = p;
    Rol g = roles.save(r);
    bitacora.log("roles", nuevo ? "Rol creado" : "Rol actualizado", r.nombre + ": permisos CRUD por módulo", "ok");
    return g;
  }

  @Transactional
  public void eliminarRol(String id) {
    Rol r = roles.findById(id).orElseThrow(() -> ApiException.noEncontrado("Rol"));
    if (r.sistema) throw ApiException.invalido("Los roles del sistema no se pueden eliminar");
    if (usuarios.countByRolId(id) > 0) throw ApiException.conflicto("Hay usuarios asignados a este rol");
    roles.delete(r);
    bitacora.log("roles", "Rol eliminado", r.nombre, "warn");
  }
}
