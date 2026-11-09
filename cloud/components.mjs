import config from "../config/community.json" with { type: "json" };
import { rubricText } from "../config/rubrics.mjs";
import { extraInterests, ticketKinds, staffTracks } from "../config/community-roles.mjs";
const menu=(id,placeholder,options)=>[{type:1,components:[{type:3,custom_id:id,placeholder,min_values:1,max_values:1,options}]}];
const message=(content,components=[])=>({type:4,data:{content,flags:64,components,allowed_mentions:{parse:[]}}});
const modal=(id,title,fields)=>({type:9,data:{custom_id:id,title,components:fields.map(([custom_id,label,style,min_length,max_length])=>({type:1,components:[{type:4,custom_id,label,style,required:true,min_length,max_length}]}))}});
function command(i,name,sub,values={}) { const opts=Object.entries(values).map(([name,value])=>({name,value}));return {...i,type:2,data:{name,options:sub?[{type:1,name:sub,options:opts}]:opts}}; }
export function componentRoute(i) {
  const id=i.data.custom_id,value=i.data.values?.[0];
  const modes=config.modes.map(m=>({label:m.name,value:m.id,description:m.group}));
  if(i.type===5){
    const fields=Object.fromEntries((i.data.components||[]).flatMap(row=>(row.components||[]).map(f=>[f.custom_id,f.value])));
    if(id.startsWith("ticket:open:")){const kind=id.slice(12);if(!ticketKinds.includes(kind))throw Error("Invalid ticket category.");return {command:command(i,"ticket","open",{kind,subject:fields.subject,detail:fields.detail})};}
    if(id.startsWith("apply:open:")){const track=id.slice(11);if(!staffTracks.includes(track))throw Error("Invalid application track.");return{command:command(i,"staff-apply","submit",{track,experience:fields.experience,availability:fields.availability})};}
    throw Error("This form has expired. Open the panel again.");
  }
  if(id==="hub:test")return{response:message("Choose the mode for your official test request.",menu("test:mode","Select a testing mode",modes))};
  if(id==="test:mode"){
    if(!config.modes.some(m=>m.id===value))throw Error("Invalid mode.");
    return{response:message("Choose your region. The next step checks ownership, real session availability, capacity and cooldown.",menu("test:region:"+value,"Select your region",["EU","NA","AS","SA","AU","AF","ME","OC"].map(v=>({label:v,value:v}))))};
  }
  if(id.startsWith("test:region:"))return{command:command(i,"request-test",null,{mode:id.slice(12),region:value})};
  if(id==="hub:availability")return{command:command(i,"availability",null)};
  if(id==="hub:rubrics")return{response:message("Choose a mode to read its assessment rubric.",menu("rubric:mode","Select a rubric",modes))};
  if(id==="rubric:mode"){const m=config.modes.find(m=>m.id===value);if(!m)throw Error("Invalid mode.");return{response:message(rubricText(m.id,m.name).slice(0,1950))};}
  if(id==="hub:modes")return{response:message("Choose a mode interest role. This does not grant a rank or join a test queue.",menu("roles:mode","Toggle a PvP mode",modes))};
  if(id==="roles:mode")return{command:command(i,"preferences",null,{mode:value})};
  if(id==="hub:interests")return{response:message("Choose a casual game interest or opt-in alert role.",menu("roles:interest","Toggle an interest or alert",Object.entries(extraInterests).map(([value,label])=>({label,value}))))};
  if(id==="roles:interest")return{command:command(i,"interests",null,{role:value})};
  if(id==="hub:ticket")return{response:message("Choose your ticket category. Staff reports are restricted to moderators; other cases can be handled by the support team.",menu("ticket:kind","What do you need help with?",ticketKinds.map(value=>({label:{support:"General support",account:"Minecraft account verification",report:"Player report","staff-report":"Confidential staff report"}[value],value}))))};
  if(id==="ticket:kind"){if(!ticketKinds.includes(value))throw Error("Invalid ticket category.");return{response:modal("ticket:open:"+value,"Contact the team",[["subject","Subject — no passwords or tokens",1,5,100],["detail","Describe the problem and relevant links",2,10,1500]])};}
  if(id.startsWith("ticket:close:"))return{command:command(i,"ticket","close",{id:id.slice(13),reason:"Closed using the ticket's close button."})};
  if(id==="hub:apply")return{response:message("Choose a staff application track. Minecraft ownership verification is required; no application automatically grants a role.",menu("apply:track","Choose a volunteer role",staffTracks.map(value=>({label:value.replaceAll("-"," "),value}))))};
  if(id==="apply:track"){if(!staffTracks.includes(value))throw Error("Invalid application track.");return{response:modal("apply:open:"+value,"Volunteer application",[["experience","Relevant experience and why you want to help",2,30,1500],["availability","UTC availability and weekly commitment",2,10,300]])};}
  if(id==="hub:guide")return{command:command(i,"guide",null,{topic:"start"})};
  throw Error("This button is no longer supported. Use /guide or reopen the current panel.");
}
