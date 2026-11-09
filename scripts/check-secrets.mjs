import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const values=Object.entries(process.env).filter(([k,v])=>/TOKEN|PASSWORD|SECRET/.test(k)&&v.length>=16).map(([,v])=>v);
const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
paths.push('dist/server/index.js');
let count=0;
for(const path of paths){const content=await readFile(path);if(values.some(v=>content.includes(Buffer.from(v)))){console.error('Credential match in '+path);count++;}}
if(count)process.exitCode=1;else console.log('No configured credential values found in tracked files or bundled Worker.');
