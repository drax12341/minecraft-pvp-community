package community.pvp.arena;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.YamlConfiguration;
import org.yaml.snakeyaml.*;
import org.yaml.snakeyaml.constructor.SafeConstructor;

/**
 * Validate saved world references before Bukkit can silently drop an invalid serialized Location.
 */
final class ArenaStorage {
  static YamlConfiguration load(File file) throws Exception {
    YamlConfiguration data = new YamlConfiguration();
    if (!file.exists()) return data;
    String source = Files.readString(file.toPath(), StandardCharsets.UTF_8);
    LoaderOptions limits = new LoaderOptions();
    limits.setCodePointLimit(20_000_000);
    Object raw = new Yaml(new SafeConstructor(limits)).load(source);
    validate(raw, 0);
    data.loadFromString(source);
    return data;
  }

  static void validate(Object raw, int depth) throws IOException {
    if (depth > 64) throw new IOException("Player data nesting is too deep");
    if (raw instanceof Map<?, ?> map) {
      Object type = map.get("==");
      if ("org.bukkit.Location".equals(type) || "Location".equals(type)) {
        Object world = map.get("world");
        if (!(world instanceof String name) || Bukkit.getWorld(name) == null)
          throw new IOException(
              "A saved location references an unloaded world. Load that world before"
                  + " CommunityArena; player data was preserved.");
      }
      for (Object value : map.values()) validate(value, depth + 1);
    } else if (raw instanceof List<?> list) for (Object value : list) validate(value, depth + 1);
  }
}
