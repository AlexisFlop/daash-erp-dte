package sv.daash.erp.servicio;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sv.daash.erp.comun.ApiException;
import sv.daash.erp.dominio.*;
import sv.daash.erp.repo.*;
import sv.daash.erp.seguridad.JwtServicio;
import sv.daash.erp.seguridad.Permisos;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class AuthServicio {
  public static final int MAX_INTENTOS = 5;
  public static final int MINUTOS_BLOQUEO = 15;
  public static final int MINUTOS_TOKEN_RESET = 15;

  private final UsuarioRepo usuarios;
  private final RolRepo roles;
  private final ResetTokenRepo tokens;
  private final CorreoRepo correos;
  private final PasswordEncoder encoder;
  private final JwtServicio jwt;
  private final BitacoraServicio bitacora;
  private final SecureRandom rnd = new SecureRandom();

  public AuthServicio(UsuarioRepo usuarios, RolRepo roles, ResetTokenRepo tokens, CorreoRepo correos, PasswordEncoder encoder, JwtServicio jwt, BitacoraServicio bitacora) {
    this.usuarios = usuarios; this.roles = roles; this.tokens = tokens; this.correos = correos; this.encoder = encoder; this.jwt = jwt; this.bitacora = bitacora;
  }

  public record Sesion(String token, Usuario usuario, Rol rol) {}

  private static ApiException noAutorizado(String m) { return new ApiException(HttpStatus.UNAUTHORIZED, m); }

  /** RF-01 · Inicio de sesión con bloqueo tras 5 intentos fallidos (CA-04) */
  @Transactional(noRollbackFor = ApiException.class)
  public Sesion login(String correo, String password) {
    String c = correo == null ? "" : correo.trim().toLowerCase();
    Usuario u = usuarios.findByCorreoIgnoreCase(c).orElse(null);
    if (u == null) {
      bitacora.log("sistema", "auth", "Inicio de sesión fallido", "Correo no registrado: " + c, "warn");
      throw noAutorizado("Credenciales incorrectas");
    }
    if (!u.activo) throw noAutorizado("Esta cuenta está dada de baja. Contacte al gerente.");
    if (u.bloqueadoHasta != null && u.bloqueadoHasta.isAfter(Instant.now())) {
      long min = Math.max(1, Duration.between(Instant.now(), u.bloqueadoHasta).toMinutes() + 1);
      throw noAutorizado("Cuenta bloqueada por intentos fallidos. Intente en " + min + " min.");
    }
    if (password == null || !encoder.matches(password, u.passwordHash)) {
      int intentos = u.intentosFallidos + 1;
      boolean bloquear = intentos >= MAX_INTENTOS;
      u.intentosFallidos = (short) (bloquear ? 0 : intentos);
      u.bloqueadoHasta = bloquear ? Instant.now().plus(Duration.ofMinutes(MINUTOS_BLOQUEO)) : null;
      usuarios.save(u);
      bitacora.log(u.id.toString(), "auth", bloquear ? "Cuenta bloqueada" : "Inicio de sesión fallido", u.correo + " · intento " + intentos + "/" + MAX_INTENTOS, bloquear ? "error" : "warn");
      throw noAutorizado(bloquear
          ? "Se superaron " + MAX_INTENTOS + " intentos. Cuenta bloqueada por " + MINUTOS_BLOQUEO + " minutos."
          : "Credenciales incorrectas · " + (MAX_INTENTOS - intentos) + " intento(s) restante(s)");
    }
    u.intentosFallidos = 0;
    u.bloqueadoHasta = null;
    u.ultimoAcceso = Instant.now();
    usuarios.save(u);
    bitacora.log(u.id.toString(), "auth", "Inicio de sesión", u.nombre + " ingresó al sistema", "ok");
    return new Sesion(jwt.emitir(u), u, roles.findById(u.rolId).orElseThrow());
  }

  public Sesion actual() {
    Usuario u = usuarios.findById(Permisos.actual().id()).orElseThrow(() -> noAutorizado("Sesión no válida"));
    return new Sesion(null, u, roles.findById(u.rolId).orElseThrow());
  }

  /** RF-02 · Envía un enlace temporal; responde igual exista o no el correo (evita enumeración) */
  @Transactional
  public void recuperar(String correo) {
    String c = correo == null ? "" : correo.trim().toLowerCase();
    usuarios.findByCorreoIgnoreCase(c).filter(u -> u.activo).ifPresent(u -> {
      tokens.invalidarDeUsuario(u.id);
      byte[] b = new byte[20];
      rnd.nextBytes(b);
      ResetToken t = new ResetToken();
      t.token = HexFormat.of().formatHex(b);
      t.usuarioId = u.id;
      t.expira = Instant.now().plus(Duration.ofMinutes(MINUTOS_TOKEN_RESET));
      tokens.save(t);
      CorreoSimulado m = new CorreoSimulado();
      m.para = u.correo;
      m.asunto = "Restablecimiento de contraseña · DAASH ERP";
      m.cuerpo = "Hola " + u.nombre.split(" ")[0] + ", recibimos una solicitud para restablecer tu contraseña. El enlace expira en "
          + MINUTOS_TOKEN_RESET + " minutos. Si no fuiste tú, ignora este mensaje.";
      m.enlace = "/restablecer/" + t.token;
      correos.save(m);
      bitacora.log(u.id.toString(), "auth", "Solicitud de restablecimiento", "Enlace temporal enviado a " + u.correo, "info");
    });
  }

  public ResetToken tokenValido(String token) {
    return tokens.findById(token).filter(t -> !t.usado && t.expira.isAfter(Instant.now()))
        .orElseThrow(() -> new ApiException(HttpStatus.GONE, "Enlace inválido o expirado"));
  }

  public static List<String> politica(String pw) {
    List<String> e = new ArrayList<>();
    if (pw == null || pw.length() < 8) e.add("Mínimo 8 caracteres");
    if (pw == null || !pw.matches(".*[A-Z].*")) e.add("Una letra mayúscula");
    if (pw == null || !pw.matches(".*\\d.*")) e.add("Un número");
    if (pw == null || !pw.matches(".*[^A-Za-z0-9].*")) e.add("Un carácter especial");
    return e;
  }

  private void exigirPolitica(String pw) {
    List<String> e = politica(pw);
    if (!e.isEmpty()) throw ApiException.invalido("La contraseña no cumple la política", e);
  }

  @Transactional
  public void restablecer(String token, String password) {
    ResetToken t = tokenValido(token);
    exigirPolitica(password);
    Usuario u = usuarios.findById(t.usuarioId).orElseThrow();
    u.passwordHash = encoder.encode(password);
    u.intentosFallidos = 0;
    u.bloqueadoHasta = null;
    usuarios.save(u);
    t.usado = true;
    tokens.save(t);
    bitacora.log(u.id.toString(), "auth", "Contraseña restablecida", u.correo, "ok");
  }

  @Transactional
  public void cambiarPassword(String actual, String nueva) {
    Usuario u = usuarios.findById(Permisos.actual().id()).orElseThrow();
    if (actual == null || !encoder.matches(actual, u.passwordHash)) throw ApiException.invalido("Contraseña actual incorrecta");
    exigirPolitica(nueva);
    u.passwordHash = encoder.encode(nueva);
    usuarios.save(u);
    bitacora.log("auth", "Cambio de contraseña", u.correo, "ok");
  }

  /** RF-11 · Verifica credenciales de un usuario con permiso para autorizar descuentos */
  public Usuario verificarAutorizador(String correo, String password) {
    Usuario u = usuarios.findByCorreoIgnoreCase(correo == null ? "" : correo.trim()).filter(x -> x.activo).orElse(null);
    if (u == null || password == null || !encoder.matches(password, u.passwordHash)
        || !roles.findById(u.rolId).map(r -> r.autorizaDescuentos).orElse(false))
      throw ApiException.invalido("Credenciales inválidas o el usuario no tiene nivel de gerente");
    return u;
  }
}
