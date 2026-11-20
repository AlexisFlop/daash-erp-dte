package sv.daash.erp.dominio;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import sv.daash.erp.comun.UuidMayus;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "evento_contingencia")
public class EventoContingencia {
  @Id @JsonSerialize(using = UuidMayus.class) public UUID id;
  @Column(name = "f_inicio") @JsonProperty("fInicio") public Instant fInicio;
  @Column(name = "f_fin") @JsonProperty("fFin") public Instant fFin;
  public short tipoContingencia;
  public String motivo;
  public String estado;
  @Column(name = "sello_recepcion") public String selloRecibido;
  @JdbcTypeCode(SqlTypes.JSON) @Column(name = "documento_json") public Map<String, Object> json;
  public UUID usuarioId;
  /** DTE asociados al evento (calculado) */
  @Transient @JsonSerialize(contentUsing = UuidMayus.class) public List<UUID> dtes;
}
