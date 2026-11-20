package sv.daash.erp.dominio;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.Formula;
import java.time.Instant;
import java.util.UUID;

/** Actualización dinámica: solo se envían las columnas modificadas (evita auditorías espurias en los disparadores) */
@Entity
@org.hibernate.annotations.DynamicUpdate
@Table(name = "usuario")
public class Usuario {
  @Id public UUID id;
  public String nombre;
  public String correo;
  @JsonIgnore public String passwordHash;
  public String dui;
  public String rolId;
  @JsonIgnore public Short sucursalId;
  @Formula("(select s.nombre from daash.sucursal s where s.id = sucursal_id)") public String sucursal;
  public boolean activo = true;
  public short intentosFallidos;
  public Instant bloqueadoHasta;
  public Instant ultimoAcceso;
  public Instant creado = Instant.now();
}
