import {REST,Routes} from 'discord.js';
import {readFile,writeFile} from 'node:fs/promises';
const rest=new REST().setToken(process.env.DISCORD_TOKEN),guild=process.env.DISCORD_GUILD_ID;
if(guild!=='1568767259168608267')throw Error('Wrong guild');
let roles=await rest.get(Routes.guildRoles(guild));
const role=n=>roles.find(r=>r.name===n),me=await rest.get(Routes.user('@me')),bot=await rest.get(Routes.guildMember(guild,me.id));
for(const name of ['Test Alerts','Event Alerts','Update Alerts','Result Alerts'])await rest.patch(Routes.guildRole(guild,role(name).id),{body:{mentionable:true}});
const priority=['Moderator','Gamemode Manager','Regulator','Support Team','Helper','Senior Tester','Trainee Tester','Coach',...roles.filter(r=>r.name.startsWith('Color · ')).map(r=>r.name)];
for(const name of priority.reverse()){
 roles=await rest.get(Routes.guildRoles(guild));const top=Math.max(...roles.filter(r=>bot.roles.includes(r.id)).map(r=>r.position)),r=role(name);
 if(r&&r.position<top)await rest.patch(Routes.guildRoles(guild),{body:[{id:r.id,position:top-1}]});
}
const server=await rest.get(Routes.guild(guild));
let members=[];try{members=await rest.get(Routes.guildMembers(guild),{query:new URLSearchParams({limit:'1000'})});}catch{members=[await rest.get(Routes.guildMember(guild,server.owner_id))];}
const names=ns=>ns.map(n=>role(n)?.id).filter(Boolean);
const support=names(['Community Moderator','Moderator','Support Team','Helper']),testers=names(['Tier Tester','Senior Tester','Gamemode Manager']),staff=[...support,...testers,...names(['Trainee Tester','Regulator'])];
const assigned=[];
for(const m of members){if(m.user.bot)continue;for(const [name,ids]of [['Support Ticket Pings',support],['Staff Pings',staff],['Tester Pings',testers]])if(m.user.id===server.owner_id||m.roles.some(id=>ids.includes(id))){await rest.put(Routes.guildMemberRole(guild,m.user.id,role(name).id));assigned.push({user:m.user.id,role:name});}}
// Put native emoji IDs on mode menus without external image dependencies.
const emojis=await rest.get(Routes.guildEmojis(guild)),config=JSON.parse(await readFile('config/community.json','utf8'));
const mapping={mace:'mace',mace_spear:'spear_mace',mace_ht:'ht_mace',mace_lt:'lt_mace',mace_og:'og_mace',mace_rod:'rod_mace',mace_rocket:'rocket_mace'};
for(const m of config.modes)m.emoji=emojis.find(e=>e.name===mapping[m.id])?.id;
await writeFile('config/community.json',JSON.stringify(config,null,2)+'\n');
const channels=await rest.get(Routes.guildChannels(guild));
const report={assigned,roles:roles.filter(r=>priority.includes(r.name)).map(r=>({name:r.name,position:r.position})),channelCount:channels.length,customEmojis:emojis.length};
await writeFile('.runtime/mace-finalize-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
