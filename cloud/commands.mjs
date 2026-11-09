import { journeyNames, runJourney, requireQualification, requireReadyRoom } from './journeys.mjs';
import { kitManifests } from '../config/kit-manifests.mjs';
import config from "../config/community.json" with { type: "json" };
import { operationNames, runOperation } from "./operations.mjs";
import { staffAccess } from "../config/community-roles.mjs";

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
  const {mod,tester} = staffAccess(interaction,env);
  if(journeyNames.has(data.name))return runJourney(interaction,env,store,request);
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
                  `${config.modes.find((k) => k.id === m)?.name || m}: ${r.pos === 0 ? "HT" : "LT"}${r.tier} · peak ${r.peak_pos === 0 ? "HT" : "LT"}${r.peak_tier}`,
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
      await requireQualification(store,actor,mode());
      const status = { open: "open", pause: "paused", close: "closed" }[
        sub?.name
      ];
      if(status==='open'){
        if(!kitManifests.modes.some(m=>m.id===mode())||get('kit')!==kitManifests.version)throw Error('This mode needs a complete kit manifest. Review /standards.html and explicitly approve the current version in the kit option; keep other modes closed.');
        store.reason(get('benchmarks'));
      }
      await store.session(
        mode(),
        region(),
        status,
        actor,
        get("capacity") ?? 30,
        get("cooldown") ?? 72,
        get('kit')||null,
        get('benchmarks')||null,
      );
      if(status==='open'&&env.DISCORD_TEST_ALERT_CHANNEL_ID){
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
      await requireQualification(store,actor,entry.mode);
      const room=await requireReadyRoom(store,get('id'),actor);
      const assessment=await store.one('SELECT kit_version FROM assessments WHERE id=?',get('id'));
      if(assessment?.kit_version!==room.kit_version)throw Error('Record a new assessment against the current private-room kit version before publishing.');
      const account=await store.one('SELECT * FROM accounts WHERE discord=?',entry.user);
      const previous=account?await store.one('SELECT tier,pos FROM results WHERE uuid=? AND mode=? AND NOT EXISTS(SELECT 1 FROM revoked WHERE result_id=results.id) ORDER BY sequence DESC LIMIT 1',account.uuid,entry.mode):null;
      await store.result(
        get("id"),
        Number(tier.slice(-1)),
        tier.startsWith("HT") ? 0 : 1,
        evidence,
        actor,
        true,
      );
      if(env.DISCORD_RESULTS_CHANNEL_ID){
        const ping=/^\d{5,22}$/.test(env.DISCORD_RESULT_PING_ROLE_ID||'')?env.DISCORD_RESULT_PING_ROLE_ID:null;
        try{await discord(`/channels/${env.DISCORD_RESULTS_CHANNEL_ID}/messages`,'POST',{content:ping?`<@&${ping}>`:undefined,embeds:[{title:`${account.name}'s Test Results 🏆`,color:parseInt(config.modes.find(m=>m.id===entry.mode)?.color.slice(1)||'8074ee',16),fields:[{name:'Tester',value:`<@${actor}>`},{name:'Gamemode',value:config.modes.find(m=>m.id===entry.mode)?.name||entry.mode,inline:true},{name:'Region',value:entry.region,inline:true},{name:'Username',value:account.name},{name:'Previous Rank',value:previous?`${previous.pos===0?'HT':'LT'}${previous.tier}`:'Unranked',inline:true},{name:'Rank Earned',value:tier,inline:true},{name:'Match evidence',value:evidence}],footer:{text:'Assessment '+get('id')}}],allowed_mentions:{parse:[],roles:ping?[ping]:[]}});}catch{return 'Result saved. The rankings feed updated, but the Discord result announcement failed; ask staff to review it.';}
      }
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
