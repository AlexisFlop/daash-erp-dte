package sv.daash.erp.repo;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import sv.daash.erp.dominio.*;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;

public interface BitacoraRepo extends JpaRepository<Bitacora, Long> {
  List<Bitacora> findTop1500ByOrderByFechaDescIdDesc();
}
