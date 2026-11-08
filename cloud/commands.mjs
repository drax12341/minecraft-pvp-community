import config from "../config/community.json" with { type: "json" };

const regions = ["EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"];
export async function runCommand(interaction, env, store, request = fetch) {
  const actor = interaction.member?.user?.id;
  if (
    !actor ||
    interaction.guild_id !== env.DISCORD_GUILD_ID ||
    interaction.application_id !== env.DISCORD_CLIENT_ID
  )
    throw Error("This command is only available in our community server.");
  const data = interaction.data;
  const sub = data.options?.find((o) => o.type === 1);
  const options = sub ? sub.options || [] : data.options || [];
  const get = (name) => options.find((o) => o.name === name)?.value;
  const roles = interaction.member.roles || [];
  const mod =
    actor === env.DISCORD_OWNER_ID ||
    (BigInt(interaction.member.permissions || "0") & 8n) !== 0n ||
    roles.includes(env.MODERATOR_ROLE_ID);
  const tester = mod || roles.includes(env.TESTER_ROLE_ID);
  const requireMod = () => {
    if (!mod) throw Error("Only moderators can use this command.");
  };
  const requireTester = () => {
    if (!tester)
      throw Error("Only testers and moderators can use this command.");
  };
  const mode = () => {
    if (!config.modes.some((m) => m.id === get("mode")))
      throw Error("Choose a valid mode.");
    return get("mode");
  };
  const region = () => {
    if (!regions.includes(get("region"))) throw Error("Choose a valid region.");
    return get("region");
  };
  const discord = async (path, method = "GET") => {
    const response = await request("https://discord.com/api/v10" + path, {
      method,
      headers: { Authorization: "Bot " + env.DISCORD_TOKEN },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw Error(
        "Discord could not update the role. Ask staff to check the bot's role hierarchy and permissions.",
      );
    return response.status === 204 ? undefined : response.json();
  };
  switch (data.name) {
    case "preferences": {
      const changes = [];
      const allRoles = await discord(`/guilds/${env.DISCORD_GUILD_ID}/roles`);
      const safeRole = (name) => {
        const role = allRoles.find((r) => r.name === name);
        if (!role || role.managed || BigInt(role.permissions) !== 0n)
          throw Error(
            "The interest role is missing or has unsafe permissions. Ask staff to review setup.",
          );
        return role;
      };
      if (get("mode")) {
        mode();
        const role = safeRole(
          config.modes.find((m) => m.id === get("mode")).name,
        );
        const remove = roles.includes(role.id);
        await discord(
          `/guilds/${env.DISCORD_GUILD_ID}/members/${actor}/roles/${role.id}`,
          remove ? "DELETE" : "PUT",
        );
        changes.push(role.name + (remove ? " removed" : " added"));
      }
      if (get("region")) {
        region();
        const target = safeRole(get("region"));
        for (const r of allRoles)
          if (
            regions.includes(r.name) &&
            r.id !== target.id &&
            roles.includes(r.id)
          ) {
            safeRole(r.name);
            await discord(
              `/guilds/${env.DISCORD_GUILD_ID}/members/${actor}/roles/${r.id}`,
              "DELETE",
            );
          }
        await discord(
          `/guilds/${env.DISCORD_GUILD_ID}/members/${actor}/roles/${target.id}`,
          "PUT",
        );
        changes.push("Region " + get("region"));
      }
      return changes.join(" · ") || "Choose a mode or region.";
    }
    case "verify-account": {
      requireMod();
      if (
        !/^\d{5,22}$/.test(get("user") || "") ||
        !/^([a-f0-9]{32}|[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(
          get("uuid") || "",
        ) ||
        !/^\w{3,16}$/.test(get("name") || "")
      )
        throw Error("Enter a valid verified Minecraft UUID and username.");
      const compact = get("uuid").replaceAll("-", "").toLowerCase();
      const uuid = compact.replace(
        /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
        "$1-$2-$3-$4-$5",
      );
      await store.verify(get("user"), uuid, get("name"), actor);
      return "Verified account saved in cloud storage. Staff must confirm ownership before using this command.";
    }
    case "session": {
      requireTester();
      const status = { open: "open", pause: "paused", close: "closed" }[
        sub?.name
      ];
      await store.session(
        mode(),
        region(),
        status,
        actor,
        get("capacity") ?? 30,
        get("cooldown") ?? 72,
      );
      return `${get("mode")} / ${get("region")} session ${status}. The public testing page updates automatically.`;
    }
    case "queue": {
      if (sub?.name === "join")
        return (
          "Queue entry created: " +
          (await store.join(actor, mode(), region())) +
          ". A tester will claim it when available."
        );
      if (sub?.name === "leave")
        return (await store.leave(actor, mode()))
          ? "You left the queue."
          : "No waiting entry found. For claimed entries, contact your tester.";
      if (sub?.name !== "list") throw Error("Choose join, leave or list.");
      const rows = (await store.list()).filter(
        (r) => tester || r.user === actor,
      );
      return rows.length
        ? rows
            .slice(0, 15)
            .map((r) => `${r.mode} / ${r.region} / ${r.status} / ${r.id}`)
            .join("\n")
        : "You have no open entries.";
    }
    case "claim":
      requireTester();
      await store.claim(get("id"), actor);
      return "Test claimed. Agree on the kit, server and rules with the player.";
    case "result": {
      requireTester();
      const tier = get("tier"),
        evidence = get("evidence");
      if (
        !/^(HT|LT)[1-5]$/.test(tier || "") ||
        typeof evidence !== "string" ||
        evidence.length > 1000 ||
        !URL.canParse(evidence) ||
        new URL(evidence).protocol !== "https:"
      )
        throw Error(
          "A valid tier and shareable HTTPS evidence link are required.",
        );
      await store.result(
        get("id"),
        Number(tier.slice(-1)),
        tier.startsWith("HT") ? 0 : 1,
        evidence,
        actor,
      );
      return "Result saved with evidence and tester attribution. The cloud rankings feed updates automatically.";
    }
    case "appeal": {
      if (sub?.name === "submit")
        return (
          "Private appeal recorded: " +
          (await store.appeal(get("id"), actor, get("reason"))) +
          ". An independent moderator must review it."
        );
      if (sub?.name === "status") {
        const rows = await store.appeals(actor);
        return rows.length
          ? rows
              .slice(0, 10)
              .map(
                (r) =>
                  `${r.id} · ${r.status}${r.decision ? " · " + r.decision : ""}`,
              )
              .join("\n")
          : "You have no appeals.";
      }
      requireMod();
      if (sub?.name !== "review")
        throw Error("Choose submit, status or review.");
      if (!get("id")) {
        const rows = await store.appeals();
        return rows.length
          ? rows
              .slice(0, 8)
              .map((r) => `${r.id} · result ${r.result_id} · ${r.reason}`)
              .join("\n")
          : "No pending appeals.";
      }
      await store.review(get("id"), actor, get("decision"), get("reason"));
      return "Appeal decision saved. Revoked results are excluded from current rankings.";
    }
    default:
      throw Error("Unknown command.");
  }
}
