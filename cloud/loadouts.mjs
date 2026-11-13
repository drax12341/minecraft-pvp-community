import {kitManifests} from '../config/kit-manifests.mjs';
export async function approvedCommunityLoadout(store,mode,version){
  if(version===kitManifests.version&&kitManifests.modes.some(m=>m.id===mode))return true;
  return !!await store.one('SELECT 1 FROM mode_loadouts WHERE mode=? AND version=? AND revoked=0',mode,version||'');
}
