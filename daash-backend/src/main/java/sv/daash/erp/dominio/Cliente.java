package sv.daash.erp.dominio;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "cliente")
public class Cliente {
  @Id public UUID id;
  public String tipo;
  public String nombre;
  public String nombreComercial;
  public String tipoDocumento;
  public String numDocumento;
  public String nrc;
  public String codActividad;
  public String descActividad;
  public String correo;
  public String telefono;
  @JsonIgnore public String departamento;
  @JsonIgnore public String municipio;
  @JsonIgnore @Column(name = "direccion") public String complemento;
  public boolean activo = true;
  public Instant creado = Instant.now();

  @JsonProperty("direccion")
  public Map<String, String> getDireccion() {
    Map<String, String> d = new LinkedHashMap<>();
    d.put("departamento", departamento);
    d.put("municipio", municipio);
    d.put("complemento", complemento);
    return d;
  }

  @JsonProperty("direccion")
  public void setDireccion(Map<String, String> d) {
    if (d == null) return;
    departamento = d.get("departamento");
    municipio = d.get("municipio");
    complemento = d.get("complemento");
  }
}
