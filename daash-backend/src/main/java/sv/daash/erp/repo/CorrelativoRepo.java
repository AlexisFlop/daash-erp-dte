package sv.daash.erp.repo;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import sv.daash.erp.dominio.*;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;

public interface CorrelativoRepo extends JpaRepository<Correlativo, String> {
  @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select c from Correlativo c where c.tipoDte = :t") Optional<Correlativo> bloquear(@Param("t") String t);
}
