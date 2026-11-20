package sv.daash.erp.dominio;

import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Immutable
@Table(name = "dte_bitacora")
public class DteBitacora {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
  public UUID codigoGeneracion;
  public Instant fecha = Instant.now();
  public String evento;
  public String codigoMsg;
  public String descripcion;
  @JdbcTypeCode(SqlTypes.JSON) public Map<String, Object> respuestaMh;
}
