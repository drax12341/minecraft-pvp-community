import {Resvg} from '@resvg/resvg-js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('web/brand',{recursive:true});
const master=await readFile('web/mark.svg','utf8');
for(const [name,size] of [['discord-icon',512],['favicon',64]])await writeFile(`web/brand/${name}.png`,new Resvg(master,{fitTo:{mode:'width',value:size}}).render().asPng());
for(const [name,title,subtitle] of [['testing','EARN YOUR PLACE','Verify · Prepare · Queue · Review'],['support','THE COMMUNITY DESK','Private help. Clear next steps.'],['standards','BUILT ON EVIDENCE','Versioned kits. Independent review.']]){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360" viewBox="0 0 1200 360"><rect width="1200" height="360" rx="24" fill="#15223c"/><path d="M850 0h350v360H490Z" fill="#213050"/><path d="M32 300h1136" stroke="#65d8eb" stroke-width="3"/><text x="54" y="68" fill="#65d8eb" font-family="Arial,sans-serif" font-size="22" letter-spacing="4">MINECRAFT PVP COMMUNITY</text><text x="54" y="173" fill="#dce9ff" font-family="Arial,sans-serif" font-weight="bold" font-size="60">${title}</text><text x="54" y="235" fill="#a995ff" font-family="Arial,sans-serif" font-size="30">${subtitle}</text></svg>`;
  await writeFile(`web/brand/panel-${name}.svg`,svg);
  await writeFile(`web/brand/panel-${name}.png`,new Resvg(svg).render().asPng());
}
