package sv.daash.erp.servicio;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import sv.daash.erp.comun.ApiException;
import sv.daash.erp.dominio.*;
import sv.daash.erp.fiscal.Calculadora;
import sv.daash.erp.fiscal.DteBuilder;
import sv.daash.erp.fiscal.Fiscal;
import sv.daash.erp.fiscal.SimuladorMH;
import sv.daash.erp.repo.*;
import sv.daash.erp.seguridad.Permisos;
import sv.daash.erp.seguridad.UsuarioAutenticado;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

/** Punto de venta, documentos tributarios electrónicos y contingencia (RF-10 a RF-15) */
@Service
public class FacturacionServicio {
  private static final Logger log = LoggerFactory.getLogger(FacturacionServicio.class);

  private final ProductoRepo productos;
  private final ClienteRepo clientes;
  private final UsuarioRepo usuarios;
  private final RolRepo roles;
  private final VentaRepo ventas;
  private final DteRepo dtes;
  private final DteBitacoraRepo dteBitacora;
  private final EventoRepo eventos;
  private final CorreoRepo correos;
  private final ConfiguracionRepo configRepo;
  private final ConfigServicio config;
  private final CajaServicio caja;
  private final InventarioServicio inventario;
  private final AuthServicio auth;
  private final BitacoraServicio bitacora;
  private final SimuladorMH mh;
  private final ObjectMapper om;
  private final TransactionTemplate tx;
  private final AtomicBoolean reintentando = new AtomicBoolean(false);

  public FacturacionServicio(ProductoRepo productos, ClienteRepo clientes, UsuarioRepo usuarios, RolRepo roles, VentaRepo ventas, DteRepo dtes,
                             DteBitacoraRepo dteBitacora, EventoRepo eventos, CorreoRepo correos, ConfiguracionRepo configRepo, ConfigServicio config,
                             CajaServicio caja, InventarioServicio inventario, AuthServicio auth, BitacoraServicio bitacora, SimuladorMH mh,
                             ObjectMapper om, TransactionTemplate tx) {
    this.productos = productos; this.clientes = clientes; this.usuarios = usuarios; this.roles = roles; this.ventas = ventas; this.dtes = dtes;
    this.dteBitacora = dteBitacora; this.eventos = eventos; this.correos = correos; this.configRepo = configRepo; this.config = config;
    this.caja = caja; this.inventario = inventario; this.auth = auth; this.bitacora = bitacora; this.mh = mh; this.om = om; this.tx = tx;
  }

  // ======================================================================= Venta
  public record ItemSolicitud(UUID productoId, int cantidad) {}
  public record Autorizacion(String correo, String password) {}
  public record VentaSolicitud(List<ItemSolicitud> items, BigDecimal descuentoPct, UUID clienteId, String tipoDte, String metodoPago,
                               BigDecimal recibido, Autorizacion autorizacion) {}
  public record Resultado(boolean ok, Dte dte, Venta venta) {}

  @Transactional
  public Resultado emitirVenta(VentaSolicitud s) {
    UsuarioAutenticado ua = Permisos.actual();
    Usuario usuario = usuarios.findById(ua.id()).orElseThrow();
    Turno turno = caja.abierto(ua.id()).orElseThrow(() -> ApiException.invalido("No hay una caja abierta para este usuario (RF-09)"));
    if (!"01".equals(s.tipoDte()) && !"03".equals(s.tipoDte())) throw ApiException.invalido("Tipo de documento inválido");
    if (!List.of("EFECTIVO", "TARJETA", "TRANSFERENCIA").contains(s.metodoPago())) throw ApiException.invalido("Método de pago inválido");
    if (s.items() == null || s.items().isEmpty()) throw ApiException.invalido("La venta no tiene productos");

    // CA-05: el backend ignora los precios del cliente y usa el catálogo oficial con bloqueo de fila (evita sobreventa concurrente)
    Map<UUID, Integer> cantidades = new LinkedHashMap<>();
    for (ItemSolicitud i : s.items()) {
      if (i.cantidad() <= 0) throw ApiException.invalido("Cantidad inválida");
      cantidades.merge(i.productoId(), i.cantidad(), Integer::sum);
    }
    Map<UUID, Producto> catalogo = productos.bloquear(cantidades.keySet()).stream().collect(Collectors.toMap(p -> p.id, p -> p));
    List<String> errores = new ArrayList<>();
    List<ItemVenta> items = new ArrayList<>();
    cantidades.forEach((id, cant) -> {
      Producto p = catalogo.get(id);
      if (p == null || !p.activo) { errores.add("Producto no disponible"); return; }
      if (p.stock < cant) errores.add("Stock insuficiente para " + p.nombre + " (disponible: " + p.stock + ")");
      items.add(new ItemVenta(p.id, p.sku, p.nombre, cant, p.precio));
    });

    Configuracion cfg = config.obtener();
    BigDecimal pct = s.descuentoPct() == null ? BigDecimal.ZERO : s.descuentoPct();
    if (pct.signum() < 0 || pct.compareTo(BigDecimal.valueOf(50)) > 0) errores.add("Descuento fuera de rango (0 a 50 %)");
    UUID autorizadoPor = null;
    if (pct.compareTo(cfg.descuentoBase) > 0 && !roles.findById(ua.rolId()).map(r -> r.autorizaDescuentos).orElse(false)) {
      if (s.autorizacion() == null) errores.add("El descuento supera el " + cfg.descuentoBase.stripTrailingZeros().toPlainString() + "% base y requiere autorización de gerente (RF-11)");
      else autorizadoPor = auth.verificarAutorizador(s.autorizacion().correo(), s.autorizacion().password()).id;
    }
    Cliente cliente = s.clienteId() == null ? null : clientes.findById(s.clienteId()).orElse(null);
    errores.addAll(DteBuilder.validar(s.tipoDte(), cliente, items));
    if (!errores.isEmpty()) throw ApiException.invalido("No se pudo emitir el documento", errores);

    Instant ahora = Instant.now();
    Calculadora.Totales t = Calculadora.calcular(items, pct, s.tipoDte());
    if ("EFECTIVO".equals(s.metodoPago()) && s.recibido() != null && s.recibido().compareTo(t.total()) < 0)
      throw ApiException.invalido("El efectivo recibido es menor al total");

    Dte dte = generarYTransmitir(s.tipoDte(), cfg, items, pct, cliente, s.metodoPago(), usuario, null, ahora);
    Venta v = new Venta();
    v.id = UUID.randomUUID(); v.fecha = ahora; v.turnoId = turno.id; v.usuarioId = usuario.id; v.clienteId = s.clienteId(); v.tipoDte = s.tipoDte();
    v.items = items; v.descuentoPct = pct; v.autorizadoPor = autorizadoPor; v.metodoPago = s.metodoPago();
    v.subtotal = t.subtotal(); v.descuento = t.descuento(); v.iva = t.iva(); v.total = t.total();
    v.recibido = "EFECTIVO".equals(s.metodoPago()) ? s.recibido() : null;
    v.cambio = v.recibido != null ? Fiscal.r2(v.recibido.subtract(t.total())) : null;
    v.dteId = dte.id;
    ventas.save(v);
    dte.ventaId = v.id;
    dtes.save(dte);

    // Rebaja atómica del inventario y Kardex (RF-07)
    for (ItemVenta it : items) {
      Producto p = catalogo.get(it.productoId);
      p.stock -= it.cantidad;
      productos.save(p);
      inventario.movimiento(p, "SALIDA", it.cantidad, p.stock, p.costo, DteBuilder.TIPOS.get(s.tipoDte()).corto() + " " + dte.numeroControl.substring(dte.numeroControl.length() - 6), null);
    }
    if (autorizadoPor != null) bitacora.log("pos", "Descuento autorizado", pct + "% autorizado por " + usuarios.findById(autorizadoPor).map(u -> u.nombre).orElse(""), "warn");
    bitacora.log("dte", "DTE " + dte.estado.toLowerCase(), DteBuilder.TIPOS.get(dte.tipoDte).nombre() + " " + dte.numeroControl + " · $" + dte.total,
        switch (dte.estado) { case "PROCESADO" -> "ok"; case "RECHAZADO" -> "error"; default -> "warn"; });
    return new Resultado(true, dte, v);
  }

  /** Genera el JSON, lo firma y lo transmite al MH; si el MH no responde, el DTE queda en contingencia (RF-13, RF-14) */
  private Dte generarYTransmitir(String tipo, Configuracion cfg, List<ItemVenta> items, BigDecimal pct, Cliente cliente, String metodo,
                                 Usuario usuario, Dte relacionado, Instant ahora) {
    EventoContingencia ev = cfg.mhEnLinea ? null : eventoActivoOCrear(1, null);
    DteBuilder.Datos d = new DteBuilder.Datos();
    d.tipo = tipo; d.config = cfg; d.correlativo = config.siguienteCorrelativo(tipo); d.codigoGeneracion = UUID.randomUUID(); d.fecha = ahora;
    d.items = items; d.descuentoPct = pct; d.cliente = cliente; d.metodoPago = metodo; d.vendedor = usuario.nombre; d.relacionado = relacionado;
    if (ev != null) { d.tipoContingencia = (int) ev.tipoContingencia; d.motivoContingencia = ev.motivo; }
    Map<String, Object> json = DteBuilder.construir(d);
    Calculadora.Totales t = Calculadora.calcular(items, pct, tipo);

    Dte dte = new Dte();
    dte.id = d.codigoGeneracion; dte.tipoDte = tipo; dte.numeroControl = DteBuilder.numeroControl(tipo, cfg, d.correlativo);
    LocalDateTime local = LocalDateTime.ofInstant(ahora, Fiscal.SV);
    dte.fechaEmi = local.toLocalDate(); dte.horaEmi = local.toLocalTime().withNano(0); dte.creado = ahora;
    dte.clienteId = cliente == null ? null : cliente.id; dte.usuarioId = usuario.id;
    dte.receptorNombre = cliente == null ? "Consumidor final" : cliente.nombre;
    dte.total = t.total(); dte.iva = t.iva(); dte.totalGravada = Fiscal.r2(t.total().subtract(t.iva()));
    dte.tipoModelo = (short) (ev == null ? 1 : 2); dte.ambiente = cfg.ambiente;
    dte.json = json; dte.firma = DteBuilder.firmar(json, om); dte.estado = "CONTINGENCIA";
    dte.relacionadoId = relacionado == null ? null : relacionado.id;

    if (ev == null) {
      try {
        aplicarRespuesta(dte, mh.transmitir(cfg, dte.id, null));
      } catch (SimuladorMH.MHNoDisponible e) {
        dte.intentos = 1;
        dte.ultimoIntento = Instant.now();
        ev = eventoActivoOCrear(1, null);
        registrar(dte.id, "ERROR_ENVIO", null, e.getMessage(), null);
      }
    }
    if ("CONTINGENCIA".equals(dte.estado)) {
      dte.eventoContingenciaId = ev.id;
      registrar(dte.id, "CONTINGENCIA", null, "Emitido en modelo diferido; pendiente de transmisión", null);
    }
    dtes.save(dte);
    return dte;
  }

  @SuppressWarnings("unchecked")
  private void aplicarRespuesta(Dte dte, Map<String, Object> resp) {
    dte.intentos++;
    dte.ultimoIntento = Instant.now();
    dte.respuesta = resp;
    if ("PROCESADO".equals(resp.get("estado"))) {
      dte.estado = "PROCESADO";
      dte.selloRecibido = (String) resp.get("selloRecibido");
      dte.fhProcesamiento = (String) resp.get("fhProcesamiento");
    } else dte.estado = "RECHAZADO";
    registrar(dte.id, "RESPUESTA", (String) resp.get("codigoMsg"), (String) resp.get("descripcionMsg"), resp);
  }

  private void registrar(UUID id, String evento, String codigo, String descripcion, Map<String, Object> resp) {
    DteBitacora b = new DteBitacora();
    b.codigoGeneracion = id; b.evento = evento; b.codigoMsg = codigo; b.descripcion = descripcion; b.respuestaMh = resp;
    dteBitacora.save(b);
  }

  // ======================================================================= Consultas
  public List<Dte> listar() {
    List<Dte> lista = dtes.findAllByOrderByCreadoDesc();
    Map<UUID, List<UUID>> ncs = new HashMap<>();
    lista.stream().filter(d -> d.relacionadoId != null).forEach(d -> ncs.computeIfAbsent(d.relacionadoId, k -> new ArrayList<>()).add(d.id));
    lista.forEach(d -> d.notasCredito = ncs.getOrDefault(d.id, List.of()));
    return lista;
  }

  public Dte obtener(UUID id) {
    Dte d = dtes.findById(id).orElseThrow(() -> ApiException.noEncontrado("Documento"));
    d.notasCredito = dtes.findByRelacionadoId(id).stream().map(x -> x.id).toList();
    return d;
  }

  public List<DteBitacora> bitacoraDte(UUID id) { return dteBitacora.findByCodigoGeneracionOrderByFechaAsc(id); }

  public List<Venta> ventas() { return ventas.findAllByOrderByFechaDesc(); }

  // ======================================================================= Operaciones sobre DTE
  @Transactional
  public Dte retransmitir(UUID id) {
    Dte d = obtener(id);
    if (!"RECHAZADO".equals(d.estado) && !"CONTINGENCIA".equals(d.estado)) throw ApiException.invalido("Solo se retransmiten documentos rechazados o en contingencia");
    Configuracion cfg = config.obtener();
    try {
      aplicarRespuesta(d, mh.transmitir(cfg, id, false));
      bitacora.log("dte", "Retransmisión exitosa", d.numeroControl + " · sello " + d.selloRecibido.substring(0, 12) + "…", "ok");
    } catch (SimuladorMH.MHNoDisponible e) {
      d.intentos++;
      d.ultimoIntento = Instant.now();
      registrar(id, "ERROR_ENVIO", null, e.getMessage(), null);
      bitacora.log("dte", "Retransmisión fallida", d.numeroControl + ": MH no disponible", "error");
    }
    return dtes.save(d);
  }

  @Transactional
  public Dte invalidar(UUID id, int tipo, String motivo) {
    Dte d = obtener(id);
    if (!"PROCESADO".equals(d.estado)) throw ApiException.invalido("Solo se pueden invalidar documentos procesados por el MH");
    Configuracion cfg = config.obtener();
    if (!cfg.mhEnLinea) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "La invalidación requiere conexión con el Ministerio de Hacienda");
    if (tipo < 1 || tipo > 3) throw ApiException.invalido("Tipo de invalidación inválido (CAT-024)");
    if (tipo == 3 && (motivo == null || motivo.trim().length() < 5)) throw ApiException.invalido("El motivo es obligatorio para el tipo 3");
    if (dtes.findByRelacionadoId(id).stream().anyMatch(x -> !"INVALIDADO".equals(x.estado)))
      throw ApiException.conflicto("El documento tiene notas de crédito vigentes; invalídelas primero");
    Usuario u = usuarios.findById(Permisos.actual().id()).orElseThrow();
    Cliente c = d.clienteId == null ? null : clientes.findById(d.clienteId).orElse(null);
    UUID codigo = UUID.randomUUID();
    Map<String, Object> json = DteBuilder.invalidacion(d, cfg, c, tipo, motivo, u, codigo);
    Map<String, Object> resp = mh.transmitir(cfg, codigo, false);
    String motivoFinal = motivo == null || motivo.isBlank() ? (tipo == 1 ? "Error en la información del DTE" : tipo == 2 ? "Rescindir de la operación realizada" : "Otro") : motivo.trim();
    d.estado = "INVALIDADO";
    d.invalidacion = Fiscal.m("fecha", Instant.now().toString(), "tipoAnulacion", tipo, "motivo", motivoFinal, "responsable", u.nombre, "json", json, "selloRecibido", resp.get("selloRecibido"));
    dtes.save(d);
    registrar(id, "INVALIDACION", (String) resp.get("codigoMsg"), motivoFinal, resp);
    // Devuelve el stock al inventario
    if (d.ventaId != null) ventas.findById(d.ventaId).ifPresent(v -> devolverStock(v.items, "Invalidación " + d.numeroControl.substring(d.numeroControl.length() - 6)));
    bitacora.log("dte", "Documento invalidado", d.numeroControl + " · " + motivoFinal, "warn");
    return d;
  }

  private void devolverStock(List<ItemVenta> items, String referencia) {
    Map<UUID, Producto> ps = productos.bloquear(items.stream().map(i -> i.productoId).toList()).stream().collect(Collectors.toMap(p -> p.id, p -> p));
    for (ItemVenta it : items) {
      Producto p = ps.get(it.productoId);
      p.stock += it.cantidad;
      productos.save(p);
      inventario.movimiento(p, "DEVOLUCION", it.cantidad, p.stock, p.costo, referencia, null);
    }
  }

  @SuppressWarnings("unchecked")
  @Transactional
  public Resultado notaCredito(UUID id, List<ItemSolicitud> solicitud) {
    Dte original = obtener(id);
    List<String> e = new ArrayList<>();
    if (!"03".equals(original.tipoDte)) e.add("La nota de crédito solo puede relacionarse a un Comprobante de Crédito Fiscal");
    if (!"PROCESADO".equals(original.estado)) e.add("El documento relacionado debe estar procesado por el MH");
    Venta v = original.ventaId == null ? null : ventas.findById(original.ventaId).orElse(null);
    if (v == null) e.add("El documento no tiene una venta asociada");
    if (solicitud == null || solicitud.isEmpty()) e.add("Seleccione al menos un producto a devolver");
    if (!e.isEmpty()) throw ApiException.invalido("No se pudo emitir la nota de crédito", e);

    // Cantidades ya devueltas por notas de crédito vigentes
    Map<String, Integer> devuelto = new HashMap<>();
    for (Dte nc : dtes.findByRelacionadoId(id)) {
      if ("INVALIDADO".equals(nc.estado)) continue;
      for (Map<String, Object> l : (List<Map<String, Object>>) nc.json.get("cuerpoDocumento"))
        devuelto.merge((String) l.get("codigo"), ((Number) l.get("cantidad")).intValue(), Integer::sum);
    }
    List<ItemVenta> items = new ArrayList<>();
    for (ItemSolicitud s : solicitud) {
      if (s.cantidad() <= 0) continue;
      ItemVenta vendido = v.items.stream().filter(i -> i.productoId.equals(s.productoId())).findFirst()
          .orElseThrow(() -> ApiException.invalido("El producto no pertenece al documento original"));
      int max = vendido.cantidad - devuelto.getOrDefault(vendido.sku, 0);
      if (s.cantidad() > max) throw ApiException.invalido("La cantidad a devolver de " + vendido.nombre + " supera lo disponible (" + max + ")");
      items.add(new ItemVenta(vendido.productoId, vendido.sku, vendido.nombre, s.cantidad(), vendido.precio));
    }
    if (items.isEmpty()) throw ApiException.invalido("Seleccione al menos un producto a devolver");
    Cliente c = clientes.findById(original.clienteId).orElseThrow();
    errores(DteBuilder.validar("05", c, items));
    Usuario u = usuarios.findById(Permisos.actual().id()).orElseThrow();
    Dte nc = generarYTransmitir("05", config.obtener(), items, BigDecimal.ZERO, c, null, u, original, Instant.now());
    devolverStock(items, "NC " + nc.numeroControl.substring(nc.numeroControl.length() - 6));
    bitacora.log("dte", "Nota de crédito emitida", nc.numeroControl + " relacionada a " + original.numeroControl + " · stock devuelto", "ok");
    return new Resultado(true, nc, null);
  }

  private static void errores(List<String> e) { if (!e.isEmpty()) throw ApiException.invalido("Documento inválido", e); }

  @Transactional
  public Dte enviarCorreo(UUID id, String para) {
    if (!Fiscal.validarCorreo(para)) throw ApiException.invalido("Correo inválido");
    Dte d = obtener(id);
    CorreoSimulado m = new CorreoSimulado();
    m.para = para;
    m.asunto = DteBuilder.TIPOS.get(d.tipoDte).nombre() + " electrónica · " + d.numeroControl;
    m.cuerpo = "Adjuntamos su documento tributario electrónico emitido por " + config.obtener().emisor("nombre") + ". Código de generación: "
        + d.id.toString().toUpperCase() + ". " + (d.selloRecibido != null ? "Sello de recepción: " + d.selloRecibido + "."
        : "Documento emitido en contingencia; el sello se asignará al restablecerse el servicio.");
    m.adjuntosCsv = d.id.toString().toUpperCase() + ".pdf," + d.id.toString().toUpperCase() + ".json";
    correos.save(m);
    d.correoEnviado = para;
    bitacora.log("dte", "Comprobante enviado por correo", d.numeroControl + " → " + para, "ok");
    return dtes.save(d);
  }

  // ======================================================================= Contingencia
  private int intervalo(Configuracion c) { return c.modoDemo ? 20 : 300; }

  private EventoContingencia eventoActivoOCrear(int tipo, String motivo) {
    return eventos.findFirstByEstado("ACTIVO").orElseGet(() -> {
      EventoContingencia ev = new EventoContingencia();
      ev.id = UUID.randomUUID(); ev.fInicio = Instant.now(); ev.tipoContingencia = (short) tipo; ev.motivo = motivo; ev.estado = "ACTIVO";
      UsuarioAutenticado u = Permisos.actualONulo();
      ev.usuarioId = u == null ? null : u.id();
      eventos.save(ev);
      Configuracion c = configRepo.findById((short) 1).orElseThrow();
      c.mhEnLinea = false;
      c.proximoReintento = Instant.now().plusSeconds(intervalo(c));
      configRepo.save(c);
      bitacora.log("contingencia", "Contingencia activada", "Tipo " + tipo + ": los DTE se emitirán en modelo diferido", "warn");
      return ev;
    });
  }

  public List<EventoContingencia> eventos() {
    List<EventoContingencia> l = eventos.todos();
    l.forEach(e -> e.dtes = dtes.findByEventoContingenciaId(e.id).stream().map(x -> x.id).toList());
    return l;
  }

  public Map<String, Object> estadoContingencia() {
    return Fiscal.m("config", config.obtener(), "eventos", eventos(), "pendientes", dtes.countByEstado("CONTINGENCIA"));
  }

  @Transactional
  public Map<String, Object> cambiarEstadoMH(boolean enLinea, Integer tipo, String motivo) {
    Configuracion c = configRepo.findById((short) 1).orElseThrow();
    if (!enLinea) {
      int t = tipo == null ? 1 : tipo;
      if (t < 1 || t > 5) throw ApiException.invalido("Tipo de contingencia inválido (CAT-005)");
      if (t == 5 && (motivo == null || motivo.trim().length() < 5)) throw ApiException.invalido("El motivo es obligatorio para el tipo 5");
      eventoActivoOCrear(t, motivo == null || motivo.isBlank() ? null : motivo.trim());
    } else if (!c.mhEnLinea) {
      c.mhEnLinea = true;
      c.proximoReintento = Instant.now().plusSeconds(3);
      configRepo.save(c);
      eventos.findFirstByEstado("ACTIVO").ifPresent(ev -> { ev.estado = "PENDIENTE_ENVIO"; ev.fFin = Instant.now(); eventos.save(ev); });
      bitacora.log("contingencia", "Servicio MH restablecido", "Se programó la transmisión del evento de contingencia y lotes pendientes", "ok");
    }
    return estadoContingencia();
  }

  public record ResultadoReintento(int transmitidos, boolean fallo) {}

  /** Reintento de transmisión: evento de contingencia + lote de DTE pendientes (cron cada 5 min; 20 s en modo demo) */
  public ResultadoReintento reintentar(boolean manual) {
    if (!reintentando.compareAndSet(false, true)) return new ResultadoReintento(0, false);
    try {
      Configuracion c = config.obtener();
      long pendientes = dtes.countByEstado("CONTINGENCIA");
      List<EventoContingencia> abiertos = eventos.findByEstadoNot("TRANSMITIDO");
      if (pendientes == 0 && abiertos.stream().noneMatch(e -> "PENDIENTE_ENVIO".equals(e.estado))) {
        tx.executeWithoutResult(s -> { Configuracion x = configRepo.findById((short) 1).orElseThrow(); x.proximoReintento = null; configRepo.save(x); });
        return new ResultadoReintento(0, false);
      }
      if (!c.mhEnLinea) {
        tx.executeWithoutResult(s -> {
          Configuracion x = configRepo.findById((short) 1).orElseThrow();
          x.proximoReintento = Instant.now().plusSeconds(intervalo(x));
          configRepo.save(x);
          for (Dte d : dtes.findByEstadoOrderByCreadoAsc("CONTINGENCIA")) {
            d.intentos++; d.ultimoIntento = Instant.now(); dtes.save(d);
            registrar(d.id, "REINTENTO", null, "MH sin respuesta", null);
          }
          bitacora.log("contingencia", manual ? "Reintento manual fallido" : "Reintento automático (cron)", "MH sin respuesta · " + pendientes + " DTE en cola", "error");
        });
        return new ResultadoReintento(0, true);
      }
      // 1) Evento de contingencia
      for (EventoContingencia ev : abiertos) {
        tx.executeWithoutResult(s -> {
          EventoContingencia e = eventos.findById(ev.id).orElseThrow();
          List<Dte> asociados = dtes.findByEventoContingenciaId(e.id);
          if (e.fFin == null) e.fFin = Instant.now();
          Usuario resp = e.usuarioId != null ? usuarios.findById(e.usuarioId).orElse(null) : null;
          if (resp == null) resp = usuarios.findAll().stream().filter(u -> "gerente".equals(u.rolId)).findFirst().orElseThrow();
          e.json = DteBuilder.eventoContingencia(e, c, asociados, resp);
          Map<String, Object> r = mh.transmitir(c, e.id, false);
          e.selloRecibido = (String) r.get("selloRecibido");
          e.estado = "TRANSMITIDO";
          eventos.save(e);
          bitacora.log("contingencia", "Evento de contingencia transmitido",
              e.id.toString().substring(0, 8) + " · " + asociados.size() + " DTE · sello " + e.selloRecibido.substring(0, 10) + "…", "ok");
        });
      }
      // 2) Lote de DTE
      int transmitidos = 0;
      for (Dte p : dtes.findByEstadoOrderByCreadoAsc("CONTINGENCIA")) {
        tx.executeWithoutResult(s -> {
          Dte d = dtes.findById(p.id).orElseThrow();
          aplicarRespuesta(d, mh.transmitir(c, d.id, false));
          dtes.save(d);
        });
        transmitidos++;
      }
      tx.executeWithoutResult(s -> { Configuracion x = configRepo.findById((short) 1).orElseThrow(); x.proximoReintento = null; configRepo.save(x); });
      if (transmitidos > 0) bitacora.log("contingencia", "Lote transmitido", transmitidos + " DTE recibieron sello de recepción", "ok");
      return new ResultadoReintento(transmitidos, false);
    } catch (SimuladorMH.MHNoDisponible e) {
      return new ResultadoReintento(0, true);
    } finally {
      reintentando.set(false);
    }
  }

  @Scheduled(fixedDelay = 1000, initialDelay = 5000)
  public void cron() {
    try {
      Configuracion c = configRepo.findById((short) 1).orElse(null);
      if (c != null && c.proximoReintento != null && !Instant.now().isBefore(c.proximoReintento)) {
        ResultadoReintento r = reintentar(false);
        if (r.transmitidos() > 0) log.info("Contingencia resuelta: {} DTE transmitidos", r.transmitidos());
      }
    } catch (Exception e) {
      log.warn("Fallo en el cron de contingencia: {}", e.getMessage());
    }
  }

  @Transactional
  public CorreoSimulado marcarLeido(UUID id) {
    CorreoSimulado m = correos.findById(id).orElseThrow(() -> ApiException.noEncontrado("Correo"));
    m.leido = true;
    return correos.save(m);
  }

  public List<CorreoSimulado> correos() { return correos.findAllByOrderByFechaDesc(); }

  public LocalDate hoy() { return LocalDate.now(Fiscal.SV); }
}
