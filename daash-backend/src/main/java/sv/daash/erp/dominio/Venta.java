package sv.daash.erp.dominio;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import sv.daash.erp.comun.UuidMayus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "venta")
public class Venta {
  @Id public UUID id;
  public Instant fecha = Instant.now();
  public UUID turnoId;
  public UUID usuarioId;
  public UUID clienteId;
  public String tipoDte;
  public String metodoPago;
  public BigDecimal descuentoPct = BigDecimal.ZERO;
  public UUID autorizadoPor;
  public BigDecimal subtotal;
  public BigDecimal descuento = BigDecimal.ZERO;
  public BigDecimal iva;
  public BigDecimal total;
  public BigDecimal recibido;
  public BigDecimal cambio;
  @JsonSerialize(using = UuidMayus.class) public UUID dteId;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "venta_detalle", joinColumns = @JoinColumn(name = "venta_id"))
  @OrderColumn(name = "linea")
  public List<ItemVenta> items = new ArrayList<>();
}
