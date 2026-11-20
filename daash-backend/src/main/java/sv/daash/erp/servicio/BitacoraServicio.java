package sv.daash.erp.servicio;

import org.springframework.stereotype.Service;
import sv.daash.erp.dominio.Bitacora;
import sv.daash.erp.repo.BitacoraRepo;
import sv.daash.erp.seguridad.Permisos;
import sv.daash.erp.seguridad.UsuarioAutenticado;

/** Bitácora de auditoría de la aplicación (eventos de seguridad, caja, inventario y DTE) */
@Service
public class BitacoraServicio {
  private final BitacoraRepo repo;
  public BitacoraServicio(BitacoraRepo repo) { this.repo = repo; }

  public void log(String modulo, String accion, String detalle, String nivel) { log(null, modulo, accion, detalle, nivel); }

  public void log(String usuarioId, String modulo, String accion, String detalle, String nivel) {
    Bitacora b = new Bitacora();
    UsuarioAutenticado u = Permisos.actualONulo();
    b.usuarioId = usuarioId != null ? usuarioId : u != null ? u.id().toString() : "sistema";
    b.modulo = modulo;
    b.accion = accion;
    b.detalle = detalle;
    b.nivel = nivel;
    repo.save(b);
  }
}
