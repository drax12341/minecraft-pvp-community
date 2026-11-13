import config from '../config/community.json' with { type: 'json' };
import { communityDeskCommands } from '../config/community-desk.mjs';
import { staffAccess } from '../config/community-roles.mjs';
import { requireQualification } from './journeys.mjs';

export const communityDeskNames = new Set(communityDeskCommands.map(c => c.name));
const communityRegions = ['EU','NA','AS','SA','AU','AF','ME','OC'];
const communityRank = r => `${r.pos === 0 ? 'HT' : 'LT'}${r.tier}`;
const communityMode = id => {
  const mode = config.modes.find(m => m.id === id);
  if (!mode) throw Error('Choose a valid community testing mode.');
  return mode;
};
const communityButton = (label, custom_id, style = 2, disabled = false) => ({ type: 2, label, custom_id, style, disabled });
const communityRow = (...components) => ({ type: 1, components });
const communityMessage = (content, components = []) => ({ content, components, allowed_mentions: { parse: [] } });
const communityURL = 'https://minecraft-pvp-community.draxion0.chatgpt.site';

export async function communityQueueBoard(store, mode, region) {
  const kit = communityMode(mode);
  if (!communityRegions.includes(region)) throw Error('Choose a valid region.');
  const session = await store.one('SELECT * FROM sessions WHERE mode=? AND region=?', mode, region);
  const counts = await store.one("SELECT count(*) AS occupied,sum(status='waiting') AS waiting,sum(status='claimed') AS claimed FROM queue WHERE mode=? AND region=? AND status IN ('waiting','claimed')", mode, region);
  const active = await store.all("SELECT q.tester,a.name FROM queue q JOIN accounts a ON a.discord=q.user WHERE q.mode=? AND q.region=? AND q.status='claimed' ORDER BY q.created,q.id LIMIT 20", mode, region);
  const capacity = Math.min(session?.capacity ?? 20, 20);
  const state = session?.status || 'Not scheduled';
  const full = counts.occupied >= capacity;
  const badge = state === 'open' ? (full ? 'FULL' : 'OPEN') : state.toUpperCase();
  const testers = active.length ? active.map(q => `<@${q.tester}> → **${q.name}**`).join('\n') : 'No player is being tested right now.';
  return {
    ...communityMessage(''),
    embeds: [{
      title: `${kit.name} · ${region} · Testing Waitlist`,
      color: state === 'open' && !full ? 0x58c89b : state === 'paused' ? 0xe9bb62 : 0x8994a8,
      description: `**${badge} · ${counts.occupied}/${capacity} slots**\n${counts.waiting || 0} waiting · ${counts.claimed || 0} being tested\n\n**Tester → currently testing**\n${testers}`,
      fields: [
        { name: 'Session host', value: session?.actor ? `<@${session.actor}>` : session ? 'Use Refresh for tester details.' : 'No tester has opened this session.', inline: true },
        { name: 'Retest cooldown', value: session ? `${session.cooldown} hours` : 'Set when staff open a session.', inline: true },
        { name: 'How it works', value: 'Verify Minecraft ownership first. Join an open session; a qualified tester calls you into a private room. Both confirm readiness before playing. Waiting and active tests share the 20 slots. No guaranteed waiting time.' },
      ],
      footer: { text: `${config.name} · Waitlist ${mode}/${region} · Refresh for latest state` },
      timestamp: new Date().toISOString(),
    }],
    components: [communityRow(
      communityButton('Join waitlist', `board:join:${mode}:${region}`, 3, state !== 'open' || full),
      communityButton('Leave waitlist', `board:leave:${mode}:${region}`),
      communityButton('My status', `board:status:${mode}:${region}`, 1),
      communityButton('Refresh', `board:refresh:${mode}:${region}`),
      communityButton('Testing guide', 'hub:guide'),
    ), {type:1,components:[{type:3,custom_id:'board:region:'+mode,placeholder:'Choose another region',min_values:1,max_values:1,options:communityRegions.map(value=>({label:value,value,default:value===region}))}]}],
  };
}

export async function refreshCommunityBoards(store, env, request = fetch, mode = '', region = '') {
  const saved = await store.all("SELECT * FROM queue_boards WHERE (?='' OR mode=?) AND (?='' OR region=?) LIMIT 56", mode, mode, region, region);
  const configured = (config.queueBoards || []).filter(b=>b.guild===env.DISCORD_GUILD_ID&&(!mode||b.mode===mode)&&(!region||b.region===region));
  const boards = [...new Map([...configured,...saved].map(b=>[b.mode+'/'+b.region,b])).values()];
  let updated = 0, failed = 0;
  for (const board of boards) {
    try {
      const body = await communityQueueBoard(store, board.mode, board.region);
      const response = await request(`https://discord.com/api/v10/channels/${board.channel}/messages/${board.message}`, {
        method: 'PATCH', headers: { Authorization: 'Bot ' + env.DISCORD_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) failed++; else updated++;
    } catch { failed++; }
  }
  return { updated, failed };
}

export async function runCommunityDesk(i, env, store, request = fetch, dispatch) {
  const { actor, mod, tester } = staffAccess(i, env);
  const sub = i.data.options?.find(o => o.type === 1);
  const options = sub?.options || i.data.options || [];
  const get = name => options.find(o => o.name === name)?.value;
  const invoke = (name, action, values) => {
    const args = Object.entries(values).map(([name, value]) => ({ name, value }));
    return dispatch({ ...i, type: 2, data: { name, options: action ? [{ type: 1, name: action, options: args }] : args } });
  };
  const mode = () => communityMode(get('mode')).id;
  const now = () => new Date().toISOString();
  const explanation = () => {
    const reason = get('reason');
    if (typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 1000) throw Error('Include an explanation of 10–1000 characters.');
    return reason.trim();
  };
  const staffOnly = () => { if (!tester) throw Error('Only testers and moderators can open the staff workspace.'); };
  switch (i.data.name) {
    case 'desk': {
      const account = await store.one('SELECT name FROM accounts WHERE discord=?', actor);
      const entries = await store.one("SELECT count(*) n FROM queue WHERE user=? AND status IN ('waiting','claimed')", actor);
      return communityMessage(`**${config.name} · Your player desk**\n${account ? `Verified player: **${account.name}**` : 'Start by verifying your Minecraft account privately with staff.'}\n${entries.n} active evaluation${entries.n === 1 ? '' : 's'}\n\nChoose a testing mode to see your next step. Your profile, history and support cases are one click away.`, [
        communityRow(communityButton('My testing hub', 'desk:my-hub', 1), communityButton('My profile', 'community:self'), communityButton('My history', 'community:history')),
        communityRow(communityButton('Testing waitlists', 'community:boards', 3), communityButton('High-tier test', 'desk:player'), communityButton('Get support', 'hub:ticket')),
        communityRow(communityButton('Apply as tester', 'desk:tester'), communityButton('Roles & alerts', 'hub:interests'), communityButton('Guide', 'hub:guide')),
      ]);
    }
    case 'queue-board': {
      const m = mode(), region = get('region'), board = await communityQueueBoard(store, m, region);
      if (!get('publish')) return board;
      if (!mod) throw Error('Only moderators can publish a public waitlist board.');
      if (!/^\d{5,22}$/.test(i.channel_id || '')) throw Error('Publish from the intended guild text channel.');
      const discord = async (path, method = 'GET', body) => {
        const response = await request('https://discord.com/api/v10' + path, { method, headers: { Authorization: 'Bot ' + env.DISCORD_TOKEN, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw Error('Discord could not publish this board. Check channel permissions and retry the same command.');
        return response.json();
      };
      const channel = await discord('/channels/' + i.channel_id);
      if (channel.guild_id !== env.DISCORD_GUILD_ID || channel.type !== 0) throw Error('Choose a text channel in this community server.');
      const saved = await store.one('SELECT * FROM queue_boards WHERE mode=? AND region=?', m, region);
      if (saved && saved.channel !== i.channel_id) throw Error('This board is already published in <#'+saved.channel+'>. Refresh it there to avoid duplicate public boards.');
      let messageId = saved?.message;
      if (!messageId) {
        const recent = await discord(`/channels/${i.channel_id}/messages?limit=100`);
        messageId = recent.find(message => message.author?.id === env.DISCORD_CLIENT_ID && message.embeds?.some(e => e.footer?.text === board.embeds[0].footer.text))?.id;
      }
      if (messageId) await discord(`/channels/${i.channel_id}/messages/${messageId}`, 'PATCH', board);
      else {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.DISCORD_GUILD_ID}/${m}/${region}`));
        const nonce = Array.from(new Uint8Array(digest)).slice(0,12).map(b=>b.toString(16).padStart(2,'0')).join('');
        const message = await discord(`/channels/${i.channel_id}/messages`, 'POST', {...board,nonce,enforce_nonce:true});
        messageId = message.id;
      }
      await store.statement('INSERT INTO queue_boards VALUES(?,?,?,?) ON CONFLICT(mode,region) DO UPDATE SET message=excluded.message WHERE channel=excluded.channel', m, region, i.channel_id, messageId).run();
      return communityMessage(`Waitlist board published: https://discord.com/channels/${env.DISCORD_GUILD_ID}/${i.channel_id}/${messageId}\nIt refreshes after queue, session and test actions. Members can use Refresh for the current state.`);
    }
    case 'pull': {
      staffOnly();
      const m = mode(), region = get('region');
      if (!communityRegions.includes(region)) throw Error('Choose a valid region.');
      if (!env.DISCORD_TICKET_CATEGORY_ID) throw Error('Configure the private testing category before pulling players.');
      await requireQualification(store, actor, m);
      let entry = await store.one("SELECT id FROM queue WHERE tester=? AND mode=? AND region=? AND status='claimed'", actor, m, region);
      if (!entry) entry = { id: await store.claimNext(m, region, actor) };
      const linked = await store.one("SELECT id FROM high_tests WHERE queue_id=? AND status='claimed'", entry.id);
      if (linked) throw Error('This is a promotion assessment. Continue in its /high-test dashboard; its existing ticket is retained.');
      const room = await invoke('test-room', 'open', { id: entry.id });
      return communityMessage(`**Your next assessment is ready**\n${room}\n\nUse the room controls to confirm readiness. Record the rubric before publishing a result. If room creation failed previously, this recovered the same assignment.`, [communityRow(
        communityButton('Assessment status', `room:status:${entry.id}`),
        communityButton('Confirm ready', `room:ready:${entry.id}`, 3),
        communityButton('Record assessment', `room:assess:${entry.id}`, 1),
      )]);
    }
    case 'leaderboard': return invoke('roster', null, { mode: mode() });
    case 'player': {
      if (!['self','view','history'].includes(sub?.name)) throw Error('Choose self, view or history.');
      const name = get('name');
      if (name && !/^\w{3,16}$/.test(name)) throw Error('Enter a valid Minecraft username.');
      if (get('mode')) mode();
      const account = name ? null : await store.one('SELECT uuid,name FROM accounts WHERE discord=?', actor);
      const player = (await store.rankings(config.points)).players.find(p => name ? p.name.toLowerCase() === name.toLowerCase() : p.uuid === account?.uuid);
      if (sub.name === 'history') {
        const uuid = player?.uuid || account?.uuid;
        if (!uuid) return communityMessage('No published history found. Use /desk to get started.');
        const rows = await store.all("SELECT r.id,r.mode,r.tier,r.pos,r.created,r.evidence FROM results r WHERE uuid=? AND (?='' OR mode=?) AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) ORDER BY sequence DESC LIMIT 10", uuid, get('mode') || '', get('mode') || '');
        return communityMessage(`**${player?.name || account.name} · Placement history**\n` + (rows.map(r => `**${communityRank(r)} ${communityMode(r.mode).name}** · <t:${Math.floor(Date.parse(r.created)/1000)}:d>\n${r.id} · [Match evidence](${r.evidence})`).join('\n\n') || 'No published results yet.') + '\n\nLast 10 valid results. Revoked placements and private appeal notes are excluded.');
      }
      if (!player) return communityMessage(account ? `**${account.name}** · Verified, unranked\nRequest your first evaluation from /desk.` : 'No published placement found. Verify ownership through the private support panel in /desk.');
      return communityMessage(`**${player.name} · ${player.region} · ${player.points} active points**\n` + Object.entries(player.rankings).map(([m,r]) => `${communityMode(m).name}: **${communityRank(r)}${r.retired ? ' · Retired' : ''}** · peak ${communityRank({tier:r.peak_tier,pos:r.peak_pos})}`).join('\n'), [communityRow({ type: 2, style: 5, label: 'Open player profile', url: communityURL + '/#rankings?player=' + encodeURIComponent(player.uuid) })]);
    }
    case 'tester': {
      if (sub?.name === 'desk') {
        staffOnly();
        const entry = await store.one("SELECT q.*,a.name,r.channel FROM queue q JOIN accounts a ON a.discord=q.user LEFT JOIN test_rooms r ON r.id=q.id WHERE q.tester=? AND q.status='claimed'", actor);
        const demand = await store.all("SELECT q.mode,q.region,count(*) n FROM queue q JOIN tester_qualifications t ON t.mode=q.mode AND t.user=? WHERE q.status='waiting' GROUP BY q.mode,q.region ORDER BY n DESC,q.mode,q.region LIMIT 7", actor);
        const buttons = entry ? [communityRow(communityButton('Open / recover room', `room:open:${entry.id}`, 1), communityButton('Ready', `room:ready:${entry.id}`, 3), communityButton('Score rubric', `room:assess:${entry.id}`), communityButton('Publish result', `room:result:${entry.id}`))] : [];
        return communityMessage(`**Tester workspace**\n${entry ? `Assigned: **${entry.name}** · ${communityMode(entry.mode).name} / ${entry.region}\nAssessment: ${entry.id}${entry.channel ? ` · <#${entry.channel}>` : ''}` : 'No active assignment. /pull mode region selects the next eligible player and opens their private room.'}\n\n**Waiting in your qualified modes**\n${demand.map(r => `${communityMode(r.mode).name} / ${r.region}: ${r.n}`).join('\n') || 'No waiting players in your qualified modes.'}\n\nHigh-tier promotions keep their /high-test dashboard, opponent sets and independent review. /tester stats shows documented activity.`, buttons);
      }
      if (!['stats','leaderboard'].includes(sub?.name)) throw Error('Choose desk, stats or leaderboard.');
      if (get('mode')) mode();
      const period = get('period') || 'overall';
      if (!['month','overall'].includes(period)) throw Error('Choose month or overall.');
      const stamp = new Date(), start = period === 'month' ? new Date(Date.UTC(stamp.getUTCFullYear(),stamp.getUTCMonth(),1)).toISOString() : '';
      const end = new Date(Date.UTC(stamp.getUTCFullYear(),stamp.getUTCMonth()+1,1)).toISOString();
      const user = sub.name === 'stats' ? get('user') || actor : '';
      if (user && !/^\d{5,22}$/.test(user)) throw Error('Choose a valid community member.');
      const filter = "NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) AND (?='' OR r.mode=?) AND (?='' OR r.tester=?) AND r.created>=? AND r.created<?";
      const params = [get('mode') || '', get('mode') || '', user, user, start, end];
      const rows = await store.all(`SELECT r.tester,a.name,count(*) n FROM results r LEFT JOIN accounts a ON a.discord=r.tester WHERE ${filter} GROUP BY r.tester ORDER BY n DESC,r.tester LIMIT 10`, ...params);
      const total = await store.one(`SELECT count(*) n FROM results r WHERE ${filter}`, ...params);
      return communityMessage(`**${sub.name === 'stats' ? 'Tester activity' : 'Testing leaderboard'} · ${period === 'month' ? stamp.toISOString().slice(0,7) + ' UTC' : 'Overall'}**\n**${total.n} documented test${total.n === 1 ? '' : 's'}**\n${rows.map((r,n) => `${n+1}. ${r.name || '<@'+r.tester+'>'} — **${r.n}**`).join('\n') || 'No completed, valid tests yet.'}\n\nCounts exclude revoked results. Volume is recognition, not an automatic staff promotion.`);
    }
    case 'retire': {
      if (sub?.name === 'request') {
        const m = mode(), reason = explanation();
        const account = await store.one('SELECT * FROM accounts WHERE discord=?', actor);
        if (!account) throw Error('Verify account ownership before requesting retirement.');
        const placement = await store.one('SELECT * FROM results r WHERE uuid=? AND mode=? AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) ORDER BY sequence DESC LIMIT 1', account.uuid, m);
        if (!placement || config.points[communityRank(placement)] < config.points.LT2) throw Error('Retirement requires a current LT2-or-higher placement.');
        const active = await store.one("SELECT 1 FROM queue WHERE user=? AND mode=? AND status IN ('waiting','claimed')", actor, m);
        if (active) throw Error('Finish or leave your active evaluation before requesting retirement.');
        const id = crypto.randomUUID(), stamp = now();
        const outcome = await store.db.batch([
          store.statement("UPDATE retirements SET status='superseded',updated=? WHERE user=? AND mode=? AND status='approved' AND result_id<>?", stamp, actor, m, placement.id),
          store.statement("INSERT INTO retirements(id,user,uuid,mode,result_id,reason,created,updated) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM retirements WHERE user=? AND mode=? AND status IN ('pending','approved'))", id, actor, account.uuid, m, placement.id, reason, stamp, stamp, actor, m),
          store.audit(actor, 'retirement-request', id),
        ]);
        if (!outcome[1].meta.changes) throw Error('You already have an active retirement or pending request. Use /retire status.');
        return communityMessage(`Retirement request saved: ${id}\n${communityMode(m).name} · ${communityRank(placement)}\nYour placement stays active until an independent moderator approves. Peak and test history are preserved.`);
      }
      if (sub?.name === 'cancel') {
        const m = mode();
        const result = await store.db.batch([store.statement("UPDATE retirements SET status='returned',updated=? WHERE user=? AND mode=? AND status IN ('pending','approved')", now(), actor, m), store.audit(actor,'retirement-return',m)]);
        return communityMessage(result[0].meta.changes ? 'Request cancelled or retirement ended. Your latest valid placement is active; its history is preserved.' : 'No active retirement request for this mode.');
      }
      if (sub?.name === 'status') {
        const rows = await store.all('SELECT id,mode,status,decision FROM retirements WHERE user=? ORDER BY created DESC LIMIT 8', actor);
        return communityMessage('**Your retirement requests**\n' + (rows.map(r => `${r.id} · ${communityMode(r.mode).name} · **${r.status}**${r.decision ? '\n'+r.decision : ''}`).join('\n\n') || 'No retirement requests.'));
      }
      if (sub?.name !== 'review' || !mod) throw Error('Only moderators can review retirement requests.');
      if (!get('id')) {
        const rows = await store.all("SELECT t.id,t.mode,t.reason,a.name FROM retirements t JOIN accounts a ON a.discord=t.user WHERE t.status='pending' ORDER BY t.created LIMIT 5");
        return communityMessage('**Pending retirement reviews**\n' + (rows.map(r => `${r.id} · ${r.name} · ${communityMode(r.mode).name}\n${r.reason}`).join('\n\n') || 'No pending requests.'));
      }
      const decision = get('decision'), reason = explanation();
      if (!['approved','declined'].includes(decision)) throw Error('Choose approved or declined.');
      const row = await store.one("SELECT * FROM retirements WHERE id=? AND status='pending'", get('id'));
      if (!row) throw Error('No pending request found.');
      if (row.user === actor) throw Error('An independent moderator must review your request.');
      const result = await store.db.batch([
        store.statement(`UPDATE retirements SET status=?,reviewer=?,decision=?,updated=? WHERE id=? AND status='pending' AND user<>?
          AND result_id=(SELECT id FROM results r WHERE r.uuid=retirements.uuid AND r.mode=retirements.mode AND NOT EXISTS(SELECT 1 FROM revoked v WHERE v.result_id=r.id) ORDER BY sequence DESC LIMIT 1)
          AND NOT EXISTS(SELECT 1 FROM queue q WHERE q.user=retirements.user AND q.mode=retirements.mode AND q.status IN ('waiting','claimed'))`, decision, actor, reason, now(), row.id, actor),
        store.audit(actor, 'retirement-review', row.id),
      ]);
      if (!result[0].meta.changes) throw Error('The placement or queue changed, or this request was already reviewed. Recheck before deciding.');
      return communityMessage(`Retirement ${decision}. Original results, peak and the review record are retained.`);
    }
    default: throw Error('Unknown community desk action.');
  }
}
