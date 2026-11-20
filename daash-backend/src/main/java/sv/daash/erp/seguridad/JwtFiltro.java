package sv.daash.erp.seguridad;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import sv.daash.erp.repo.UsuarioRepo;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Component
public class JwtFiltro extends OncePerRequestFilter {
  private final JwtServicio jwt;
  private final UsuarioRepo usuarios;

  public JwtFiltro(JwtServicio jwt, UsuarioRepo usuarios) { this.jwt = jwt; this.usuarios = usuarios; }

  @Override
  protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
    String h = req.getHeader("Authorization");
    if (h != null && h.startsWith("Bearer ")) {
      try {
        Claims c = jwt.verificar(h.substring(7));
        UUID id = UUID.fromString(c.getSubject());
        // El rol se toma de la base de datos: un usuario dado de baja o con rol cambiado pierde el acceso de inmediato
        usuarios.findById(id).filter(u -> u.activo && u.rolId.equals(c.get("rol", String.class))).ifPresent(u -> {
          var auth = new UsernamePasswordAuthenticationToken(new UsuarioAutenticado(u.id, u.nombre, u.rolId), null,
              List.of(new SimpleGrantedAuthority("ROLE_" + u.rolId.toUpperCase())));
          SecurityContextHolder.getContext().setAuthentication(auth);
        });
      } catch (JwtException | IllegalArgumentException ignorado) {
        // Token inválido, alterado o expirado: la solicitud continúa como anónima y será rechazada con 401
      }
    }
    chain.doFilter(req, res);
  }
}
