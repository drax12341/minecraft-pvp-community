import {tokenHash} from './verification.mjs';
export async function rememberStaffIdentity(store,user,identity={}){
 const linked=await store.one('SELECT name,uuid FROM accounts WHERE discord=?',user);
 const name=linked?.name||identity.nick||identity.global_name||identity.username;
 if(!name)return;
 const publicId=linked?.uuid||(await tokenHash('mace-public-staff/'+user)).slice(0,24);
 await store.statement('INSERT INTO staff_public_profiles VALUES(?,?,?,?,?) ON CONFLICT(user) DO UPDATE SET public_id=excluded.public_id,display_name=excluded.display_name,avatar=excluded.avatar,updated=excluded.updated',user,publicId,String(name).slice(0,80),linked?.uuid?'https://mc-heads.net/avatar/'+linked.uuid+'/96':identity.avatar&&/^[a-zA-Z0-9_]+$/.test(identity.avatar)?'https://cdn.discordapp.com/avatars/'+user+'/'+identity.avatar+'.png':null,new Date().toISOString()).run();
}
