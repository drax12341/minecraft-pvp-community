// Own-server upgrade. Additive channels, preserved message history and explicit
// permission profiles. Run without --apply for the intended structure.
import { REST, Routes, PermissionFlagsBits as P } from "discord.js";
import { readFile,writeFile,mkdir } from "node:fs/promises";
import config from "../config/community.json" with {type:"json"};
import { extraInterests } from "../config/community-roles.mjs";
import { rubricText,rubricProtocol,rubricPlacement } from "../config/rubrics.mjs";
const guild=process.env.DISCORD_GUILD_ID;
if(guild!=="1568767259168608267"||!process.env.DISCORD_TOKEN)throw Error("Expected own server and dedicated bot environment.");
const apply=process.argv.includes("--apply"),rest=new REST().setToken(process.env.DISCORD_TOKEN);
const groups=[
 {name:"01 · START HERE",old:"Start here",readOnly:true,channels:["welcome","rules","announcements","choose-your-modes","how-to-test","server-guide","roles-and-alerts"]},
 {name:"02 · COMMUNITY",old:"Community",channels:["general","introductions","find-a-duel","clips-and-highlights","guides-and-coaching","survival-smp","minigames","building-and-redstone","suggestions","player-resources"]},
 {name:"03 · TESTING DESK",old:"Competition",channels:["request-test","test-queue","test-results","testing-rubrics","testing-faq","tester-schedule","events","looking-for-team"]},
 {name:"04 · MAIN MODES",old:"Main mode testing",channels:config.modes.filter(m=>m.group==="Main modes").map(m=>m.id+"-testing")},
 {name:"05 · SUBMODES",old:"Submode testing",channels:config.modes.filter(m=>m.group==="Submodes").map(m=>m.id+"-testing")},
 {name:"06 · SUPPORT",old:"Support",channels:["open-a-ticket","help","appeals","report-a-player","staff-applications","tester-recruitment","sponsorships"]},
 {name:"07 · VOICE",old:"Voice channels",channels:[]},
 {name:"08 · PRIVATE TICKETS",private:true,channels:[]},
 {name:"09 · TICKET ARCHIVE",private:true,channels:[]},
 {name:"10 · STAFF",old:"Staff",private:true,channels:["staff-chat","test-review","moderation-log","helper-desk","ticket-log","rubric-review","staff-handbook","moderator-cases"]},
];
const staffNames=["Moderator","Support Team","Helper","Senior Tester","Trainee Tester","Coach"];
const roleNames=[...staffNames,"Verified Player",...Object.values(extraInterests)];
if(!apply){console.log(JSON.stringify({roles:roleNames,groups,rubrics:config.modes.map(m=>m.name),panels:["welcome","rules","choose-your-modes","request-test","open-a-ticket","staff-applications","testing-rubrics"],preservesMessages:true},null,2));process.exit(0);}
const report={createdRoles:[],updatedRoles:[],createdChannels:[],movedChannels:[],panels:[],verified:[],blocked:[]};
const me=await rest.get(Routes.user("@me"));
let roles=await rest.get(Routes.guildRoles(guild)),channels=await rest.get(Routes.guildChannels(guild));
const role=name=>{const r=roles.find(r=>r.name===name);if(!r)throw Error("Required role missing: "+name);return r;};
const getRoleColor=name=>{
 if(name==="Moderator")return 0xef638b;if(["Support Team","Helper"].includes(name))return 0x2dd4bf;
 if(["Senior Tester","Trainee Tester"].includes(name))return 0x60a5fa;if(name==="Coach")return 0xf59e0b;
 if(name==="Verified Player")return 0x34d399;
 if(/^(HT|LT)[1-5]$/.test(name))return {1:0xf5cb65,2:0xe093ed,3:0x67c9ec,4:0x70d5a1,5:0xb4bfce}[name.at(-1)];
 return config.modes.find(m=>m.name===name)?.color?parseInt(config.modes.find(m=>m.name===name).color.slice(1),16):0x9c8ded;
};
for(const name of roleNames)if(!roles.some(r=>r.name===name)){
 const r=await rest.post(Routes.guildRoles(guild),{body:{name,permissions:"0",color:getRoleColor(name),hoist:staffNames.includes(name),mentionable:false}});roles.push(r);report.createdRoles.push({name,id:r.id});
}
const member=await rest.get(Routes.guildMember(guild,me.id));
roles=await rest.get(Routes.guildRoles(guild));
const top=Math.max(...roles.filter(r=>member.roles.includes(r.id)).map(r=>r.position));
for(const r of roles.filter(r=>!r.managed&&r.position<top&&r.id!==guild)){
 const color=getRoleColor(r.name);if(r.color!==color){await rest.patch(Routes.guildRole(guild,r.id),{body:{color}});report.updatedRoles.push(r.name);}
}
const everyone=role("@everyone");
if(BigInt(everyone.permissions)&P.MentionEveryone)await rest.patch(Routes.guildRole(guild,guild),{body:{permissions:String(BigInt(everyone.permissions)&~P.MentionEveryone)}});
const priority=[...staffNames,"Event Host","Verified Player","Creator","Supporter",...Object.keys(config.points),...config.modes.map(m=>m.name),...Object.values(extraInterests),"EU","NA","AS","SA","AU","AF","ME","OC"];
const lower=roles.filter(r=>!r.managed&&r.position<top&&r.id!==guild).sort((a,b)=>(priority.indexOf(a.name)<0?999:priority.indexOf(a.name))-(priority.indexOf(b.name)<0?999:priority.indexOf(b.name)));
await rest.patch(Routes.guildRoles(guild),{body:lower.map((r,i)=>({id:r.id,position:lower.length-i}))});
const mods=[role("Community Moderator").id,role("Moderator").id];
const testers=[role("Tier Tester").id,role("Senior Tester").id];
const support=[role("Support Team").id,role("Helper").id];
const allow=P.ViewChannel|P.SendMessages|P.ReadMessageHistory|P.EmbedLinks|P.AttachFiles;
const readOnlyDeny=P.SendMessages|P.CreatePublicThreads|P.CreatePrivateThreads|P.SendMessagesInThreads;
const profile=(kind)=>{
 const trusted=kind==="private"?[...mods,...testers]:kind==="support"?[...mods,...support]:kind==="mods"?mods:[...mods,...testers,...support];
 const hidden=["private","support","mods"].includes(kind);
 return [{id:guild,type:0,allow:String(hidden?0n:P.ViewChannel|P.ReadMessageHistory),deny:String(hidden?P.ViewChannel:kind==="read"?readOnlyDeny:0n)},
 ...trusted.map(id=>({id,type:0,allow:String(allow),deny:"0"})),{id:me.id,type:1,allow:String(allow),deny:"0"}];
};
// Only this server's named infrastructure is managed; unrelated channels remain.
const parentByName=new Map();
for(const group of groups){
 let parent=channels.find(c=>c.type===4&&c.name===group.name)||channels.find(c=>c.type===4&&c.name===group.old);
 const kind=group.name.includes("TICKET")?"support":group.private?"private":group.readOnly?"read":"public";
 const overwrites=profile(kind);
 if(!parent){parent=await rest.post(Routes.guildChannels(guild),{body:{name:group.name,type:4,permission_overwrites:overwrites}});channels.push(parent);report.createdChannels.push({name:parent.name,id:parent.id});}
 else parent=await rest.patch(Routes.channel(parent.id),{body:{name:group.name,permission_overwrites:overwrites}});
 parentByName.set(group.name,parent);
 for(const name of group.channels){
  let channel=channels.find(c=>c.type===0&&c.name===name);
  const readOnly=group.readOnly||["request-test","test-results","testing-rubrics","testing-faq","tester-schedule","open-a-ticket","report-a-player","staff-applications","staff-handbook"].includes(name);
  const restricted=["moderation-log","moderator-cases"].includes(name)?"mods":["helper-desk","ticket-log"].includes(name)?"support":group.private?"private":readOnly?"read":"public";
  const body={parent_id:parent.id,permission_overwrites:profile(restricted),rate_limit_per_user:readOnly?0:["find-a-duel","suggestions","looking-for-team"].includes(name)?30:3};
  if(!channel){channel=await rest.post(Routes.guildChannels(guild),{body:{name,type:0,...body}});channels.push(channel);report.createdChannels.push({name,id:channel.id});}
  else {channel=await rest.patch(Routes.channel(channel.id),{body});report.movedChannels.push(name);}
  if(restricted!=="public"){
   const e=channel.permission_overwrites.find(o=>o.id===guild),bot=channel.permission_overwrites.find(o=>o.id===me.id);
   if(!bot||(BigInt(bot.allow)&allow)!==allow)throw Error("Bot access verification failed: "+name);
   if(["mods","private","support"].includes(restricted)&&(!e||!(BigInt(e.deny)&P.ViewChannel)))throw Error("Privacy verification failed: "+name);
  }
 }
}
const voiceParent=parentByName.get("07 · VOICE");
for(const [name,limit]of[["Community Lounge",24],["Practice Room 1",4],["Practice Room 2",4],["Coaching Room",6]])if(!channels.some(c=>c.type===2&&c.name===name)){
 const c=await rest.post(Routes.guildChannels(guild),{body:{name,type:2,parent_id:voiceParent.id,user_limit:limit,permission_overwrites:profile("public")}});channels.push(c);report.createdChannels.push({name,id:c.id});
}
await rest.patch(Routes.guildChannels(guild),{body:groups.map((g,index)=>({id:parentByName.get(g.name).id,position:index}))});
const channelName=name=>channels.find(c=>c.type===0&&c.name===name);
const button=(label,id,style=2)=>({type:2,style,label,custom_id:id});
const mainButtons=[button("Request a test","hub:test",1),button("Open a ticket","hub:ticket"),button("Pick your modes","hub:modes"),button("Read rubrics","hub:rubrics")];
const panels={
 welcome:["ONE COMMUNITY. EVERY PLAYSTYLE.","Welcome to Minecraft PvP Tierlist. Meet practice partners, improve your play and earn placements through our own testing team.\n\n**01 · Set up:** choose your mode interests, casual games, region and opt-in alerts.\n**02 · Get ready:** read the rules and your mode's rubric. Staff verify Minecraft ownership without passwords.\n**03 · Play:** request a test only when a real session is open, or find casual practice.\n**04 · Get help:** open a private ticket; keep reports and application details out of public chat.\n\nOne independent tierlist. No bought ranks, fake activity or imported placements.",mainButtons],
 rules:["The arena code","**Respect:** no harassment, hate speech, doxxing, threats or targeted drama.\n**Fair play:** no cheats, macros, boosting, account sharing or staged tests. Agree approved mods, kit and version before playing.\n**Privacy:** never send passwords, tokens or backup codes. Record only agreed evidence and keep personal information out of shared clips.\n**Testing:** no self-testing; only assigned testers publish results. High tiers need independent sign-off.\n**Integrity:** sponsors cannot buy ranks, queue priority or appeal outcomes. Appeals use private commands, reviewed independently.\n**Community:** use the right channels, avoid unsolicited pings and advertising, and respect slowmode. Report problems privately.",[button("Need support?","hub:ticket"),button("Testing guide","hub:guide")]],
 "server-guide":["Find your place","**Community:** general chat, introductions, duel partners, clips and coaching.\n**Minecraft beyond tiers:** Survival & SMP, Bedwars/Skywars and other minigames, creative builds, redstone and parkour. These interests do not create extra tierlists.\n**Testing desk:** test requests, published rubrics, actual availability, results and FAQ.\n**Modes:** eight main modes and seven submodes, each with its own testing channel and criterion panel.\n**Support:** private tickets, account assistance, reports and applications.\n**Voice:** lounge, two practice rooms and coaching.\n\nUse /guide, /availability, /profile, /practice and /queue status. No green bot indicator is required.",mainButtons],
 "choose-your-modes":["Your modes. Your region.","Pick PvP interests with the buttons below or /preferences mode. Use /preferences region to select EU, NA, AS, SA, AU, AF, ME or OC.\n\nThese roles are cosmetic interests. They never grant testing, moderation or ranking permissions. Choosing a role does not join a queue. You can toggle it again to remove it.",[button("PvP mode interests","hub:modes",1),button("Casual games & alerts","hub:interests")]],
 "roles-and-alerts":["Stay informed on your terms","Opt into Test Alerts, Event Alerts and Update Alerts. Choose Survival & SMP, Bedwars, Skywars, Creative & Redstone or Parkour interests.\n\n/interests toggles one safe role. No roles pinged by this setup. Staff roles are assigned only by the owner after an interview and supervised training; applications never promote automatically.",[button("Choose interests & alerts","hub:interests",1)]],
 "how-to-test":["Your route to a placement","**1** Confirm Minecraft ownership with staff; use a private account ticket if needed.\n**2** Read /rubric mode and the published session kit manifest.\n**3** Check /availability; request your mode/region below or /request-test. Verification, capacity and cooldown are checked again.\n**4** An assigned tester agrees the setup and plays the assessment. Only they record its six scores.\n**5** The tester submits evidence and placement; high tiers require independent senior review.\n**6** /queue status shows your progress and latest valid result. /appeal submit lets you request independent review.\n\nA request is not a guaranteed appointment or rank.",[button("Request a test","hub:test",1),button("Real availability","hub:availability"),button("Mode rubrics","hub:rubrics")]],
 "request-test":["THE TESTING DESK","Use the request button to choose your mode and region. This creates a real queue entry only if your Minecraft ownership is verified, the session is open, a place is available and your cooldown has elapsed.\n\nCheck /queue status mode region for private progress. /queue leave cancels a waiting entry. A claimed entry belongs to its assigned tester; testers can /claim action:release for a handoff.\n\nNo sessions are opened by this server upgrade. Real trained staff and exact kit manifests are required first.",[button("Request a test","hub:test",1),button("Check availability","hub:availability"),button("Read criteria","hub:rubrics")]],
 "test-queue":["Know your next step","/request-test and /queue join enter the same official queue. /queue status shows verification, your entry ID, waiting position, latest result ID and cooldown privately.\n\nWaiting positions exclude already claimed tests and are not an ETA. Leave with /queue leave. For a claimed entry, speak to the assigned tester. Practice listings remain separate from official testing.",[button("Request a test","hub:test",1),button("Availability","hub:availability")]],
 "testing-rubrics":["Transparent assessment. Evidence before rank.",rubricProtocol+"\n\n"+rubricPlacement+"\n\n**Tester workflow:** /claim → /assessment record (six scores) → independent /assessment review for tiers 1–2 → /result. Changed assessments invalidate previous sign-off through revision matching; prior scoring/review history is retained.",[button("Choose a mode rubric","hub:rubrics",1)]],
 "testing-faq":["Before you request a test","**Bot looks offline?** Commands and buttons use cloud HTTP hosting; your PC is not needed.\n**No open session?** Staff must confirm availability, approved kit and trained testers. There is no hidden reservation.\n**Can I buy a tier or priority?** No.\n**Forgot my result ID?** /queue status mode region.\n**Need a retest?** Check the session cooldown in /queue status; default is 72 hours.\n**Disagree with a result?** /appeal submit id reason. Your original tester cannot decide the appeal.\n**Want to help?** Tester applications and staff applications are private; no automatic promotions.",[button("Support ticket","hub:ticket"),button("Testing guide","hub:guide")]],
 "tester-schedule":["Real availability, without invented dates","/availability reads live cloud sessions, occupancy, capacity and cooldown. Staff announce a session only after confirming a tester, region/server, kit manifest and assessment rules.\n\nA channel or alert role does not imply someone is currently testing. This setup creates no fake timetable and opens no sessions.",[button("View actual sessions","hub:availability",1)]],
 "open-a-ticket":["A PRIVATE WAY TO GET HELP","Choose general support, account assistance, a player report or a confidential staff report. A private channel opens for you and the relevant team.\n\n**Account checks:** staff explain an ownership proof; never share passwords or backup codes.\n**Player reports:** include relevant message/match links and what happened, without public accusations.\n**Staff reports:** restricted to moderators; helpers and ordinary testers do not receive access.\n\nAt most two active tickets per member, one per category. /ticket status tracks your cases. Closing keeps a private read-only record. Server administrators can access private channels.",[button("Open a private ticket","hub:ticket",1)]],
 "report-a-player":["Report fairly. Keep it private.","Open a player report ticket with a clear timeline, relevant Discord/message/match links and consented evidence. Do not post allegations or personal information publicly. Staff reports have a separate moderator-only route.\n\nFor a tier result dispute, use /appeal submit so an independent reviewer can decide it. A report does not automatically punish or change a rank.",[button("Open a report","hub:ticket",1)]],
 "staff-applications":["BUILD THE COMMUNITY WITH US","Apply as Helper, Moderator, Coach or Event Host. Verify Minecraft ownership first, then use the application button or /staff-apply submit. Include relevant experience and UTC availability.\n\nModerators independently review private applications for interview or decline with feedback. /staff-apply status shows your decisions. No application grants a role. The owner assigns trusted staff only after an interview and role-specific training.\n\nInterested in testing? Use /tester-apply for a specific mode/region.",[button("Apply for a volunteer role","hub:apply",1)]],
 "staff-handbook":["Clear responsibilities. Limited access.","**Moderators:** private reports, independent appeals, warning/case records and staff recruitment. Never decide your own disputes. /moderation records internal cases; it does not apply native Discord punishments.\n**Helpers & Support Team:** handle ordinary support/account tickets; no confidential staff reports, moderation cases or appeal decisions.\n**Tier/Senior Testers:** follow the mode rubric, claim fairly and record evidence. Independent senior review is required for tier 1–2 publication.\n**Trainee Testers:** supervised learning only; the trainee role does not authorize /claim or /result.\n**Coaches:** voluntary learning and respectful feedback, no rank promises.\n**Event Hosts:** publish real rules, UTC timing and an accountable host.\n\nUse strong account security. Never request secrets, mass-ping members, promise queue priority or grant staff roles through interest menus.",[]],
 "helper-desk":["Support handoffs","/ticket status lists ordinary active cases for support staff. /ticket claim assigns one responder; do not claim your own ticket. Coordinate inside the case channel. /ticket close archives a case without deleting history.\n\nEscalate confidential staff complaints to moderators. Helpers cannot read those cases through commands or channel grants. Account verification itself remains a moderator action.",[]],
 "moderator-cases":["Private moderation records","/moderation warn user reason records an internal case with attribution. /moderation cases lists records privately; /moderation resolve retains the original record and resolution. These commands do not DM, kick, ban or timeout members.\n\nUse proportionate human review and native Discord enforcement only with appropriate permissions. Appeals and staff applications require an independent reviewer.",[]],
 "rubric-review":["Calibrate before placing","Publish exact mode kit manifests and agree reference opponents before opening sessions. Use six 0–4 dimensions with the published weights. Scores provide feedback, not an automatic rank formula.\n\n/assessment record requires your own claimed test. /assessment review requires a different senior tester/moderator, a different player, the current assessment revision and the exact proposed tier. Preserve evidence and recuse conflicts. Training candidates do not acquire tester powers automatically.",[]],
 "survival-smp":["Minecraft beyond the arena","Share Survival/SMP projects, progress and invitations with clear version, region and server rules. Do not advertise paid ranks or unsolicited services. Use tickets for reports and avoid sharing private coordinates without consent.",[button("Choose game interests","hub:interests")]],
 minigames:["Find your next game","Bedwars, Skywars, parkour and other Minecraft minigames belong here. Post game, region, version and UTC availability. These casual interests do not import external rankings or create extra official tierlists.",[button("Choose game interests","hub:interests")]],
 "building-and-redstone":["Show the build. Explain the idea.","Share original builds, farms and redstone ideas. Mention Java/Bedrock, version and relevant constraints. Credit inspirations and ask before reposting someone else's work. Keep feedback specific and kind.",[]],
 suggestions:["Make a useful suggestion","**Problem:** what is difficult now?\n**Proposal:** what should change?\n**Benefit:** who would it help?\n**Trade-offs:** what might it cost or complicate?\n\nDo not include private reports or accusations. Suggestions do not guarantee implementation.",[]],
 "player-resources":["Your player toolkit","/guide for the basics · /rubric for assessment criteria · /availability for real sessions · /request-test for official queues · /practice for sparring partners · /profile for earned placements · /ticket for private help.\n\nNever install an untrusted file for testing. Our public website and official experimental mod release are linked below; no external rank providers are connected.",[]],
};
const page="https://drax12341.github.io/minecraft-pvp-community/";
async function publish(name,title,description,buttons=[],suffix="main"){
 const c=channelName(name);if(!c){report.blocked.push(name+": missing");return;}
 const marker=`Minecraft PvP Tierlist · community-v4 · ${name} · ${suffix}`;
 const messages=await rest.get(Routes.channelMessages(c.id),{query:new URLSearchParams({limit:"100"})});
 const prior=messages.find(m=>m.author.id===me.id&&m.embeds?.some(e=>e.footer?.text===marker));
 const body={embeds:[{title,description,color:0xa78bfa,footer:{text:marker}}],components:[...(buttons.length?[{type:1,components:buttons}]:[]),{type:1,components:[{type:2,style:5,label:"Community website",url:page}]}],allowed_mentions:{parse:[]}};
 const msg=prior?await rest.patch(Routes.channelMessage(c.id,prior.id),{body}):await rest.post(Routes.channelMessages(c.id),{body});
 const check=await rest.get(Routes.channelMessage(c.id,msg.id));if(check.embeds?.[0]?.footer?.text!==marker)throw Error("Panel verification failed: "+name);
 report.panels.push({channel:name,message:msg.id});
}
for(const [name,[title,description,buttons]]of Object.entries(panels)){
 await rest.patch(Routes.channel(channelName(name).id),{body:{topic:description.replaceAll("\n"," ").slice(0,990)}});
 await publish(name,title,description,buttons);
}
for(const m of config.modes){
 await publish(m.id+"-testing",`${m.name.toUpperCase()} · TESTING & CRITERIA`,rubricText(m.id,m.name),[button("Request a test","hub:test",1),button("Availability","hub:availability")],"rubric");
}
const all=await rest.get(Routes.guildChannels(guild));
for(const g of groups)for(const name of g.channels){
 const c=all.find(c=>c.id===channelName(name).id);if(c.parent_id!==parentByName.get(g.name).id)throw Error("Channel parent verification failed: "+name);report.verified.push(name);
}
const envValues={DISCORD_MODERATOR_ROLE_IDS:mods.join(","),DISCORD_TESTER_ROLE_IDS:testers.join(","),DISCORD_SENIOR_TESTER_ROLE_IDS:role("Senior Tester").id,DISCORD_SUPPORT_ROLE_IDS:support.join(","),DISCORD_VERIFIED_ROLE_ID:role("Verified Player").id,DISCORD_TICKET_CATEGORY_ID:parentByName.get("08 · PRIVATE TICKETS").id,DISCORD_TICKET_ARCHIVE_ID:parentByName.get("09 · TICKET ARCHIVE").id};
let local=await readFile(".env","utf8");
for(const [key,value]of Object.entries(envValues))local=new RegExp("^"+key+"=", "m").test(local)?local.replace(new RegExp("^"+key+"=.*$","m"),key+"="+value):local.trimEnd()+"\n"+key+"="+value+"\n";
await writeFile(".env",local);await mkdir(".runtime",{recursive:true});await writeFile(".runtime/community-v4-report.json",JSON.stringify({...report,envValues},null,2));
console.log(JSON.stringify({...report,roleCount:roles.length,channelCount:all.length},null,2));
