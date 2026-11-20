package sv.daash.erp.dominio;

import jakarta.persistence.*;

@Entity
@Table(name = "correlativo")
public class Correlativo {
  @Id public String tipoDte;
  public long ultimo;
}
