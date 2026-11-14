import {manageTesters} from './tester-management.mjs';
import {seasonalAnalytics} from './analytics.mjs';
import {supportExtensionActions,supportExtension} from './support-extensions.mjs';
import {managePlacement} from './placements.mjs';
import {rememberStaffIdentity} from './public-identity.mjs';
import {deskRegions} from '../config/testing-desk.mjs';
import {setupWizard} from './setup-wizard.mjs';
import {competitorProfile} from './profiles.mjs';
import {competitionCommandNames,runCompetition,transitionMatch} from './competition.mjs';
import {loadCompetitionConfig} from './competition-config.mjs';
import { testingHubPanel, publishTestingHub } from './platform-panels.mjs';
import { journeyNames, runJourney, requireQualification, requireReadyRoom } from './journeys.mjs';
import config from "../config/community.json" with { type: "json" };
import { operationNames, runOperation } from "./operations.mjs";
import { staffAccess } from "../config/community-roles.mjs";
import { testingDeskNames, runTestingDesk } from './testing-desk.mjs';
import { communityDeskNames, runCommunityDesk } from './community-desk.mjs';
import { approvedCommunityLoadout } from './loadouts.mjs';
import { beginVerification } from './verification.mjs';
import { drainOutbox, queueSessionNotifications } from './delivery.mjs';

const regions = deskRegions;
export async function runCommand(interaction, env, store, request = fetch) {
  const actor = interaction.member?.user?.id;
  if (
    !actor ||
    interaction.guild_id !== env.DISCORD_GUILD_ID ||
    interaction.application_id !== env.DISCORD_CLIENT_ID
  )
    throw Error("This command is only available in our community server.");
  await loadCompetitionConfig(store);
  const resources=await store.all("SELECT key,discord_id FROM guild_resources WHERE key IN ('role:manager','role:tester','role:high-tester','role:verified')");
  const resource=id=>resources.find(r=>r.key===id)?.discord_id;
  env={...env,DISCORD_MODERATOR_ROLE_IDS:[env.DISCORD_MODERATOR_ROLE_IDS||env.MODERATOR_ROLE_ID,resource('role:manager')].filter(Boolean).join(','),DISCORD_TESTER_ROLE_IDS:[env.DISCORD_TESTER_ROLE_IDS||env.TESTER_ROLE_ID,resource('role:tester'),resource('role:high-tester')].filter(Boolean).join(','),DISCORD_VERIFIED_ROLE_ID:env.DISCORD_VERIFIED_ROLE_ID||resource('role:verified')};
  const ticketCategory=await store.one("SELECT value FROM platform_settings WHERE key='ticket-category'");if(ticketCategory)env.DISCORD_TICKET_CATEGORY_ID=ticketCategory.value;
  const data = interaction.data;
  const sub = data.options?.find((o) => o.type === 1);
  const options = sub ? sub.options || [] : data.options || [];
  const get = (name) => options.find((o) => o.name === name)?.value;
  const roles = interaction.member.roles || [];
  const {mod,tester} = staffAccess(interaction,env);
  if(tester)await rememberStaffIdentity(store,actor,{...interaction.member.user,nick:interaction.member.nick});
  if(data.name==='analytics')return seasonalAnalytics(interaction,env,store);
  if(data.name==='tester'&&['add','remove','permissions'].includes(sub?.name))return manageTesters(interaction,env,store);
  if(data.name==='ticket'&&supportExtensionActions.has(sub?.name))return supportExtension(interaction,env,store,request);
  if(data.name==='tier')return managePlacement(interaction,env,store);
  if(data.name==='tier-confirm'){const draft=await store.one("SELECT * FROM staff_action_drafts WHERE id=? AND actor=? AND action='tier' AND expires>?",get('id'),actor,new Date().toISOString());if(!draft)throw Error('Placement confirmation expired or belongs to another manager.');if(draft.completed)return 'This placement adjustment is already saved.';const p=JSON.parse(draft.payload);const result=await runCommand({...interaction,confirmedPlacement:true,placementConfirmationId:draft.id,data:{name:'tier',options:Object.entries(p).map(([name,value])=>({name,value}))}},env,store,request);await store.statement('UPDATE staff_action_drafts SET completed=? WHERE id=?',new Date().toISOString(),draft.id).run();return result;}
  if(['setup','autosetup'].includes(data.name))return setupWizard(interaction,env,store,request);
  if(data.name==='progress'||data.name==='profile'||(data.name==='player'&&['self','view'].includes(sub?.name)))return competitorProfile(interaction,env,store,data.name==='progress');
  const competitionAlias=data.name==='cooldown'&&sub&&sub.name!=='status'?'cooldown-admin':data.name==='player'&&['restrict','unrestrict'].includes(sub?.name)?'player-admin':data.name==='queue'&&['forceclose','clear'].includes(sub?.name)?'queue-admin':null;
  if(competitionAlias||competitionCommandNames.has(data.name))return runCompetition({...interaction,data:{...data,name:competitionAlias||data.name}},env,store,request,next=>runCommand(next,env,store,request));
  if(communityDeskNames.has(data.name))return runCommunityDesk(interaction,env,store,request,next=>runCommand(next,env,store,request));
  if(journeyNames.has(data.name))return runJourney(interaction,env,store,request);
  if(testingDeskNames.has(data.name))return runTestingDesk(interaction,env,store,request,next=>runCommand(next,env,store,request));
  if(operationNames.has(data.name))return runOperation(interaction,env,store,request);
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
  const discord = async (path, method = "GET", body) => {
    const response = await request("https://discord.com/api/v10" + path, {
      method,
      headers: { Authorization: "Bot " + env.DISCORD_TOKEN, "Content-Type":"application/json" },
      body:body?JSON.stringify(body):undefined,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw Error(
        "Discord could not update the role. Ask staff to check the bot's role hierarchy and permissions.",
      );
    return response.status === 204 ? undefined : response.json();
  };
  switch (data.name) {
    case 'platform-rankings': {
      const players=(await store.rankings(config.points)).players;
      return {content:'',embeds:[{title:'?? TOP MACE COMPETITORS',color:0xe4b95b,description:players.slice(0,15).map((p,n)=>'**'+(n+1)+'. '+p.name+'** ? '+p.points+' points').join('\n')||'No official placements have been published yet.',footer:{text:'Current placements across enabled and historical Mace modes. Ties use stable UUID ordering.'}}],components:[{type:1,components:[{type:2,style:2,label:'My profile',custom_id:'community:self'},{type:2,style:2,label:'Refresh rankings',custom_id:'network:rankings'}]}]};
    }
    case 'testing-hub': return get('publish')?publishTestingHub(interaction,env,store,request):testingHubPanel(store);
    case 'tier-role': {
      requireMod();
      const m=mode(),tier=get('tier'),role=get('role');
      if(!/^(HT|LT)[1-5]$/.test(tier||'')||!/^\d{5,22}$/.test(role||''))throw Error('Choose a valid tier and role.');
      store.reason(get('reason'));
      const current=await store.one('SELECT role FROM tier_role_mappings WHERE mode=? AND tier=?',m,tier);
      if(current&&current.role!==role)throw Error('A mapping already exists. Management must review a role migration before replacing it.');
      const roles=await discord(`/guilds/${env.DISCORD_GUILD_ID}/roles`);
      const target=roles.find(r=>r.id===role);
      if(!target||target.managed||BigInt(target.permissions)!==0n||role===env.DISCORD_GUILD_ID)throw Error('Tier roles must be unmanaged, with no permissions.');
      await store.db.batch([store.statement('INSERT OR IGNORE INTO tier_role_mappings VALUES(?,?,?)',m,tier,role),store.audit(actor,'tier-role-map',m+'/'+tier+': '+get('reason'))]);
      const saved=await store.one('SELECT role FROM tier_role_mappings WHERE mode=? AND tier=?',m,tier);
      if(saved?.role!==role)throw Error('Mapping changed concurrently; inspect configuration.');
      return 'Tier role mapped for '+m+' / '+tier+'. Other Mace mode roles are preserved.';
    }
    case 'resync': return runCommand({...interaction,data:{name:'system',options:[{type:1,name:'resync'}]}},env,store,request);
    case 'logs': {
      requireMod();const rows=await store.all('SELECT id,actor,action,subject,created FROM audit WHERE (? IS NULL OR actor=?) ORDER BY id DESC LIMIT 20',get('user')||null,get('user')||null);
      return {content:'Private audit log export: latest '+rows.length+' matching events.',artifact:{name:'mace-audit.txt',text:rows.map(r=>r.created+' #'+r.id+' '+r.actor+' '+r.action+' '+r.subject).join('\n')},components:[]};
    }
    case 'system': {
      requireMod();
      if(sub?.name==='resync'){
        const now=new Date().toISOString();
        await store.db.batch([
          store.statement("INSERT OR IGNORE INTO outbox_events(kind,subject,available_at,created) SELECT 'roles',r.id,?,? FROM results r WHERE NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id) AND NOT EXISTS(SELECT 1 FROM results newer WHERE newer.uuid=r.uuid AND newer.mode=r.mode AND newer.sequence>r.sequence AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=newer.id))",now,now),
          store.statement("INSERT OR IGNORE INTO outbox_events(kind,subject,available_at,created) SELECT 'verified-role',discord,?,? FROM accounts",now,now),
          store.statement("UPDATE outbox_events SET status='pending',available_at=?,lease=NULL,lease_until=NULL WHERE kind='verified-role' OR (kind='roles' AND subject IN (SELECT id FROM results r WHERE NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id) AND NOT EXISTS(SELECT 1 FROM results newer WHERE newer.uuid=r.uuid AND newer.mode=r.mode AND newer.sequence>r.sequence AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=newer.id))))",now),
          store.audit(actor,'platform-resync','Current placement and verification roles'),
        ]);return 'Current placement and verified-account role reconciliation is queued. No official result or announcement was duplicated. Inspect /delivery status for failures.';
      }
      const counts=await store.one("SELECT (SELECT count(*) FROM accounts) verified,(SELECT count(*) FROM sessions WHERE status='open') queues,(SELECT count(*) FROM queue WHERE status='waiting') waiting,(SELECT count(*) FROM queue WHERE status='claimed') active,(SELECT count(*) FROM results r WHERE r.record_type='test' AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=r.id)) completed,(SELECT count(*) FROM outbox_events WHERE status<>'done') pending");
      return '**PLATFORM HEALTH**\nVerified competitors: '+counts.verified+'\nOpen queues: '+counts.queues+'\nPlayers waiting: '+counts.waiting+'\nActive tests: '+counts.active+'\nCompleted official tests: '+counts.completed+'\nPending deliveries: '+counts.pending+'\nUse /delivery status for actionable failures.';
    }
    case 'result-confirm': {
      const draft=await store.one('SELECT * FROM result_drafts WHERE id=? AND tester=? AND expires>?',get('id'),actor,new Date().toISOString());
      if(!draft)throw Error('This result confirmation expired or belongs to another tester. Submit a new result.');
      const existing=await store.one('SELECT tier,pos,evidence,tester FROM results WHERE id=?',draft.test_id);
      if(existing){if(existing.tester===actor&&existing.evidence===draft.evidence&&draft.tier===((existing.pos===0?'HT':'LT')+existing.tier))return 'This official result is already finalized. Delivery retries remain tracked in /delivery status.';throw Error('A different result was finalized; ask staff to review.');}
      return runCommand({...interaction,resultConfirmed:true,data:{name:'result',options:[{name:'id',value:draft.test_id},{name:'tier',value:draft.tier},{name:'evidence',value:draft.evidence}]}},env,store,request);
    }
    case 'verify': {
      if(sub?.name==='status')return (await store.one('SELECT name FROM accounts WHERE discord=?',actor))?.name ? 'Your Minecraft ownership is verified.' : 'No verified account. Start with /verify start.';
      if(!env.MINECRAFT_VERIFICATION_SERVER||env.MINECRAFT_PROOF_SECRET?.length<32||!env.MINECRAFT_PROOF_SECRET)throw Error('The ownership server is not configured. Open private account support.');
      const challenge=await beginVerification(store,actor,get('name'),request);
      return '**VERIFY YOUR MINECRAFT ACCOUNT**\nJoin **'+env.MINECRAFT_VERIFICATION_SERVER+'** using **'+challenge.name+'**, then run:\n`/linkdiscord '+challenge.code+'`\nExpires <t:'+Math.floor(Date.parse(challenge.expires)/1000)+':R>. Keep this code private.';
    }
    case 'notifications': {
      const delivery=get('delivery');
      if(delivery){if(!['dm','none'].includes(delivery))throw Error('Choose dm or none.');await store.statement('INSERT INTO notification_preferences VALUES(?,?) ON CONFLICT(user) DO UPDATE SET delivery=excluded.delivery',actor,delivery).run();}
      const saved=await store.one('SELECT delivery FROM notification_preferences WHERE user=?',actor);
      return 'Optional testing notifications: '+(saved?.delivery||'none')+'. Waitlist membership never reserves a live queue place.';
    }
    case 'delivery': {
      requireMod();
      if(sub?.name==='retry')await drainOutbox(store,env,request);
      const rows=await store.all("SELECT id,kind,attempts,last_error FROM outbox_events WHERE status<>'done' ORDER BY id LIMIT 15");
      return rows.length?rows.map(r=>'#'+r.id+' · '+r.kind+' · '+r.attempts+' attempts · '+(r.last_error||'Pending')).join('\n'):'All delivery events are up to date.';
    }
    case "practice": {
      if (sub?.name === "create")
        return (
          "Practice post created: " +
          (await store.practiceCreate(actor, mode(), region(), get("note"))) +
          ". Members can find it with /practice list for 24 hours. Practice never awards a tier. Close it when you are done."
        );
      if (sub?.name === "close") {
        await store.practiceClose(get("id"), actor, mod);
        return "Practice post closed; its record is retained.";
      }
      if (sub?.name !== "list") throw Error("Choose create, list or close.");
      if (get("mode")) mode();
      if (get("region")) region();
      const posts = await store.practiceList(get("mode"), get("region"));
      return posts.length
        ? posts
            .map(
              (p) =>
                `${p.mode} / ${p.region} · <@${p.user}>\n${p.note}\nID ${p.id}`,
            )
            .join("\n\n")
        : "No active practice posts match. Create one with /practice create; choose your mode, region, kit and UTC availability. Practice does not create a testing queue entry.";
    }
    case "tester-apply": {
      if (sub?.name === "submit")
        return (
          "Private tester application saved: " +
          (await store.applyTester(
            actor,
            mode(),
            region(),
            get("experience"),
            get("availability"),
          )) +
          ". /tester-apply status shows the decision. No staff role has been granted."
        );
      if (sub?.name === "status") {
        const rows = await store.testerApplications(actor);
        return rows.length
          ? rows
              .map(
                (r) =>
                  `${r.id} · ${r.mode} / ${r.region} · ${r.status}${r.decision ? "\n" + r.decision : ""}`,
              )
              .join("\n\n")
          : "You have no tester applications.";
      }
      requireMod();
      if (sub?.name !== "review")
        throw Error("Choose submit, status or review.");
      if (get("id")) {
        await store.reviewTester(
          get("id"),
          actor,
          get("decision"),
          get("reason"),
        );
        return "Application reviewed privately. Arrange supervised rubric training before any manual staff-role assignment.";
      }
      const rows = await store.testerApplications();
      return rows.length
        ? rows
            .map(
              (r) =>
                `${r.id} · <@${r.user}> · ${r.mode} / ${r.region}\n${r.experience.slice(0, 350)}\nAvailability: ${r.availability}`,
            )
            .join("\n\n")
        : "No pending tester applications.";
    }
    case "profile": {
      const name = get("name");
      if (typeof name !== "string" || !/^\w{3,16}$/.test(name))
        throw Error(
          "Enter a Minecraft username, 3–16 letters, numbers or underscores.",
        );
      const p = (await store.rankings(config.points)).players.find(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      );
      return p
        ? `${p.name} · ${p.region} · ${p.points} points\n` +
            Object.entries(p.rankings)
              .map(
                ([m, r]) =>
                  `${config.modes.find((k) => k.id === m)?.name || m}: ${r.pos === 0 ? "HT" : "LT"}${r.tier}${r.retired ? ' · Retired' : ''} · peak ${r.peak_pos === 0 ? "HT" : "LT"}${r.peak_tier}`,
              )
              .join("\n") +
            `\nhttps://minecraft-pvp-community.draxion0.chatgpt.site/#rankings?player=${encodeURIComponent(p.uuid)}`
        : "No published placement for that player on our tierlist. /guide start explains how to get tested.";
    }
    case "guide": {
      const topics = {
        start:
          "One independent tierlist. 1. Read #rules and the kit guidance. 2. /preferences mode region chooses interests, not a ranking. 3. Ask moderators to verify Minecraft ownership. 4. /availability shows real sessions. 5. /queue join mode region enters an open session. /queue status explains your progress. Never share passwords or install files for a test.",
        testing:
          "Before playing, agree the kit/version, arena, allowed mods, scoring rubric and publishable evidence with your tester. /queue list shows your IDs; /queue leave cancels a waiting entry. Claimed entries need your assigned tester. No guaranteed waiting time or placement. Sessions stay closed until real staff and rubrics are ready.",
        appeals:
          "Use /queue status mode region to find your latest result ID and evidence, then /appeal submit id reason. /appeal status shows your private decisions. Only the result owner can submit; an independent moderator reviews it. Never put personal details or accusations in public channels.",
        staff:
          "Trusted staff: verify actual Minecraft ownership before /verify-account. Publish mode-specific kit and scoring rules before /session open. /queue list identifies players privately. /claim assigns one tester; only that tester can /result with shareable HTTPS evidence. Review appeals independently. Tester applications start in #tester-recruitment; interest roles never grant staff access.",
        practice:
          "Use #find-a-duel for mode, region, version, server and UTC availability. Use #guides-and-coaching for one specific question and an optional consented clip. Practice/coaching is separate from official placements. Events are announced only when a real host and rules are confirmed.",
      };
      const topic = get("topic") || "start";
      if (!Object.hasOwn(topics, topic))
        throw Error("Choose a valid guide topic.");
      return (
        topics[topic] +
        "\nhttps://minecraft-pvp-community.draxion0.chatgpt.site/#testing"
      );
    }
    case "availability": {
      if (get("mode")) mode();
      if (get("region")) region();
      const rows = (await store.testing()).sessions.filter(
        (s) =>
          (!get("mode") || s.mode === get("mode")) &&
          (!get("region") || s.region === get("region")),
      );
      return rows.length
        ? rows
            .slice(0, 12)
            .map(
              (s) =>
                `${s.mode} / ${s.region}: ${s.status} · ${s.waiting} waiting, ${s.claimed} claimed · capacity ${s.capacity} · cooldown ${s.cooldown}h`,
            )
            .join("\n") +
            "\nSnapshot only; /queue join checks capacity again. No waiting-time guarantee. More: https://minecraft-pvp-community.draxion0.chatgpt.site/#testing"
        : "No published sessions match. Testing is not open for this selection. Read /guide testing or find practice in #find-a-duel; do not join a different region unless you can play there.";
    }
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
      const linked=await store.one('SELECT uuid FROM accounts WHERE discord=?',get('user'));
      if(!linked||linked.uuid!==uuid)throw Error('New account links require the online-server ownership challenge: /verify start. This staff command only resynchronizes an existing identity.');
      await store.verify(get("user"), uuid, get("name"), actor);
      if(env.DISCORD_VERIFIED_ROLE_ID){
        try{
          const roles=await discord(`/guilds/${env.DISCORD_GUILD_ID}/roles`);
          const role=roles.find(r=>r.id===env.DISCORD_VERIFIED_ROLE_ID);
          if(!role||role.managed||BigInt(role.permissions)!==0n)throw Error('Unsafe verification role');
          await discord(`/guilds/${env.DISCORD_GUILD_ID}/members/${get('user')}/roles/${role.id}`,'PUT');
        }catch{
          return 'Ownership verification was saved, but the Verified Player role could not be synchronised. Staff should check the role hierarchy and repeat verification with the same UUID to retry. Do not create another identity.';
        }
      }
      return "Verified account saved in cloud storage. Staff must confirm ownership before using this command.";
    }
    case "session": {
      requireTester();
      if(await store.one('SELECT 1 FROM tester_sessions WHERE mode=? AND region=? AND ended IS NULL',get('mode'),get('region')))throw Error('This queue uses independent tester availability. Use /start, /pause, /resume or /end; managers may /queue forceclose.');
      await requireQualification(store,actor,mode());
      const status = { open: "open", pause: "paused", close: "closed" }[
        sub?.name
      ];
      if(status==='open'){
        if(!await approvedCommunityLoadout(store,mode(),get('kit')))throw Error('This mode needs an approved loadout version. Moderators record real calibration with /loadout approve; use that exact version in the kit option.');
        store.reason(get('benchmarks'));
      }
      await store.session(
        mode(),
        region(),
        status,
        actor,
        get("capacity") ?? 20,
        get("cooldown") ?? 720,
        get('kit')||null,
        get('benchmarks')||null,
      );
      const announce=status==='open'&&await queueSessionNotifications(store,mode(),region());
      if(announce&&env.DISCORD_TEST_ALERT_CHANNEL_ID){
        const ping=/^\d{5,22}$/.test(env.DISCORD_TEST_PING_ROLE_ID||'')?env.DISCORD_TEST_PING_ROLE_ID:null;
        try{await discord(`/channels/${env.DISCORD_TEST_ALERT_CHANNEL_ID}/messages`,'POST',{content:(ping?`<@&${ping}> `:'')+`Testing is open: ${config.modes.find(m=>m.id===get('mode')).name} / ${get('region')}. Use the testing menu to join; verification, cooldown and capacity checks apply.`,allowed_mentions:{parse:[],roles:ping?[ping]:[]}});}catch{return `${get('mode')} / ${get('region')} session open. The session alert failed; staff should review the announcement.`;}
      }
      return `${get("mode")} / ${get("region")} session ${status}. The public testing page updates automatically.`;
    }
    case "queue": {
      if (sub?.name === "status") {
        const m = mode(),
          r = region(),
          state = await store.status(actor, m, r);
        const lines = [
          `${m} / ${r}`,
          state.account
            ? `Verified account: ${state.account.name}`
            : "Account ownership is not verified. Ask moderators; a username alone is not proof.",
          state.session
            ? `Session ${state.session.status} · ${state.occupied}/${state.session.capacity} occupied · cooldown ${state.session.cooldown}h`
            : "No session published for this mode/region.",
        ];
        if (state.entry)
          lines.push(
            `Your entry: ${state.entry.id} · ${state.entry.status} · ${state.entry.region}${state.position ? ` · waiting position ${state.position} (claimed tests excluded; no ETA)` : " · coordinate with your assigned tester"}`,
          );
        else lines.push("No open entry for this mode.");
        if (state.latest)
          lines.push(
            `Latest valid result: ${state.latest.id} · ${state.latest.pos === 0 ? "HT" : "LT"}${state.latest.tier}\nEvidence: ${state.latest.evidence}`,
          );
        if (state.eligibleAt)
          lines.push(
            Date.parse(state.eligibleAt) > Date.now()
              ? `Retest cooldown ends <t:${Math.ceil(Date.parse(state.eligibleAt) / 1000)}:F> for this session's settings.`
              : "Retest cooldown has elapsed for this session's settings.",
          );
        return lines.join("\n");
      }
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
      const rows = (await store.list(tester?null:actor)).filter(
        (r) => tester || r.user === actor,
      );
      return rows.length
        ? rows
            .slice(0, 15)
            .map(
              (r) =>
                `${r.mode} / ${r.region} / ${r.status} / ${r.id}${tester ? ` / player <@${r.user}>` : ""}`,
            )
            .join("\n")
        : "You have no open entries.";
    }
    case "claim":
      requireTester();
      if(get('action')==='next'){
        await requireQualification(store,actor,mode());
        const id=await store.claimNext(mode(),region(),actor);
        return `Next eligible entry claimed: ${id}. Use /test-room open id:${id}.`;
      }
      if (get("action") === "release") {
        const room=await store.one("SELECT 1 FROM test_rooms WHERE id=? AND state<>'archived'",get('id'));
        if(room)throw Error('Archive the private testing room before releasing this claim. This prevents the previous tester retaining access after handoff.');
        await store.release(get("id"), actor);
        return "Entry returned to waiting with its original queue time. No result was changed.";
      }
      if (get("action") && get("action") !== "claim")
        throw Error("Choose claim or release.");
      const entry=await store.one('SELECT mode FROM queue WHERE id=?',get('id'));
      if(!entry)throw Error('No waiting entry found.');
      await requireQualification(store,actor,entry.mode);
      await store.claim(get("id"), actor);
      return "Test claimed. Use /test-room open with this assessment ID for private coordination, readiness and written kit agreement.";
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
      const entry=await store.one('SELECT * FROM queue WHERE id=?',get('id'));
      if(!entry)throw Error('Assessment not found.');
      const linkedTest=await store.one("SELECT id,target FROM high_tests WHERE queue_id=? AND status='claimed'",get('id'));
      if(linkedTest&&(interaction.testingDeskPublish!==linkedTest.id||tier!==linkedTest.target))throw Error('Publish this linked promotion through /high-test publish in its private ticket so its phases and target tier are checked together.');
      await requireQualification(store,actor,entry.mode);
      const room=await requireReadyRoom(store,get('id'),actor);
      const assessment=await store.one('SELECT kit_version FROM assessments WHERE id=?',get('id'));
      if(assessment?.kit_version!==room.kit_version)throw Error('Record a new assessment against the current private-room kit version before publishing.');
      const account=await store.one('SELECT * FROM accounts WHERE discord=?',entry.user);
      const previous=account?await store.one('SELECT tier,pos FROM effective_placements WHERE uuid=? AND mode=? AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=effective_placements.id) ORDER BY sequence DESC LIMIT 1',account.uuid,entry.mode):null;
      const lifecycle=await store.one('SELECT * FROM test_lifecycle WHERE test_id=?',get('id'));
      if(lifecycle&&!['AWAITING_RESULT','RESULT_PENDING_CONFIRMATION'].includes(lifecycle.state))throw Error('Finish the managed test with /match finish before submitting its official result.');
      if(!interaction.resultConfirmed&&!interaction.testingDeskPublish){
        if(lifecycle?.state==='AWAITING_RESULT')await transitionMatch(store,get('id'),actor,['AWAITING_RESULT'],'RESULT_PENDING_CONFIRMATION','Tester is reviewing the official result.');
        const draft=crypto.randomUUID();
        await store.statement('INSERT INTO result_drafts VALUES(?,?,?,?,?,?)',draft,get('id'),actor,tier,evidence,new Date(Date.now()+600000).toISOString()).run();
        return {content:'**CONFIRM OFFICIAL RESULT**\nPlayer: '+account.name+'\nMode: '+config.modes.find(m=>m.id===entry.mode).name+'\nPrevious: '+(previous?((previous.pos===0?'HT':'LT')+previous.tier):'Unranked')+' ? '+tier+'\nEvidence: '+evidence+'\nConfirm within ten minutes. All qualification and readiness checks run again.',components:[{type:1,components:[{type:2,style:3,label:'Confirm official result',custom_id:'result:confirm:'+draft}]}]};
      }
      await store.result(
        get("id"),
        Number(tier.slice(-1)),
        tier.startsWith("HT") ? 0 : 1,
        evidence,
        actor,
        true,
      );
      await drainOutbox(store,env,request);
      return "Result saved with evidence and tester attribution. The cloud rankings feed updates automatically. Announcements and mapped roles are tracked for delivery; staff can inspect /delivery status.";
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
