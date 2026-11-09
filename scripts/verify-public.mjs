const origin='https://minecraft-pvp-community.draxion0.chatgpt.site';
for(const path of ['/healthz','/api/kits','/standards.html','/brand/discord-icon.png','/api/tickets','/api/accounts','/api/queue','/api/applications','/api/assessments']){
 const r=await fetch(origin+path+'?audit='+Date.now(),{headers:{'Cache-Control':'no-cache'}});
 console.log(path,r.status,r.headers.get('Content-Type'),path==='/healthz'?await r.text():'');
}
const r=await fetch(origin+'/discord/interactions',{method:'POST',body:'{}'});console.log('unsigned interaction',r.status);
