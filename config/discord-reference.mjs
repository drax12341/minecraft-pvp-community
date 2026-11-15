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
    "👋 Welcome to the Community",
    "**Play. Improve. Earn your tier.**\nVerify your Java IGN, pick your mode and join an open queue.",
    ["Verify Account", "verify:start", "Player Desk", "community:desk"],
  ],
  information: [
    "📋 Start Here",
    "**Verify → Queue → Test → Result**\nUse your own Java account. Your tester confirms the kit and rules before play.",
    ["Find a Test", "community:boards", "My Profile", "community:self"],
  ],
  rules: [
    "📜 Community Rules",
    "**Respect people. Play fairly. Protect your account.**\nNo harassment, cheats, boosting or bought tiers. Keep reports private; never share login details.",
    ["Get Support", "hub:ticket"],
  ],
  "request-test": [
    "📝 Request a Test",
    "**Choose your mode and region.**\nJoin when testing is open. Closed? Save waitlist interest for the next session.",
    [
      "Verify Account",
      "verify:start",
      "Enter Waitlist",
      "community:boards",
      "My Status",
      "community:desk",
    ],
  ],
  "request-support": [
    "📬 Private Support",
    "**Need a hand?**\nOpen a ticket with a short explanation and relevant links. Account issues and reports stay private.",
    ["Open a Ticket", "hub:ticket"],
  ],
  "common-questions": [
    "❓ Quick Answers",
    "**Rank:** `/profile` · **Retest:** `/cooldown status`\n**Leave:** `/leave` · **Appeal:** `/appeal submit`\nTesting opens when a qualified tester is available.",
    ["Find a Test", "community:boards", "Get Support", "hub:ticket"],
  ],
  "bot-commands": [
    "🤖 Command Desk",
    "**Your profile, tests and support—in one place.**\n`/profile` · `/queue-board` · `/cooldown` · `/ticket`\nStaff: `/staff-help` shows tools available to your roles.",
    ["My Profile", "community:self", "Find a Test", "community:boards"],
  ],
  "tester-commands": [
    "⚔️ Tester Tools",
    "**Start → Next → Assess → Result**\n`/start` · `/next` · `/match` · `/assessment` · `/result`\nTake a break with `/pause`; end availability with `/end`.",
    [
      "Tester Desk",
      "network:tester-stats",
      "Leaderboard",
      "network:tester-leaderboard",
    ],
  ],
  "community-support": [
    "🏡 Ask the Community",
    "Quick questions belong here. Use a **private ticket** for accounts, reports or appeals.",
    ["Private Support", "hub:ticket"],
  ],
  polls: [
    "📊 Have Your Say",
    "One clear question. Fair choices. A closing time. Use native Discord polls.",
  ],
  events: [
    "🎉 Community Events",
    "**Mode · Region · Rules · UTC start**\nLook here for confirmed events and community matches.",
  ],
  introductions: [
    "👋 Introduce Yourself",
    "Your IGN, region and favourite modes. What are you working on?",
  ],
  "guides-and-coaching": [
    "📚 Learn Something New",
    "Share techniques, practice tips and annotated clips. Credit sources and keep feedback useful.",
  ],
  "advanced-matchmaking-info": [
    "⚔️ Find Your Match",
    "**Mode · Tier · Region · Server · Time**\nPractice matches help you improve; official testing awards tiers.",
  ],
};
