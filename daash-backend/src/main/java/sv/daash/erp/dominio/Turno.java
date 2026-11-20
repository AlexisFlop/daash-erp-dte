package sv.daash.erp.dominio;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "turno_caja")
public class Turno {
  @Id public UUID id;
  public UUID usuarioId;
  public String caja;
  public Instant apertura = Instant.now();
  public BigDecimal fondoInicial;
  public Instant cierre;
  public BigDecimal efectivoContado;
  public String estado = "ABIERTO";
  @JsonIgnore public BigDecimal totalVentas;
  @JsonIgnore public Integer transacciones;
  @JsonIgnore public BigDecimal totalEfectivo;
  @JsonIgnore public BigDecimal totalTarjeta;
  @JsonIgnore public BigDecimal totalTransferencia;
  @JsonIgnore public BigDecimal esperadoEfectivo;
  @JsonIgnore public BigDecimal diferencia;

  @JsonProperty("resumen")
  public Map<String, Object> getResumen() {
    if (!"CERRADO".equals(estado)) return null;
    Map<String, Object> r = new LinkedHashMap<>();
    r.put("ventas", totalVentas);
    r.put("transacciones", transacciones);
    r.put("porMetodo", Map.of("EFECTIVO", totalEfectivo, "TARJETA", totalTarjeta, "TRANSFERENCIA", totalTransferencia));
    r.put("esperadoEfectivo", esperadoEfectivo);
    r.put("diferencia", diferencia);
    return r;
  }
}
