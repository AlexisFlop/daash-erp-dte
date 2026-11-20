package sv.daash.erp.dominio;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import sv.daash.erp.comun.UuidMayus;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Documento Tributario Electrónico (tabla particionada por año de emisión) */
@Entity
@Table(name = "dte_encabezado")
public class Dte {
  @Id @Column(name = "codigo_generacion") @JsonSerialize(using = UuidMayus.class) public UUID id;
  public String tipoDte;
  public String numeroControl;
  @Column(name = "fecha_emision") public LocalDate fechaEmi;
  @Column(name = "hora_emision") public LocalTime horaEmi;
  public Instant creado = Instant.now();
  public UUID ventaId;
  public UUID clienteId;
  public UUID usuarioId;
  public String receptorNombre;
  @JsonIgnore public BigDecimal totalGravada;
  @Column(name = "total_iva") public BigDecimal iva;
  @Column(name = "total_pagar") public BigDecimal total;
  public String estado;
  public short tipoModelo;
  @Column(name = "sello_recepcion") public String selloRecibido;
  public String fhProcesamiento;
  public String ambiente = "00";
  @JdbcTypeCode(SqlTypes.JSON) @Column(name = "documento_json") public Map<String, Object> json;
  @Column(name = "firma_jws") public String firma;
  @JdbcTypeCode(SqlTypes.JSON) @Column(name = "respuesta_mh") public Map<String, Object> respuesta;
  public int intentos;
  public Instant ultimoIntento;
  @JsonSerialize(using = UuidMayus.class) public UUID relacionadoId;
  @JsonSerialize(using = UuidMayus.class) public UUID eventoContingenciaId;
  @JdbcTypeCode(SqlTypes.JSON) public Map<String, Object> invalidacion;
  public String correoEnviado;

  /** Notas de crédito emitidas sobre este documento (calculado) */
  @Transient @JsonSerialize(contentUsing = UuidMayus.class) public List<UUID> notasCredito;
}
