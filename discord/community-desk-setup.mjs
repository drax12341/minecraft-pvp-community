import config from '../config/community.json' with {type:'json'};
if(!process.argv.includes('--apply')){
 console.log(JSON.stringify({community:config.name,action:'Refresh the existing authoritative per-mode queue panels using the deployed cloud service.',modes:config.modes.map(m=>m.name),installMissing:'Use npm run discord:platform:apply for the guided network installation.'},null,2));
}else{
 if(!process.env.DISCORD_TOKEN||process.env.DISCORD_GUILD_ID!=='1568767259168608267')throw Error('Configure the intended community bot environment.');
 const response=await fetch('https://minecraft-pvp-community.draxion0.chatgpt.site/api/internal/queue-panels',{method:'POST',headers:{Authorization:'Bearer '+process.env.DISCORD_TOKEN},signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('Authoritative queue panel refresh failed: HTTP '+response.status);
 console.log(JSON.stringify(await response.json()));
}
