package sv.daash.erp.dominio;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "compra")
public class Compra {
  @Id public UUID id;
  public Instant fecha;
  public UUID proveedorId;
  public String numeroComprobante;
  public BigDecimal subtotal;
  public BigDecimal iva;
  public BigDecimal total;
  public UUID usuarioId;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "compra_detalle", joinColumns = @JoinColumn(name = "compra_id"))
  @OrderColumn(name = "linea")
  public List<ItemCompra> items = new ArrayList<>();
}
