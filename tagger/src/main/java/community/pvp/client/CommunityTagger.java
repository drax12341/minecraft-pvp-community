package community.pvp.client;

import com.google.gson.*;
import community.pvp.Tier;
import community.pvp.TierSelector;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.loader.api.FabricLoader;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.text.Text;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import static net.fabricmc.fabric.api.client.command.v2.ClientCommandManager.*;
import com.mojang.brigadier.arguments.StringArgumentType;

public final class CommunityTagger implements ClientModInitializer {
    private static final Path CONFIG = FabricLoader.getInstance().getConfigDir().resolve("community-tagger.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Set<String> MODES = Set.of("sword","axe","vanilla","uhc","pot","nethop","smp","mace","mace_spear","mace_breach","mace_density","cart","bow","diasmp","creeper");
    private static volatile Map<UUID,List<Tier>> snapshot = Map.of();
    private static final AtomicBoolean LOADING = new AtomicBoolean();
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).followRedirects(HttpClient.Redirect.NEVER).build();
    private static long nextRefresh;
    private static long lastSuccess;
    public static Settings settings = new Settings();
    public static final class Settings {
        public String mode = "sword", color = "#edc478", source = "mctiers";
        public boolean enabled = true, fallback = false, showRetired = false;
    }
    @Override public void onInitializeClient() {
        try { if (Files.exists(CONFIG)) settings = Optional.ofNullable(GSON.fromJson(Files.readString(CONFIG),Settings.class)).orElseGet(Settings::new); }
        catch (Exception e) { System.err.println("Community Tagger: invalid config; defaults restored"); settings = new Settings(); }
        if (!MODES.contains(settings.mode)) settings.mode="sword";
        if (!Set.of("mctiers","community").contains(settings.source)) settings.source="mctiers";
        if (settings.color==null || !settings.color.matches("#[a-fA-F0-9]{6}")) settings.color="#edc478";
        ClientTickEvents.END_CLIENT_TICK.register(client -> { if(client.world != null && settings.enabled && System.currentTimeMillis()>nextRefresh) refresh(); });
        ClientCommandRegistrationCallback.EVENT.register((dispatcher,access) -> dispatcher.register(literal("communitytag")
            .executes(c -> { c.getSource().sendFeedback(Text.literal("Community Tagger: "+settings.source+" / "+settings.mode+". Commands: mode <id>, source <mctiers|community>, toggle, fallback, reload")); return 1; })
            .then(literal("toggle").executes(c -> {settings.enabled=!settings.enabled;save();c.getSource().sendFeedback(Text.literal("Tier labels "+(settings.enabled?"enabled":"disabled")));return 1;}))
            .then(literal("fallback").executes(c -> {settings.fallback=!settings.fallback;save();c.getSource().sendFeedback(Text.literal("Highest active fallback: "+settings.fallback));return 1;}))
            .then(literal("reload").executes(c -> {nextRefresh=0;c.getSource().sendFeedback(Text.literal("Snapshot refresh scheduled."));return 1;}))
            .then(literal("mode").then(argument("id",StringArgumentType.word()).executes(c -> {String mode=StringArgumentType.getString(c,"id");if(!MODES.contains(mode)){c.getSource().sendError(Text.literal("Unknown mode. Available: "+String.join(", ",MODES)));return 0;}settings.mode=mode;save();c.getSource().sendFeedback(Text.literal("Selected mode: "+mode));return 1;})))
            .then(literal("source").then(argument("id",StringArgumentType.word()).executes(c -> {String source=StringArgumentType.getString(c,"id");if(!Set.of("mctiers","community").contains(source)){c.getSource().sendError(Text.literal("Choose mctiers or community"));return 0;}settings.source=source;snapshot=Map.of();lastSuccess=0;nextRefresh=0;save();c.getSource().sendFeedback(Text.literal("Source: "+source));return 1;})))));
    }
    private static void save() {try {Files.writeString(CONFIG,GSON.toJson(settings));}catch(Exception e){System.err.println("Community Tagger: could not save config");}}
    private static void refresh() {
        if(!LOADING.compareAndSet(false,true))return;
        nextRefresh=System.currentTimeMillis()+300_000;
        String source=settings.source;
        String file=source.equals("community")?"results":"mctiers";
        var request=HttpRequest.newBuilder(URI.create("https://drax12341.github.io/minecraft-pvp-community/data/"+file+".json")).timeout(Duration.ofSeconds(12)).header("User-Agent","CommunityTagger/0.1").GET().build();
        HTTP.sendAsync(request,HttpResponse.BodyHandlers.ofString()).orTimeout(15,TimeUnit.SECONDS).thenAccept(response -> {
            if(response.statusCode()!=200 || response.body().length()>2_000_000)throw new IllegalStateException("Snapshot unavailable or too large");
            JsonObject root=JsonParser.parseString(response.body()).getAsJsonObject();
            // Do not display a stale website snapshot as a current rank.
            if(!root.has("updatedAt") || root.get("updatedAt").isJsonNull())return;
            var updated=java.time.Instant.parse(root.get("updatedAt").getAsString());
            if(updated.isBefore(java.time.Instant.now().minus(Duration.ofDays(2))))return;
            Map<UUID,List<Tier>> parsed=new HashMap<>();
            for(JsonElement item:root.getAsJsonArray("players")) {
                if(parsed.size()>=5000)break;
                JsonObject p=item.getAsJsonObject();List<Tier> tiers=new ArrayList<>();
                for(var entry:p.getAsJsonObject("rankings").entrySet()){JsonObject r=entry.getValue().getAsJsonObject();tiers.add(new Tier(entry.getKey(),r.get("tier").getAsInt(),r.get("pos").getAsInt(),r.has("retired")&&r.get("retired").getAsBoolean()));}
                parsed.put(UUID.fromString(p.get("uuid").getAsString()),List.copyOf(tiers));
            }
            if(settings.source.equals(source)){snapshot=Map.copyOf(parsed);lastSuccess=System.currentTimeMillis();}
        }).exceptionally(error -> {System.err.println("Community Tagger: snapshot refresh failed; labels expire after 10 minutes");return null;}).whenComplete((r,e)->LOADING.set(false));
    }
    public static Text decorate(UUID uuid,Text original) {
        if(!settings.enabled || System.currentTimeMillis()-lastSuccess>600_000)return original;
        var selected=TierSelector.select(snapshot.getOrDefault(uuid,List.of()),settings.mode,settings.fallback,settings.showRetired);
        if(selected.isEmpty())return original;
        Tier t=selected.get();int color=Integer.parseInt(settings.color.substring(1),16);
        return Text.literal("["+(settings.source.equals("community")?"Community":"MCTiers")+" "+t.mode()+" "+t.label()+(t.retired()?" retired":"")+"] ").styled(s->s.withColor(color)).append(original.copy());
    }
}
