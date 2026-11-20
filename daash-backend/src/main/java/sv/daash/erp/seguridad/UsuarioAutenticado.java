package sv.daash.erp.seguridad;

import java.util.UUID;

/** Principal de Spring Security: identidad tomada del token y rol verificado contra la base de datos */
public record UsuarioAutenticado(UUID id, String nombre, String rolId) {}
