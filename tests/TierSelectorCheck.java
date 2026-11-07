import community.pvp.Tier;
import community.pvp.TierSelector;
import java.util.List;
public class TierSelectorCheck {
    public static void main(String[] args) {
        var tiers=List.of(new Tier("sword",3,0,false),new Tier("mace",1,0,true),new Tier("axe",2,1,false));
        if(!TierSelector.select(tiers,"sword",true,false).orElseThrow().label().equals("HT3"))throw new AssertionError("Preferred mode must win");
        if(!TierSelector.select(tiers,"bow",true,false).orElseThrow().mode().equals("axe"))throw new AssertionError("Retired tiers must be excluded");
        if(TierSelector.select(tiers,"bow",false,false).isPresent())throw new AssertionError("Fallback must be opt-in");
        if(!TierSelector.select(tiers,"bow",true,true).orElseThrow().mode().equals("mace"))throw new AssertionError("Explicit retired setting");
        System.out.println("Tier selection checks passed");
    }
}
