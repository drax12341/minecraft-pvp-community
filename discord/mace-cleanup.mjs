import {REST,Routes,PermissionFlagsBits as P} from 'discord.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Resvg} from '@resvg/resvg-js';
import config from '../config/community.json' with {type:'json'};
import {extraInterests} from '../config/community-roles.mjs';
const guild=process.env.DISCORD_GUILD_ID;
if(guild!=='1568767259168608267')throw Error('Unexpected guild');
const rest=new REST().setToken(process.env.DISCORD_TOKEN),apply=process.argv.includes('--apply');
const groups=[
 ['📌 INFORMATION',[['👋┃welcome','welcome'],['📜┃rules','rules'],['📢┃announcements','announcements'],['🎨┃roles-and-pings','roles-and-alerts'],['❓┃faq','testing-faq'],['🔗┃tierlist-link',null]]],
 ['🔨 TESTING',[['🧪┃request-test','request-test'],['📕┃testing-kits','testing-rubrics'],['✅┃verified-servers',null],['🏆┃results','test-results']]],
 ['💬 COMMUNITY',[['💬┃general','general'],['⚔┃find-a-duel','find-a-duel'],['🎬┃clips','clips-and-highlights'],['💡┃suggestions','suggestions']]],
 ['📩 SUPPORT',[['📩┃support-tickets','open-a-ticket'],['📋┃applications','staff-applications']]],
 ...config.modes.map(m=>[m.name+' Testing',[[m.id.replaceAll('_','-')+'-waitlist',m.id+'-testing']]]),
 ['🔊 VOICE',[]],['🔒 PRIVATE TICKETS',[]],['📁 TICKET ARCHIVE',[]],
 ['🛡 STAFF',[['staff-chat','staff-chat'],['test-review','test-review'],['ticket-log','ticket-log'],['staff-handbook','staff-handbook'],['moderation-log','moderation-log'],['moderator-cases','moderator-cases']]],
];
if(!apply){console.log(JSON.stringify({groups,modes:config.modes.map(m=>m.name)},null,2));process.exit(0);}
await mkdir('.runtime',{recursive:true});
const me=await rest.get(Routes.user('@me'));
let channels=await rest.get(Routes.guildChannels(guild)),roles=await rest.get(Routes.guildRoles(guild));
await writeFile('.runtime/mace-before.json',JSON.stringify({channels,roles},null,2));
const report={channels:[],roles:[],emojis:[],deleted:[],preserved:[],blocked:[],panels:[]};
const attempt=async(label,fn)=>{try{return await fn()}catch(e){report.blocked.push(label+': '+e.message);console.log('Blocked: '+label+' '+e.status);return null;}};
const staff=['Moderator','Support Team','Helper','Senior Tester','Trainee Tester','Coach','Gamemode Manager','Regulator'];
const colors={'Moderator':0x3498db,'Support Team':0x47c5ac,'Helper':0xa18af5,'Senior Tester':0xe0a754,'Trainee Tester':0x65a9ce,'Gamemode Manager':0x24a4c9,'Regulator':0x25c9ad};
const cosmetic={'Color · Violet':0xa78bfa,'Color · Blue':0x5c9ded,'Color · Cyan':0x55d7db,'Color · Green':0x68d398,'Color · Gold':0xe9bb62,'Color · Pink':0xec97c5,'Color · Red':0xea737d};
for(const name of [...staff,'Support Ticket Pings','Staff Pings','Tester Pings','Result Alerts',...Object.keys(cosmetic),...config.modes.map(m=>m.name)]){
 let r=roles.find(r=>r.name===name);const color=colors[name]||cosmetic[name]||parseInt(config.modes.find(m=>m.name===name)?.color.slice(1)||'8994a8',16);
 if(!r){r=await rest.post(Routes.guildRoles(guild),{body:{name,permissions:'0',color,hoist:staff.includes(name),mentionable:name.endsWith('Pings')}});roles.push(r);report.roles.push(name);}
 else if(!r.managed&&r.name!=='@everyone')await attempt(name,()=>rest.patch(Routes.guildRole(guild,r.id),{body:{color,hoist:staff.includes(name),mentionable:name.endsWith('Pings')}}));
}
const role=n=>roles.find(r=>r.name===n)?.id;
roles=await rest.get(Routes.guildRoles(guild));
const member=await rest.get(Routes.guildMember(guild,me.id)),top=Math.max(...roles.filter(r=>member.roles.includes(r.id)).map(r=>r.position));
// Staff first, selectable colors above cosmetic ranks and interests.
const order=[...staff,...Object.keys(cosmetic),...Object.keys(config.points),'Verified Player',...config.modes.map(m=>m.name),'Support Ticket Pings','Staff Pings','Tester Pings',...Object.values(extraInterests)];
const movable=roles.filter(r=>!r.managed&&r.id!==guild&&r.position<top).sort((a,b)=>(order.indexOf(a.name)<0?999:order.indexOf(a.name))-(order.indexOf(b.name)<0?999:order.indexOf(b.name)));
// Move editable roles one at a time; managed integration roles occupy reserved positions.
for(const name of [...staff,...Object.keys(cosmetic)].reverse()){
 roles=await rest.get(Routes.guildRoles(guild));const currentTop=Math.max(...roles.filter(r=>member.roles.includes(r.id)).map(r=>r.position)),r=roles.find(r=>r.name===name);
 if(r&&r.position<currentTop)await attempt('role '+name,()=>rest.patch(Routes.guildRoles(guild),{body:[{id:r.id,position:currentTop-1}]}));
}
const mods=['Community Moderator','Moderator'].map(role).filter(Boolean),support=['Support Team','Helper'].map(role).filter(Boolean),testers=['Tier Tester','Senior Tester','Gamemode Manager'].map(role).filter(Boolean);
const access=P.ViewChannel|P.SendMessages|P.ReadMessageHistory|P.EmbedLinks|P.AttachFiles;
function profile(kind){const hidden=kind==='private',read=kind==='read';return[{id:guild,type:0,allow:hidden?'0':String(P.ViewChannel|P.ReadMessageHistory),deny:String(hidden?P.ViewChannel:read?P.SendMessages|P.CreatePublicThreads|P.CreatePrivateThreads|P.SendMessagesInThreads:0n)},...([...new Set([...mods,...support,...testers])].map(id=>({id,type:0,allow:String(access),deny:'0'}))),{id:me.id,type:1,allow:String(access),deny:'0'}];}
const keep=new Set(),byName=new Map(),parents=new Map();
const oldParents=['01 · START HERE','03 · TESTING DESK','02 · COMMUNITY','06 · SUPPORT'];
for(let ix=0;ix<groups.length;ix++){
 const [name,children]=groups[ix],priv=/PRIVATE|ARCHIVE|STAFF/.test(name);
 const oldName=oldParents[ix]||({'🔊 VOICE':'07 · VOICE','🔒 PRIVATE TICKETS':'08 · PRIVATE TICKETS','📁 TICKET ARCHIVE':'09 · TICKET ARCHIVE','🛡 STAFF':'10 · STAFF'}[name]);
 let parent=channels.find(c=>c.type===4&&c.name===name)||channels.find(c=>c.type===4&&c.name===oldName);
 const body={name,type:4,permission_overwrites:profile(priv?'private':'public')};
 parent=parent?await rest.patch(Routes.channel(parent.id),{body}):await rest.post(Routes.guildChannels(guild),{body});
 keep.add(parent.id);parents.set(name,parent.id);
 for(const [label,old]of children){
  let c=channels.find(c=>c.type===0&&c.name===label)||channels.find(c=>c.type===0&&c.name===old);
  const kind=priv?'private':name==='💬 COMMUNITY'?'public':'read';
  const b={name:label,type:0,parent_id:parent.id,permission_overwrites:profile(kind),rate_limit_per_user:kind==='public'?3:0};
  c=c?await rest.patch(Routes.channel(c.id),{body:b}):await rest.post(Routes.guildChannels(guild),{body:b});
  keep.add(c.id);byName.set(label,c);report.channels.push({name:label,id:c.id});
 }
}
for(const [name,old]of [['🔊 Lounge','Community Lounge'],['⚔ Practice 1','Practice Room 1'],['⚔ Practice 2','Practice Room 2']]){
 let c=channels.find(c=>c.type===2&&[name,old].includes(c.name));const body={name,type:2,parent_id:parents.get('🔊 VOICE'),permission_overwrites:profile('public'),user_limit:6};
 c=c?await rest.patch(Routes.channel(c.id),{body}):await rest.post(Routes.guildChannels(guild),{body});keep.add(c.id);
}
await rest.patch(Routes.guildChannels(guild),{body:[...parents.values()].map((id,position)=>({id,position}))});
const button=(label,custom_id,style=2)=>({type:2,label,custom_id,style});
async function panel(name,title,description,buttons=[]){const c=byName.get(name),marker='Mace Community · '+name;
 const messages=await rest.get(Routes.channelMessages(c.id),{query:new URLSearchParams({limit:'100'})});
 const prior=messages.find(m=>m.author.id===me.id&&m.embeds?.some(e=>e.footer?.text===marker))||messages.find(m=>m.author.id===me.id&&m.embeds?.some(e=>/community-v|journey/.test(e.footer?.text||'')));
 const body={embeds:[{title,description,color:0x8074ee,footer:{text:marker}}],components:buttons.length?[{type:1,components:buttons}]:[],allowed_mentions:{parse:[]}};
 const msg=prior?await rest.patch(Routes.channelMessage(c.id,prior.id),{body}):await rest.post(Routes.channelMessages(c.id),{body});
 await rest.patch(Routes.channel(c.id),{body:{topic:description.replaceAll('\n',' ').slice(0,990)}});
 report.panels.push({channel:name,id:msg.id});
 // Remove only superseded guidance written by this same bot, preserving member posts and results.
 if(!name.includes('results'))for(const m of messages.filter(m=>m.id!==msg.id&&m.author.id===me.id&&m.embeds?.some(e=>/community-v|upgrade-v|journey/.test(e.footer?.text||''))))await rest.delete(Routes.channelMessage(c.id,m.id));
}
const ref=n=>'<#'+byName.get(n).id+'>';
await panel('👋┃welcome','🔨 Welcome to the Mace Community',`Seven gamemodes. One community.\n\n**Start here:** read ${ref('📜┃rules')}, choose roles in ${ref('🎨┃roles-and-pings')} and read ${ref('❓┃faq')}.\n**Get tested:** premium Java account → staff ownership verification → select mode and region → waitlist or open session → assigned tester → results.\n**Need help?** ${ref('📩┃support-tickets')}. Never share passwords or tokens.`,[button('Request a test','hub:test',1),button('Roles & pings','hub:interests'),button('Support','hub:ticket')]);
await panel('📜┃rules','📜 Community rules','Respect everyone. No harassment, hate, threats, doxxing, spam or unsolicited advertising.\n\n**Fair testing:** premium Minecraft Java accounts only. No cheats, macros, boosting, account sharing or staged results. Agree the approved kit, version and server before playing. Staff must independently review high-tier placements.\n\n**Privacy:** never share passwords, tokens or backup codes. Report issues through private tickets. Publish only agreed match evidence. No bought tiers or queue priority.');
await panel('📢┃announcements','📢 Community announcements','Official updates appear here. Choose Update Alerts, Test Alerts, Result Alerts or Event Alerts in roles-and-pings to control optional notifications.');
await panel('🎨┃roles-and-pings','🎨 Your modes, region & notifications','Choose your gamemode interests and optional Test / Event / Update / Result Alerts. Use /preferences region to set your region. Pick one name color; choosing another replaces your previous color.\n\nInterest and color roles grant no staff permissions or tiers. Staff Pings, Tester Pings and Support Ticket Pings are assigned by the owner to relevant staff only.',[button('Gamemodes','hub:modes',1),button('Alerts & colors','hub:interests')]);
await panel('❓┃faq','❓ Frequently Asked Questions',`Please read these before opening a support ticket.\n\n**Can I tier test on cracked / Bedrock edition?**\nNo. A premium Minecraft Java account is required.\n\n**I selected a gamemode and verified, but I am not on a waitlist.**\nReload Discord and reselect the mode if the menu is stuck. Mode roles are preferences; use the test request menu or /waitlist join to save testing demand. Use /waitlist status to check it.\n\n**Where can I see tiers?**\nSee ${ref('🔗┃tierlist-link')}.\n\n**Why is my tester from another region? Can I change testers?**\nAsk staff to arrange a suitable tester if regions differ. Current bot sessions and queues are organized by mode and region. A tester change must be coordinated by staff.\n\n**Can tiers be removed or transferred?**\nTiers are not removed on request. If you lose access to your Discord or Minecraft account, open an account support ticket with evidence of ownership for staff review. Never send login credentials.\n\nIf your question is not answered here, use ${ref('📩┃support-tickets')}. This FAQ may receive updates.`);
await panel('🔗┃tierlist-link','🔗 Official tierlist','View published placements, testing availability and player profiles.',[{type:2,style:5,label:'Open tierlist',url:'https://minecraft-pvp-community.draxion0.chatgpt.site'}]);
await panel('🧪┃request-test','📝 Evaluation Testing Waitlist','Select a gamemode and your preferred region. Your username must match the Minecraft account you will test on. Staff verify ownership privately; never send account credentials.\n\nAn open session checks verification, capacity and cooldown. When no session is open, save a waitlist preference. This records demand without reserving an active queue place. /waitlist status and /queue status show your progress.\n\nFalse account, region or server information can cause a denied test.',[button('Enter Waitlist / Request Test','hub:test',1),button('Session availability','hub:availability'),button('Testing guide','hub:guide')]);
await panel('📕┃testing-kits','📕 Mace testing kits',config.modes.map(m=>'**'+m.name+'**').join(' · ')+'\n\nRead the assessment criteria below. Exact loadouts, version and benchmark opponents must be approved by staff before sessions open. The reference screenshots do not specify complete kits; no invented loadouts are treated as approved.',[button('Choose a kit / rubric','hub:rubrics',1)]);
const serverText=`🟢 🇺🇳 **pvphq.com** — Global\n\n**North / South America**\n🟢 🇺🇸 east.catpvp.xyz 💎\n🟢 🇺🇸 west.catpvp.xyz 💎\n🟢 🇺🇸 nac.catpvp.xyz 💎\n🟢 🇨🇱 sa.catpvp.xyz 💎\n🟢 🇺🇸 macesmp.net 💎\n🟢 🇺🇸 fishffa.gg 💎\n🟢 🇨🇱 sa.fishffa.gg 💎\n🟢 🇧🇷 br.fishffa.gg 💎\n🟢 🇺🇸 na.aquapvp.club 💎\n🟢 🇺🇸 play.pvplegacy.net\n🟢 🇺🇸 mcpvp.club\n🟡 🇺🇸 na.minemen.club\n\n**Europe**\n🟢 🇩🇪 eu.catpvp.xyz 💎\n🟢 🇬🇧 eu.mcpvp.club\n🟡 🇩🇪 eu.minemen.club\n🟡 🇩🇪 turtled.net\n\n**Asia / Australia**\n🟢 🇸🇬 as.catpvp.xyz 💎\n🟢 🇦🇪 me.catpvp.xyz 💎\n🟢 🇦🇺 au.catpvp.xyz 💎\n🟢 🇸🇬 as.mcpvp.club\n🟢 🇦🇺 oceanias.net\n🟢 🇦🇺 au.mcpvp.club\n🟡 🇸🇬 as.minemen.club\n\n🟢 **Priority** — use over agreement servers.\n🟡 **Agreement** — both players must agree.\n💎 Supports some or all Mace Submodes kits.\n\n⚠ Testing outside this list invalidates the test unless staff explicitly authorize an exception.\nServer list supplied by community management; ask staff which kit is supported before playing.`;
await panel('✅┃verified-servers','✅ Verified Testing Servers',serverText);
await panel('🏆┃results','🏆 Test results','Official completed tests appear here. Results identify the player, tester, gamemode, region, earned tier and agreed match evidence. No placements are awarded by selecting roles.');
await panel('📩┃support-tickets','📩 Request Support',`Read ${ref('❓┃faq')} before creating a ticket.\n\n🧩 **Support** — questions and general issues.\n👤 **Account Support** — verification, lost access and transfer requests with ownership evidence.\n⚠ **Player Report** — facts, time and evidence.\n🛡 **Confidential Staff Report** — independent owner / reviewer access.\n🖥 **Technical Support** — bot, website or testing server applications (include server address, region and supported kits).\n\nChoose a category, complete the form, then review and submit. The support notification role is pinged inside new ordinary tickets. Staff complaints notify only configured independent reviewers / owner. Please do not spam staff.`,[button('Select request type','hub:ticket',1)]);
await panel('📋┃applications','📋 Join the team','Apply for a volunteer staff track with the button below. For tester roles use /tester-apply submit with mode, region, experience and availability. Applications require human review and training; they do not grant staff access.',[button('Staff application','hub:apply',1)]);
for(const m of config.modes)await panel(m.id.replaceAll('_','-')+'-waitlist',m.name+' · Testing Waitlist','Use the button to select your region and request this mode. /availability shows real sessions. When sessions are closed, save a waitlist preference; no active position or waiting time is promised.\n\nRead the approved testing kit and verified server list first. Use Test Alerts for optional session notifications.',[button('Request '+m.name,'test:mode:'+m.id,1),button('Availability','hub:availability')]);
// Custom, original vector badges rendered to PNG for native Discord emojis.
let emojis=await rest.get(Routes.guildEmojis(guild));
for(const [name,color,glyph]of [['mace', '#83b8ef','M'],['spear_mace','#58d5ca','S'],['ht_mace','#ed777f','HT'],['lt_mace','#8fc879','LT'],['og_mace','#bb9bef','OG'],['rod_mace','#efbf76','R'],['rocket_mace','#ed90ce','↑'],['ticket','#8074ee','T'],['verified','#68d398','✓']])if(!emojis.some(e=>e.name===name))await attempt('emoji '+name,async()=>{const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect x="4" y="4" width="120" height="120" rx="28" fill="#222735" stroke="${color}" stroke-width="7"/><text x="64" y="86" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="56" fill="${color}">${glyph}</text></svg>`;const png=new Resvg(svg).render().asPng();const e=await rest.post(Routes.guildEmojis(guild),{body:{name,image:'data:image/png;base64,'+Buffer.from(png).toString('base64')}});report.emojis.push(e.name);});
// Retire known unused infrastructure only. Preserve human-authored channel history privately.
channels=await rest.get(Routes.guildChannels(guild));
for(const c of channels.filter(c=>!keep.has(c.id)&&c.type===0&&!/^(ticket-|closed-|test-)/.test(c.name))){
 await attempt('retire '+c.name,async()=>{
  const messages=await rest.get(Routes.channelMessages(c.id),{query:new URLSearchParams({limit:'100'})});
  await writeFile('.runtime/retired-'+c.id+'.json',JSON.stringify({channel:c,messages},null,2));
  if(messages.length<100&&messages.every(m=>m.author.id===me.id)){await rest.delete(Routes.channel(c.id));report.deleted.push(c.name);}
  else {await rest.patch(Routes.channel(c.id),{body:{parent_id:parents.get('📁 TICKET ARCHIVE'),permission_overwrites:profile('private')}});report.preserved.push(c.name);}
 });
}
channels=await rest.get(Routes.guildChannels(guild));
for(const c of channels.filter(c=>c.type===4&&!keep.has(c.id)&&!channels.some(x=>x.parent_id===c.id)))await attempt('empty category '+c.name,async()=>{await rest.delete(Routes.channel(c.id));report.deleted.push(c.name);});
for(const c of channels.filter(c=>c.type===2&&!keep.has(c.id)&&['General','Coaching Room'].includes(c.name)))await attempt(c.name,async()=>{const states=await rest.get(Routes.guild(guild),{query:new URLSearchParams({with_counts:'true'})});/* No voice member eviction: keep old rooms hidden instead. */await rest.patch(Routes.channel(c.id),{body:{parent_id:parents.get('📁 TICKET ARCHIVE'),permission_overwrites:profile('private')}});report.preserved.push(c.name);});
const envValues={DISCORD_SUPPORT_PING_ROLE_ID:role('Support Ticket Pings')};
let env=await readFile('.env','utf8');for(const [k,v]of Object.entries(envValues))env=new RegExp('^'+k+'=.*$','m').test(env)?env.replace(new RegExp('^'+k+'=.*$','m'),k+'='+v):env.trimEnd()+'\n'+k+'='+v+'\n';await writeFile('.env',env);
const after=await rest.get(Routes.guildChannels(guild));for(const id of keep)if(!after.some(c=>c.id===id))throw Error('Missing managed channel '+id);
await writeFile('.runtime/mace-cleanup-report.json',JSON.stringify({...report,envValues},null,2));console.log(JSON.stringify({...report,envValues},null,2));
