package community.pvp.arena;

/** Paper's documented attribute-swap switch is server-wide and must apply before a fight. */
final class CombatCompatibility {
    static String status = "Native Paper defaults";
    static Object applied;
    static boolean previous;
    static void enable(CommunityArena p) {
        if (!p.getConfig().getBoolean("combat.attribute-swapping", true)) return;
        try {
            var type = Class.forName("io.papermc.paper.configuration.GlobalConfiguration");
            Object global = type.getMethod("get").invoke(null);
            Object settings = type.getField("unsupportedSettings").get(global);
            var field = settings.getClass().getField("updateEquipmentOnPlayerActions");
            previous = field.getBoolean(settings);
            field.setBoolean(settings, false);
            applied = settings;
            status = "Attribute swapping enabled";
            p.getLogger().info("Attribute swapping enabled server-wide for this running Paper instance. Native cooldowns and Lunge are retained.");
        } catch (ClassNotFoundException ex) {
            p.getLogger().warning("Paper global configuration unavailable; attribute swapping cannot be enabled here.");
        } catch (ReflectiveOperationException | RuntimeException ex) {
            p.getLogger().warning("Set unsupported-settings.update-equipment-on-player-actions: false in config/paper-global.yml and restart to enable attribute swapping. " + ex.getClass().getSimpleName());
        }
    }

    static void restore(CommunityArena p) {
        if (applied == null) return;
        try {
            applied.getClass().getField("updateEquipmentOnPlayerActions").setBoolean(applied, previous);
        } catch (ReflectiveOperationException ex) {
            p.getLogger().warning("Restart Paper to restore the configured equipment-update policy.");
        } finally {
            applied = null;
            status = "Native Paper defaults";
        }
    }
}
