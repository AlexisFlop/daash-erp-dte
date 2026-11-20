package sv.daash.erp.repo;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import sv.daash.erp.dominio.*;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;

public interface ResetTokenRepo extends JpaRepository<ResetToken, String> {
  @Modifying @Query("update ResetToken t set t.usado = true where t.usuarioId = :u and t.usado = false") void invalidarDeUsuario(@Param("u") UUID u);
}
