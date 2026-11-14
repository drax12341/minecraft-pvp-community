import config from "../config/community.json" with { type: "json" };
import { deskRegions } from "../config/testing-desk.mjs";
const builtInMaceModes = config.modes.map((m) => ({ ...m }));
const builtInRegions = [...deskRegions];
export async function loadCompetitionConfig(store) {
  const rows = await store.all("SELECT * FROM mode_settings");
  const overrides = new Map(rows.map((m) => [m.id, m]));
  config.modes = [
    ...builtInMaceModes.map((m) => {
      const o = overrides.get(m.id);
      return o
        ? {
            ...m,
            name: o.name,
            icon: o.icon,
            rules: JSON.parse(o.rules),
            enabled: !!o.enabled,
            testingServer: o.testing_server,
            cooldownHours: o.cooldown_hours,
            capacity: o.capacity,
            scoreLimit: o.score_limit,
          }
        : m;
    }),
    ...rows
      .filter((m) => !builtInMaceModes.some((x) => x.id === m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        group: "Submodes",
        color: "#7861e8",
        icon: m.icon,
        rules: JSON.parse(m.rules),
        enabled: !!m.enabled,
        description: "Administrator-configured Mace testing submode",
        testingServer: m.testing_server,
        cooldownHours: m.cooldown_hours,
        capacity: m.capacity,
        scoreLimit: m.score_limit,
      })),
  ].filter((m) => m.enabled !== false);
  const regions = await store.all("SELECT * FROM region_settings");
  deskRegions.splice(
    0,
    deskRegions.length,
    ...[...new Set([...builtInRegions, ...regions.map((r) => r.id)])].filter(
      (id) => regions.find((r) => r.id === id)?.enabled !== 0,
    ),
  );
  return config;
}
export function modeAutocompleteCatalog(commands) {
  const visit = (options) =>
    options?.map((o) => {
      const v = { ...o };
      if (v.name === "mode" && v.type === 3) {
        delete v.choices;
        v.autocomplete = true;
      }
      if (v.options) v.options = visit(v.options);
      return v;
    });
  return commands.map((c) => ({ ...c, options: visit(c.options) }));
}
