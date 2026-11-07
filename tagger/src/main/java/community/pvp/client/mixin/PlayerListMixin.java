package community.pvp.client.mixin;
import community.pvp.client.CommunityTagger;
import net.minecraft.client.gui.hud.PlayerListHud;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(PlayerListHud.class)
public abstract class PlayerListMixin {
    @Inject(method="getPlayerName",at=@At("RETURN"),cancellable=true)
    private void community$tab(PlayerListEntry entry,CallbackInfoReturnable<Text> callback) {
        callback.setReturnValue(CommunityTagger.decorate(entry.getProfile().getId(),callback.getReturnValue()));
    }
}
