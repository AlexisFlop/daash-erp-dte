package sv.daash.erp.fiscal;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/** Utilidades fiscales de El Salvador: redondeo, validación de documentos, valor en letras y sellos. */
public final class Fiscal {
  private Fiscal() {}

  public static final ZoneId SV = ZoneId.of("America/El_Salvador");
  public static final BigDecimal IVA = new BigDecimal("0.13");
  public static final BigDecimal UNO_IVA = new BigDecimal("1.13");
  private static final SecureRandom RND = new SecureRandom();
  private static final Pattern DUI = Pattern.compile("^\\d{8}-\\d$");
  private static final Pattern NIT = Pattern.compile("^\\d{4}-\\d{6}-\\d{3}-\\d$");
  private static final Pattern NRC = Pattern.compile("^\\d{1,6}-\\d$");
  private static final Pattern CORREO = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

  public static BigDecimal r2(BigDecimal v) { return v.setScale(2, RoundingMode.HALF_UP); }
  public static BigDecimal bd(double v) { return BigDecimal.valueOf(v); }

  /** Mapa ordenado que admite nulos: m("a", 1, "b", null) */
  public static Map<String, Object> m(Object... kv) {
    Map<String, Object> r = new LinkedHashMap<>();
    for (int i = 0; i < kv.length; i += 2) r.put((String) kv[i], kv[i + 1]);
    return r;
  }

  // ---------- Validaciones (RF-16) ----------
  public static boolean validarDUI(String dui) {
    if (dui == null || !DUI.matcher(dui).matches()) return false;
    String d = dui.replace("-", "");
    int suma = 0;
    for (int i = 0; i < 8; i++) suma += (d.charAt(i) - '0') * (9 - i);
    return (10 - (suma % 10)) % 10 == d.charAt(8) - '0';
  }
  public static boolean validarNIT(String nit) { return nit != null && (NIT.matcher(nit).matches() || validarDUI(nit)); }
  public static boolean validarNRC(String nrc) { return nrc != null && NRC.matcher(nrc).matches(); }
  public static boolean validarCorreo(String c) { return c != null && CORREO.matcher(c).matches(); }

  // ---------- Fechas en formato MH ----------
  public static String fechaISO(Instant t) { return LocalDateTime.ofInstant(t, SV).format(DateTimeFormatter.ISO_LOCAL_DATE); }
  public static String horaISO(Instant t) { return LocalDateTime.ofInstant(t, SV).format(DateTimeFormatter.ofPattern("HH:mm:ss")); }
  public static String fhMH(Instant t) { return LocalDateTime.ofInstant(t, SV).format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")); }

  /** Sello de recepción simulado: 40 caracteres que inician con el año */
  public static String generarSello(Instant t) {
    String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    StringBuilder s = new StringBuilder(String.valueOf(LocalDateTime.ofInstant(t, SV).getYear()));
    for (int i = 0; i < 36; i++) s.append(chars.charAt(RND.nextInt(chars.length())));
    return s.toString();
  }

  // ---------- Número a letras (totalLetras) ----------
  private static final String[] U = {"", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"};
  private static final String[] D = {"", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"};
  private static final String[] C = {"", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"};

  private static String centenas(int n) {
    if (n == 0) return "";
    if (n == 100) return "CIEN";
    int c = n / 100, r = n % 100;
    String s = C[c];
    if (r > 0) {
      s += s.isEmpty() ? "" : " ";
      s += r < 30 ? U[r] : D[r / 10] + (r % 10 > 0 ? " Y " + U[r % 10] : "");
    }
    return s;
  }

  public static String numeroALetras(BigDecimal monto) {
    BigDecimal m = r2(monto);
    long entero = m.longValue();
    int cent = m.subtract(BigDecimal.valueOf(entero)).movePointRight(2).intValue();
    int millones = (int) (entero / 1_000_000), miles = (int) ((entero % 1_000_000) / 1000), resto = (int) (entero % 1000);
    StringBuilder s = new StringBuilder();
    if (millones > 0) s.append(millones == 1 ? "UN MILLÓN " : centenas(millones) + " MILLONES ");
    if (miles > 0) s.append(miles == 1 ? "MIL " : centenas(miles).replaceAll("UNO$", "UN") + " MIL ");
    if (resto > 0) s.append(centenas(resto));
    String t = s.toString().trim();
    if (t.isEmpty()) t = "CERO";
    return t.replaceAll("UNO$", "UN") + " " + String.format("%02d", cent) + "/100 USD";
  }
}
