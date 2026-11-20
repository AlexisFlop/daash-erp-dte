package sv.daash.erp.comun;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestControllerAdvice
public class ManejadorErrores {
  private static final Logger log = LoggerFactory.getLogger(ManejadorErrores.class);

  private ResponseEntity<Map<String, Object>> r(HttpStatus s, String m, List<String> e) {
    Map<String, Object> b = new LinkedHashMap<>();
    b.put("estado", s.value());
    b.put("mensaje", m);
    b.put("errores", e);
    return ResponseEntity.status(s).body(b);
  }

  @ExceptionHandler(ApiException.class)
  ResponseEntity<Map<String, Object>> api(ApiException ex) { return r(ex.status, ex.getMessage(), ex.errores); }

  @ExceptionHandler({AccessDeniedException.class, AuthorizationDeniedException.class})
  ResponseEntity<Map<String, Object>> denegado(Exception ex) { return r(HttpStatus.FORBIDDEN, "Tu rol no tiene permiso para esta acción", List.of()); }

  /** Las restricciones de la base de datos son la última línea de defensa de la integridad */
  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<Map<String, Object>> integridad(DataIntegrityViolationException ex) {
    String causa = ex.getMostSpecificCause().getMessage();
    log.warn("Violación de integridad: {}", causa);
    return r(HttpStatus.CONFLICT, "La base de datos rechazó la operación por una regla de integridad", List.of(causa.split("\n")[0]));
  }
}
