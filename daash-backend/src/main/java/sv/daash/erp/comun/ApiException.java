package sv.daash.erp.comun;

import org.springframework.http.HttpStatus;
import java.util.List;

/** Error de negocio con estado HTTP y lista opcional de errores de validación */
public class ApiException extends RuntimeException {
  public final HttpStatus status;
  public final List<String> errores;

  public ApiException(HttpStatus status, String mensaje) { this(status, mensaje, List.of()); }
  public ApiException(HttpStatus status, String mensaje, List<String> errores) { super(mensaje); this.status = status; this.errores = errores; }

  public static ApiException noEncontrado(String que) { return new ApiException(HttpStatus.NOT_FOUND, que + " no encontrado"); }
  public static ApiException invalido(String m) { return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, m); }
  public static ApiException invalido(String m, List<String> errores) { return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, m, errores); }
  public static ApiException conflicto(String m) { return new ApiException(HttpStatus.CONFLICT, m); }
}
