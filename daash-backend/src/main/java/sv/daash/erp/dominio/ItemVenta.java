package sv.daash.erp.dominio;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.math.BigDecimal;
import java.util.UUID;

@Embeddable
public class ItemVenta {
  public UUID productoId;
  public String sku;
  public String nombre;
  public int cantidad;
  /** Precio unitario SIN IVA tomado del catálogo oficial */
  @Column(name = "precio_unitario") public BigDecimal precio;

  public ItemVenta() {}
  public ItemVenta(UUID productoId, String sku, String nombre, int cantidad, BigDecimal precio) {
    this.productoId = productoId; this.sku = sku; this.nombre = nombre; this.cantidad = cantidad; this.precio = precio;
  }
}
