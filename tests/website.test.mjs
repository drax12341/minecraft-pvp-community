import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import {deskPaths,deskTiers,testingDeskCommands} from '../config/testing-desk.mjs';
import {communityDeskCommands} from '../config/community-desk.mjs';
const config = JSON.parse(await readFile("config/community.json"));
const player = {
  uuid: "00000000-0000-0000-0000-000000000001",
  name: "TestPlayer",
  region: "EU",
  points: 10,
  rankings: {
    mace: { tier: 3, pos: 0, peak_tier: 3, peak_pos: 0, retired: false },
  },
};
async function website(
  players = [],
  sessions = [],
  route = "rankings",
  recent = [],
  host = 'example.com',
  testerActivity = [],
) {
  const dom = new JSDOM(await readFile("web/index.html", "utf8"), {
      url: `https://${host}/${host==='drax12341.github.io'?'minecraft-pvp-community/':''}` + (route ? "#" + route : ""),
      runScripts: "outside-only",
    }),
    w = dom.window;
  w.__requests=[];
  w.fetch = async (url) => (w.__requests.push(String(url)),{
    ok: true,
    json: async () =>
      url.endsWith('testing-desk.json')||url.endsWith('/api/testing-desk')
        ? {paths:deskPaths,tiers:deskTiers,commands:[...testingDeskCommands,...communityDeskCommands],demand:[],leaderboard:testerActivity}
        : url.endsWith("community.json")
        ? config
        : url.endsWith("testing.json")
          ? { sessions, activation: sessions.length ? "active" : "pending" }
          : { updatedAt: null, players, recent },
  });
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    w.document.activeElement?.blur();
  };
  const deskSource=(await readFile('web/testing-desk.js','utf8')).replaceAll('export function','function').replaceAll('export async function','async function');
  const leagueSource=(await readFile('web/league.js','utf8')).replaceAll('export function','function');
  const controlSource=(await readFile('web/control-room.js','utf8')).replaceAll('export function','function');
  const appSource=(await readFile('web/tierlist.js','utf8')).replace(/^import .*\r?\n/gm,'');
  await w.eval(`(async()=>{${deskSource}\n${leagueSource}\n${controlSource}\n${appSource}\n})()`);
  return dom;
}

test('home showcase filters real queue occupancy by region without inventing players',async()=>{
 const dom=await website([],[{mode:'mace',region:'EU',status:'open',capacity:20,waiting:3,claimed:1},{mode:'mace_rod',region:'NA',status:'paused',capacity:20,waiting:2,claimed:0}],'home'),w=dom.window,d=w.document;
 assert.ok(d.querySelector('.cr-challenger'));assert.equal(d.querySelectorAll('#home-player-index [data-cr-profile]').length,0);
 d.querySelector('#home-region').value='NA';d.querySelector('#home-region').dispatchEvent(new w.Event('change'));
 assert.equal(d.querySelectorAll('#home-queues [data-queue-region]').length,1);assert.match(d.querySelector('#home-queues').textContent,/Rod Mace/);assert.match(d.querySelector('#home-queues').textContent,/2\/20/);
 assert.doesNotMatch(d.querySelector('#home-queues').textContent,/4\/20/);
 d.querySelector('#refresh-public').click();await new Promise(r=>w.setTimeout(r,20));assert.equal(d.querySelector('#home-region').value,'NA');dom.window.close();
});

test('universal finder searches real players and opens their existing profile',async()=>{
 const dom=await website([player],[],'home'),w=dom.window,d=w.document;
 d.querySelector('#global-kit-search').click();const input=d.querySelector('#kit-search');input.value='TestPlayer';input.dispatchEvent(new w.Event('input'));
 assert.equal(d.querySelectorAll('[data-search-player]').length,1);d.querySelector('[data-search-player]').click();
 assert.match(d.querySelector('#modal-body').textContent,/TestPlayer/);assert.ok(d.querySelector('#save-player'));dom.window.close();
});

test('control room combines search, region and saved filters, resets pagination and retains scope across navigation',async()=>{
 const players=Array.from({length:16},(_,n)=>({...player,uuid:'person-'+n,name:'Player'+String(n).padStart(2,'0'),region:n%2?'NA':'EU'}));
 const dom=await website(players,[],'home'),w=dom.window,d=w.document;
 assert.equal(d.querySelectorAll('.cr-ranking-table tbody tr').length,10);d.querySelector('#index-next').click();assert.equal(d.querySelectorAll('.cr-ranking-table tbody tr').length,6);
 d.querySelector('#home-player-region').value='NA';d.querySelector('#home-player-region').dispatchEvent(new w.Event('change'));assert.equal(d.querySelector('#index-page').textContent,'1 / 1');assert.equal(d.querySelectorAll('.cr-ranking-table tbody tr').length,8);
 d.querySelector('#home-player-search').value='Player03';d.querySelector('#home-player-search').dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.cr-ranking-table tbody tr').length,1);
 d.querySelector('[data-cr-save="person-3"]').click();assert.equal(d.querySelector('[data-cr-save="person-3"]').getAttribute('aria-pressed'),'true');assert.ok(JSON.parse(w.localStorage.getItem('pvp:savedPlayers')).includes('person-3'));
 d.querySelector('#home-saved-only').click();assert.equal(d.querySelector('#index-count').textContent,'1');
 w.location.hash='kits';await new Promise(r=>w.setTimeout(r,10));w.location.hash='home';await new Promise(r=>w.setTimeout(r,10));assert.equal(d.querySelector('#home-player-search').value,'Player03');assert.equal(d.querySelector('#home-player-region').value,'NA');assert.equal(d.querySelector('#home-saved-only').getAttribute('aria-pressed'),'true');dom.window.close();
});

test('home comparison uses real players and clearing it works outside the full rankings page',async()=>{
 const dom=await website([player,{...player,uuid:'other',name:'OtherPlayer'}],[],'home'),w=dom.window,d=w.document;
 for(const input of d.querySelectorAll('[data-cr-compare]')){input.checked=true;input.dispatchEvent(new w.Event('change'));}
 assert.equal(d.querySelector('#compare').disabled,false);d.querySelector('#compare').click();assert.match(d.querySelector('#modal-body').textContent,/TestPlayer/);assert.match(d.querySelector('#modal-body').textContent,/OtherPlayer/);d.querySelector('.close').click();
 d.querySelector('#clear-compare').click();assert.equal(d.querySelector('.compare-dock'),null);assert.equal(d.querySelectorAll('[data-cr-compare]:checked').length,0);assert.equal(d.body.dataset.page,'home');dom.window.close();
});

test('personal testing commands, shareable scope, tag controls and CSV downloads perform their stated action',async()=>{
 const dom=await website([player],[],'home'),w=dom.window,d=w.document,copied=[];Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>copied.push(text)}});
 d.querySelector('#quick-mode').value='mace_rod';d.querySelector('#quick-mode').dispatchEvent(new w.Event('change'));d.querySelector('#quick-region').value='NA';d.querySelector('#quick-region').dispatchEvent(new w.Event('change'));d.querySelector('#quick-copy').click();await Promise.resolve();assert.equal(copied.at(-1),'/queue status mode:mace_rod region:NA');
 d.querySelector('[data-index-mode="mace"]').click();d.querySelector('[data-index-view="cards"]').click();d.querySelector('#index-share').click();await Promise.resolve();assert.match(copied.at(-1),/mode=mace/);assert.match(copied.at(-1),/view=cards/);
 d.querySelector('#preview-mode').value='mace_rod';d.querySelector('#preview-tier').value='HT1';d.querySelector('#preview-tier').dispatchEvent(new w.Event('change'));assert.match(d.querySelector('#home-tag-preview').textContent,/Rod Mace HT1/);
 let exported;w.Blob=Blob;w.URL.createObjectURL=blob=>{exported=blob;return 'blob:download';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
 d.querySelector('#index-export').click();assert.match(await exported.text(),/TestPlayer/);assert.match(await exported.text(),/Active points/);dom.window.close();
});

test('home shows escaped public tester activity, valid evidence and real analytics without fake identities',async()=>{
 const recent=[{...player,mode:'mace',tier:3,pos:0,created:new Date().toISOString(),evidence:'javascript:alert(1)'}];
 const dom=await website([player],[],'home',recent,'example.com',[{name:'<img src=x onerror=alert(1)>',tests:4}]),w=dom.window,d=w.document;await new Promise(r=>w.setTimeout(r,10));
 assert.match(d.querySelector('#tester-activity').textContent,/4 tests/);assert.equal(d.querySelector('#tester-activity img[onerror]'),null);assert.equal(d.querySelector('#home-recent-results a'),null);
 assert.equal(d.querySelector('.cr-donut-total').textContent,'1');assert.equal(d.querySelector('.cr-activity-total strong').textContent,'1');d.querySelector('[data-chart-days="7"]').click();assert.equal(d.querySelectorAll('.cr-activity-bars>div').length,7);
 d.querySelector('[data-target-tier="LT1"]').click();assert.match(d.querySelector('#home-target-result .button').hash,/tier=LT1/);dom.window.close();
});

test('saved-player watchlist persists through navigation and can remove a saved player without changing rankings',async()=>{
 const dom=await website([player],[],'rankings?player='+player.uuid),w=dom.window,d=w.document;
 d.querySelector('#save-player').click();d.querySelector('.close').click();w.location.hash='watchlist';await new Promise(r=>w.setTimeout(r,10));
 assert.equal(d.querySelectorAll('[data-watch-player]').length,1);assert.match(d.querySelector('#watchlist-count').textContent,/1/);
 d.querySelector('[data-watch-remove]').click();assert.equal(d.querySelectorAll('[data-watch-player]').length,0);assert.deepEqual(JSON.parse(w.localStorage.getItem('pvp:savedPlayers')),[]);
 w.location.hash='rankings';await new Promise(r=>w.setTimeout(r,10));assert.equal(d.querySelectorAll('[data-player]').length,1);dom.window.close();
});

test('insights compute the active tier distribution from real placements and apply mode and region filters',async()=>{
 const retired={...player,uuid:'retired',name:'RetiredPlayer',region:'NA',rankings:{mace:{tier:1,pos:0,retired:true}}};
 const dom=await website([player,retired],[],'insights'),w=dom.window,d=w.document;
 assert.equal(d.querySelector('#insight-total').textContent,'1');assert.match(d.querySelector('#tier-distribution').textContent,/HT3/);
 d.querySelector('#insight-region').value='NA';d.querySelector('#insight-region').dispatchEvent(new w.Event('change'));
 assert.equal(d.querySelector('#insight-total').textContent,'0');assert.match(d.querySelector('#tier-distribution').textContent,/No active placements/);dom.window.close();
});

test('tier explorer calculates the actual point gap and preserves mode and target in the application link',async()=>{
 const dom=await website([],[],'planner'),w=dom.window,d=w.document;
 d.querySelector('#planner-current').value='LT3';d.querySelector('#planner-target').value='HT3';d.querySelector('#planner-mode').value='mace_rod';
 d.querySelector('#planner-target').dispatchEvent(new w.Event('change'));
 assert.match(d.querySelector('#planner-gap').textContent,/4 points/);assert.match(d.querySelector('#planner-next').hash,/mode=mace_rod/);assert.match(d.querySelector('#planner-next').hash,/tier=HT3/);
 assert.match(d.querySelector('#planner-result').textContent,/not a prediction/);dom.window.close();
});

test('global motion preference persists while background scene controls remain usable',async()=>{
 const dom=await website([],[],'home'),w=dom.window,d=w.document;
 d.querySelector('#motion-toggle').click();assert.ok(d.body.classList.contains('calm-view'));assert.equal(w.localStorage.getItem('pvp:calm'),'true');
 d.querySelector('[data-scene-choice="quiet"]').click();assert.equal(d.querySelector('.control-hero').dataset.scene,'quiet');assert.equal(d.querySelector('[data-scene-choice="quiet"]').getAttribute('aria-pressed'),'true');
 w.location.hash='kits';await new Promise(r=>w.setTimeout(r,10));w.location.hash='home';await new Promise(r=>w.setTimeout(r,10));assert.equal(d.querySelector('.control-hero').dataset.scene,'quiet');assert.ok(d.body.classList.contains('calm-view'));dom.window.close();
});

test('watchlist comparison can be cleared without requiring the rankings page',async()=>{
 const dom=await website([player],[],'rankings?player='+player.uuid),w=dom.window,d=w.document;
 d.querySelector('#save-player').click();d.querySelector('.close').click();w.location.hash='watchlist';await new Promise(r=>w.setTimeout(r,10));
 d.querySelector('[data-watch-compare]').click();assert.ok(d.querySelector('.compare-dock'));assert.equal(d.querySelector('[data-watch-compare]').getAttribute('aria-pressed'),'true');
 d.querySelector('#clear-compare').click();assert.equal(d.querySelector('.compare-dock'),null);assert.equal(d.querySelector('[data-watch-compare]').getAttribute('aria-pressed'),'false');assert.equal(d.body.dataset.page,'watchlist');dom.window.close();
});

test('finder escapes public player names and keyboard navigation reaches results',async()=>{
 const malicious={...player,name:'<img src=x onerror=alert(1)>'};
 const dom=await website([malicious],[],'home'),w=dom.window,d=w.document;
 d.querySelector('#global-kit-search').click();const input=d.querySelector('#kit-search');input.value='onerror';input.dispatchEvent(new w.Event('input'));
 assert.equal(d.querySelector('#kit-picker img[onerror]'),null);assert.match(d.querySelector('[data-search-player]').textContent,/onerror/);
 input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',cancelable:true}));assert.ok(d.activeElement.hasAttribute('data-search-player'));dom.window.close();
});

test('control room switches between table and player cards while preserving filtered results',async()=>{
 const dom=await website([player],[],'home'),w=dom.window,d=w.document;w.matchMedia=()=>({matches:true});
 d.querySelector('[data-index-view="cards"]').click();assert.equal(d.querySelectorAll('.cr-player-card').length,1);assert.equal(d.querySelector('.cr-ranking-table'),null);
 d.querySelector('[data-index-mode="mace_rod"]').click();assert.equal(d.querySelectorAll('.cr-player-card').length,0);
 d.querySelector('#index-reset').click();assert.equal(d.querySelectorAll('.cr-player-card').length,1);d.querySelector('[data-index-view="table"]').click();assert.equal(d.querySelectorAll('.cr-ranking-table tbody tr').length,1);
 assert.equal(d.querySelector('[data-index-view="table"]').getAttribute('aria-pressed'),'true');dom.window.close();
});

test('testing walkthrough supports keyboard steps, accurate commands and native FAQ disclosures',async()=>{
 const dom=await website([],[],'home'),w=dom.window,d=w.document;
 const verify=d.querySelector('[data-guide-step="verify"]');
 assert.match(d.querySelector('#guide-detail code').textContent,/^\/desk$/);
 verify.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',cancelable:true}));
 assert.equal(d.activeElement.dataset.guideStep,'queue');assert.equal(d.querySelector('#guide-detail').getAttribute('aria-labelledby'),'guide-tab-queue');
 assert.equal(d.querySelector('#guide-detail code').textContent,'/queue status');
 assert.equal(d.querySelectorAll('.cr-guide-steps [aria-selected="true"]').length,1);
 assert.equal(d.querySelectorAll('.cr-faq details>summary').length,6);assert.match(d.querySelector('#home-faq').textContent,/assigned tester/);
 d.querySelector('#tag-preview-cycle').click();assert.doesNotMatch(d.querySelector('#home-tag-preview').textContent,/HT3/);
 dom.window.close();
});

test('GitHub Pages uses project-relative assets, the correct canonical URL and live public data',async()=>{
 const dom=await website([player],[],'home',[],'drax12341.github.io'),w=dom.window,d=w.document;
 assert.equal(d.querySelector('link[rel="canonical"]').href,'https://drax12341.github.io/minecraft-pvp-community/');
 const css=[...d.querySelectorAll('link[rel="stylesheet"]')].filter(a=>!a.href.includes('googleapis'));assert.equal(css.length,2);assert.match(css[0].getAttribute('href'),/^\.\/site.css/);assert.match(css[1].getAttribute('href'),/^\.\/control-room.css/);
 assert.ok(w.__requests.includes('https://minecraft-pvp-community.draxion0.chatgpt.site/data/results.json'));
 assert.ok(w.__requests.includes('https://minecraft-pvp-community.draxion0.chatgpt.site/data/testing.json'));
 w.location.hash='kits';await new Promise(r=>w.setTimeout(r,10));assert.equal(d.querySelector('a[href="./standards.html"]').href,'https://drax12341.github.io/minecraft-pvp-community/standards.html');assert.doesNotMatch(d.querySelector('main').textContent,/Sword|Axe|Bow/);
 dom.window.close();
});

test('the standalone design parses with explicit hidden-panel and reduced-motion safeguards',async()=>{
 const css=await readFile('web/site.css','utf8'),dom=new JSDOM('<!doctype html><style>'+css+'</style>');
 const rules=[...dom.window.document.styleSheets[0].cssRules];
 assert.ok(rules.some(r=>r.selectorText==='[hidden]'&&r.style.getPropertyValue('display')==='none'));
 assert.ok(rules.some(r=>r.conditionText?.includes('prefers-reduced-motion:reduce')||r.conditionText?.includes('prefers-reduced-motion: reduce')));
 dom.window.close();
});

test('standards show only this community’s modes and escaped approved equipment, with usable mode filtering',async()=>{
 const dom=new JSDOM(await readFile('web/standards.html','utf8'),{url:'https://example.com/standards.html',runScripts:'outside-only'}),w=dom.window;
 w.fetch=async url=>({ok:true,json:async()=>String(url).includes('community.json')?config:{loadouts:[{mode:'mace',version:'mace-v1',loadout:'Mace & fishing rod <img src=x onerror=alert(1)>',created:'2026-11-13T00:00:00Z'}]}});
 await w.eval('(async()=>{'+await readFile('web/standards.js','utf8')+'})()');const d=w.document;
 assert.equal(d.querySelectorAll('[data-loadout-mode]').length,7);assert.match(d.querySelector('#standards').textContent,/mace-v1/);assert.equal(d.querySelector('#standards img[onerror]'),null);
 d.querySelector('#loadout-mode').value='mace_rod';d.querySelector('#loadout-mode').dispatchEvent(new w.Event('change'));
 assert.equal(d.querySelectorAll('[data-loadout-mode]').length,1);assert.match(d.querySelector('#standards').textContent,/Rod Mace/);assert.doesNotMatch(d.querySelector('#standards').textContent,/Sword|Axe|Bow/);dom.window.close();
});
test('high-tier roster filters real placements, excludes lower tiers and never renders sample players',async()=>{
 const dom=await website([player,{...player,uuid:'lower',name:'LowerPlayer',rankings:{mace:{tier:3,pos:1}}}],[],'high-tiers');const d=dom.window.document;
 assert.equal(d.querySelectorAll('.rank-lane').length,5);assert.equal(d.querySelectorAll('[data-high-player]').length,1);assert.match(d.querySelector('#high-board').textContent,/TestPlayer/);assert.doesNotMatch(d.querySelector('#high-board').textContent,/LowerPlayer|PreviewPlayer/);
 d.querySelector('#high-region').value='NA';d.querySelector('#high-region').dispatchEvent(new dom.window.Event('change'));assert.equal(d.querySelectorAll('[data-high-player]').length,0);dom.window.close();
});
test('test desk changes target phases and tester fields and prepares a local application',async()=>{
 const dom=await website([],[],'test-desk'),w=dom.window,d=w.document;await new Promise(r=>w.setTimeout(r,10));
 const form=d.querySelector('#desk-form');assert.ok(form);assert.equal(d.querySelectorAll('#desk-phases li').length,2);
 form.elements.tier.value='LT1';form.elements.tier.dispatchEvent(new w.Event('change'));assert.equal(d.querySelectorAll('#desk-phases li').length,3);
 form.elements.kind.value='tester';form.elements.kind.dispatchEvent(new w.Event('change'));assert.equal(d.querySelector('#desk-experience').hidden,false);assert.equal(form.elements.experience.required,true);
 form.elements.experience.value='I record independent scores and explain fair tier decisions.';form.elements.availability.value='Saturday 16 UTC';form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.match(d.querySelector('#desk-draft').textContent,/tester-desk apply mode:mace region:EU tier:LT1/);assert.match(d.querySelector('#desk-draft').textContent,/Nothing submitted/);dom.window.close();
});
test('profile testing paths preserve the gamemode, region and next tier in the application builder',async()=>{
 const dom=await website([player],[],'rankings?player='+player.uuid),w=dom.window,d=w.document;
 const link=d.querySelector('.profile-next');assert.ok(link);assert.match(link.hash,/mode=mace/);assert.match(link.hash,/tier=LT2/);link.click();await new Promise(r=>w.setTimeout(r,15));
 const form=d.querySelector('#desk-form');assert.equal(form.elements.mode.value,'mace');assert.equal(form.elements.region.value,'EU');assert.equal(form.elements.tier.value,'LT2');assert.equal(d.querySelector('dialog').open,false);dom.window.close();
});
test('the public Pages mirror reads live testing demand from the same cloud service as rankings',async()=>{
 const dom=await website([],[],'test-desk',[],'drax12341.github.io');await new Promise(r=>dom.window.setTimeout(r,10));assert.ok(dom.window.__requests.includes('https://minecraft-pvp-community.draxion0.chatgpt.site/api/testing-desk'));dom.window.close();
});
test("standalone board has five tiers, explicit sample preview, and no external ranks", async () => {
  const dom = await website(),
    w = dom.window,
    d = w.document;
  assert.equal(d.querySelectorAll(".tier-column").length, 5);
  assert.equal(d.querySelectorAll("[data-player]").length, 0);
  assert.doesNotMatch(d.body.textContent, /MCTiers|PvPTiers|CatPvP|provider/i);
  d.querySelector("#preview-toggle").click();
  assert.match(
    d.querySelector(".preview-notice").textContent,
    /Not real rankings/,
  );
  assert.equal(d.querySelectorAll("[data-player]").length, 10);
  d.querySelector("#exit-preview").click();
  assert.equal(d.querySelectorAll("[data-player]").length, 0);
  dom.window.close();
});

test("league homepage uses real counts, a compact navigation shell and direct gamemode entry points", async () => {
  const dom = await website([], [], ""),
    w = dom.window,
    d = w.document;
  assert.equal(d.body.dataset.page, "home");
  assert.match(d.querySelector('#hero-title').textContent,/MaceTierlist/);
  assert.equal(d.querySelectorAll('[data-league-mode]').length,7);
  assert.equal(d.querySelector('.control-hero').dataset.scene,'arena');
  assert.match(d.querySelector('.league-empty').textContent,/first results/);
  assert.equal(d.querySelector('.community-stats strong').textContent,'0');
  d.querySelector('#mobile-navigation').click();assert.equal(d.querySelector('#mobile-navigation').getAttribute('aria-expanded'),'true');
  d.querySelector('.league-rail a').click();assert.equal(d.querySelector('#mobile-navigation').getAttribute('aria-expanded'),'false');
  await new Promise(r=>w.setTimeout(r,10));
  d.querySelector('[data-league-mode="mace_rod"]').click();
  await new Promise((r) => w.setTimeout(r, 10));
  assert.equal(d.body.dataset.page, "rankings");
  assert.match(d.querySelector(".kit-title h2").textContent, /Rod Mace/);
  dom.window.close();
});

test("kit groups, searchable kit picker, clear filters and compact controls work", async () => {
  const dom = await website([player]),
    w = dom.window,
    d = w.document;
  d.querySelector('[data-mode-group="sub"]').click();
  assert.ok(d.querySelector('[data-mode="mace_spear"]'));
  assert.equal(d.querySelector('[data-mode="mace"]'), null);
  d.querySelector("#browse-modes").click();
  const search = d.querySelector("#kit-search");
  search.value = "Rod Mace";
  search.dispatchEvent(new w.Event("input"));
  assert.equal(d.querySelectorAll("[data-pick]").length, 1);
  d.querySelector('[data-pick="mace_rod"]').click();
  await new Promise((r) => w.setTimeout(r, 10));
  assert.match(d.querySelector(".kit-title h2").textContent, /Rod Mace/);
  const query = d.querySelector("#search");
  query.value = "missing";
  query.dispatchEvent(new w.Event("input"));
  assert.ok(d.querySelector("#clear-filters"));
  d.querySelector("#clear-filters").click();
  assert.equal(d.querySelector("#search").value, "");
  d.querySelector("#density").click();
  assert.equal(
    d.querySelector("#density").getAttribute("aria-pressed"),
    "true",
  );
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "/", bubbles: true }));
  assert.equal(d.activeElement.id, "search");
  dom.window.close();
});

test("testing filters select an open region and preserve the request form", async () => {
  const dom = await website(
      [],
      [
        {
          mode: "mace",
          region: "EU",
          status: "closed",
          waiting: 0,
          claimed: 0,
        },
        { mode: "mace", region: "NA", status: "open", waiting: 3, claimed: 1 },
      ],
    ),
    w = dom.window,
    d = w.document;
  w.location.hash = "testing";
  await new Promise((r) => w.setTimeout(r, 10));
  assert.match(d.querySelector(".session-open").textContent, /Open · NA/);
  d.querySelector("[name=name]").value = "MyPlayer";
  d.querySelector("#session-status").value = "open";
  d.querySelector("#session-status").dispatchEvent(new w.Event("change"));
  assert.equal(d.querySelectorAll(".session").length, 1);
  d.querySelector('[data-request="mace"]').click();
  assert.equal(d.querySelector("[name=region]").value, "NA");
  assert.equal(d.querySelector("[name=name]").value, "MyPlayer");
  d.querySelector("#session-region").value = "EU";
  d.querySelector("#session-region").dispatchEvent(new w.Event("change"));
  assert.equal(d.querySelectorAll(".session").length, 0);
  assert.match(
    d.querySelector(".session-empty").textContent,
    /No open sessions/,
  );
  assert.equal(d.querySelector("[name=name]").value, "MyPlayer");
  dom.window.close();
});
test("community profile, search, navigation, request summary and tag preview work", async () => {
  const dom = await website([player]),
    w = dom.window,
    d = w.document;
  d.querySelector("[data-player]").click();
  assert.equal(d.querySelector("dialog").open, true);
  assert.match(d.querySelector("#modal-body").textContent, /TestPlayer/);
  d.querySelector(".close").click();
  const search = d.querySelector("#search");
  search.value = "nomatch";
  search.dispatchEvent(new w.Event("input"));
  assert.equal(d.querySelectorAll("[data-player]").length, 0);
  for (const route of ["testing", "kits", "tagger", "sponsors", "about"]) {
    w.location.hash = route;
    await new Promise((r) => w.setTimeout(r, 10));
    assert.ok(d.querySelector("h1"));
    if (route === "testing") {
      d.querySelector("[name=name]").value = "TestPlayer";
      d.querySelector("[name=availability]").value = "Saturday 16 UTC";
      d.querySelector("[name=rules]").checked = true;
      d.querySelector("form").dispatchEvent(
        new w.Event("submit", { cancelable: true }),
      );
      assert.match(
        d.querySelector("#modal-body").textContent,
        /no queue entry has been created/,
      );
      d.querySelector(".close").click();
    }
    if (route === "tagger") {
      d.querySelector("#tag-mode").value = "mace";
      d.querySelector("#tag-mode").dispatchEvent(new w.Event("change"));
      assert.match(d.querySelector("#tag-label").textContent, /Mace HT3/);
    }
  }
  dom.window.close();
});

test("shared ranking scope, profile deep links, saved players and retired filtering work together", async () => {
  const retired = {
    ...player,
    uuid: "00000000-0000-0000-0000-000000000002",
    name: "RetiredPlayer",
    rankings: { mace: { ...player.rankings.mace, retired: true } },
  };
  const dom = await website(
      [player, retired],
      [],
      "rankings?mode=mace&region=EU&view=list&status=all&player=" +
        player.uuid,
    ),
    w = dom.window,
    d = w.document;
  assert.equal(d.querySelector("dialog").open, true);
  assert.match(d.querySelector("#modal-body").textContent, /TestPlayer/);
  d.querySelector("#save-player").click();
  assert.equal(
    JSON.parse(w.localStorage.getItem("pvp:savedPlayers"))[0],
    player.uuid,
  );
  d.querySelector(".close").click();
  d.querySelector("#saved-only").click();
  assert.equal(d.querySelectorAll("tbody [data-player]").length, 1);
  assert.match(w.location.hash, /saved=1/);
  d.querySelector("#reset-view").click();
  assert.equal(d.querySelectorAll("[data-player]").length, 1);
  d.querySelector("#rank-status").value = "retired";
  d.querySelector("#rank-status").dispatchEvent(new w.Event("change"));
  assert.match(
    d.querySelector("#rankings-content").textContent,
    /RetiredPlayer/,
  );
  assert.match(d.querySelector("#rankings-content").textContent, /HT3/);
  assert.match(w.location.hash, /status=retired/);
  d.querySelector("#calm-view").click();
  assert.ok(d.body.classList.contains("calm-view"));
  assert.equal(w.localStorage.getItem("pvp:calm"), "true");
  dom.window.close();
});

test("leaderboards paginate without hiding filter scope and result feeds enforce HT3 cutoff", async () => {
  const ps = Array.from({ length: 56 }, (_, i) => ({
    ...player,
    uuid: String(i),
    name: "Player" + String(i).padStart(3, "0"),
  }));
  const dom = await website(ps, [], "rankings?mode=overall&view=list"),
    w = dom.window,
    d = w.document;
  assert.equal(d.querySelectorAll("tbody tr").length, 50);
  d.querySelector("#next-page").click();
  assert.equal(d.querySelectorAll("tbody tr").length, 6);
  assert.equal(d.querySelector(".rank-position").textContent, "51");
  d.querySelector("#prev-page").click();
  assert.equal(d.querySelector(".rank-position").textContent, "1");
  dom.window.close();
  const recent = [
    {
      ...player,
      mode: "mace",
      tier: 3,
      pos: 0,
      evidence: "https://example.com/evidence",
      created: "2026-11-08T00:00:00Z",
    },
    {
      ...player,
      name: "LowPlayer",
      mode: "mace",
      tier: 3,
      pos: 1,
      evidence: "https://example.com/low",
      created: "2026-11-08T00:00:00Z",
    },
  ];
  const resultDom = await website([], [], "results", recent),
    rd = resultDom.window.document;
  assert.equal(rd.querySelectorAll(".result-card").length, 2);
  rd.querySelector("[data-result-scope=high]").click();
  assert.equal(rd.querySelectorAll(".result-card").length, 1);
  assert.match(rd.querySelector("#results-feed").textContent, /TestPlayer/);
  assert.doesNotMatch(
    rd.querySelector("#results-feed").textContent,
    /LowPlayer/,
  );
  resultDom.window.close();
});

test("community summaries are local and refresh failure retains useful content", async () => {
  const dom = await website([], [], "community"),
    w = dom.window,
    d = w.document;
  d.querySelector("[name=practice-note]").value =
    "Saturday 16 UTC, mace kit, spacing practice.";
  d.querySelector("#practice-draft").dispatchEvent(
    new w.Event("submit", { cancelable: true }),
  );
  assert.equal(d.querySelector("dialog").open, true);
  assert.match(
    d.querySelector("#modal-body").textContent,
    /nothing has been posted/,
  );
  d.querySelector(".close").click();
  w.fetch = async () => {
    throw Error("Simulated outage");
  };
  d.querySelector("#refresh-public").click();
  await new Promise((r) => w.setTimeout(r, 10));
  assert.match(
    d.querySelector("#data-status").textContent,
    /last loaded snapshot/,
  );
  assert.equal(
    d.querySelector("[name=practice-note]").value,
    "Saturday 16 UTC, mace kit, spacing practice.",
  );
  dom.window.close();
});
