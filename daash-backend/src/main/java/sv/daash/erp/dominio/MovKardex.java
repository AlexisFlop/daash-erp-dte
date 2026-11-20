package sv.daash.erp.dominio;

import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Movimiento de Kardex: registro inmutable (solo inserción) */
@Entity
@Immutable
@Table(name = "kardex")
public class MovKardex {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
  public Instant fecha = Instant.now();
  public UUID productoId;
  public String tipo;
  public int cantidad;
  public int saldo;
  @Column(name = "costo_unitario") public BigDecimal costoUnit;
  public String referencia;
  public String justificacion;
  public UUID usuarioId;
}
