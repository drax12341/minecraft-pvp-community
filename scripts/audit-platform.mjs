import { mkdir, writeFile } from 'node:fs/promises';
const headers = {Authorization: 'Bot ' + process.env.DISCORD_TOKEN};
const report = {observedAt: new Date().toISOString()};
for (const [name, path] of [ ['channels', `/guilds/${process.env.DISCORD_GUILD_ID}/channels`], ['roles', `/guilds/${process.env.DISCORD_GUILD_ID}/roles`], ['commands', `/applications/${process.env.DISCORD_CLIENT_ID}/guilds/${process.env.DISCORD_GUILD_ID}/commands`], ['application', '/applications/@me'] ]) {
  const response = await fetch('https://discord.com/api/v10' + path, {headers});
  if (!response.ok) throw Error(`${name}: HTTP ${response.status}`);
  const data = await response.json();
  report[name] = name === 'application' ? {endpoint:data.interactions_endpoint_url} : data;
  console.log(name, Array.isArray(data) ? data.length : data.interactions_endpoint_url);
}
for (const path of ['/healthz','/api/rankings','/api/testing']) {
  const response = await fetch('https://minecraft-pvp-community.draxion0.chatgpt.site'+path);
  const data=await response.json();
  report[path]={status:response.status,data};
  console.log(path,response.status,JSON.stringify(data));
}
await mkdir('.runtime',{recursive:true});
await writeFile('.runtime/platform-audit.json',JSON.stringify(report,null,2));
