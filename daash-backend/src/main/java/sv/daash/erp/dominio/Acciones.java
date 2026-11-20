package sv.daash.erp.dominio;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class Acciones {
  @Column(name = "crear") @JsonProperty("c") public boolean c;
  @Column(name = "leer") @JsonProperty("r") public boolean r;
  @Column(name = "actualizar") @JsonProperty("u") public boolean u;
  @Column(name = "borrar") @JsonProperty("d") public boolean d;

  public Acciones() {}
  public Acciones(boolean c, boolean r, boolean u, boolean d) { this.c = c; this.r = r; this.u = u; this.d = d; }

  public boolean permite(String accion) {
    return switch (accion) { case "c" -> c; case "r" -> r; case "u" -> u; case "d" -> d; default -> false; };
  }
}
