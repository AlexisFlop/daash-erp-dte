package sv.daash.erp.fiscal;

import org.springframework.stereotype.Component;
import sv.daash.erp.dominio.Configuracion;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import static sv.daash.erp.fiscal.Fiscal.*;

/**
 * Simulador del servicio de recepción de DTE del Ministerio de Hacienda.
 * Reproduce latencia, caída del servicio (contingencia) y rechazos de validación.
 */
@Component
public class SimuladorMH {

  public static class MHNoDisponible extends RuntimeException {
    public MHNoDisponible() { super("Tiempo de espera agotado: el servicio de recepción del Ministerio de Hacienda no responde"); }
  }

  public Map<String, Object> transmitir(Configuracion cfg, UUID codigo, Boolean forzarRechazo) {
    try {
      Thread.sleep(cfg.latenciaMs + ThreadLocalRandom.current().nextInt(400));
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
    if (!cfg.mhEnLinea) throw new MHNoDisponible();
    Instant ahora = Instant.now();
    boolean rechazo = forzarRechazo != null ? forzarRechazo : cfg.simularRechazo;
    if (rechazo) {
      return m("version", 2, "ambiente", cfg.ambiente, "versionApp", 2, "estado", "RECHAZADO", "codigoGeneracion", codigo.toString().toUpperCase(),
          "selloRecibido", null, "fhProcesamiento", fhMH(ahora), "clasificaMsg", "20", "codigoMsg", "004",
          "descripcionMsg", "[receptor.correo] NO CUMPLE EL FORMATO REQUERIDO", "observaciones", List.of("Verifique los datos del receptor y retransmita el documento"));
    }
    return m("version", 2, "ambiente", cfg.ambiente, "versionApp", 2, "estado", "PROCESADO", "codigoGeneracion", codigo.toString().toUpperCase(),
        "selloRecibido", generarSello(ahora), "fhProcesamiento", fhMH(ahora), "clasificaMsg", "10", "codigoMsg", "001",
        "descripcionMsg", "RECIBIDO", "observaciones", List.of());
  }
}
