package sv.daash.erp.dominio;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "reset_token")
public class ResetToken {
  @Id public String token;
  public UUID usuarioId;
  public Instant expira;
  public boolean usado;
}
