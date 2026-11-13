import { REST, Routes } from 'discord.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import config from '../config/community.json' with { type: 'json' };
import { communityQueueBoard } from '../cloud/community-desk.mjs';

const apply = process.argv.includes('--apply');
const region = 'EU';
if (!apply) {
  console.log(JSON.stringify({community:config.name,capacity:20,defaultRegion:region,otherRegions:'Available in each board menu',channels:config.modes.map(m=>m.id.replaceAll('_','-')+'-waitlist'),action:'Update this bot’s panels in existing channels; preserve roles, permissions and message history.'},null,2));
  process.exit(0);
}
const guild = process.env.DISCORD_GUILD_ID;
if (guild !== '1568767259168608267') throw Error('Unexpected community guild; no changes applied.');
if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) throw Error('Configure the local bot environment first.');
const rest = new REST().setToken(process.env.DISCORD_TOKEN);
const me = await rest.get(Routes.user('@me'));
if (me.id !== process.env.DISCORD_CLIENT_ID || !me.bot) throw Error('Dedicated bot identity mismatch.');
const channels = await rest.get(Routes.guildChannels(guild));
const targets = config.modes.map(mode=>({mode,channel:channels.find(c=>c.type===0&&c.name===mode.id.replaceAll('_','-')+'-waitlist')}));
if (targets.some(t=>!t.channel)) throw Error('A required existing waitlist channel is missing. No channels will be created.');
const response = await fetch('https://minecraft-pvp-community.draxion0.chatgpt.site/api/testing',{signal:AbortSignal.timeout(10000)});
if (!response.ok) throw Error('Cannot read current session counts; no panels changed.');
const snapshot = await response.json();
const report = {guild,panels:[],before:[]};
await mkdir('.runtime',{recursive:true});
const backupPath='.runtime/community-desk-before-'+Date.now()+'.json';
const panels=[];
for (const {mode,channel} of targets) {
  const session=snapshot.sessions.find(s=>s.mode===mode.id&&s.region===region);
  const store={
    one:async sql=>sql.includes('FROM sessions')?session||null:{occupied:(session?.waiting||0)+(session?.claimed||0),waiting:session?.waiting||0,claimed:session?.claimed||0},
    all:async()=>[],
  };
  const body=await communityQueueBoard(store,mode.id,region);
  if(session?.claimed)body.embeds[0].description=body.embeds[0].description.replace('No player is being tested right now.','Tester and player details refresh after the next queue action or Refresh click.');
  panels.push({channel,body,key:'waitlist-'+mode.id,board:{guild,mode:mode.id,region}});
}
const button=(label,custom_id,style=2)=>({type:2,label,custom_id,style});
const requestChannel=channels.find(c=>c.type===0&&c.name.includes('request-test'));
if(requestChannel)panels.push({channel:requestChannel,key:'player-desk',body:{content:'',embeds:[{title:config.name+' · Player Desk',description:'**Your next test starts here.**\n\nVerify Minecraft ownership privately, choose your Mace discipline and region, then join an open waitlist. Each board shows the tester, the player currently testing and **20 shared queue slots**.\n\nUse **My player desk** for your profile, history and next action. High-tier promotions keep their private application, opponent sets and independent review. Never share passwords or account tokens.',color:0x9c82ee,footer:{text:config.name+' · Community player desk'}}],components:[{type:1,components:[button('My player desk','community:desk',1),button('Testing waitlists','community:boards',3),button('Verify account / support','hub:ticket'),button('High-tier application','desk:player')]}],allowed_mentions:{parse:[]}}});
const staffChannel=channels.find(c=>c.type===0&&c.name==='staff-handbook');
if(staffChannel)panels.push({channel:staffChannel,key:'staff-desk',body:{embeds:[{title:'Community testing · Staff desk',description:'**/tester desk** — current assignment and waiting demand\n**/pull mode region** — next eligible player and recoverable private room\n**Room buttons** — readiness, rubric scoring and publication\n**/high-test** — promotion phases and independent review\n**/tester leaderboard period:month** — documented UTC monthly activity\n**/retire review** — independent retirement decisions\n\nOnly qualified testers can claim or assess. Member buttons never grant staff access. Staff roles and promotions remain deliberate management decisions.',color:0x58c89b,footer:{text:config.name+' · Community staff desk'}}],components:[{type:1,components:[button('Open tester desk','community:staff',1),button('Testing guidance','hub:rubrics')]}],allowed_mentions:{parse:[]}}});

// Preflight every target before writing any message.
for(const panel of panels){
  const messages=await rest.get(Routes.channelMessages(panel.channel.id),{query:new URLSearchParams({limit:'100'})});
  panel.prior=messages.find(m=>m.author.id===me.id&&m.embeds?.some(e=>e.footer?.text===panel.body.embeds[0].footer.text));
  if(!panel.prior&&panel.key==='player-desk')panel.prior=messages.find(m=>m.author.id===me.id&&m.embeds?.some(e=>/Evaluation Testing Waitlist/.test(e.title||'')));
  report.before.push({channel:panel.channel.id,key:panel.key,message:panel.prior||null});
}
await writeFile(backupPath,JSON.stringify(report.before,null,2));
const boards=[];
for(const panel of panels){
  const nonce=Buffer.from(guild+'/'+panel.key).toString('base64url').slice(-24);
  const message=panel.prior?await rest.patch(Routes.channelMessage(panel.channel.id,panel.prior.id),{body:panel.body}):await rest.post(Routes.channelMessages(panel.channel.id),{body:{...panel.body,nonce,enforce_nonce:true}});
  report.panels.push({key:panel.key,channel:panel.channel.id,message:message.id});
  if(panel.board)boards.push({...panel.board,channel:panel.channel.id,message:message.id});
  // Persist each successful board so a later partial failure remains recoverable.
  if(panel.board){
    const current=JSON.parse(await readFile('config/community.json','utf8'));
    current.queueBoards=[...new Map([...(current.queueBoards||[]),...boards].map(b=>[b.guild+'/'+b.mode+'/'+b.region,b])).values()];
    await writeFile('config/community.json',JSON.stringify(current,null,2)+'\n');
  }
}
await writeFile('.runtime/community-desk-panels.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({updated:report.panels.length,waitlists:boards.length,backup:backupPath}));
