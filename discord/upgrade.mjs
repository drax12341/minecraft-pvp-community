// Additive, repeatable own-guild presentation upgrade. Never uses a user token.
import { REST, Routes, PermissionsBitField as Permissions } from "discord.js";
import config from "../config/community.json" with { type: "json" };
const guild = process.env.DISCORD_GUILD_ID;
if (guild !== "1568767259168608267" || !process.env.DISCORD_TOKEN)
  throw Error("Expected own guild and dedicated bot credentials.");
const rest = new REST().setToken(process.env.DISCORD_TOKEN);
const apply = process.argv.includes("--apply");
const me = await rest.get(Routes.user("@me"));
let channels = await rest.get(Routes.guildChannels(guild));
const roles = await rest.get(Routes.guildRoles(guild));
const staff = channels.find((c) => c.name === "Staff" && c.type === 4);
const privateChannels = channels.filter(
  (c) => c.parent_id === staff?.id || c.id === staff?.id,
);
for (const c of privateChannels) {
  const everyone = c.permission_overwrites?.find((o) => o.id === guild);
  if (
    !everyone ||
    !(BigInt(everyone.deny) & 1024n) ||
    BigInt(everyone.allow) & 1024n
  )
    throw Error("Staff privacy check failed; stopping before edits.");
  const trusted = new Set([
    guild,
    me.id,
    ...roles
      .filter((r) => ["Tier Tester", "Community Moderator"].includes(r.name))
      .map((r) => r.id),
  ]);
  if (
    c.permission_overwrites.some(
      (o) => !trusted.has(o.id) && BigInt(o.allow) & 1024n,
    )
  )
    throw Error("Unexpected staff access grant; review manually.");
}
if (!staff || privateChannels.length < 4)
  throw Error("Expected existing private staff category and channels.");
const member = await rest.get(Routes.guildMember(guild, me.id));
const base = roles
  .filter((r) => r.id === guild || member.roles.includes(r.id))
  .reduce((a, r) => a | BigInt(r.permissions), 0n);
const effective = (c) => {
  let p = base;
  const all = c.permission_overwrites || [];
  const e = all.find((o) => o.id === guild);
  if (e) p = (p & ~BigInt(e.deny)) | BigInt(e.allow);
  const rs = all.filter((o) => o.type === 0 && member.roles.includes(o.id));
  p =
    (p & ~rs.reduce((a, o) => a | BigInt(o.deny), 0n)) |
    rs.reduce((a, o) => a | BigInt(o.allow), 0n);
  const own = all.find((o) => o.id === me.id && o.type === 1);
  return own ? (p & ~BigInt(own.deny)) | BigInt(own.allow) : p;
};
const page = "https://drax12341.github.io/minecraft-pvp-community/";
const topics = {
  welcome:
    "One independent tierlist. Cloud commands work with the owner PC off. Start in #help: /guide start → /preferences → ownership check → /availability → /queue join. Sessions open only after staff and kit rubrics are ready.",
  rules:
    "Fair play, respect and consented evidence. No cheats, boosting, account sharing, harassment or doxxing. Never share passwords or install unknown files. Sponsors cannot buy ranks or queue priority. /guide testing",
  "choose-your-modes":
    "/preferences mode region toggles a safe mode interest role and sets your region. Interests do not grant tiers or staff access. /availability shows published testing sessions; /guide start explains account checks.",
  "how-to-test":
    "/guide testing → staff ownership check → /availability mode region → /queue join → /queue status. Agree kit, version, arena, scoring and evidence before playing. Cooldowns are session-specific; no ETA is promised.",
  "test-queue":
    "/availability for sessions and capacity. /queue join mode region; /queue status mode region for your private position, result ID and cooldown; /queue list for entry IDs; /queue leave for waiting entries.",
  "test-results":
    "Only this community’s earned placements. Live results and evidence: " +
    page +
    "#rankings. /queue status shows your latest valid result ID; /appeal submit is private. No external placements imported.",
  help: "Community command desk: /guide start|testing|appeals|staff|practice. /availability lists actual sessions. /queue status mode region checks your private progress. Never post account credentials or appeal details here.",
  appeals:
    "Guidance only: submit case details through private /appeal submit id reason; /appeal status for decisions. Independent moderators review; do not post evidence containing personal information or accusations here.",
  "find-a-duel":
    "Practice template: mode • region • Java version • server • UTC availability • casual/ranked practice. Agree the kit first. Practice is not an official tier test; no unsolicited pings or paid rank offers.",
  "guides-and-coaching":
    "Ask one specific skill question: mode • goal • what you tried • optional consented clip. Feedback and practice never award an official placement. /guide practice",
  events:
    "Confirmed events only: host • mode/kit • region/server • UTC date/time • format • fair-play rules • sign-up deadline. No scheduled activity is implied by this channel.",
  sponsorships:
    "Disclose each agreed sponsor and what they support. No confirmed sponsor is implied. Money cannot buy ranks, queue priority or appeal outcomes. Contact staff before any agreement.",
  "tester-recruitment":
    "Apply privately with /tester-apply submit after Minecraft ownership verification. Include mode, region, experience and UTC availability. /tester-apply status shows the decision. Staff arrange supervised training; applications never grant roles.",
};
topics["find-a-duel"] =
  "Use /practice create to publish mode, region, kit, UTC availability and goal. /practice list finds member posts; /practice close removes yours from active listings. Posts expire in 24 hours. Practice never awards an official tier.";
topics.help =
  "Your player toolkit: /guide • /availability • /queue status • /profile • /practice • /tester-apply. Copy commands from our website’s Testing or Community pages. Applications and appeals use private command replies.";
for (const m of config.modes)
  topics[m.id + "-testing"] =
    m.name +
    " testing · /availability mode:" +
    m.id +
    " to check real sessions. Verify ownership, agree the published kit/scoring rules, then /queue join. /queue status shows progress privately. This channel does not imply an open queue.";
const panels = {
  help: [
    "Your command desk",
    "One independent tierlist. Your progress comes from our own tests.\n\n**Start:** /guide start → /preferences → ask staff for Minecraft ownership verification.\n**Find testing:** /availability mode region. No published session means no open testing.\n**Track:** /queue status mode region shows your account check, waiting position, latest valid result ID and retest cooldown privately.\n**Play:** /queue join; an assigned tester agrees the kit, scoring and evidence before a match.\n**Review:** /appeal submit and /appeal status are private.\n\nPractice: #find-a-duel. Help improving: #guides-and-coaching. Volunteer: #tester-recruitment. Commands run in cloud hosting; no green bot indicator is needed.",
  ],
  "test-queue": [
    "Find a real session. Track your next step.",
    "/availability lists published sessions, occupancy and cooldowns. /queue join mode region checks verification, capacity and eligibility again.\n\n/queue status mode region shows your waiting position and latest valid result ID privately. Positions exclude already claimed tests and do not predict a wait time. /queue leave cancels waiting entries. For a claimed entry, contact your assigned tester.\n\nStaff must publish kit/scoring rules and confirm trained testers before opening any session.",
  ],
  "find-a-duel": [
    "Practice with a purpose",
    "**Find a partner:** /practice list with optional mode and region.\n**Publish yours:** /practice create with mode, region and a short note: kit, UTC availability and goal.\n**Finished?** /practice close with your listing ID. Listings expire after 24 hours; moderators can close inappropriate posts.\n\nYour listing is visible to members using the bot. Do not include private information. Agree the server, rules and recording first. Practice never awards a tier. No unsolicited pings.",
  ],
  "guides-and-coaching": [
    "Turn a clip into a clear question",
    "Share your mode, one goal and what you have already tried. Add a clip only with consent and without personal information. Give specific, respectful feedback. Coaching does not buy a placement or queue priority.",
  ],
  "tester-recruitment": [
    "Help build fair testing",
    "**Apply privately:** verify Minecraft ownership with staff, then use /tester-apply submit. Choose your mode and region, explain your testing/scoring experience and give UTC availability. Use /tester-apply status for private feedback.\n\nA moderator may invite you to a rubric exercise and supervised testing. Applications never grant staff roles. Do not post private application details here. Impartial scoring, kit knowledge, consented evidence and recusal from your own disputes are essential.",
  ],
  "test-review": [
    "Staff launch and handoff checklist",
    "Before /session open: verify actual account ownership, publish exact version/kit/mod/arena/scoring rules, confirm capacity and cooldown, and assign real testers plus an independent appeal reviewer.\n\n/queue list includes player identifiers privately for staff. /claim assigns one tester. /result requires the assigned tester and a shareable HTTPS evidence link. Members can retrieve the result ID through /queue status. Never put private appeal reasons in public results.\n\nRun two real consenting accounts through the full flow before launch. No sessions have been opened by this setup.",
  ],
};
panels.help[1] +=
  "\n\n**Between tests:** /practice create, list and close help you find a spar. /profile finds earned placements. **Volunteer:** /tester-apply submit and status keep applications private. Visit the website’s Community page for copyable commands.";
panels["test-review"][1] +=
  "\n\n**Handoffs:** /claim action:release returns your unfinished claim to its original waiting position. Completed results cannot be released. **Recruitment:** /tester-apply review lists pending applications; choose interview or declined with feedback. You cannot review your own application. No command grants staff roles.";
const log = {
  applied: apply,
  topics: [],
  panels: [],
  blocked: [],
  created: [],
  verified: [],
};
let recruitment = channels.find((c) => c.name === "tester-recruitment");
if (!recruitment && apply) {
  const parent = channels.find((c) => c.name === "Community" && c.type === 4);
  recruitment = await rest.post(Routes.guildChannels(guild), {
    body: {
      name: "tester-recruitment",
      type: 0,
      parent_id: parent?.id,
      topic: topics["tester-recruitment"],
    },
  });
  channels.push(recruitment);
  log.created.push(recruitment.id);
}
for (const c of channels.filter((c) => c.type === 0 && topics[c.name])) {
  if (apply && c.topic !== topics[c.name])
    await rest.patch(Routes.channel(c.id), { body: { topic: topics[c.name] } });
  log.topics.push({ channel: c.name, id: c.id });
}
for (const [name, [title, description]] of Object.entries(panels)) {
  const c = channels.find((c) => c.type === 0 && c.name === name);
  if (!c) {
    log.blocked.push(name + ": missing channel");
    continue;
  }
  const required =
    Permissions.Flags.ViewChannel |
    Permissions.Flags.SendMessages |
    Permissions.Flags.EmbedLinks |
    Permissions.Flags.ReadMessageHistory;
  if ((effective(c) & required) !== required) {
    log.blocked.push(name + ": bot lacks panel permissions");
    continue;
  }
  if (!apply) {
    log.panels.push({ channel: name, planned: true });
    continue;
  }
  const marker = "Minecraft PvP Tierlist · upgrade-v3 · " + name;
  const messages = await rest.get(Routes.channelMessages(c.id), {
    query: new URLSearchParams({ limit: "100" }),
  });
  const existing = messages.find(
    (m) =>
      m.author.id === me.id && m.embeds?.some((e) => e.footer?.text === marker),
  );
  const body = {
    embeds: [{ title, description, color: 0xad91ef, footer: { text: marker } }],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "Testing & rules",
            url: page + "#testing",
          },
          { type: 2, style: 5, label: "Our rankings", url: page + "#rankings" },
        ],
      },
    ],
    allowed_mentions: { parse: [] },
  };
  const message = existing
    ? await rest.patch(Routes.channelMessage(c.id, existing.id), { body })
    : await rest.post(Routes.channelMessages(c.id), { body });
  const checked = await rest.get(Routes.channelMessage(c.id, message.id));
  if (checked.embeds?.[0]?.footer?.text !== marker)
    throw Error("Panel read-back failed.");
  log.panels.push({
    channel: name,
    url: `https://discord.com/channels/${guild}/${c.id}/${message.id}`,
  });
}
if (apply)
  for (const c of channels.filter((c) => c.type === 0 && topics[c.name])) {
    const checked = await rest.get(Routes.channel(c.id));
    if (checked.topic !== topics[c.name])
      throw Error("Topic read-back failed: " + c.name);
    log.verified.push(c.name);
  }
console.log(JSON.stringify(log, null, 2));
