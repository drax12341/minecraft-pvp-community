package community.pvp.arena;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.function.*;

import org.bukkit.*;
import org.bukkit.scheduler.BukkitRunnable;

/**
 * One native async chunk request at a time; never compete with an active fight.
 */
final class MapWarmup {
    record ChunkPos(int x, int z) {
    }

    final CommunityArena p;
    final ArrayDeque<ChunkPos> pending = new ArrayDeque<>();
    final int total;
    int completed, failures;
    boolean loading, done;
    Function<ChunkPos, CompletableFuture<Chunk>> loader;
    Consumer<ChunkPos> unloader;

    static List<ChunkPos> plan() {
        List<ChunkPos> result = new ArrayList<>();
        for (int size = 0; size < 3; size++)
            for (var map : BattleMaps.all())
                if (map.size() == size) {
                    List<ChunkPos> area = new ArrayList<>();
                    for (int x = (map.cx() - map.width() / 2) >> 4; x <= ((map.cx() + map.width() / 2 - 1) >> 4); x++)
                        for (int z = (1024 - map.length() / 2) >> 4; z <= ((1024 + map.length() / 2 - 1) >> 4); z++)
                            area.add(new ChunkPos(x, z));
                    area.sort(Comparator.comparingInt(c -> Math.abs(c.x * 16 - map.cx()) + Math.abs(c.z * 16 - 1024)));
                    result.addAll(area);
                }
        return List.copyOf(result);
    }

    MapWarmup(CommunityArena p) {
        this.p = p;
        var plan = plan();
        total = plan.size();
        if (p.data.getBoolean("maps-v6-prewarmed")) {
            completed = total;
            done = true;
        } else pending.addAll(plan);
        loader = pos -> p.world.getChunkAtAsync(pos.x, pos.z, true);
        unloader = pos -> p.world.unloadChunkRequest(pos.x, pos.z);
    }

    void failed(ChunkPos pos, Throwable error) {
        loading = false;
        failures++;
        p.getLogger().warning("Map prewarm failed at " + pos + ": " + error.getClass().getSimpleName());
    }

    void step() {
        if (done || loading || !p.ffa.isEmpty() || !p.matches.isEmpty() || !p.bots.sessions.isEmpty() || !p.partyBattles.sessions.isEmpty())
            return;
        if (pending.isEmpty()) {
            done = true;
            p.data.set("maps-v6-prewarmed", failures == 0);
            p.save();
            p.getLogger().info("Map prewarm finished: " + completed + "/" + total + " chunks, failures=" + failures);
            return;
        }
        ChunkPos pos = pending.removeFirst();
        loading = true;
        try {
            loader.apply(pos).whenComplete((chunk, error) -> {
                if (!p.isEnabled()) return;
                Bukkit.getScheduler().runTask(p, () -> {
                    if (error != null) {
                        failed(pos, error);
                        return;
                    }
                    loading = false;
                    completed++;
                    unloader.accept(pos);
                    if (completed % 200 == 0) p.getLogger().info("Map prewarm " + completed + "/" + total + " chunks");
                });
            });
        } catch (RuntimeException error) {
            failed(pos, error);
        }
    }

    void start() {
        if (done || !p.getConfig().getBoolean("maps.prewarm", true) || !(p.world.getGenerator() instanceof BattleGenerator))
            return;
        new BukkitRunnable() {
            public void run() {
                step();
                if (done) cancel();
            }
        }.runTaskTimer(p, 40, 2);
    }
}
