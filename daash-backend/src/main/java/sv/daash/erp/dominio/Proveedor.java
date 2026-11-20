package sv.daash.erp.dominio;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "proveedor")
public class Proveedor {
  @Id public UUID id;
  public String razonSocial;
  public String nit;
  public String nrc;
  public String contacto;
  public String telefono;
  public String correo;
  public boolean activo = true;
}
