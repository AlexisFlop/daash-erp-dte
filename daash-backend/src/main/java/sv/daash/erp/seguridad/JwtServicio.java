package sv.daash.erp.seguridad;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import sv.daash.erp.dominio.Usuario;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

/** Emisión y verificación estricta de tokens JWT firmados con HS256 (CA-02) */
@Service
public class JwtServicio {
  private final SecretKey llave;
  private final int horas;

  public JwtServicio(@Value("${daash.jwt.secreto}") String secreto, @Value("${daash.jwt.horas}") int horas) {
    // La llave se deriva con SHA-256: cualquier secreto configurado produce una llave HS256 de 256 bits
    try {
      this.llave = Keys.hmacShaKeyFor(java.security.MessageDigest.getInstance("SHA-256").digest(secreto.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
    this.horas = horas;
  }

  public String emitir(Usuario u) {
    Instant ahora = Instant.now();
    return Jwts.builder()
        .issuer("daash-erp")
        .subject(u.id.toString())
        .claim("nombre", u.nombre)
        .claim("rol", u.rolId)
        .issuedAt(Date.from(ahora))
        .expiration(Date.from(ahora.plus(horas, ChronoUnit.HOURS)))
        .signWith(llave, Jwts.SIG.HS256)
        .compact();
  }

  /** Lanza excepción si la firma no coincide, el token expiró o el emisor no es válido */
  public Claims verificar(String token) {
    return Jwts.parser().verifyWith(llave).requireIssuer("daash-erp").build().parseSignedClaims(token).getPayload();
  }
}
