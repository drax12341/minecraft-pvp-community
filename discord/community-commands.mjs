import config from "../config/community.json" with { type: "json" };
import { extraInterests, ticketKinds, staffTracks } from "../config/community-roles.mjs";
const string=(name,description,required=false,choices)=>({type:3,name,description,required,...(choices?{choices:choices.map(v=>typeof v==="string"?{name:v,value:v}:v)}:{})});
const user=(required=false)=>({type:6,name:"user",description:"Community member",required});
const sub=(name,description,options=[])=>({type:1,name,description,options});
const id=(required=true)=>string("id","Case, application or test ID",required);
const reason=()=>string("reason","Clear explanation; at least 10 characters",true);
const mode=()=>string("mode","PvP testing mode",true,config.modes.map(m=>({name:m.name,value:m.id})));
export const communityCommands=[
  {name:"request-test",description:"Request an official test in an open session",options:[mode(),string("region","Your playing region",true,["EU","NA","AS","SA","AU","AF","ME","OC"])]},
  {name:"rubric",description:"Read a mode's assessment criteria and test protocol",options:[mode()]},
  {name:"interests",description:"Choose casual Minecraft interests and opt-in alerts",options:[string("role","Interest or alert to toggle",true,Object.entries(extraInterests).map(([value,name])=>({name,value})))]},
  {name:"ticket",description:"Private support, account and reporting tickets",options:[
    sub("open","Open a private ticket",[string("kind","Ticket category",true,ticketKinds),string("subject","Short subject, 5–100 characters",true),string("detail","Details, 10–1500 characters; never credentials",true)]),
    sub("status","Your tickets, or a case you may access",[id(false)]),
    sub("claim","Support staff: claim a ticket",[id()]),
    sub("close","Close a ticket and keep its private history",[id(),reason()]),
  ]},
  {name:"assessment",description:"Tester rubric scoring and independent high-tier sign-off",options:[
    sub("record","Assigned tester: record the six rubric scores",[id(),string("scores","Six whole scores 0–4, separated by commas",true),reason()]),
    sub("show","Staff: view a saved assessment",[id()]),
    sub("review","Senior staff: independently approve a proposed high tier",[id(),string("tier","Exact high tier being approved",true,["HT1","LT1","HT2","LT2"]),reason()]),
  ]},
  {name:"staff-apply",description:"Private helper, moderator, coach and event-host applications",options:[
    sub("submit","Apply for a volunteer role without automatic promotion",[string("track","Volunteer role",true,staffTracks),string("experience","Relevant experience, 30–1500 characters",true),string("availability","UTC availability, 10–300 characters",true)]),
    sub("status","Read your application decisions"),
    sub("review","Moderators: list or independently review applications",[id(false),string("decision","Interview or decline",false,["interview","declined"]),string("reason","Decision explanation, at least 10 characters")]),
  ]},
  {name:"moderation",description:"Moderator-only internal warning records and case reviews",options:[
    sub("warn","Record a private warning case",[user(true),reason()]),
    sub("cases","Read private moderation records",[user()]),
    sub("resolve","Resolve a case while retaining its record",[id(),reason()]),
  ]},
];
