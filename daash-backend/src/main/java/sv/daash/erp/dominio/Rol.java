package sv.daash.erp.dominio;

import jakarta.persistence.*;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "rol")
public class Rol {
  @Id public String id;
  public String nombre;
  public String descripcion;
  public boolean sistema;
  public boolean autorizaDescuentos;

  /** Permisos CRUD por módulo (tabla permiso) */
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "permiso", joinColumns = @JoinColumn(name = "rol_id"))
  @MapKeyColumn(name = "modulo")
  public Map<String, Acciones> permisos = new HashMap<>();

  public boolean puede(String modulo, String accion) {
    Acciones a = permisos.get(modulo);
    return a != null && a.permite(accion);
  }
}
