package sv.daash.erp.repo;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import sv.daash.erp.dominio.*;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;

public interface DteRepo extends JpaRepository<Dte, UUID> {
  List<Dte> findAllByOrderByCreadoDesc();
  List<Dte> findByEstadoOrderByCreadoAsc(String estado);
  List<Dte> findByRelacionadoId(UUID id);
  List<Dte> findByEventoContingenciaId(UUID id);
  long countByEstado(String estado);
}
