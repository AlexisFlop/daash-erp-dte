package sv.daash.erp.dominio;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "correo_simulado")
public class CorreoSimulado {
  @Id public UUID id = UUID.randomUUID();
  public Instant fecha = Instant.now();
  public String para;
  public String asunto;
  public String cuerpo;
  public String enlace;
  @JsonIgnore @Column(name = "adjuntos") public String adjuntosCsv;
  public boolean leido;

  @JsonProperty("adjuntos")
  public List<String> getAdjuntos() { return adjuntosCsv == null ? null : Arrays.asList(adjuntosCsv.split(",")); }
}
