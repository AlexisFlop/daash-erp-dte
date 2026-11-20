package sv.daash.erp.seguridad;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import sv.daash.erp.comun.ApiException;
import sv.daash.erp.repo.RolRepo;

import org.springframework.http.HttpStatus;

/**
 * Verificación de permisos CRUD por módulo (RBAC, RF-04). Se usa en los controladores como
 * {@code @PreAuthorize("@perm.puede('inventario','c')")}.
 */
@Component("perm")
public class Permisos {
  private final RolRepo roles;

  public Permisos(RolRepo roles) { this.roles = roles; }

  public boolean puede(String modulo, String accion) {
    UsuarioAutenticado u = actualONulo();
    if (u == null) return false;
    return roles.findById(u.rolId()).map(r -> r.puede(modulo, accion)).orElse(false);
  }

  /** Permite si el rol tiene alguno de los permisos indicados como "modulo:accion" */
  public boolean alguno(String... pares) {
    for (String p : pares) { String[] x = p.split(":"); if (puede(x[0], x[1])) return true; }
    return false;
  }

  public static UsuarioAutenticado actualONulo() {
    Authentication a = SecurityContextHolder.getContext().getAuthentication();
    return a != null && a.getPrincipal() instanceof UsuarioAutenticado u ? u : null;
  }

  public static UsuarioAutenticado actual() {
    UsuarioAutenticado u = actualONulo();
    if (u == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "Sesión no válida");
    return u;
  }
}
