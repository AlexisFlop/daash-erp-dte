package sv.daash.erp.repo;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import sv.daash.erp.dominio.*;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;

public interface TurnoRepo extends JpaRepository<Turno, UUID> {
  Optional<Turno> findFirstByUsuarioIdAndEstado(UUID usuarioId, String estado);
  List<Turno> findAllByOrderByAperturaDesc();
}
