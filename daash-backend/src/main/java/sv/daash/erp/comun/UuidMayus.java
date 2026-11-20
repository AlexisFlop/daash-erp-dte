package sv.daash.erp.comun;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;
import java.io.IOException;
import java.util.UUID;

/** Los códigos de generación del MH se representan como UUID en mayúsculas */
public class UuidMayus extends StdSerializer<UUID> {
  public UuidMayus() { super(UUID.class); }
  @Override
  public void serialize(UUID v, JsonGenerator g, SerializerProvider p) throws IOException { g.writeString(v.toString().toUpperCase()); }
}
