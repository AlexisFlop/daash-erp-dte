package sv.daash.erp.dominio;

import jakarta.persistence.*;

@Entity
@Table(name = "sucursal")
public class Sucursal {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Short id;
  public String nombre;
  @Column(name = "cod_establecimiento") public String codEstablecimiento;
  public String codPuntoVenta;
}
