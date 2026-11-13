const root=document.querySelector('#standards');
const standardsEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try{
  const origin=location.hostname==='drax12341.github.io'?'https://minecraft-pvp-community.draxion0.chatgpt.site':'';
  const [config,catalogue]=await Promise.all(['./data/community.json',origin+'/api/loadouts'].map(async url=>{
    const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Unavailable');return response.json();
  }));
  if(!Array.isArray(config.modes)||!Array.isArray(catalogue.loadouts))throw Error('Invalid catalogue');
  root.innerHTML=`<section class="loadout-controls"><label>Discipline<select id="loadout-mode"><option value="all">All seven disciplines</option>${config.modes.map(m=>`<option value="${standardsEscape(m.id)}">${standardsEscape(m.name)}</option>`).join('')}</select></label><label>Find equipment or a version<input id="loadout-search" type="search" maxlength="80" placeholder="Enchantments, fishing rod, version…"></label></section><p class="fine" id="loadout-count" role="status"></p><div id="loadout-list" class="loadout-list"></div>`;
  const draw=()=>{
    const selected=root.querySelector('#loadout-mode').value,query=root.querySelector('#loadout-search').value.toLowerCase().trim();
    const modes=config.modes.filter(m=>(selected==='all'||m.id===selected)&&(!query||(m.name+' '+catalogue.loadouts.filter(l=>l.mode===m.id).map(l=>l.version+' '+l.loadout).join(' ')).toLowerCase().includes(query)));
    root.querySelector('#loadout-count').textContent=modes.length+' community disciplines in this view.';
    root.querySelector('#loadout-list').innerHTML=modes.map(mode=>{
      const loadouts=catalogue.loadouts.filter(l=>l.mode===mode.id);
      return `<article class="loadout-card" data-loadout-mode="${standardsEscape(mode.id)}"><div class="loadout-title"><img src="./assets/${standardsEscape(mode.id)}.svg" alt="" width="44" height="44"><h2>${standardsEscape(mode.name)}</h2><span class="loadout-status ${loadouts.length?'is-approved':''}">${loadouts.length?'Staff-approved versions':'Awaiting staff approval'}</span></div>${loadouts.length?loadouts.map((loadout,n)=>`<details${n===0?' open':''}><summary>${standardsEscape(loadout.version)} <span>Read exact equipment & rules</span></summary><pre>${standardsEscape(loadout.loadout)}</pre></details>`).join(''):'<p>No approved equipment version has been published yet. Keep official sessions closed until the testing team has completed calibration and recorded the exact loadout.</p>'}<details class="loadout-preparation"><summary>Preparation & fair-play rules</summary><ul>${(mode.rules||[]).map(rule=>'<li>'+standardsEscape(rule)+'</li>').join('')}</ul></details><a class="subtle-link" href="./#test-desk?mode=${encodeURIComponent(mode.id)}">Explore ${standardsEscape(mode.name)} testing</a></article>`;
    }).join('')||'<div class="big-empty"><h2>No matching loadouts.</h2><p>Try another discipline, equipment name or version.</p></div>';
  };
  root.querySelector('#loadout-mode').onchange=draw;root.querySelector('#loadout-search').oninput=draw;draw();
}catch{
  root.innerHTML='<section class="big-empty"><h2>Approved loadouts are unavailable.</h2><p>Reload this page or ask your tester for the current approved version. No approval is implied while the catalogue is unavailable.</p><a class="button secondary" href="./standards.html">Try again</a><a class="subtle-link" href="https://discord.com/channels/1568767259168608267/1569347576216551555">Ask the testing team</a></section>';
}
