package sv.daash.erp.servicio;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sv.daash.erp.comun.ApiException;
import sv.daash.erp.dominio.Turno;
import sv.daash.erp.dominio.Venta;
import sv.daash.erp.fiscal.Fiscal;
import sv.daash.erp.repo.DteRepo;
import sv.daash.erp.repo.TurnoRepo;
import sv.daash.erp.repo.VentaRepo;
import sv.daash.erp.seguridad.Permisos;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Apertura de turno y corte de caja Z (RF-09, RF-12) */
@Service
public class CajaServicio {
  private final TurnoRepo turnos;
  private final VentaRepo ventas;
  private final DteRepo dtes;
  private final BitacoraServicio bitacora;

  public CajaServicio(TurnoRepo turnos, VentaRepo ventas, DteRepo dtes, BitacoraServicio bitacora) {
    this.turnos = turnos; this.ventas = ventas; this.dtes = dtes; this.bitacora = bitacora;
  }

  public List<Turno> historial() { return turnos.findAllByOrderByAperturaDesc(); }

  public Optional<Turno> abierto(UUID usuarioId) { return turnos.findFirstByUsuarioIdAndEstado(usuarioId, "ABIERTO"); }

  @Transactional
  public Turno abrir(BigDecimal fondo, String caja) {
    UUID u = Permisos.actual().id();
    if (abierto(u).isPresent()) throw ApiException.conflicto("Ya tienes un turno abierto");
    if (fondo == null || fondo.signum() < 0) throw ApiException.invalido("El fondo inicial no puede ser negativo");
    Turno t = new Turno();
    t.id = UUID.randomUUID();
    t.usuarioId = u;
    t.caja = caja == null || caja.isBlank() ? "Caja 01" : caja;
    t.fondoInicial = Fiscal.r2(fondo);
    turnos.save(t);
    bitacora.log("caja", "Apertura de turno", t.caja + " · fondo inicial $" + t.fondoInicial, "ok");
    return t;
  }

  /** Corte Z: resumen por método de pago excluyendo documentos invalidados */
  @Transactional
  public Turno cerrar(BigDecimal efectivoContado) {
    Turno t = abierto(Permisos.actual().id()).orElseThrow(() -> ApiException.invalido("No tienes un turno abierto"));
    if (efectivoContado == null || efectivoContado.signum() < 0) throw ApiException.invalido("Efectivo contado inválido");
    List<Venta> vs = ventas.findByTurnoId(t.id).stream()
        .filter(v -> dtes.findById(v.dteId).map(d -> !"INVALIDADO".equals(d.estado)).orElse(true)).toList();
    BigDecimal ef = suma(vs, "EFECTIVO"), tj = suma(vs, "TARJETA"), tr = suma(vs, "TRANSFERENCIA");
    t.totalEfectivo = ef; t.totalTarjeta = tj; t.totalTransferencia = tr;
    t.totalVentas = Fiscal.r2(ef.add(tj).add(tr));
    t.transacciones = vs.size();
    t.esperadoEfectivo = Fiscal.r2(t.fondoInicial.add(ef));
    t.efectivoContado = Fiscal.r2(efectivoContado);
    t.diferencia = Fiscal.r2(t.efectivoContado.subtract(t.esperadoEfectivo));
    t.estado = "CERRADO";
    t.cierre = Instant.now();
    turnos.save(t);
    bitacora.log("caja", "Corte de caja Z", t.caja + " · ventas $" + t.totalVentas + " · diferencia $" + t.diferencia, t.diferencia.signum() == 0 ? "ok" : "warn");
    return t;
  }

  private static BigDecimal suma(List<Venta> vs, String metodo) {
    return Fiscal.r2(vs.stream().filter(v -> metodo.equals(v.metodoPago)).map(v -> v.total).reduce(BigDecimal.ZERO, BigDecimal::add));
  }
}
