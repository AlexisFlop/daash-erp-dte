package sv.daash.erp.web;

import org.springframework.web.bind.annotation.*;
import sv.daash.erp.comun.ApiException;
import sv.daash.erp.dominio.CorreoSimulado;
import sv.daash.erp.dominio.Usuario;
import sv.daash.erp.repo.CorreoRepo;
import sv.daash.erp.servicio.AuthServicio;
import sv.daash.erp.servicio.ConfigServicio;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthServicio auth;
  private final CorreoRepo correos;
  private final ConfigServicio config;
  public AuthController(AuthServicio auth, CorreoRepo correos, ConfigServicio config) { this.auth = auth; this.correos = correos; this.config = config; }

  /** Buzón simulado de una dirección (solo en modo demostración; reemplaza al servidor SMTP real) */
  @GetMapping("/bandeja-demo")
  public List<CorreoSimulado> bandeja(@RequestParam String correo) {
    if (!config.obtener().modoDemo) throw ApiException.noEncontrado("Recurso");
    return correos.findAllByOrderByFechaDesc().stream().filter(c -> c.para.equalsIgnoreCase(correo.trim())).limit(5).toList();
  }

  public record Credenciales(String correo, String password) {}
  public record CambioPassword(String actual, String nueva) {}
  public record NuevaPassword(String password) {}

  @PostMapping("/login")
  public AuthServicio.Sesion login(@RequestBody Credenciales c) { return auth.login(c.correo(), c.password()); }

  @GetMapping("/me")
  public AuthServicio.Sesion me() { return auth.actual(); }

  @PostMapping("/recuperar")
  public Map<String, Object> recuperar(@RequestBody Map<String, String> b) {
    auth.recuperar(b.get("correo"));
    return Map.of("ok", true);
  }

  @GetMapping("/restablecer/{token}")
  public Map<String, Object> validar(@PathVariable String token) { return Map.of("valido", true, "expira", auth.tokenValido(token).expira); }

  @PostMapping("/restablecer/{token}")
  public Map<String, Object> restablecer(@PathVariable String token, @RequestBody NuevaPassword b) {
    auth.restablecer(token, b.password());
    return Map.of("ok", true);
  }

  @PostMapping("/cambiar-password")
  public Map<String, Object> cambiar(@RequestBody CambioPassword b) {
    auth.cambiarPassword(b.actual(), b.nueva());
    return Map.of("ok", true);
  }

  /** Verificación de credenciales de gerente para autorizar descuentos (RF-11) */
  @PostMapping("/autorizar-descuento")
  public Map<String, Object> autorizar(@RequestBody Credenciales c) {
    Usuario u = auth.verificarAutorizador(c.correo(), c.password());
    return Map.of("id", u.id, "nombre", u.nombre);
  }
}
