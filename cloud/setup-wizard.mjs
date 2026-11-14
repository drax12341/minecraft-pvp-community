import config from "../config/community.json" with { type: "json" };
import { staffAccess } from "../config/community-roles.mjs";
import { deskRegions } from "../config/testing-desk.mjs";
import { competitionDiscord } from "./competition.mjs";
import { testingHubPanel } from "./platform-panels.mjs";
import { communityQueueBoard } from "./community-desk.mjs";

const setupStageNames = [
  "Server identity",
  "Mace submodes",
  "Regions",
  "Testing roles",
  "Channel structure",
  "Permissions",
  "Dashboards",
  "Validation",
];
const setupBtn = (label, custom_id, style = 2) => ({
  type: 2,
  label,
  custom_id,
  style,
});
export async function setupWizard(i, env, store, request = fetch) {
  const { actor, mod } = staffAccess(i, env);
  if (!mod)
    throw Error(
      "Only administrators and testing managers can run server setup.",
    );
  const sub = i.data.options?.find((o) => o.type === 1),
    opts = sub?.options || i.data.options || [],
    get = (n) => opts.find((o) => o.name === n)?.value;
  const action = get("action") || sub?.name || "status",
    now = () => new Date().toISOString();
  const api = (path, method, body) =>
    competitionDiscord(env, request, path, method, body);
  await store
    .statement(
      "INSERT OR IGNORE INTO setup_runs(guild,updated) VALUES(?,?)",
      env.DISCORD_GUILD_ID,
      now(),
    )
    .run();
  let run = await store.one(
    "SELECT * FROM setup_runs WHERE guild=?",
    env.DISCORD_GUILD_ID,
  );
  if (action === "identity") {
    const name = get("name"),
      color = get("color");
    if (!name || name.length > 80 || !/^#[a-f0-9]{6}$/i.test(color || ""))
      throw Error("Use a network name and #RRGGBB color.");
    await store
      .statement(
        "INSERT INTO platform_settings VALUES('branding',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,actor=excluded.actor,updated=excluded.updated",
        JSON.stringify({ name, color }),
        actor,
        now(),
      )
      .run();
  }
  if (action === "regions") {
    const enabled = String(get("regions") || "")
      .split(",")
      .filter(Boolean);
    if (
      !enabled.length ||
      enabled.some(
        (r) => !["EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"].includes(r),
      )
    )
      throw Error("Choose at least one valid region.");
    await store.db.batch(
      ["EU", "NA", "AS", "SA", "AU", "AF", "ME", "OC"].map((r) =>
        store.statement(
          "INSERT INTO region_settings VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled",
          r,
          r,
          enabled.includes(r) ? 1 : 0,
        ),
      ),
    );
  }
  if (action === "next" || action === "back") {
    const stage = Math.max(
      1,
      Math.min(8, run.stage + (action === "next" ? 1 : -1)),
    );
    await store
      .statement(
        "UPDATE setup_runs SET stage=?,updated=? WHERE guild=?",
        stage,
        now(),
        env.DISCORD_GUILD_ID,
      )
      .run();
    run.stage = stage;
  }
  if (action === "install") {
    const channels = await api("/guilds/" + env.DISCORD_GUILD_ID + "/channels"),
      roles = await api("/guilds/" + env.DISCORD_GUILD_ID + "/roles");
    const bot = await api(
      "/guilds/" + env.DISCORD_GUILD_ID + "/members/" + env.DISCORD_CLIENT_ID,
    );
    const botPerms = roles
      .filter((r) => r.id === env.DISCORD_GUILD_ID || bot.roles.includes(r.id))
      .reduce((n, r) => n | BigInt(r.permissions), 0n);
    if (!(botPerms & 8n) && (!(botPerms & 16n) || !(botPerms & 268435456n)))
      throw Error(
        "Setup requires Manage Channels and Manage Roles (or Administrator) on the bot. No resources were changed.",
      );
    const resources = await store.all("SELECT * FROM guild_resources"),
      saved = new Map(resources.map((r) => [r.key, r.discord_id]));
    const remember = async (key, id, kind) => {
      saved.set(key, id);
      await store
        .statement(
          "INSERT INTO guild_resources VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET discord_id=excluded.discord_id,updated=excluded.updated",
          key,
          id,
          kind,
          now(),
        )
        .run();
    };
    const ensureRole = async (key, names, color) => {
      let r =
        roles.find((r) => r.id === saved.get("role:" + key)) ||
        roles.find((r) => names.includes(r.name) && !r.managed);
      if (!r) {
        r = await api("/guilds/" + env.DISCORD_GUILD_ID + "/roles", "POST", {
          name: names[0],
          permissions: "0",
          color,
          mentionable: false,
          hoist: key === "tester" || key === "manager",
        });
        roles.push(r);
      }
      await remember("role:" + key, r.id, "role");
      return r.id;
    };
    const manager = await ensureRole(
        "manager",
        ["Testing Manager", "Gamemode Manager"],
        0xa78bfa,
      ),
      tester = await ensureRole("tester", ["Tier Tester", "Tester"], 0x7861e8),
      high = await ensureRole(
        "high-tester",
        ["Senior Tester", "High Tester"],
        0xe4b95b,
      );
    await ensureRole("verified", ["Verified Player", "Verified"], 0x39c99a);
    for (const tier of Object.keys(config.points))
      await ensureRole(
        "tier:" + tier,
        [tier],
        tier.endsWith("1") ? 0xe4b95b : 0x7861e8,
      );
    for (const m of config.modes) {
      await ensureRole("tester:" + m.id, [m.name + " Tester"], 0x7861e8);
      for (const tier of Object.keys(config.points)) {
        const role = await ensureRole(
          "tier:" + m.id + ":" + tier,
          [m.name + " ? " + tier],
          tier.endsWith("1") ? 0xe4b95b : 0x7861e8,
        );
        await store
          .statement(
            "INSERT OR IGNORE INTO tier_role_mappings VALUES(?,?,?)",
            m.id,
            tier,
            role,
          )
          .run();
      }
    }
    const view = 1024n,
      send = 2048n,
      history = 65536n,
      embed = 16384n,
      attach = 32768n;
    const publicOverwrites = [
      {
        id: env.DISCORD_GUILD_ID,
        type: 0,
        allow: String(view | history),
        deny: String(send | 34359738368n | 68719476736n | 274877906944n),
      },
      {
        id: env.DISCORD_CLIENT_ID,
        type: 1,
        allow: String(view | send | history | embed | attach),
        deny: "0",
      },
      ...[manager, tester, high].map((id) => ({
        id,
        type: 0,
        allow: String(view | send | history | embed | attach),
        deny: "0",
      })),
    ];
    const privateOverwrites = (testers = false) => [
      { id: env.DISCORD_GUILD_ID, type: 0, allow: "0", deny: String(view) },
      {
        id: env.DISCORD_CLIENT_ID,
        type: 1,
        allow: String(view | send | history | embed | attach),
        deny: "0",
      },
      ...[
        ...new Set([
          manager,
          ...String(
            env.DISCORD_MODERATOR_ROLE_IDS || env.MODERATOR_ROLE_ID || "",
          )
            .split(",")
            .filter(Boolean),
          ...(testers ? [tester, high] : []),
        ]),
      ].map((id) => ({
        id,
        type: 0,
        allow: String(view | send | history | embed | attach),
        deny: "0",
      })),
    ];
    const ensureChannel = async (
      key,
      name,
      type,
      parent,
      aliases = [],
      privacy = "public",
    ) => {
      let c =
        channels.find((c) => c.id === saved.get(key)) ||
        channels.find((c) => c.type === type && c.name === name) ||
        channels.find(
          (c) => c.type === type && [name, ...aliases].includes(c.name),
        );
      const overwrites =
        privacy === "public"
          ? publicOverwrites
          : privateOverwrites(privacy === "testers");
      if (!c) {
        c = await api("/guilds/" + env.DISCORD_GUILD_ID + "/channels", "POST", {
          name,
          type,
          ...(parent ? { parent_id: parent } : {}),
          permission_overwrites: overwrites,
        });
        channels.push(c);
      } else {
        try {
          await api("/channels/" + c.id, "PATCH", {
            permission_overwrites: overwrites,
          });
        } catch (error) {
          if (!/403|Missing Permissions/.test(error.message)) throw error;
          await store.audit(actor,'setup-existing-channel-uneditable',c.id).run();
          c=await api('/guilds/'+env.DISCORD_GUILD_ID+'/channels','POST',{
            name,type,...(parent?{parent_id:parent}:{}),permission_overwrites:overwrites,
          });
          channels.push(c);
        }
      }
      await remember(key, c.id, "channel");
      return c.id;
    };
    const start = await ensureChannel(
      "category:start",
      "📌 START HERE",
      4,
      null,
      ["📌 INFORMATION"],
    );
    const main = await ensureChannel(
      "category:testing",
      "⚔️ MACE TESTING CENTER",
      4,
      null,
      ["🔨 TESTING"],
    );
    const testerCat = await ensureChannel(
      "category:testers",
      "⚔️ TESTER CONTROL CENTER",
      4,
      null,
      [],
      "testers",
    );
    const staffCat = await ensureChannel(
      "category:staff",
      "🛡️ STAFF ADMINISTRATION",
      4,
      null,
      ["🛡 STAFF"],
      "staff",
    );
    const privateCat = await ensureChannel(
      "category:tickets",
      "🔒 PRIVATE TICKETS",
      4,
      null,
      [],
      "staff",
    );
    await ensureChannel(
      "category:archive",
      "📁 TICKET ARCHIVE",
      4,
      null,
      [],
      "staff",
    );
    const targets = [
      ["welcome", "👋・welcome", start, ["👋┃welcome"], "welcome"],
      ["rules", "📜・rules", start, ["📜┃rules"], "rules"],
      ["information", "📋・information", start, ["how-to-test"], "information"],
      ["faq", "❓・faq", start, ["❓┃faq"], "faq"],
      ["request-test", "⚔️・request-test", main, ["🧪┃request-test"], "hub"],
      ["status", "📊・testing-status", main, ["test-queue"], "network"],
      [
        "leaderboards",
        "👑・leaderboards",
        main,
        ["🏅┃testing-leaderboard"],
        "leaderboards",
      ],
      ["cooldowns", "⏳・cooldowns", main, [], "cooldowns"],
      [
        "tester-dashboard",
        "⚔️・tester-dashboard",
        testerCat,
        [],
        "tester",
        "testers",
      ],
      [
        "tester-commands",
        "📋・tester-commands",
        testerCat,
        [],
        "tester-guide",
        "testers",
      ],
      [
        "tester-statistics",
        "📊・tester-statistics",
        testerCat,
        [],
        "statistics",
        "testers",
      ],
      [
        "high-tier-requests",
        "👑・high-tier-requests",
        testerCat,
        [],
        "high-tests",
        "testers",
      ],
      ["testing-logs", "🔍・testing-logs", testerCat, [], "logs", "testers"],
      [
        "staff-dashboard",
        "🛡️・staff-dashboard",
        staffCat,
        [],
        "staff",
        "staff",
      ],
      ["system-health", "🔧・system-health", staffCat, [], "health", "staff"],
      ["reports", "🚨・reports", staffCat, [], "support", "staff"],
      ["appeals", "🧾・appeals", staffCat, [], "appeals", "staff"],
    ];
    const enabled = await store.all(
      "SELECT id FROM region_settings WHERE enabled=1",
    );
    const regions = enabled.length
      ? enabled.map((r) => r.id)
      : ["EU", "NA", "AS"];
    for (const region of regions) {
      const cat = await ensureChannel(
        "category:region:" + region,
        region + " REGIONAL TESTING",
        4,
        null,
      );
      targets.push([
        "region:" + region,
        region.toLowerCase() + "-queue",
        cat,
        [],
        "regional",
      ]);
    }
    const installed = [];
    for (const [key, name, parent, aliases, panel, privacy] of targets) {
      const channel = await ensureChannel(
        "channel:" + key,
        name,
        0,
        parent,
        aliases,
        privacy || "public",
      );
      installed.push({ key, channel, panel });
    }
    await store
      .statement(
        "INSERT INTO platform_settings VALUES('ticket-category',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated",
        privateCat,
        actor,
        now(),
      )
      .run();
    await store
      .statement(
        "UPDATE setup_runs SET stage=7,settings=?,updated=? WHERE guild=?",
        JSON.stringify({ installed }),
        now(),
        env.DISCORD_GUILD_ID,
      )
      .run();
    await store
      .audit(actor, "setup-resources-installed", String(installed.length))
      .run();
    return {
      content: `**SERVER STRUCTURE INSTALLED**\n${installed.length} channel resources configured. Existing messages and unrelated channels were preserved. Private tester and staff sections have explicit access controls.\nContinue to install the persistent dashboards.`,
      components: [
        {
          type: 1,
          components: [
            setupBtn("Install dashboards", "setup:panels", 1),
            setupBtn("Validate setup", "setup:validate"),
          ],
        },
      ],
    };
  }
  if (action === "panels") {
    const installed = JSON.parse(run.settings).installed;
    if (!installed?.length) throw Error("Install the channel structure first.");
    let count = 0;
    for (const target of installed) {
      const body = await setupPanel(target.panel, store, target.key),
        marker = "Mace network · " + target.key;
      body.embeds[0].footer = { text: marker };
      const key = "panel:" + target.key,
        saved = await store.one(
          "SELECT discord_id FROM guild_resources WHERE key=?",
          key,
        );
      let message = saved?.discord_id;
      if (!message) {
        const recent = await api(
          "/channels/" + target.channel + "/messages?limit=100",
        );
        message = recent.find(
          (m) =>
            m.author?.id === env.DISCORD_CLIENT_ID &&
            m.embeds?.some((e) => e.footer?.text === marker),
        )?.id;
      }
      if (message)
        await api(
          "/channels/" + target.channel + "/messages/" + message,
          "PATCH",
          body,
        );
      else
        message = (
          await api("/channels/" + target.channel + "/messages", "POST", {
            ...body,
            nonce: BufferNonce(target.key),
            enforce_nonce: true,
          })
        ).id;
      await store
        .statement(
          "INSERT INTO guild_resources VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET discord_id=excluded.discord_id,updated=excluded.updated",
          key,
          message,
          "message",
          now(),
        )
        .run();
      if (target.panel === "hub")
        await store
          .statement(
            "INSERT INTO platform_panels(key,channel,message) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET message=excluded.message",
            "hub:" + target.channel,
            target.channel,
            message,
          )
          .run();
      count++;
    }
    await store
      .statement(
        "UPDATE setup_runs SET stage=8,updated=? WHERE guild=?",
        now(),
        env.DISCORD_GUILD_ID,
      )
      .run();
    return {
      content: `**${count} DISCORD DASHBOARDS INSTALLED**\nPlayer navigation, tester controls, staff tools, regional mode selectors and ranking actions are connected.`,
      components: [
        {
          type: 1,
          components: [setupBtn("Run validation", "setup:validate", 3)],
        },
      ],
    };
  }
  if (action === "validate") {
    const channels = await api("/guilds/" + env.DISCORD_GUILD_ID + "/channels"),
      roles = await api("/guilds/" + env.DISCORD_GUILD_ID + "/roles"),
      resources = await store.all("SELECT * FROM guild_resources");
    const missing = resources.filter((r) =>
      r.kind === "channel"
        ? !channels.some((c) => c.id === r.discord_id)
        : r.kind === "role"
          ? !roles.some((c) => c.id === r.discord_id)
          : false,
    );

    return (
      "**SETUP VALIDATION**\nDatabase: connected\nDiscord API: connected\nConfigured resources: " +
      resources.length +
      "\nMissing channels / roles: " +
      missing.length +
      "\nOwnership server: " +
      (env.MINECRAFT_VERIFICATION_SERVER
        ? "Configured"
        : "Needs real server configuration") +
      "\nMode-specific tester approvals: use /qualification list\nApproved kits: use /loadout show per Mace mode\n\n" +
      (missing.length
        ? missing.map((m) => m.key).join("\n")
        : "All installed resource IDs are present. No production rank was generated during validation.")
    );
  }
  const details = [
    "Set the network identity. Existing branding is preserved until you submit a change.",
    "Detected Mace modes:\n" +
      config.modes.map((m) => "• " + m.name + " (`" + m.id + "`)").join("\n") +
      "\nUse /mode create or /mode edit for actual official rules. No new rules are invented.",
    "Choose enabled regions for the server installation. Default: Europe, North America and Asia.",
    "Setup reuses existing tester and management roles, creates missing safe roles, and keeps mode qualifications explicit. /qualification grant and /quota set remain manager-only.",
    "Create missing public, regional, tester and staff sections. Existing channel history is retained. Installation also applies least-privilege overwrites.",
    "Public panels are read-only; private staff/tester sections receive explicit role access. Private test rooms grant only the player, assigned tester, bot and testing management.",
    "Install the hub, regional selectors, rules, profiles, cooldowns, leaderboards, tester workspace and staff controls.",
    "Validate database access, Discord connectivity and saved resource IDs. Review real kit approval, ownership server and bot hierarchy separately.",
  ];
  const controls = [];
  if (run.stage === 1)
    controls.push(setupBtn("Set identity", "setup:identity-form", 1));
  if (run.stage === 2)
    controls.push(setupBtn("View configured modes", "staff:modes"));
  if (run.stage === 3)
    controls.push(setupBtn("Configure regions", "setup:regions-form", 1));
  if ([4, 5, 6].includes(run.stage))
    controls.push(
      setupBtn("Install roles, channels & permissions", "setup:install", 3),
    );
  if (run.stage === 7)
    controls.push(setupBtn("Install dashboards", "setup:panels", 3));
  if (run.stage === 8)
    controls.push(setupBtn("Validate installation", "setup:validate", 3));
  return {
    content: "",
    embeds: [
      {
        title: "⚙️ MACE NETWORK SETUP",
        color: 0x7861e8,
        description: `**STAGE ${run.stage}/8 · ${setupStageNames[run.stage - 1]}**\n\n${details[run.stage - 1]}`,
        footer: { text: "Persistent administrator setup wizard" },
      },
    ],
    components: [
      { type: 1, components: controls },
      {
        type: 1,
        components: [
          setupBtn("Back", "setup:back"),
          setupBtn("Continue", "setup:next", 1),
          setupBtn("Current setup", "setup:status"),
        ],
      },
    ],
  };
}
function BufferNonce(value) {
  return "setup-" + value.replace(/[^a-z0-9]/gi, "").slice(0, 18);
}
export async function setupPanel(kind, store, key = "") {
  const row = (...buttons) => ({ type: 1, components: buttons }),
    button = setupBtn;
  let title, description, components;
  if (kind === "hub") return testingHubPanel(store);
  if (kind === "regional") {
    title = "⚔️ " + key.slice(7) + " MACE TESTING";
    description =
      "Choose your Mace submode to open the live regional queue. Saved waitlist interest and live queue positions remain separate.";
    components = [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "regional:mode:" + key.slice(7),
            placeholder: "Choose a Mace submode",
            options: config.modes
              .slice(0, 25)
              .map((m) => ({ label: m.name, value: m.id })),
          },
        ],
      },
    ];
  } else if (kind === "welcome") {
    title = "🏆 WELCOME TO THE MACE COMPETITIVE NETWORK";
    description =
      "Prove your skill. Earn your tier. Climb the rankings.\n\n① Verify your Minecraft account.\n② Choose your region and Mace submode.\n③ Save interest or join a live queue.\n④ Meet your official tester privately.\n⑤ Receive a traceable result and updated profile.";
    components = [
      row(
        button("Get started", "community:desk", 1),
        button("How testing works", "hub:guide"),
        button("View rankings", "network:rankings"),
        button("Help center", "hub:ticket"),
      ),
    ];
  } else if (kind === "tester") {
    title = "⚔️ TESTER CONTROL CENTER";
    description =
      "Open a shared session, pull the next eligible player, manage your availability and complete official tests.\n\nYour workspace shows live assignments, approved modes, activity and quotas. Every action validates your role and mode qualification.";
    components = [
      row(
        button("My tester dashboard", "community:staff", 1),
        button("Open queue", "testerflow:start"),
        button("My statistics", "network:tester-stats"),
        button("My quota", "network:quota"),
      ),
    ];
  } else if (kind === "staff") {
    title = "🛡️ ADMINISTRATION CENTER";
    description =
      "Manage the testing network with audited controls and confirmed destructive actions.\n\nQueues · testers · modes · restrictions · health · setup";
    components = [
      row(
        button("Open administration", "network:staff", 1),
        button("System health", "staff:health"),
        button("Delivery failures", "staff:delivery"),
        button("Setup wizard", "staff:setup"),
      ),
    ];
  } else if (kind === "rules") {
    title = "📜 COMPETITIVE INTEGRITY & MACE RULES";
    description =
      "Read each mode’s actual rules before playing.\n\nNo cheats, macros, staged results or account sharing. Verify account control. Keep tickets and evidence private when required. Queue abuse and tester conduct are reviewed by staff. Appeals must reference the official result ID. No automatic punishments are issued for gateway outages.";
    components = [
      row(
        button("Mode testing rules", "hub:rubrics"),
        button("Testing guide", "hub:guide"),
        button("Appeals / disputes", "hub:ticket"),
      ),
    ];
  } else if (kind === "cooldowns") {
    title = "⏱️ INDEPENDENT MACE COOLDOWNS";
    description =
      "Each Mace submode has its own retest eligibility. Your actual next-test timestamps are private. Staff overrides require reasons and confirmation.";
    components = [
      row(
        button("My cooldowns", "desk:cooldown", 1),
        button("My player desk", "community:desk"),
      ),
    ];
  } else if (kind === "leaderboards") {
    title = "🏆 OFFICIAL MACE RANKINGS";
    description =
      "Current tiers, peak tiers, points and deterministic rankings come from this network’s official evaluations. No imported or sample placements are shown.";
    components = [
      row(
        button("Overall rankings", "network:rankings", 1),
        button("My profile", "community:self"),
        button("Tier progression", "network:progress"),
      ),
    ];
  } else if (kind === "statistics") {
    title = "📊 TESTER PERFORMANCE";
    description =
      "Completed official evaluations, UTC monthly activity and quotas. Recognition never bypasses testing integrity.";
    components = [
      row(
        button("My statistics", "network:tester-stats", 1),
        button("Tester leaderboard", "network:tester-leaderboard"),
        button("My quota", "network:quota"),
      ),
    ];
  } else if (kind === "high-tests") {
    title = "👑 HIGH-TIER EVALUATIONS";
    description =
      "Promotion applications preserve approved qualification thresholds, opponent sets, phase evidence and independent sign-off.";
    components = [
      row(
        button("My application dashboard", "desk:player", 1),
        button("Pending applications", "network:high-pending"),
      ),
    ];
  } else if (kind === "health" || kind === "logs") {
    title = "🔧 PLATFORM OPERATIONS";
    description =
      "Inspect stale tests and durable delivery failures. Saved results remain authoritative when Discord delivery needs a retry.";
    components = [
      row(
        button("Queue health", "staff:health", 1),
        button("System status", "network:system"),
        button("Delivery failures", "staff:delivery"),
      ),
    ];
  } else if (kind === "tester-guide") {
    title = "📋 TESTER WORKFLOW";
    description =
      "**/start** open or join a session\n**/pull** reserve the next eligible player\n**/match start** begin after both participants are ready\n**/match finish** record score\n**/assessment record** save rubric feedback\n**/result** review and confirm\n**/pause · /resume · /end** control your own availability\n\nPrivate notes, cancellation, absence review, deadline extension and transcripts are available in each managed ticket.";
    components = [
      row(button("Open my tester workspace", "community:staff", 1)),
    ];
  } else if (kind === "appeals" || kind === "support") {
    title = "🧾 PRIVATE SUPPORT, REPORTS & APPEALS";
    description =
      "Open account support, a tier appeal, testing dispute, tester report, bug report or general support. Include the relevant official test ID and evidence references. Result changes require authorized independent review.";
    components = [
      row(
        button("Open support", "hub:ticket", 1),
        button("My cases", "network:support-status"),
      ),
    ];
  } else {
    title = kind === "faq" ? "❓ TESTING FAQ" : "📋 HOW OFFICIAL TESTING WORKS";
    description =
      "Premium Java account ownership is required. Mode roles are preferences and do not grant a tier. Waitlists notify you about future sessions; live queues provide FIFO positions. Each Mace mode has independent records and cooldowns. High-tier requests follow the community’s existing phased policy.";
    components = [
      row(
        button("Player desk", "community:desk", 1),
        button("Find testing", "community:boards"),
        button("Testing guide", "hub:guide"),
      ),
    ];
  }
  return {
    content: "",
    embeds: [
      {
        title,
        description,
        color: 0x7861e8,
        footer: { text: "Mace network · " + kind },
      },
    ],
    components,
    allowed_mentions: { parse: [] },
  };
}
