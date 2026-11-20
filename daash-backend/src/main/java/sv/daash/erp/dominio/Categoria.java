package sv.daash.erp.dominio;

import jakarta.persistence.*;

@Entity
@Table(name = "categoria")
public class Categoria {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Short id;
  public String nombre;
}
