package sv.daash.erp.dominio;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.math.BigDecimal;
import java.util.UUID;

@Embeddable
public class ItemCompra {
  public UUID productoId;
  public int cantidad;
  @Column(name = "costo_unitario") public BigDecimal costoUnit;
}
