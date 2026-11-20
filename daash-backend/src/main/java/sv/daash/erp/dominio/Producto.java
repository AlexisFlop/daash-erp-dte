package sv.daash.erp.dominio;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.Formula;
import java.math.BigDecimal;
import java.util.UUID;

/** Actualización dinámica: solo se envían las columnas modificadas (evita auditorías espurias en los disparadores) */
@Entity
@org.hibernate.annotations.DynamicUpdate
@Table(name = "producto")
public class Producto {
  @Id public UUID id;
  public String sku;
  public String codigoBarras;
  public String nombre;
  public String descripcion;
  @JsonIgnore public Short categoriaId;
  @Formula("(select c.nombre from daash.categoria c where c.id = categoria_id)") public String categoria;
  /** Precio unitario SIN IVA */
  @Column(name = "precio_venta") public BigDecimal precio;
  public BigDecimal costo;
  public int stock;
  public int stockMinimo;
  public boolean activo = true;
}
