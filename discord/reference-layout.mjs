import { REST, Routes, PermissionFlagsBits as P } from 'discord.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { rankedPolicy } from '../config/ranked-policy.mjs';

export const tierlistChannels = [
  ['📖┃ranked-rubric'], ['📖┃ranked-ruleset', '📕┃testing-kits'],
  ['🖥️┃testing-servers', '✅┃verified-servers'], ['🚨┃staff-movements'],
  ['⛔┃punishments'], ['🏅┃testing-leaderboard'], ['🏅┃high-tests'],
  ['🏆┃high-results'], ['🏆┃results'], ['📋┃forum-posting'],
];
export function policyEmbeds() {
  return rankedPolicy.map(([title, description], index) => ({
    title, description, color: 0x8eb5ef,
    footer: { text: `Mace Community · Ranked policy · ${index + 1}` },
  }));
}
export async function applyLayout() {
  const guild = process.env.DISCORD_GUILD_ID;
  if (guild !== '1568767259168608267') throw Error('Unexpected Discord guild');
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const me = await rest.get(Routes.user('@me'));
  const server = await rest.get(Routes.guild(guild));
  let channels = await rest.get(Routes.guildChannels(guild));
  const roles = await rest.get(Routes.guildRoles(guild));
  await mkdir('.runtime', { recursive: true });
  await writeFile(`.runtime/reference-layout-before-${Date.now()}.json`, JSON.stringify({ channels, roles }, null, 2));
  const staff = roles.filter(r => ['Community Moderator','Moderator','Tier Tester','Senior Tester','Gamemode Manager','Support Team','Helper'].includes(r.name));
  const write = P.ViewChannel | P.SendMessages | P.ReadMessageHistory | P.EmbedLinks | P.AttachFiles | P.SendMessagesInThreads | P.CreatePublicThreads;
  const permissions = (chat = false) => [
    { id: guild, type: 0, allow: String(P.ViewChannel | P.ReadMessageHistory | (chat ? P.SendMessages | P.SendMessagesInThreads | P.CreatePublicThreads : 0n)), deny: chat ? '0' : String(P.SendMessages | P.CreatePublicThreads | P.CreatePrivateThreads | P.SendMessagesInThreads) },
    ...staff.map(r => ({ id: r.id, type: 0, allow: String(write), deny: '0' })),
    { id: me.id, type: 1, allow: String(write), deny: '0' },
  ];
  const report = { channels: [], panels: [], leaderboard: null };
  async function ensure(name, parent, old, chat = false, forum = false) {
    let c = channels.find(c => c.name === name) || channels.find(c => old && c.name === old);
    const type = parent ? forum && server.features.includes('COMMUNITY') ? 15 : 0 : 4;
    const body = { name, ...(parent ? { parent_id: parent } : {}), permission_overwrites: permissions(chat) };
    c = c ? await rest.patch(Routes.channel(c.id), { body }) : await rest.post(Routes.guildChannels(guild), { body: { ...body, type } });
    channels = channels.filter(x => x.id !== c.id).concat(c);
    report.channels.push({ id: c.id, name: c.name, type: c.type });
    return c;
  }
  const tierlist = await ensure('📄 Tierlist');
  const byName = new Map();
  for (const [name, old] of tierlistChannels) byName.set(name, await ensure(name, tierlist.id, old, name.includes('forum-posting'), name.includes('forum-posting')));
  const general = await ensure('🌍 General', null, '💬 COMMUNITY');
  const generalNames = [['💬┃general'], ['📸┃media','🎬┃clips'], ['⚔️┃unstable-chats'], ['🔔┃advanced-matchmaking-alerts'], ['🗡️┃advanced-matchmaking'], ['⚔┃find-a-duel'], ['🤖┃commands'], ['💡┃suggestions']];
  for (const [name, old] of generalNames) byName.set(name, await ensure(name, general.id, old, true));
  const info = channels.find(c => c.name === '📌 INFORMATION');
  byName.set('📰┃tester-of-the-month', await ensure('📰┃tester-of-the-month', info.id));
  async function panel(channel, key, embeds, components = []) {
    const marker = `Mace Community · Reference · ${key}`;
    const messages = await rest.get(Routes.channelMessages(channel.id), { query: new URLSearchParams({ limit: '100' }) });
    const prior = messages.find(m => m.author.id === me.id && m.embeds?.some(e => e.footer?.text === marker));
    const body = { embeds: embeds.map((e, i) => ({ ...e, ...(i === embeds.length - 1 ? { footer: { text: marker } } : {}) })), components, allowed_mentions: { parse: [] } };
    const msg = prior ? await rest.patch(Routes.channelMessage(channel.id, prior.id), { body }) : await rest.post(Routes.channelMessages(channel.id), { body });
    report.panels.push({ channel: channel.name, id: msg.id, key });
    return msg;
  }
  const embed = (title, description, color = 0x8eb5ef) => [{ title, description, color }];
  for (let i = 0; i < policyEmbeds().length; i++) await panel(byName.get('📖┃ranked-rubric'), 'policy-' + i, [policyEmbeds()[i]]);
  await panel(byName.get('📖┃ranked-rubric'), 'rankings', embed('🏆 View the rankings', '[Community rankings](https://minecraft-pvp-community.draxion0.chatgpt.site/#rankings)\n[Reference Mace rankings · MCTIERS](https://mctiers.com/rankings/mace)'));
  // Preserve the existing server list; restyle its already-published regional content.
  const servers = byName.get('🖥️┃testing-servers');
  const serverMessages = await rest.get(Routes.channelMessages(servers.id), { query: new URLSearchParams({ limit: '100' }) });
  const serverPanel = serverMessages.find(m => m.author.id === me.id && m.embeds?.some(e => e.title?.includes('Testing Servers')));
  if (serverPanel) await rest.patch(Routes.channelMessage(servers.id, serverPanel.id), { body: { embeds: serverPanel.embeds.map(({ title, description, footer }) => ({ title: '🖥️ Testing Servers', description, footer, color: 0x8eb5ef })), allowed_mentions: { parse: [] } } });
  await panel(byName.get('📖┃ranked-ruleset'), 'ruleset', embed('📖 Ranked Ruleset', `Use <#${byName.get('📖┃ranked-rubric').id}> for promotion, demotion, forfeit, cooldown and peak-tier rules.\n\nAgree the exact kit, version, allowed mods, arena and reset rules with staff before playing. The kit menu below contains assessment guidance; staff must approve exact loadouts before opening sessions.\n\n**Staff adjudication:** phase progression, strikes, replacement margins, forfeits, pending demotions and peak tiers require staff records and review. The bot currently tracks session queues and published placements.`));
  await panel(byName.get('🚨┃staff-movements'), 'staff-movements', embed('🚨 Staff Movements', 'Staff appointments, promotions, transfers and departures are recorded here by management.'));
  await panel(byName.get('⛔┃punishments'), 'punishments', embed('⛔ Punishments', 'Staff publish public moderation outcomes here. Report players or appeal a decision through a private support ticket.'));
  await panel(byName.get('🏅┃high-tests'), 'high-tests', embed('🏅 High Tests', 'HT3+ testing coordination and staff-approved match assignments. Start with the test request menu; an assigned qualified tester coordinates your private testing room. Read the ranked rubric before accepting an assignment.'));
  await panel(byName.get('🏆┃high-results'), 'high-results', embed('🏆 High Results', `Staff-reviewed HT3+ results and rank defenses. The bot’s complete official result feed remains <#${byName.get('🏆┃results').id}>.`));
  await panel(byName.get('🤖┃commands'), 'commands', embed('🤖 Testing Commands', '**/guide** — getting started\n**/availability** — sessions by mode and region\n**/waitlist status** — saved waitlist preferences\n**/queue status mode region** — account, queue, latest result and current session cooldown\n**/profile** — player lookup\n**/ticket** — private support\n\nA failed tier test has a 30-day cooldown under the ranked policy. Staff must record and enforce failed-test restrictions separately from the bot’s session-configured retest cooldown.'));
  const request = channels.find(c => c.name === '🧪┃request-test');
  const requestMessages = await rest.get(Routes.channelMessages(request.id), { query: new URLSearchParams({ limit: '100' }) });
  const requestPrior = requestMessages.find(m => m.author.id === me.id && m.embeds?.some(e => e.title?.includes('Evaluation Testing')));
  const button = (label, custom_id) => ({ type: 2, style: 1, label, custom_id });
  const requestBody = { embeds: embed('📝 Evaluation Testing Waitlist', `Upon applying, choose your testing mode and region. When a session is closed, save your waitlist preference; when it opens, join the active queue. An assigned tester opens your private testing room.\n\n• **Region** should match the server you wish to test on.\n• **Username** must match the Minecraft account you will test on.\n• HT3+ tests require staff coordination in <#${byName.get('🏅┃high-tests').id}>.\n\n**🛑 Failure to provide authentic information will result in a denied test.**\n\n**Verify Account:** choose account verification in the private support menu.\n**View Cooldown:** opens the command guide; run /queue status with your mode and region.`, 0xff087a), components: [{ type: 1, components: [button('Verify Account', 'hub:ticket'), button('Enter Waitlist', 'hub:test'), { type: 2, style: 5, label: 'View Cooldown', url: `https://discord.com/channels/${guild}/${byName.get('🤖┃commands').id}` }] }], allowed_mentions: { parse: [] } };
  if (requestPrior) await rest.patch(Routes.channelMessage(request.id, requestPrior.id), { body: requestBody });
  else await rest.post(Routes.channelMessages(request.id), { body: requestBody });
  // Count only genuine result announcements, deduplicated by durable assessment ID.
  const counts = new Map(), monthly = new Map(), seen = new Set();
  const now = new Date(), month = now.toISOString().slice(0, 7);
  let before;
  while (true) {
    const batch = await rest.get(Routes.channelMessages(byName.get('🏆┃results').id), { query: new URLSearchParams({ limit: '100', ...(before ? { before } : {}) }) });
    for (const m of batch) for (const e of m.embeds || []) {
      const id = e.footer?.text?.match(/^Assessment (.+)$/)?.[1];
      const tester = e.fields?.find(f => f.name === 'Tester')?.value?.match(/^<@!?(\d+)>$/)?.[1];
      if (m.author.id !== me.id || !id || !tester || seen.has(id)) continue;
      seen.add(id); counts.set(tester, (counts.get(tester) || 0) + 1);
      if (m.timestamp.startsWith(month)) monthly.set(tester, (monthly.get(tester) || 0) + 1);
    }
    if (batch.length < 100) break;
    before = batch.at(-1).id;
  }
  const lines = map => [...map].sort((a,b) => b[1] - a[1]).slice(0,10).map(([user,n],i) => `**${i+1}.** <@${user}> — **${n}** tests`).join('\n') || 'No completed tests recorded yet.';
  const monthName = now.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  await panel(byName.get('🏅┃testing-leaderboard'), 'leaderboard', [{ title: '🏆 All Time Testing Leaderboard', description: lines(counts), color: 0x7858ff }, { title: `🏅 ${monthName} Testing Leaderboard`, description: `${lines(monthly)}\n\n**Total Tests in ${monthName}: ${[...monthly.values()].reduce((a,b)=>a+b,0)}**\n\nBased on recorded Discord assessment announcements. Snapshot refreshed <t:${Math.floor(now.getTime()/1000)}:f> by staff.`, color: 0x7858ff }]);
  report.leaderboard = { total: seen.size, month, monthly: [...monthly.values()].reduce((a,b)=>a+b,0), source: 'Discord assessment announcements; manual refresh with this script' };
  await panel(byName.get('📰┃tester-of-the-month'), 'tester-month', embed('📰 Tester of the Month', `Monthly recognition for completed, documented tests and helpful testing conduct.\n\nSee <#${byName.get('🏅┃testing-leaderboard').id}> for recorded counts. Staff announce the winner after review.`, 0x7858ff));
  const forum = byName.get('📋┃forum-posting');
  await rest.patch(Routes.channel(forum.id), { body: { topic: 'Testing discussions: include mode, region, tier, UTC availability and shareable evidence. Private reports and appeals belong in support tickets.' } });
  if (forum.type === 0) await panel(forum, 'forum-guide', embed('📋 Forum Posting', 'Discuss testing here. Include mode, region, tier and UTC availability. Use private support for reports and appeals.'));
  const categories = ['📌 INFORMATION','📄 Tierlist','🌍 General','🔨 TESTING','📩 SUPPORT', 'Mace Testing','Spear Mace Testing','High Tier Mace Testing','Low Tier Mace Testing','OG Mace Testing','Rod Mace Testing','Rocket Mace Testing','🔊 VOICE','🔒 PRIVATE TICKETS','📁 TICKET ARCHIVE','🛡 STAFF'];
  await rest.patch(Routes.guildChannels(guild), { body: categories.map((name,position) => ({ id: channels.find(c=>c.name===name)?.id, position })).filter(c=>c.id) });
  const ordered = [...tierlistChannels.map(([name])=>byName.get(name)), ...generalNames.map(([name])=>byName.get(name))];
  await rest.patch(Routes.guildChannels(guild), { body: ordered.map((c,position)=>({id:c.id,position})) });
  const after = await rest.get(Routes.guildChannels(guild));
  for (const [name] of tierlistChannels) if (!after.some(c=>c.name===name && c.parent_id===tierlist.id)) throw Error('Missing tierlist channel: '+name);
  await writeFile('.runtime/reference-layout-report.json', JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--apply')) await applyLayout();
  else console.log(JSON.stringify({ category: '📄 Tierlist', channels: tierlistChannels, policy: rankedPolicy, note: 'Pass --apply to update Discord. Existing IDs and message history are retained.' }, null, 2));
}
