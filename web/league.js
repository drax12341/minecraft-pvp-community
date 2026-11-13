const lx = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const leagueTier = r => (r.pos === 0 ? 'HT' : 'LT') + r.tier;
const leagueActivePoints = (p, config) => Object.values(p.rankings).reduce((sum,r) => sum + (r.retired ? 0 : config.points[leagueTier(r)] || 0), 0);
const leagueOptions = config => config.modes.map(m => `<option value="${lx(m.id)}">${lx(m.name)}</option>`).join('');
const leagueRegions = ['EU','NA','AS','SA','AU','AF','ME','OC'];
const leagueRegionOptions = () => '<option value="all">All regions</option>' + leagueRegions.map(r => `<option>${r}</option>`).join('');
const leagueAvatar = p => `<img src="https://mc-heads.net/avatar/${encodeURIComponent(p.uuid)}/48" alt="" width="36" height="36" loading="lazy" referrerpolicy="no-referrer">`;
const leagueRankToken = r => `<span class="rank-token rank-token-${r.tier}">${leagueTier(r)}</span>`;
const leagueDate = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : 'Date unavailable';
const leagueIntro = (title, copy) => `<section class="page-title"><div><h1>${title}</h1><p class="subtitle">${copy}</p></div></section>`;
const leaguePreference=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('pvp:'+key))??fallback;}catch{return fallback;}};
const leagueSavePreference=(key,value)=>{try{localStorage.setItem('pvp:'+key,JSON.stringify(value));}catch{}};

export function mountLeagueShell({browseModes,onMotionToggle}) {
  document.querySelector('#global-kit-search').onclick = browseModes;
  document.querySelector('#motion-toggle').onclick = onMotionToggle;
  const toggle = document.querySelector('#mobile-navigation');
  const close = () => {document.body.classList.remove('rail-open');toggle.setAttribute('aria-expanded','false');};
  toggle.onclick = () => {const open=document.body.classList.toggle('rail-open');toggle.setAttribute('aria-expanded',String(open));};
  document.querySelectorAll('.league-rail a').forEach(a => a.addEventListener('click',()=>{close();document.querySelector('.resource-menu')?.removeAttribute('open');}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('rail-open')){close();toggle.focus();}});
  document.addEventListener('visibilitychange',()=>document.body.classList.toggle('page-hidden',document.visibilityState==='hidden'));
  document.addEventListener('click',e=>{const menu=document.querySelector('.resource-menu');if(menu?.open&&!menu.contains(e.target))menu.open=false;});
}

export function renderLeagueHome({main,config,data,testing,profile,openMode}) {
  const sessions=testing.sessions||[],open=sessions.filter(s=>s.status==='open');
  const players=data.players.filter(p=>Object.values(p.rankings).some(r=>!r.retired));
  const high=players.filter(p=>Object.values(p.rankings).some(r=>!r.retired&&(r.tier<3||(r.tier===3&&r.pos===0))));
  const recent=data.recent||[];
  main.innerHTML=`
    <section class="impact-hero">
      <div class="league-page-heading"><p class="hero-context"><span class="tiny-mark" aria-hidden="true">✦</span> The Minecraft PvP Community</p>
        <h1>Every tier.<br>Earned in<br>the arena.</h1>
        <p class="hero-description">A well-timed hit. A hard-earned placement. Find your competition across seven Mace disciplines.</p>
        <div class="hero-actions"><a class="button" href="#rankings">Find your place <span aria-hidden="true">↗</span></a><a class="hero-secondary" href="#test-desk">Get tier tested</a></div>
        <span class="league-live-pill"><i aria-hidden="true"></i>${open.length?open.length+' testing sessions open':'Next sessions announced in Discord'}</span>
      </div>
      <div class="impact-art" style="--discipline:#a7d4ef">
        <div class="impact-orbit orbit-a" aria-hidden="true"></div><div class="impact-orbit orbit-b" aria-hidden="true"></div>
        <span class="floating-rank fr-one" aria-hidden="true">HT1</span><span class="floating-rank fr-two" aria-hidden="true">LT2</span><span class="floating-rank fr-three" aria-hidden="true">HT3</span>
        <button id="impact-trigger" class="impact-stage" aria-label="Play the Mace impact animation"><span class="impact-halo" aria-hidden="true"></span><img class="impact-mace" src="./assets/impact-mace.svg" alt="" width="440" height="460"><span class="impact-floor" aria-hidden="true"></span><span class="impact-wave wave-one" aria-hidden="true"></span><span class="impact-wave wave-two" aria-hidden="true"></span><span class="impact-spark spark-one" aria-hidden="true"></span><span class="impact-spark spark-two" aria-hidden="true"></span><span class="impact-spark spark-three" aria-hidden="true"></span></button>
        <div class="impact-caption"><span class="impact-crosshair" aria-hidden="true">⌖</span><div><strong>Precision makes the difference.</strong><span id="impact-readout" role="status">Interactive Mace · click to strike</span></div><span class="scene-index" aria-hidden="true">MC / 07</span></div>
      </div>
    </section>
    <section class="league-bottom-strip" aria-label="Community snapshot"><div><strong>${players.length}</strong><span>Ranked players</span></div><div><strong>${high.length}</strong><span>HT3+ competitors</span></div><div><strong>${config.modes.length}</strong><span>Mace disciplines</span></div><div><strong>${open.length}</strong><span>Open sessions</span></div><p>Independent placements.<br>Documented in game.</p></section>
    <section class="discipline-section"><div class="league-section-title"><div><h2>Different discipline. Same ambition.</h2><p>Choose your mode. See where the field stands.</p></div><a href="#kits">Explore the rules</a></div><div class="league-mode-grid">${config.modes.map(m=>`<button class="league-mode-tile" data-league-mode="${lx(m.id)}" style="--mode-color:${lx(m.color)}"><img src="./assets/${lx(m.id)}.svg" alt="" width="48" height="48"><strong>${lx(m.name)}</strong><span aria-hidden="true">↗</span></button>`).join('')}</div></section>
    <div class="champion-layout"><section class="index-surface"><div class="league-section-title"><div><h2>The player index</h2><p>Every name backed by a community test.</p></div><label class="inline-select"><span class="sr-only">Player index mode</span><select id="home-board-mode"><option value="overall">Overall rankings</option>${leagueOptions(config)}</select></label></div><div id="home-player-index"></div><a class="index-bottom-link" href="#rankings">Explore the complete tierlist <span aria-hidden="true">↗</span></a></section>
      <aside class="home-side-stack"><section class="queue-surface"><div class="league-section-title"><div><span class="live-caption"><i aria-hidden="true"></i> Testing now</span><h2>Live waitlists</h2></div><label class="inline-select"><span class="sr-only">Queue region</span><select id="home-region">${leagueRegionOptions()}</select></label></div><div id="home-queues"></div><a class="subtle-link" href="#testing">All sessions & eligibility</a></section>
      <section class="results-surface"><div class="league-section-title"><h2>Fresh from the arena</h2><a href="#results">All results</a></div>${recent.length?recent.slice(0,4).map(r=>`<button class="league-result-line" data-league-profile="${lx(r.uuid)}">${leagueAvatar(r)}<span><strong>${lx(r.name)}</strong><small>${lx(config.modes.find(m=>m.id===r.mode)?.name||r.mode)} · ${lx(r.region)}</small></span>${leagueRankToken(r)}<time datetime="${lx(r.created)}">${lx(leagueDate(r.created))}</time></button>`).join(''):'<div class="quiet-empty"><span aria-hidden="true">⌁</span><p>No published results yet.<br>The next match starts the story.</p></div>'}</section></aside>
    </div>
    <section class="arena-path"><div><span class="path-emblem" aria-hidden="true">✦</span><h2>Your next tier<br>has a path.</h2><p>From the first queue to the final placement. Here’s what happens next.</p><a class="button secondary" href="#test-desk">Open the testing desk</a></div><ol><li><span>01</span><h3>Make it yours</h3><p>Verify your Minecraft account privately with the team.</p></li><li><span>02</span><h3>Find your session</h3><p>Pick your Mace discipline and region. Join an open 20-slot waitlist.</p></li><li><span>03</span><h3>Meet your match</h3><p>Confirm the kit with a qualified tester and play in your private room.</p></li><li><span>04</span><h3>Earn your place</h3><p>Reviewed results connect your profile, rankings and match evidence.</p></li></ol></section>
    <section class="community-invite"><div><h2>Better opponents.<br>Better together.</h2><p>Find a sparring partner. Share a replay. Build your next good fight.</p></div><a class="button" href="${lx(config.invite)}" target="_blank" rel="noopener">Meet the community ↗</a><span class="invite-watermark" aria-hidden="true">MC</span></section>`;
  const drawIndex=()=>{
    const selected=main.querySelector('#home-board-mode').value;
    main.querySelector('.index-bottom-link').href='#rankings?'+new URLSearchParams({mode:selected,view:'list',status:'active'});
    const rows=players.filter(p=>selected==='overall'||(p.rankings[selected]&&!p.rankings[selected].retired)).sort((a,b)=>selected==='overall'?leagueActivePoints(b,config)-leagueActivePoints(a,config)||a.name.localeCompare(b.name):(config.points[leagueTier(b.rankings[selected])]||0)-(config.points[leagueTier(a.rankings[selected])]||0)||a.name.localeCompare(b.name)).slice(0,8);
    main.querySelector('#home-player-index').innerHTML=rows.length?`<div class="table-wrap"><table class="home-ranking-table"><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Region</th><th scope="col">${selected==='overall'?'Points':'Placement'}</th></tr></thead><tbody>${rows.map((p,n)=>`<tr><td class="index-position">${String(n+1).padStart(2,'0')}</td><td><button class="home-player" data-home-player="${lx(p.uuid)}">${leagueAvatar(p)}<span>${lx(p.name)}<small>${Object.values(p.rankings).filter(r=>!r.retired).length} active disciplines</small></span></button></td><td><span class="region-tag">${lx(p.region)}</span></td><td>${selected==='overall'?`<strong class="score-number">${leagueActivePoints(p,config)}</strong>`:leagueRankToken(p.rankings[selected])}</td></tr>`).join('')}</tbody></table></div>`:'<div class="league-empty index-empty"><div class="empty-rank-ladder" aria-hidden="true">'+[1,2,3,4,5].map(n=>`<span class="rank-token rank-token-${n}">T${n}</span>`).join('')+'<i></i></div><h3>The first results start with you.</h3><p>This board is ready for earned placements. Complete a community test to put your name here.</p><a class="button secondary" href="#test-desk">Prepare your first test</a></div>';
    main.querySelectorAll('[data-home-player]').forEach(b=>b.onclick=()=>profile(data.players.find(p=>p.uuid===b.dataset.homePlayer)));
  };
  const drawQueues=()=>{
    const region=main.querySelector('#home-region').value;
    const rows=sessions.filter(s=>region==='all'||s.region===region).sort((a,b)=>Number(b.status==='open')-Number(a.status==='open')).slice(0,5);
    main.querySelector('#home-queues').innerHTML=rows.length?rows.map(s=>{
      const m=config.modes.find(m=>m.id===s.mode),capacity=Math.min(Number(s.capacity)||20,20),occupied=(Number(s.waiting)||0)+(Number(s.claimed)||0);
      const board=config.queueBoards?.find(b=>b.mode===s.mode&&b.region===s.region)||config.queueBoards?.find(b=>b.mode===s.mode);
      const url=board?`https://discord.com/channels/${encodeURIComponent(board.guild)}/${encodeURIComponent(board.channel)}`:config.invite;
      return `<article class="home-queue" data-queue-region="${lx(s.region)}"><div class="queue-line"><img src="./assets/${lx(m?.id||'mace')}.svg" alt="" width="28" height="28"><strong>${lx(m?.name||s.mode)}</strong><span class="queue-state state-${lx(s.status)}">${lx(s.status)}</span></div><div class="queue-occupancy"><span>${lx(s.region)} · ${Number(s.waiting)||0} waiting · ${Number(s.claimed)||0} testing</span><strong>${occupied}/${capacity}</strong></div><meter min="0" max="${capacity}" value="${Math.min(occupied,capacity)}" aria-label="${lx(m?.name||s.mode)} ${lx(s.region)} occupied slots">${occupied} of ${capacity}</meter><a href="${lx(url)}" target="_blank" rel="noopener">${s.status==='open'?'Open Discord waitlist':'Follow session announcements'} <span aria-hidden="true">↗</span></a></article>`;
    }).join(''):`<div class="queue-empty"><span class="queue-orbit" aria-hidden="true">◷</span><h3>No published sessions${region==='all'?'':' in '+lx(region)}.</h3><p>Testers announce availability in Discord. Save a waitlist preference to let the team know you’re interested.</p><a href="${lx(config.invite)}" target="_blank" rel="noopener">Check Discord</a></div>`;
  };
  const savedRegion=leaguePreference('homeRegion','all'),savedMode=leaguePreference('homeMode','overall');
  main.querySelector('#home-region').value=leagueRegions.includes(savedRegion)?savedRegion:'all';
  main.querySelector('#home-board-mode').value=config.modes.some(m=>m.id===savedMode)?savedMode:'overall';
  main.querySelector('#home-board-mode').onchange=()=>{leagueSavePreference('homeMode',main.querySelector('#home-board-mode').value);drawIndex();};
  main.querySelector('#home-region').onchange=()=>{leagueSavePreference('homeRegion',main.querySelector('#home-region').value);drawQueues();};drawIndex();drawQueues();
  main.querySelectorAll('[data-league-mode]').forEach(b=>{b.onclick=()=>openMode(b.dataset.leagueMode);b.onpointerenter=()=>main.querySelector('.impact-art')?.style.setProperty('--discipline',config.modes.find(m=>m.id===b.dataset.leagueMode).color);});
  main.querySelectorAll('[data-league-profile]').forEach(b=>b.onclick=()=>profile(data.players.find(p=>p.uuid===b.dataset.leagueProfile)));
  const stage=main.querySelector('#impact-trigger');let impactTimer;
  stage.onclick=()=>{
    const calm=document.body.classList.contains('calm-view')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const readout=main.querySelector('#impact-readout');
    if(calm){readout.textContent='Impact preview · reduced motion';return;}
    clearTimeout(impactTimer);stage.classList.remove('striking');void stage.offsetWidth;stage.classList.add('striking');readout.textContent='Impact · precision in motion';
    impactTimer=setTimeout(()=>{stage.classList.remove('striking');if(readout.isConnected)readout.textContent='Interactive Mace · click to strike';},1100);
  };
  stage.onpointermove=e=>{if(document.body.classList.contains('calm-view')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;const r=stage.getBoundingClientRect();if(r.width&&r.height){stage.style.setProperty('--pointer-x',((e.clientX-r.left)/r.width-.5)*10+'deg');stage.style.setProperty('--pointer-y',-((e.clientY-r.top)/r.height-.5)*8+'deg');}};
  stage.onpointerleave=()=>{stage.style.setProperty('--pointer-x','0deg');stage.style.setProperty('--pointer-y','0deg');};
}

export function renderLeagueWatchlist({main,config,data,saved,profile,onRemove,onCompare,selected}) {
  const render=()=>{
    const players=data.players.filter(p=>saved.has(p.uuid));
    main.innerHTML=leagueIntro('Keep your competition close.','A personal watchlist of published players. Saved on this browser, with no account or tracking profile.')+`<section class="watchlist-toolbar"><p id="watchlist-count" role="status">${players.length} published player${players.length===1?'':'s'} saved</p><a class="button secondary" href="#rankings">Find more players</a></section><div class="watchlist-grid">${players.map(p=>`<article class="watch-player"><button class="watch-identity" data-watch-player="${lx(p.uuid)}">${leagueAvatar(p)}<span><strong>${lx(p.name)}</strong><small>${lx(p.region)} · ${leagueActivePoints(p,config)} active points</small></span></button><div class="watch-ranks">${Object.entries(p.rankings).map(([mode,r])=>`<span>${lx(config.modes.find(m=>m.id===mode)?.name||mode)} ${leagueRankToken(r)}${r.retired?'<small>Retired</small>':''}</span>`).join('')}</div><div class="watch-actions"><button class="text-button" data-watch-compare="${lx(p.uuid)}" aria-pressed="${selected.has(p.uuid)}">${selected.has(p.uuid)?'Added to comparison':'Add to comparison'}</button><button class="text-button" data-watch-remove="${lx(p.uuid)}">Remove saved player</button></div></article>`).join('')}</div>${!players.length?'<section class="big-empty watch-empty"><span aria-hidden="true">☆</span><h2>Your next rival is out there.</h2><p>Open a published player’s profile and choose Save player. Compare their earned placements here whenever you return.</p><a class="button" href="#rankings">Explore the player index</a></section>':''}${[...saved].filter(id=>!data.players.some(p=>p.uuid===id)).map(id=>`<p class="unavailable-save">A saved profile is no longer published. <button class="text-button" data-watch-remove="${lx(id)}">Remove unavailable profile</button></p>`).join('')}`;
    main.querySelectorAll('[data-watch-player]').forEach(b=>b.onclick=()=>profile(data.players.find(p=>p.uuid===b.dataset.watchPlayer)));
    main.querySelectorAll('[data-watch-remove]').forEach(b=>b.onclick=()=>{onRemove(b.dataset.watchRemove);render();});
    main.querySelectorAll('[data-watch-compare]').forEach(b=>b.onclick=()=>{onCompare(b.dataset.watchCompare);b.setAttribute('aria-pressed',String(selected.has(b.dataset.watchCompare)));b.textContent=selected.has(b.dataset.watchCompare)?'Added to comparison':'Add to comparison';});
  };render();
}

export function renderLeagueInsights({main,config,data,testing}) {
  main.innerHTML=leagueIntro('Read the field.','A transparent view of this community’s published placements. Filter the real data and see the shape of the competition.')+`<section class="insight-toolbar"><label>Discipline<select id="insight-mode"><option value="all">All disciplines</option>${leagueOptions(config)}</select></label><label>Region<select id="insight-region">${leagueRegionOptions()}</select></label><a class="button secondary" href="#results">Read the match evidence</a></section><div id="insight-summary" class="insight-summary"></div><div class="insight-layout"><section class="insight-panel"><h2>The tier distribution</h2><p>Active placements in your selection. One player may hold several disciplines.</p><div id="tier-distribution"></div></section><section class="insight-panel"><h2>Discipline participation</h2><p>Published active placements, not an estimate of popularity.</p><div id="mode-distribution"></div></section></div><section class="insight-footnote"><span aria-hidden="true">ⓘ</span><p>Retired placements are excluded. Revoked results are removed by the official feed. Feed activity is capped at the most recent 100 results; it is not an all-time test total.</p></section>`;
  const draw=()=>{
    const mode=main.querySelector('#insight-mode').value,region=main.querySelector('#insight-region').value;
    const entries=data.players.flatMap(p=>Object.entries(p.rankings).filter(([id,r])=>!r.retired&&(mode==='all'||id===mode)&&(region==='all'||(r.region||p.region)===region)).map(([id,r])=>({uuid:p.uuid,mode:id,tier:leagueTier(r)})));
    const count=entries.length,unique=new Set(entries.map(e=>e.uuid)).size;
    main.querySelector('#insight-summary').innerHTML=`<article><strong id="insight-total">${count}</strong><span>Active placements</span></article><article><strong>${unique}</strong><span>Distinct players</span></article><article><strong>${(data.recent||[]).filter(r=>(mode==='all'||r.mode===mode)&&(region==='all'||r.region===region)).length}</strong><span>Results in current feed</span></article><article><strong>${(testing.sessions||[]).filter(s=>s.status==='open'&&(mode==='all'||s.mode===mode)&&(region==='all'||s.region===region)).length}</strong><span>Open testing sessions</span></article>`;
    main.querySelector('#tier-distribution').innerHTML=count?Object.keys(config.points).map(t=>{const n=entries.filter(e=>e.tier===t).length,pct=Math.round(n/count*100);return `<div class="distribution-row"><span class="rank-token rank-token-${t.slice(-1)}">${t}</span><meter min="0" max="${count}" value="${n}" aria-label="${t}: ${n} placements">${n}</meter><strong>${n}</strong><small>${pct}%</small></div>`;}).join(''):'<div class="quiet-empty"><p>No active placements match this selection. Published results will make this distribution visible.</p></div>';
    main.querySelector('#mode-distribution').innerHTML=config.modes.filter(m=>mode==='all'||m.id===mode).map(m=>{const n=entries.filter(e=>e.mode===m.id).length;return `<div class="mode-distribution-row"><img src="./assets/${lx(m.id)}.svg" alt="" width="32" height="32"><span>${lx(m.name)}</span><strong>${n}</strong><meter min="0" max="${Math.max(count,1)}" value="${n}" aria-label="${lx(m.name)}: ${n} active placements">${n}</meter></div>`;}).join('');
  };main.querySelector('#insight-mode').onchange=draw;main.querySelector('#insight-region').onchange=draw;draw();
}

export function renderLeaguePlanner({main,config}) {
  const tiers=Object.keys(config.points).reverse();
  main.innerHTML=leagueIntro('Know the next step.','Explore the ten tiers, their published point values and the testing path for your chosen Mace discipline.')+`<div class="planner-layout"><section class="planner-controls"><h2>Set your sights</h2><label>Discipline<select id="planner-mode">${leagueOptions(config)}</select></label><label>Starting tier<select id="planner-current"><option value="unranked">Unranked</option>${tiers.map(t=>`<option>${t}</option>`).join('')}</select></label><label>Explore a target<select id="planner-target">${tiers.map(t=>`<option${t==='HT3'?' selected':''}>${t}</option>`).join('')}</select></label><p class="fine">This is a guide to the published point system. An application still checks verification, current rank and eligibility in Discord.</p></section><section class="planner-result" id="planner-result" aria-live="polite"></section></div><section class="tier-scale"><h2>Every placement on the ladder</h2><div>${tiers.map(t=>`<button data-explore-tier="${t}"><span class="rank-token rank-token-${t.slice(-1)}">${t}</span><strong>${config.points[t]}</strong><small>points</small></button>`).join('')}</div></section>`;
  const draw=()=>{
    const start=main.querySelector('#planner-current').value,target=main.querySelector('#planner-target').value,mode=main.querySelector('#planner-mode').value;
    const gap=config.points[target]-(config.points[start]||0),high=['HT3','LT2','HT2','LT1','HT1'].includes(target);
    const path=high?'#test-desk?'+new URLSearchParams({mode,tier:target}):'#testing?'+new URLSearchParams({mode});
    main.querySelector('#planner-result').innerHTML=`<div class="planner-target-mark tier-${target.slice(-1)}"><span>${target}</span><small>Target placement</small></div><p id="planner-gap"><strong>${Math.abs(gap)} points</strong> ${gap>=0?'above':'below'} ${start==='unranked'?'an unranked starting point':lx(start)}</p><h2>${config.points[target]} earned points.</h2><p>${high?'High-tier promotions follow opponent sets, recorded phases and independent review.':'Start with a qualified tester in an open evaluation session.'} Scores and recorded evidence determine a placement; this calculator is not a prediction or a promise of a rank.</p><a class="button" id="planner-next" href="${lx(path)}">${high?'Explore the '+target+' test':'Find an evaluation session'}</a><a class="subtle-link" href="#kits">Read loadouts & assessment rules</a>`;
    main.querySelectorAll('[data-explore-tier]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.exploreTier===target)));
  };['#planner-current','#planner-target','#planner-mode'].forEach(id=>main.querySelector(id).onchange=draw);
  main.querySelectorAll('[data-explore-tier]').forEach(b=>b.onclick=()=>{main.querySelector('#planner-target').value=b.dataset.exploreTier;draw();});draw();
}
