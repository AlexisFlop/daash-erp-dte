package sv.daash.erp.repo;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import sv.daash.erp.dominio.*;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;

public interface ProductoRepo extends JpaRepository<Producto, UUID> {
  List<Producto> findAllByOrderByCategoriaIdAscNombreAsc();
  Optional<Producto> findBySku(String sku);
  @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from Producto p where p.id in :ids") List<Producto> bloquear(@Param("ids") Collection<UUID> ids);
}
