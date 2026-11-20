package sv.daash.erp.repo;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import sv.daash.erp.dominio.*;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;

public interface EventoRepo extends JpaRepository<EventoContingencia, UUID> {
  Optional<EventoContingencia> findFirstByEstado(String estado);
  List<EventoContingencia> findByEstadoNot(String estado);
  @Query("select e from EventoContingencia e order by e.fInicio desc") List<EventoContingencia> todos();
}
