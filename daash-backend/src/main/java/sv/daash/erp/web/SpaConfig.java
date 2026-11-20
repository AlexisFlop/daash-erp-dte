package sv.daash.erp.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Publica el frontend React compilado (classpath:/static) desde el mismo servidor.
 * Las rutas de la SPA que no corresponden a un archivo devuelven index.html; /api queda reservado a la API REST.
 */
@Configuration
public class SpaConfig implements WebMvcConfigurer {
  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    registry.addResourceHandler("/**").addResourceLocations("classpath:/static/").resourceChain(true)
        .addResolver(new PathResourceResolver() {
          @Override
          protected Resource getResource(String ruta, Resource ubicacion) throws IOException {
            Resource r = ubicacion.createRelative(ruta);
            if (r.exists() && r.isReadable()) return r;
            if (ruta.startsWith("api/") || ruta.startsWith("actuator/")) return null;
            Resource index = new ClassPathResource("/static/index.html");
            return index.exists() ? index : null;
          }
        });
  }
}
