import config from "./community.json" with { type: "json" };

// Names from the supplied references; aliases preserve live channel IDs and links.
export const referenceLayout = [
  {
    name: "📌 Information",
    aliases: ["📌 INFORMATION", "01 · START HERE"],
    channels: [
      ["👋┃welcome"],
      ["📢┃announcements"],
      ["📜┃rules", "📜・rules", "rules"],
      ["📋┃information", "📋・information", "server-guide"],
      ["🎨┃roles-and-pings"],
      ["🔗┃tierlist-link"],
      ["📰┃tester-of-the-month"],
    ],
  },
  {
    name: "📄 Tierlist",
    channels: [
      ["📖┃ranked-rubric"],
      ["📖┃ranked-ruleset"],
      ["🖥️┃testing-servers"],
      ["🚨┃staff-movements"],
      ["⛔┃punishments"],
      ["🏅┃testing-leaderboard"],
      ["🏅┃high-tests"],
      ["🏆┃high-results"],
      ["🏆┃results"],
      ["📋┃forum-posting"],
      ["🏅┃player-roster"],
    ],
  },
  {
    name: "🌍 General",
    channels: [
      ["💬┃general"],
      ["📸┃media"],
      ["⚔️┃unstable-chats"],
      ["🔔┃advanced-matchmaking-info", "🔔┃advanced-matchmaking-alerts"],
      ["🗡️┃advanced-matchmaking"],
      ["⚔┃find-a-duel"],
      ["🤖┃bot-commands", "🤖┃commands"],
    ],
  },
  {
    name: "📩 Requests",
    aliases: ["📩 SUPPORT", "06 · SUPPORT"],
    channels: [
      ["❓┃common-questions", "❓┃faq"],
      ["🏡┃community-support", "help"],
      ["📨┃request-test", "🧪┃request-test"],
      ["📬┃request-support", "📩┃support-tickets"],
      ["📋┃staff-applications", "📋┃applications"],
    ],
  },
  {
    name: "🎊 Community",
    channels: [
      ["📊┃polls"],
      ["🎉┃events"],
      ["💡┃suggestions"],
      ["👋┃introductions"],
      ["📚┃guides-and-coaching"],
    ],
  },
  {
    name: "🧪 Testing",
    aliases: ["🔨 TESTING", "03 · TESTING DESK"],
    channels: [
      ["📊┃testing-status", "📊・testing-status"],
      ["⏳┃cooldowns", "⏳・cooldowns"],
      ["📋┃tester-applications", "📝┃applications"],
      ["📋┃test-queue", "test-queue"],
    ],
  },
  ...config.modes.map((m) => ({
    name: m.name + " Testing",
    channels: [[m.id.replaceAll("_", "-") + "-waitlist"]],
  })),
  ...["EU", "NA", "AS"].map((region) => ({
    name: region + " Regional Testing",
    aliases: [region + " REGIONAL TESTING"],
    channels: [
      ["waitlist-" + region.toLowerCase(), region.toLowerCase() + "-queue"],
    ],
  })),
  { name: "🔊 Voice", aliases: ["🔊 VOICE"], channels: [] },
  {
    name: "⚔️ Tester Control",
    aliases: ["⚔️ TESTER CONTROL CENTER"],
    private: true,
    channels: [
      ["⚔️┃tester-dashboard", "⚔️・tester-dashboard"],
      ["📋┃tester-commands", "📋・tester-commands"],
      ["📊┃tester-statistics", "📊・tester-statistics"],
      ["👑┃high-tier-requests", "👑・high-tier-requests"],
      ["🔍┃testing-logs", "🔍・testing-logs"],
    ],
  },
  {
    name: "🛡 Staff",
    aliases: ["🛡 STAFF", "10 · STAFF"],
    private: true,
    channels: [
      ["💬┃staff-chat", "staff-chat"],
      ["📋┃test-review", "test-review"],
      ["🚨┃moderation-log", "moderation-log"],
      ["📬┃ticket-log", "ticket-log"],
      ["📖┃staff-handbook", "staff-handbook"],
      ["📁┃moderator-cases", "moderator-cases"],
      ["🛡️┃staff-dashboard", "🛡️・staff-dashboard"],
      ["🔧┃system-health", "🔧・system-health"],
      ["🚨┃reports", "🚨・reports"],
      ["🧾┃appeals", "🧾・appeals"],
    ],
  },
  {
    name: "🔒 Private Tickets",
    aliases: ["🔒 PRIVATE TICKETS"],
    private: true,
    channels: [],
  },
  {
    name: "📁 Ticket Archive",
    aliases: ["📁 TICKET ARCHIVE"],
    private: true,
    channels: [],
  },
];

export const referenceGuides = {
  welcome: [
    "👋 Welcome to the community",
    "Find your next match. Improve your game. Earn your tier.\n\n**1.** Choose your modes and alerts.\n**2.** Verify your Minecraft Java account.\n**3.** Read the ranked rules and approved kit.\n**4.** Join an open regional testing queue.\n\nYour profile, results and cooldown are available privately through the player desk.",
    ["Verify Account", "verify:start", "Player Desk", "community:desk"],
  ],
  information: [
    "📋 Getting Started",
    "**For players**\nVerify your IGN, choose a Mace mode and region, then join an open queue. A tester opens your private test room when it is your turn.\n\n**During your test**\nConfirm the kit, server, version and rules before playing. Follow your tester’s instructions in the room.\n\n**After your test**\nYour approved result appears in results. `/profile` shows current and peak tiers; `/cooldown status` shows your retest time.",
    ["Find a Test", "community:boards", "My Profile", "community:self"],
  ],
  rules: [
    "📜 Community Rules",
    "**Respect everyone.** No harassment, hate speech, doxxing or threats.\n**Play fairly.** No cheats, macros, account sharing, boosting or staged tests.\n**Use the right channel.** Commands belong in bot-commands; reports belong in private support.\n**Protect your account.** Never share passwords, tokens or backup codes.\n**Respect the assessment.** Agree the kit and recording before playing. Tiers require evidence and independent review where applicable.\n**Keep it honest.** No bought ranks, queue priority or false reports.",
    ["Get Support", "hub:ticket"],
  ],
  "request-test": [
    "📝 Evaluation Testing Waitlist",
    "Select your testing mode and region to get started.\n\n• **Region:** choose where you can play reliably.\n• **Username:** use the Java account you will test on.\n• **Queue:** join when an approved tester opens a session.\n• **Closed session:** save waitlist interest for future availability.\n\n**Provide accurate account and region information.**\nSaved interest does not reserve a live queue position.",
    [
      "Verify Account",
      "verify:start",
      "Enter Waitlist",
      "community:boards",
      "View Cooldown",
      "community:desk",
    ],
  ],
  "request-support": [
    "📬 Support Tickets",
    "Choose account assistance, a player report or general support. Staff reports are handled through a separate confidential route.\n\nInclude a short description and relevant message or match links. A private channel keeps the discussion together. Never include login credentials.",
    ["Open a Ticket", "hub:ticket"],
  ],
  "common-questions": [
    "❓ Common Questions",
    "**How do I get tested?**\nVerify your Java IGN, choose a mode and region, then join an open queue.\n\n**Why is the queue closed?**\nA qualified tester must open an approved session first.\n\n**How do I leave?**\nUse Leave Queue or `/leave mode`. An active test needs your assigned tester.\n\n**Where is my rank?**\nUse `/profile`, or open the player roster.\n\n**When can I retest?**\nUse `/cooldown status mode region`.\n\n**Can I appeal?**\nUse `/appeal submit` for independent review.",
    ["Find a Test", "community:boards", "Get Support", "hub:ticket"],
  ],
  "bot-commands": [
    "🤖 Bot Commands",
    "**Players**\n`/profile [ign] [user]` — current tiers, points and region\n`/check_verification` — linked account\n`/queue-board mode region` — live queue\n`/leave mode` — leave a waiting queue\n`/cooldown status mode region` — retest time\n`/ticket` — private support\n\n**Tester statistics**\n`/testerlb` — this UTC month\n`/testerlbtotal` — all time\n`/testerlbuser user` — tester statistics\n`/hightesterlb` · `/hightesterlbtotal` · `/htlb` — HT3+ tests\n\n**Testers**\n`/start` → `/next` → `/match` → `/assessment` → `/result`\n`/pause` · `/resume` · `/end` manage your availability.\n\n**Management**\n`/cdreset` · `/restrict` · `/unrestrict` use audited, mode-specific decisions and the existing confirmation rules.",
    ["My Profile", "community:self", "Find a Test", "community:boards"],
  ],
  "tester-commands": [
    "📋 Tester Commands",
    "**Open testing**\n`/start mode region` opens your availability using an approved kit.\n\n**Take the next player**\n`/next mode region` checks your qualification, claims the next waiting player and opens a private room.\n\n**Complete the assessment**\nUse the room controls and `/match` to track readiness and score. Record the six assessment dimensions, then publish with `/result`. Required independent high-tier review stays in place.\n\n**Take a break**\n`/pause`, `/resume` and `/end` change your own availability. Active tests retain their assignment.\n\n**Statistics**\n`/testerlbuser` shows your genuine documented test counts and availability hours.",
    [
      "Tester Desk",
      "network:tester-stats",
      "Leaderboard",
      "network:tester-leaderboard",
    ],
  ],
  "community-support": [
    "🏡 Community Support",
    "Ask quick setup and community questions here. For account details, reports, appeals or a private conversation with staff, open a support ticket.",
    ["Private Support", "hub:ticket"],
  ],
  polls: [
    "📊 Community Polls",
    "Share clear proposals and vote respectfully. State the question, choices and closing time. Native Discord polls can be created here.",
  ],
  events: [
    "🎉 Community Events",
    "Community matches and events belong here. Include the mode, region, version, rules, host and UTC start time. Watch announcements for confirmed events.",
  ],
  introductions: [
    "👋 Introductions",
    "Tell us your Minecraft name, region, favourite modes and what you want to improve. Keep personal information private.",
  ],
  "guides-and-coaching": [
    "📚 Guides & Coaching",
    "Share useful techniques, annotated clips and practice advice. Explain the mode and version, credit your sources and keep feedback specific.",
  ],
  "advanced-matchmaking-info": [
    "🔔 Advanced Matchmaking",
    "Find a suitable practice partner in advanced-matchmaking. Include your mode, tier, region, server and availability. Practice matches do not create official placements.",
  ],
};
