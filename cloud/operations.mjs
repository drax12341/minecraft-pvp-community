import { requireQualification } from './journeys.mjs';
import { OperationsStore } from "./operations-store.mjs";
import { extraInterests, staffAccess, ticketKinds } from "../config/community-roles.mjs";
import { rubricText } from "../config/rubrics.mjs";
import config from "../config/community.json" with { type: "json" };

export const operationNames = new Set(["ticket","rubric","assessment","staff-apply","moderation","interests","request-test"]);
const view = 1024n, send = 2048n, history = 65536n, embed = 16384n, attach = 32768n;
const ids = (text) => String(text || "").split(",").filter((s) => /^\d{5,22}$/.test(s));
export function ticketOverwrites(env, owner, kind, closed = false) {
  const moderators=ids(env.DISCORD_MODERATOR_ROLE_IDS || env.MODERATOR_ROLE_ID);
  const staff=kind === "staff-report" ? ids(env.DISCORD_REPORT_REVIEWER_ROLE_IDS) : [...moderators,...ids(env.DISCORD_SUPPORT_ROLE_IDS)];
  return [
    {id:env.DISCORD_GUILD_ID,type:0,allow:"0",deny:String(view)},
    ...[...new Set(staff)].map(id=>({id,type:0,allow:String(view|send|history|embed|attach),deny:"0"})),
    ...(kind==='staff-report'&&env.DISCORD_OWNER_ID&&env.DISCORD_OWNER_ID!==owner?[{id:env.DISCORD_OWNER_ID,type:1,allow:String(view|send|history|embed|attach),deny:'0'}]:[]),
    {id:env.DISCORD_CLIENT_ID,type:1,allow:String(view|send|history|embed|attach),deny:"0"},
    {id:owner,type:1,allow:String(view|history|embed|attach|(closed?0n:send)),deny:String(closed?send:0n)},
  ];
}
export function assertPrivateTicket(channel,env,owner,kind) {
  const expected=ticketOverwrites(env,owner,kind);
  const overwrites=channel.permission_overwrites || [];
  const everyone=overwrites.find(o=>o.id===env.DISCORD_GUILD_ID);
  if(channel.guild_id!==env.DISCORD_GUILD_ID || !everyone || !(BigInt(everyone.deny)&view) || (BigInt(everyone.allow)&view)) throw Error("Ticket privacy check failed; contact the server owner.");
  const allowed=new Set(expected.map(o=>o.id));
  if(overwrites.some(o=>!allowed.has(o.id)&&(BigInt(o.allow)&view)))throw Error("Ticket has an unexpected access grant; contact the server owner.");
  const member=overwrites.find(o=>o.id===owner&&o.type===1);
  const bot=overwrites.find(o=>o.id===env.DISCORD_CLIENT_ID&&o.type===1);
  if(!member || !(BigInt(member.allow)&view) || !bot || !(BigInt(bot.allow)&view))throw Error("Ticket access is not configured correctly.");
}

export async function runOperation(interaction,env,store,request=fetch) {
  const {actor,mod,tester,support,reportReviewer}=staffAccess(interaction,env);
  const op=new OperationsStore(store);
  const data=interaction.data,sub=data.options?.find(o=>o.type===1),opts=sub?sub.options||[]:data.options||[];
  const get=name=>opts.find(o=>o.name===name)?.value;
  const requireMod=()=>{if(!mod)throw Error("Only moderators can use this command.");};
  const requireTester=()=>{if(!tester)throw Error("Only testers can use this command.");};
  const discord=async(path,method="GET",body)=>{
    const response=await request("https://discord.com/api/v10"+path,{method,headers:{Authorization:"Bot "+env.DISCORD_TOKEN,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error(`Discord could not complete this action (HTTP ${response.status}). Ask staff to review bot permissions; no broad access is granted automatically.`);
    return response.status===204?undefined:response.json();
  };
  const mode=()=>{const m=config.modes.find(m=>m.id===get("mode"));if(!m)throw Error("Choose a valid mode.");return m;};
  switch(data.name) {
    case "rubric":return rubricText(mode().id,mode().name);
    case "request-test":{
      if(!["EU","NA","AS","SA","AU","AF","ME","OC"].includes(get("region")))throw Error("Choose a valid region.");
      const m=mode().id,r=get('region'),session=await store.one('SELECT status,capacity FROM sessions WHERE mode=? AND region=?',m,r);
      if(!session||session.status!=='open')return{content:`No open testing session for ${m} / ${r}. Save a waitlist preference to record demand for future testing. It reserves no active queue place. Verified ownership is required; no waiting time is promised.`,components:[{type:1,components:[{type:2,style:1,label:'Save waitlist preference',custom_id:`waitlist:join:${m}:${r}`}]}]};
      return "Test requested: "+await store.join(actor,mode().id,get("region"))+". Check /queue status for your progress. This is an official queue entry, subject to verification, capacity and cooldown.";
    }
    case "interests":{
      const key=get("role"),name=extraInterests[key];if(!name)throw Error("Choose a valid interest or notification role.");
      const roles=await discord(`/guilds/${env.DISCORD_GUILD_ID}/roles`),role=roles.find(r=>r.name===name);
      if(!role || role.managed || BigInt(role.permissions)!==0n)throw Error("Interest role is missing or has unsafe permissions.");
      const remove=interaction.member.roles.includes(role.id);
      await discord(`/guilds/${env.DISCORD_GUILD_ID}/members/${actor}/roles/${role.id}`,remove?"DELETE":"PUT");
      return name+(remove?" removed.":" added.");
    }
    case "assessment":{
      requireTester();
      if(sub?.name==="record"){
        const q=await store.one('SELECT mode FROM queue WHERE id=?',get('id'));
        if(!q)throw Error('Assessment not found.');
        await requireQualification(store,actor,q.mode);
        const a=await op.assess(get("id"),actor,get("scores"),get("reason"));
        return `Rubric ${a.version} assessment saved: ${a.total}/100. Scores are feedback, not an automatic tier conversion. Use /assessment review for independent HT1/LT1/HT2/LT2 sign-off before /result.`;
      }
      if(sub?.name==="review"){
        if(!mod && !ids(env.DISCORD_SENIOR_TESTER_ROLE_IDS).some(id=>interaction.member.roles.includes(id)))throw Error("Only senior testers or moderators can sign off high tiers.");
        const q=await store.one('SELECT mode FROM queue WHERE id=?',get('id'));
        if(!q)throw Error('Assessment not found.');
        await requireQualification(store,actor,q.mode,true);
        await op.reviewPlacement(get("id"),actor,get("tier"),get("reason"),get('evidence'));return "Independent senior sign-off recorded for this assessment revision and tier.";
      }
      const a=await op.one("SELECT * FROM assessments WHERE id=?",get("id"));
      if(!a)throw Error("No assessment found.");
      return `${a.id} · ${a.version} · ${a.total}/100\nScores: ${a.scores}\n${a.rationale}`;
    }
    case "staff-apply":{
      if(sub?.name==="submit")return "Private staff application saved: "+await op.applyStaff(actor,get("track"),get("experience"),get("availability"))+". No staff role was granted. Use /staff-apply status for feedback.";
      if(sub?.name==="status"){
        const rows=await op.applications(actor);return rows.length?rows.map(r=>`${r.id} · ${r.track} · ${r.status}${r.decision?"\n"+r.decision:""}`).join("\n\n"):"You have no staff applications.";
      }
      requireMod();if(sub?.name!=="review")throw Error("Choose submit, status or review.");
      if(get("id")){await op.reviewApplication(get("id"),actor,get("decision"),get("reason"));return "Private application reviewed. Arrange an interview/training; role assignment remains manual.";}
      const rows=await op.applications();return rows.length?rows.map(r=>`${r.id} · ${r.track} · <@${r.user}>\n${r.experience.slice(0,300)}\n${r.availability}`).join("\n\n"):"No pending staff applications.";
    }
    case "moderation":{
      requireMod();
      if(sub?.name==="warn")return "Private warning case recorded: "+await op.warn(get("user"),actor,get("reason"))+". This records an internal case; it does not send a DM or apply a Discord timeout.";
      if(sub?.name==="resolve"){await op.resolveCase(get("id"),actor,get("reason"));return "Case resolved; its original record is retained.";}
      if(sub?.name!=="cases")throw Error("Choose warn, cases or resolve.");
      const rows=await op.cases(get("user"));return rows.length?rows.map(r=>`${r.id} · <@${r.user}> · ${r.status}\n${r.reason}${r.resolution?"\nResolution: "+r.resolution:""}`).join("\n\n"):"No recorded cases match.";
    }
    case "ticket":{
      if(sub?.name==='prepare'){
        const kind=get('kind'),subject=get('subject'),detail=get('detail');
        if(!ticketKinds.includes(kind)||typeof subject!=='string'||subject.trim().length<5||subject.length>100||typeof detail!=='string'||detail.trim().length<10||detail.length>1500)throw Error('Check the category, subject and details.');
        await store.statement('DELETE FROM ticket_drafts WHERE expires<?',new Date().toISOString()).run();
        const id=crypto.randomUUID();
        const saved=await store.statement('INSERT INTO ticket_drafts SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM ticket_drafts WHERE user=?)<3',id,actor,kind,subject,detail,new Date(Date.now()+15*60000).toISOString(),actor).run();
        if(!saved.meta.changes)throw Error('You have three pending drafts. Submit an existing draft or wait 15 minutes.');
        return {content:`Review your private ${kind} case before submitting.\n**${subject}**\n${detail}\n\nNo case has been opened yet. This draft expires in 15 minutes. Never include credentials.`,components:[{type:1,components:[{type:2,style:1,label:'Submit private case',custom_id:'ticket:submit:'+id}]}]};
      }
      if(sub?.name==='submit'){
        const draft=await store.one('SELECT * FROM ticket_drafts WHERE id=? AND user=? AND expires>?',get('id'),actor,new Date().toISOString());
        if(!draft)throw Error('This draft expired or belongs to another member. Reopen the form.');
        const command={...interaction,data:{name:'ticket',options:[{type:1,name:'open',options:['kind','subject','detail'].map(name=>({name,value:draft[name]}))}]}};
        const result=await runOperation(command,env,store,request);
        await store.statement('DELETE FROM ticket_drafts WHERE id=? AND user=?',draft.id,actor).run();
        return result;
      }
      if(sub?.name==="open"){
        if(get('kind')==='staff-report'&&!env.DISCORD_OWNER_ID&&!env.DISCORD_REPORT_REVIEWER_ROLE_IDS)throw Error('Independent report reviewers are not configured. Contact the server owner privately.');
        if(!env.DISCORD_TICKET_CATEGORY_ID)throw Error("The private support category is not configured yet.");
        const id=await op.reserveTicket(actor,get("kind"),get("subject"),get("detail"));
        let channel;
        try{
          channel=await discord(`/guilds/${env.DISCORD_GUILD_ID}/channels`,"POST",{name:`ticket-${id.slice(0,8)}`,type:0,parent_id:env.DISCORD_TICKET_CATEGORY_ID,topic:`Private support case ${id} · ${get("kind")} · Keep credentials and personal details out of tickets.`,permission_overwrites:ticketOverwrites(env,actor,get("kind")),rate_limit_per_user:3});
          assertPrivateTicket(channel,env,actor,get("kind"));
          await op.ticketOpened(id,channel.id);
          // Ping only the configured team, once, inside the verified private case.
          const notifyRoles = [...new Set(ids(get("kind")==="staff-report"
            ? env.DISCORD_REPORT_REVIEWER_ROLE_IDS
            : (env.DISCORD_SUPPORT_ROLE_IDS || env.DISCORD_MODERATOR_ROLE_IDS || env.MODERATOR_ROLE_ID)))];
          await discord(`/channels/${channel.id}/messages`,"POST",{
            content: notifyRoles.map(role=>`<@&${role}>`).join(" ") + (get('kind')==='staff-report'&&env.DISCORD_OWNER_ID?` <@${env.DISCORD_OWNER_ID}>`:'') + " A new support case needs review.",
            allowed_mentions:{parse:[],roles:notifyRoles,users:get('kind')==='staff-report'&&env.DISCORD_OWNER_ID?[env.DISCORD_OWNER_ID]:[]},
          });
          await discord(`/channels/${channel.id}/messages`,"POST",{embeds:[{title:get("subject"),description:get("detail"),color:0xa78bfa,fields:[{name:"Category",value:get("kind"),inline:true},{name:"Case ID",value:id},{name:"Privacy",value:"Visible to you and the authorized support/moderation team. Server administrators can access private channels. Never send passwords, tokens or backup codes."}]}],components:[{type:1,components:[{type:2,style:2,label:"Close ticket",custom_id:"ticket:close:"+id}]}],allowed_mentions:{parse:[]}});
          return `Private ticket opened: <#${channel.id}>\nCase ID: ${id}. Use /ticket status or /ticket close. No waiting time is guaranteed.`;
        }catch(error){
          // A timeout can happen after Discord creates the channel. Keep the
          // reservation active so retrying cannot create an untracked duplicate.
          // If creation succeeded, retain the case/channel for staff recovery.
          throw Error(channel?`Ticket channel was created, but setup needs staff review. Case ${id}; use /ticket status. No channel was deleted.`:error.message);
        }
      }
      if(sub?.name==="status"){
        if(get("id")){
          const t=await op.ticket(get("id"));if(!t || (t.user!==actor && (!support || (t.kind==="staff-report"&&!reportReviewer))))throw Error("Ticket not found or you do not have access.");
          return `${t.id} · ${t.kind} · ${t.status} · ${t.workflow}\n${t.subject}\n${t.detail}${t.channel?`\n<#${t.channel}>`:"\nChannel creation is pending staff review."}${t.claimed_by?`\nAssigned: <@${t.claimed_by}>`:""}${t.close_reason?`\nResolution: ${t.close_reason}`:''}`;
        }
        const rows=await op.tickets(support?undefined:actor,reportReviewer);return rows.length?rows.map(t=>`${t.id} · ${t.kind} · ${t.status} · ${t.workflow}${t.channel?` · <#${t.channel}>`:""}`).join("\n"):"No active tickets.";
      }
      const t=await op.ticket(get("id"));
      if(!t || (t.user!==actor && (!support || (t.kind==="staff-report"&&!reportReviewer))))throw Error("Ticket not found or you do not have access.");
      if(sub?.name==='recover'){
        if(!support||t.user===actor)throw Error('Only independent authorised support staff can recover setup.');
        if(t.status!=='creating')throw Error('This ticket is not pending channel setup.');
        const channels=await discord(`/guilds/${env.DISCORD_GUILD_ID}/channels`);
        const channel=channels.find(c=>c.topic?.startsWith(`Private support case ${t.id} ·`));
        if(!channel)throw Error('No matching Discord channel was found. Keep this reservation for owner investigation; no duplicate channel was created.');
        assertPrivateTicket(channel,env,t.user,t.kind);
        await op.ticketOpened(t.id,channel.id);
        return `Recovered private case <#${channel.id}>. Review the subject/details using the original submission; no history was deleted.`;
      }
      if(sub?.name==="claim"){
        if(!support)throw Error("Only the support team can claim tickets.");await op.claimTicket(t.id,actor);return "Ticket claimed. Coordinate in its private channel.";
      }
      if(['state','assign','note','notes'].includes(sub?.name)){
        if(!support||t.user===actor)throw Error('Only independent authorised support staff can update this case.');
        if(t.status!=='open'&&sub.name!=='notes')throw Error('Only open cases can be updated.');
        if(sub.name==='state'){
          if(!['waiting-staff','waiting-player','escalated'].includes(get('state')))throw Error('Choose a valid case state.');
          await store.db.batch([store.statement('UPDATE support_tickets SET workflow=? WHERE id=? AND status=\'open\'',get('state'),t.id),store.audit(actor,'ticket-state',t.id)]);
          return 'Case state saved: '+get('state');
        }
        if(sub.name==='assign'){
          const target=get('user');
          const member=await discord(`/guilds/${env.DISCORD_GUILD_ID}/members/${target}`);
          const access=staffAccess({member},env);
          if(!access.support||(t.kind==='staff-report'&&!access.reportReviewer)||target===t.user)throw Error('Choose an independent staff member authorised for this category.');
          await store.db.batch([store.statement('UPDATE support_tickets SET claimed_by=? WHERE id=? AND status=\'open\'',target,t.id),store.audit(actor,'ticket-assign',t.id)]);
          return 'Case assigned. The recipient can view it through /ticket status; no channel access was broadened.';
        }
        if(sub.name==='notes'){
          const rows=await store.all('SELECT actor,note,created FROM ticket_notes WHERE ticket=? ORDER BY created DESC LIMIT 8',t.id);
          return rows.map(n=>`${n.created} · <@${n.actor}>\n${n.note}`).join('\n\n')||'No staff-only internal notes.';
        }
        store.reason(get('reason'));
        await store.db.batch([store.statement('INSERT INTO ticket_notes VALUES(?,?,?,?,?)',crypto.randomUUID(),t.id,actor,get('reason'),new Date().toISOString()),store.audit(actor,'ticket-note',t.id)]);
        return 'Internal note saved privately. It is not posted in the player’s channel.';
      }
      if(sub?.name!=="close")throw Error("Choose open, status, claim or close.");
      if(!["open","closing"].includes(t.status)||!t.channel)throw Error("Ticket is not open.");
      store.reason(get("reason"));
      const channel=await discord(`/channels/${t.channel}`);assertPrivateTicket(channel,env,t.user,t.kind);
      await op.closingTicket(t.id);
      const updated=await discord(`/channels/${t.channel}`,"PATCH",{name:`closed-${t.id.slice(0,8)}`,parent_id:env.DISCORD_TICKET_ARCHIVE_ID || channel.parent_id,permission_overwrites:ticketOverwrites(env,t.user,t.kind,true)});
      assertPrivateTicket(updated,env,t.user,t.kind);
      const owner=updated.permission_overwrites.find(o=>o.id===t.user&&o.type===1);
      if(!(BigInt(owner.deny)&send))throw Error("Archive permission check failed; contact staff.");
      await op.closedTicket(t.id,actor,get("reason"));
      return "Ticket closed and retained as a private read-only record. No messages were deleted.";
    }
    default:throw Error("Unknown community operation.");
  }
}
