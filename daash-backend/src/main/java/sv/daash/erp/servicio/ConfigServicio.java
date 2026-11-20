package sv.daash.erp.servicio;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sv.daash.erp.comun.ApiException;
import sv.daash.erp.dominio.Configuracion;
import sv.daash.erp.dominio.Correlativo;
import sv.daash.erp.repo.ConfiguracionRepo;
import sv.daash.erp.repo.CorrelativoRepo;

import java.math.BigDecimal;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service
public class ConfigServicio {
  private final ConfiguracionRepo repo;
  private final CorrelativoRepo correlativos;
  private final BitacoraServicio bitacora;

  public ConfigServicio(ConfiguracionRepo repo, CorrelativoRepo correlativos, BitacoraServicio bitacora) {
    this.repo = repo; this.correlativos = correlativos; this.bitacora = bitacora;
  }

  public Configuracion obtener() {
    Configuracion c = repo.findById((short) 1).orElseThrow(() -> ApiException.noEncontrado("Configuración"));
    c.correlativos = correlativos.findAll().stream().collect(Collectors.toMap(x -> x.tipoDte, x -> x.ultimo, (a, b) -> a, TreeMap::new));
    return c;
  }

  /** Reserva el siguiente correlativo con bloqueo de fila para evitar números de control duplicados */
  @Transactional
  public long siguienteCorrelativo(String tipo) {
    Correlativo c = correlativos.bloquear(tipo).orElseGet(() -> { Correlativo n = new Correlativo(); n.tipoDte = tipo; return n; });
    c.ultimo++;
    correlativos.save(c);
    return c.ultimo;
  }

  @SuppressWarnings("unchecked")
  @Transactional
  public Configuracion actualizar(Map<String, Object> cambios) {
    Configuracion c = obtener();
    if (cambios.containsKey("emisor")) c.emisor = (Map<String, Object>) cambios.get("emisor");
    if (cambios.containsKey("ambiente")) {
      String a = String.valueOf(cambios.get("ambiente"));
      if (!a.equals("00") && !a.equals("01")) throw ApiException.invalido("Ambiente inválido");
      c.ambiente = a;
    }
    if (cambios.containsKey("simularRechazo")) c.simularRechazo = Boolean.TRUE.equals(cambios.get("simularRechazo"));
    if (cambios.containsKey("modoDemo")) c.modoDemo = Boolean.TRUE.equals(cambios.get("modoDemo"));
    if (cambios.containsKey("latenciaMs")) c.latenciaMs = ((Number) cambios.get("latenciaMs")).intValue();
    if (cambios.containsKey("descuentoBase")) c.descuentoBase = new BigDecimal(String.valueOf(cambios.get("descuentoBase")));
    repo.save(c);
    bitacora.log("configuracion", "Configuración actualizada", String.join(", ", cambios.keySet()), "info");
    return obtener();
  }
}
