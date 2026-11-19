package community.pvp.arena;

import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;

final class ArenaMenu implements InventoryHolder {
  private Inventory inventory;

  static Inventory create(int size, Component title) {
    ArenaMenu holder = new ArenaMenu();
    holder.inventory = Bukkit.createInventory(holder, size, title);
    return holder.inventory;
  }

  @Override
  public Inventory getInventory() {
    return inventory;
  }
}
