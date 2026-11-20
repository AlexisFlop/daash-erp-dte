package sv.daash.erp.dominio;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "configuracion")
public class Configuracion {
  @Id public Short id = 1;
  @JdbcTypeCode(SqlTypes.JSON) public Map<String, Object> emisor;
  public String ambiente = "00";
  public boolean mhEnLinea = true;
  public boolean simularRechazo;
  public int latenciaMs = 700;
  public BigDecimal descuentoBase = BigDecimal.TEN;
  public boolean modoDemo = true;
  public Instant proximoReintento;
  /** Últimos correlativos por tipo de DTE (calculado desde la tabla correlativo) */
  @Transient public Map<String, Long> correlativos;

  @SuppressWarnings("unchecked")
  public String emisor(String campo) { return String.valueOf(emisor.get(campo)); }
}
