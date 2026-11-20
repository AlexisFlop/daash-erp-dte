package sv.daash.erp.dominio;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "bitacora")
public class Bitacora {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
  public Instant fecha = Instant.now();
  public String usuarioId;
  public String modulo;
  public String accion;
  public String detalle;
  public String nivel;
}
