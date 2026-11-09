import {REST,Routes,PermissionFlagsBits as P} from 'discord.js';
import {readFile,writeFile} from 'node:fs/promises';
import config from '../config/community.json' with {type:'json'};
import {deskPaths,deskTiers,testingDeskCommands} from '../config/testing-desk.mjs';
if(process.env.DISCORD_GUILD_ID!=='1568767259168608267')throw Error('Wrong guild');
const apply=process.argv.includes('--apply');
if(!apply){console.log(JSON.stringify({tiers:deskTiers,commands:testingDeskCommands.map(c=>c.name),modes:config.modes.map(m=>m.name)},null,2));process.exit(0);}
const rest=new REST().setToken(process.env.DISCORD_TOKEN),guild=process.env.DISCORD_GUILD_ID,me=await rest.get(Routes.user('@me'));
let channels=await rest.get(Routes.guildChannels(guild));const roles=await rest.get(Routes.guildRoles(guild));
const tierParent=channels.find(c=>c.name==='📄 Tierlist'),testParent=channels.find(c=>c.name==='🔨 TESTING');
if(!tierParent||!testParent)throw Error('Apply reference layout first.');
await writeFile('.runtime/testing-desk-before-'+Date.now()+'.json',JSON.stringify(channels,null,2));
const staff=roles.filter(r=>['Community Moderator','Moderator','Tier Tester','Senior Tester','Gamemode Manager'].includes(r.name));
const access=P.ViewChannel|P.ReadMessageHistory|P.SendMessages|P.EmbedLinks|P.AttachFiles;
const overwrites=[{id:guild,type:0,allow:String(P.ViewChannel|P.ReadMessageHistory),deny:String(P.SendMessages|P.CreatePublicThreads|P.CreatePrivateThreads|P.SendMessagesInThreads)},...staff.map(r=>({id:r.id,type:0,allow:String(access),deny:'0'})),{id:me.id,type:1,allow:String(access),deny:'0'}];
const report={channels:[],panels:[]};
const b=(label,custom_id,style=1)=>({type:2,label,custom_id,style});
const link=(label,url)=>({type:2,label,url,style:5});
async function ensure(name,parent){const c=channels.find(c=>c.name===name);if(!c)throw Error('Existing channel missing: '+name+'. No extra public channels will be created.');report.channels.push({name,id:c.id});return c;}
async function panel(c,key,title,description,buttons=[]){const marker='Mace Community · Testing desk · '+key;const msgs=await rest.get(Routes.channelMessages(c.id),{query:new URLSearchParams({limit:'100'})});const prior=msgs.find(m=>m.author.id===me.id&&m.embeds?.some(e=>e.footer?.text===marker));const body={embeds:[{title,description,color:key==='tester-applications'?0x9c82ee:0x8eb5ef,footer:{text:marker}}],components:buttons.length?[{type:1,components:buttons}]:[],allowed_mentions:{parse:[]}};const m=prior?await rest.patch(Routes.channelMessage(c.id,prior.id),{body}):await rest.post(Routes.channelMessages(c.id),{body});report.panels.push({channel:c.id,message:m.id,key});}
const channelIds={};
let roster=channels.find(c=>c.name==='🏅┃player-roster')||channels.find(c=>c.name==='🏅┃ht3-list');
if(!roster)throw Error('Existing player roster channel not found; no new channels created.');
roster=await rest.patch(Routes.channel(roster.id),{body:{name:'🏅┃player-roster',topic:'All gamemodes and every tier in one place. Use Browse players to filter the live roster.'}});
await panel(roster,'unified-roster','🏅 Community Player Roster','**One list. Every mode. Every tier.**\n\nBrowse current published players by gamemode, region and tier using /roster. The same placements power the website, profiles and testing eligibility.\n\nHT1 · LT1 · HT2 · LT2 · HT3 · LT3 · HT4 · LT4 · HT5 · LT5\n\nChoose a gamemode below to browse the current player list. Promotions update the roster from the published result records.',[b('Browse players','desk:roster'),b('My testing hub','desk:my-hub',2),link('Open website rankings','https://minecraft-pvp-community.draxion0.chatgpt.site/#rankings')]);
for(const t of deskTiers)channelIds[t]=roster.id;
// Remove only the four bot-created split roster channels, after preserving their full histories.
for(const old of ['🏅┃lt2-list','🏅┃ht2-list','🏅┃lt1-list','👑┃ht1-holder']){
 const c=channels.find(x=>x.name===old);if(!c)continue;let messages=[],before;
 while(true){const batch=await rest.get(Routes.channelMessages(c.id),{query:new URLSearchParams({limit:'100',...(before?{before}:{})})});messages.push(...batch);if(batch.length<100)break;before=batch.at(-1).id;}
 await writeFile('.runtime/consolidated-roster-'+c.id+'.json',JSON.stringify({channel:c,messages},null,2));
 if(messages.every(m=>m.author.id===me.id))await rest.delete(Routes.channel(c.id));
 else{const archive=channels.find(c=>c.name==='📁 TICKET ARCHIVE');await rest.patch(Routes.channel(c.id),{body:{parent_id:archive.id,permission_overwrites:archive.permission_overwrites}});}
}
const oldRosterMessages=await rest.get(Routes.channelMessages(roster.id),{query:new URLSearchParams({limit:'100'})});
for(const m of oldRosterMessages.filter(m=>m.author.id===me.id&&m.embeds?.some(e=>e.footer?.text==='Mace Community · Testing desk · HT3')))await rest.delete(Routes.channelMessage(roster.id,m.id));
report.channels.push({name:roster.name,id:roster.id});
const recruitment=await ensure('📝┃tester-applications',testParent.id);
await panel(recruitment,'tester-applications','📝 Become a Tier Tester','Choose a gamemode, region and target testing tier (HT3, LT2, HT2, LT1 or HT1). Tell us about your testing experience, scoring knowledge, impartiality and UTC availability.\n\nYour application opens a private ticket with the management team. /tester-desk status shows your decision. An interview or training offer does not grant staff roles or qualifications.',[b('Apply to become a tester','desk:tester'),b('My application','desk:tester-status',2),link('Testing commands','https://minecraft-pvp-community.draxion0.chatgpt.site/#commands')]);
const high=channels.find(c=>c.name==='🏅┃high-tests');
await panel(high,'high-tests','🏅 HT3+ Testing Desk','Apply for the next tier above your published gamemode rank. Your private ticket records the mode, region, target tier, availability, assigned tester, phase and opponent sets.\n\n**Players:** /high-test apply · status · room\n**Qualified testers:** /high-test list · claim · prepare · opponent · score · advance · assess · publish\n**Lookups:** /roster · /test-hub · /tier-path · /tester-roster · /test-stats · /cooldown\n\nFailed tests impose a 30-day gamemode cooldown. Staff adjudicate phases; passed tests require a matching published result.',[b('Apply for a higher tier','desk:player'),b('My tests','desk:status',2),b('Check cooldown','desk:cooldown',2)]);
const commandChannel=channels.find(c=>c.name==='🤖┃commands');
await panel(commandChannel,'commands','🤖 Tier Testing Commands','**Player testing**\n/high-test apply · status · room\n/roster mode tier region · /tier-path tier · /test-hub mode region\n/tester-roster mode · /test-stats mode\n/cooldown mode region\n\n**Tester applications**\n/tester-desk apply · status · room\n/tester-desk list · review (management)\n\n**Running a high-tier test**\n/high-test list → claim → prepare → ready → opponent → score → advance → assess → review → publish\nPreparation connects the official assessment to this same private ticket. The dashboard has forms for opponents, scores, assessment and publication. Omit the ID when using commands inside the ticket. Only the assigned qualified tester can update a test. LT2+ coordination requires senior mode qualification.\n\n**Initial evaluation**\n/request-test · /availability · /queue status\n/claim → /test-room open → ready → /assessment record → /result\n\n**Staff approvals**\n/qualification grant · revoke · list\n/assessment review · /appeal review\n\nUse the searchable website guide for fields and audience filters.',[link('Search all testing commands','https://minecraft-pvp-community.draxion0.chatgpt.site/#commands'),b('My tests','desk:status',2)]);
const request=channels.find(c=>c.name==='🧪┃request-test');
const requestMessages=await rest.get(Routes.channelMessages(request.id),{query:new URLSearchParams({limit:'100'})});const requestPanel=requestMessages.find(m=>m.author.id===me.id&&m.embeds?.some(e=>e.title?.includes('Evaluation Testing')));
if(requestPanel)await rest.patch(Routes.channelMessage(request.id,requestPanel.id),{body:{embeds:requestPanel.embeds.map(({title,description,color,footer})=>({title,description:description.replace('**View Cooldown:** opens the command guide; run /queue status with your mode and region.','**View Cooldown:** choose a mode and region to see active failed-test and session restrictions.'),color,footer})),components:[{type:1,components:[b('Verify Account','hub:ticket'),b('Enter Waitlist','hub:test'),b('View Cooldown','desk:cooldown')]},{type:1,components:[b('HT3+ test application','desk:player'),b('Become a tester','desk:tester',2),b('My high-tier tests','desk:status',2)]}],allowed_mentions:{parse:[]}}});
for(const m of config.modes){const c=channels.find(c=>c.name===m.id.replaceAll('_','-')+'-waitlist');if(c)await panel(c,'mode-'+m.id,m.name+' · Test & Volunteer',`**Gamemode: ${m.name}**\nInitial evaluation: choose your region and check actual session availability.\nHT3+ promotion: apply for the next tier above your published placement.\nTester application: choose the tier range you want to help assess, then provide experience and UTC availability.\n\nEvery application stays in its own private ticket. Use /high-test status or /tester-desk status to follow progress.`,[b('Request evaluation','test:mode:'+m.id),b('Apply for HT3+','desk:fixed:player:'+m.id),b('Become a tester','desk:fixed:tester:'+m.id,2)]);}
const highResults=channels.find(c=>c.name==='🏆┃high-results');
config.testingDeskChannels={highResults:highResults.id,testerApplications:recruitment.id,roster:roster.id,tiers:channelIds};
await writeFile('config/community.json',JSON.stringify(config,null,2)+'\n');
await writeFile('.runtime/testing-desk-setup-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
