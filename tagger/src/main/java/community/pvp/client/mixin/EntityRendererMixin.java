package community.pvp.client.mixin;
import community.pvp.client.CommunityTagger;
import net.minecraft.client.render.entity.EntityRenderer;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.client.render.VertexConsumerProvider;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

@Mixin(EntityRenderer.class)
public abstract class EntityRendererMixin {
    @ModifyVariable(method="renderLabelIfPresent",at=@At("HEAD"),argsOnly=true,ordinal=0)
    private Text community$label(Text original,Entity entity,Text text,MatrixStack matrices,VertexConsumerProvider vertices,int light,float tickDelta) {
        return entity instanceof PlayerEntity ? CommunityTagger.decorate(entity.getUuid(),original) : original;
    }
}
