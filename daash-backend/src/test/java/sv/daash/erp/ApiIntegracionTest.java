package sv.daash.erp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Pruebas de integración de la API contra PostgreSQL 16 real (Testcontainers) con migraciones Flyway y datos demo */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("API REST + seguridad + PostgreSQL")
class ApiIntegracionTest {

  @Container @ServiceConnection
  static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine").withDatabaseName("daash").withUsername("postgres").withPassword("demo");

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper om;
  @Autowired JdbcTemplate jdbc;

  static String gerente, cajero;

  JsonNode json(MvcResult r) throws Exception { return om.readTree(r.getResponse().getContentAsString()); }

  String login(String correo, String pw) throws Exception {
    return json(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsString(Map.of("correo", correo, "password", pw))))
        .andExpect(status().isOk()).andReturn()).get("token").asText();
  }

  @BeforeEach
  void preparar() throws Exception {
    jdbc.update("update daash.configuracion set latencia_ms = 0");
    if (gerente == null) { gerente = login("gerente@adventureworks.com.sv", "Gerente123*"); cajero = login("cajero@adventureworks.com.sv", "Cajero123*"); }
  }

  @Test @Order(1) @DisplayName("Login con credenciales incorrectas responde 401 y no emite token")
  void loginIncorrecto() throws Exception {
    mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"correo\":\"auditor@adventureworks.com.sv\",\"password\":\"mala\"}"))
        .andExpect(status().isUnauthorized());
  }

  @Test @Order(2) @DisplayName("Bloqueo de cuenta tras 5 intentos fallidos (CA-04)")
  void bloqueo() throws Exception {
    for (int i = 0; i < 5; i++)
      mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"correo\":\"bodega@adventureworks.com.sv\",\"password\":\"x\"}"));
    MvcResult r = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"correo\":\"bodega@adventureworks.com.sv\",\"password\":\"Bodega123*\"}"))
        .andExpect(status().isUnauthorized()).andReturn();
    assertTrue(json(r).get("mensaje").asText().contains("bloqueada"));
  }

  @Test @Order(3) @DisplayName("Token JWT con rol alterado es rechazado (CA-02)")
  void tokenAlterado() throws Exception {
    String[] p = cajero.split("\\.");
    String payload = new String(java.util.Base64.getUrlDecoder().decode(p[1])).replace("\"cajero\"", "\"gerente\"");
    String falso = p[0] + "." + java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes()) + "." + p[2];
    mvc.perform(get("/api/usuarios").header("Authorization", "Bearer " + falso)).andExpect(status().isUnauthorized());
  }

  @Test @Order(4) @DisplayName("RBAC: el cajero no accede a usuarios (403) pero sí al catálogo")
  void permisos() throws Exception {
    mvc.perform(get("/api/usuarios").header("Authorization", "Bearer " + cajero)).andExpect(status().isForbidden());
    mvc.perform(get("/api/productos").header("Authorization", "Bearer " + cajero)).andExpect(status().isOk());
    mvc.perform(get("/api/productos")).andExpect(status().isUnauthorized());
  }

  @Test @Order(5) @DisplayName("Venta: precio manipulado se ignora (CA-05), DTE procesado y stock descontado")
  void venta() throws Exception {
    mvc.perform(post("/api/turnos/abrir").header("Authorization", "Bearer " + cajero).contentType(MediaType.APPLICATION_JSON).content("{\"fondoInicial\":100}"))
        .andExpect(status().isOk());
    String id = jdbc.queryForObject("select id::text from daash.producto where sku = 'BK-M68B-38'", String.class);
    int stock = jdbc.queryForObject("select stock from daash.producto where sku = 'BK-M68B-38'", Integer.class);
    String cuerpo = "{\"items\":[{\"productoId\":\"" + id + "\",\"cantidad\":1,\"precio\":0.01}],\"tipoDte\":\"01\",\"metodoPago\":\"TARJETA\"}";
    JsonNode r = json(mvc.perform(post("/api/ventas").header("Authorization", "Bearer " + cajero).contentType(MediaType.APPLICATION_JSON).content(cuerpo))
        .andExpect(status().isOk()).andReturn());
    assertEquals("PROCESADO", r.at("/dte/estado").asText());
    assertEquals(1299.50, r.at("/dte/total").asDouble(), 0.001);
    assertEquals(40, r.at("/dte/selloRecibido").asText().length());
    assertEquals(stock - 1, jdbc.queryForObject("select stock from daash.producto where sku = 'BK-M68B-38'", Integer.class));
    assertEquals(1, jdbc.queryForObject("select count(*) from daash.kardex where tipo = 'SALIDA' and referencia like 'FAC%' and fecha > now() - interval '1 minute'", Integer.class));
  }

  @Test @Order(6) @DisplayName("Contingencia: DTE diferido y transmisión al restablecer el servicio (RF-14)")
  void contingencia() throws Exception {
    mvc.perform(post("/api/contingencia/mh").header("Authorization", "Bearer " + gerente).contentType(MediaType.APPLICATION_JSON).content("{\"enLinea\":false,\"tipo\":1}"))
        .andExpect(status().isOk());
    String id = jdbc.queryForObject("select id::text from daash.producto where sku = 'HL-U509'", String.class);
    JsonNode r = json(mvc.perform(post("/api/ventas").header("Authorization", "Bearer " + cajero).contentType(MediaType.APPLICATION_JSON)
        .content("{\"items\":[{\"productoId\":\"" + id + "\",\"cantidad\":1}],\"tipoDte\":\"01\",\"metodoPago\":\"EFECTIVO\"}")).andExpect(status().isOk()).andReturn());
    assertEquals("CONTINGENCIA", r.at("/dte/estado").asText());
    assertEquals(2, r.at("/dte/json/identificacion/tipoModelo").asInt());
    mvc.perform(post("/api/contingencia/mh").header("Authorization", "Bearer " + gerente).contentType(MediaType.APPLICATION_JSON).content("{\"enLinea\":true}"));
    JsonNode re = json(mvc.perform(post("/api/contingencia/reintentar").header("Authorization", "Bearer " + gerente)).andExpect(status().isOk()).andReturn());
    assertTrue(re.get("transmitidos").asInt() >= 1);
    assertEquals("PROCESADO", jdbc.queryForObject("select estado from daash.dte_encabezado where codigo_generacion = ?::uuid", String.class, r.at("/dte/id").asText()));
    assertEquals("TRANSMITIDO", jdbc.queryForObject("select estado from daash.evento_contingencia order by f_inicio desc limit 1", String.class));
  }

  @Test @Order(7) @DisplayName("La base de datos impide modificar el Kardex (registro inmutable)")
  void kardexInmutable() {
    Exception e = assertThrows(Exception.class, () -> jdbc.update("update daash.kardex set cantidad = 99 where id = (select min(id) from daash.kardex)"));
    assertTrue(e.getMessage().contains("solo inserción"));
  }

  @Test @Order(8) @DisplayName("Las contraseñas se almacenan con BCrypt")
  void bcrypt() {
    assertTrue(jdbc.queryForObject("select password_hash from daash.usuario limit 1", String.class).startsWith("$2a$10$"));
  }
}
