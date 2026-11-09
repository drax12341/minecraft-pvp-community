const phaseOrder=['LT5','HT5','LT4','HT4','LT3','HT3','LT2','HT2','LT1','HT1'];
export function checkTierPhase(target,phase,sets){
 const complete=sets.filter(s=>s.wins!==null&&s.wins!==undefined&&s.losses!==null&&s.losses!==undefined),wins=complete.reduce((n,s)=>n+s.wins,0),losses=complete.reduce((n,s)=>n+s.losses,0);
 const final=(['LT1','HT1'].includes(target)?3:2)===phase;
 const expected=target==='HT3'||(target==='HT1'&&final)||(['LT1','HT1'].includes(target)&&phase===1)?1:2;
 let tier=target==='HT3'?(phase===2?'HT3':null):final?target:phaseOrder[phaseOrder.indexOf(target)-(['LT1','HT1'].includes(target)&&phase===1?2:1)];
 let passed=false,summary='';
 if(complete.length<expected||complete.length!==sets.length)summary=`Record ${expected} completed opponent ${expected===1?'set':'sets'}; ${complete.length} recorded.`;
 else if(target==='HT3'&&phase===1){passed=complete[0].wins>=3&&complete[0].losses<=1;summary=passed?'Initial tester win meets 3–1 or better.':complete[0].wins===3&&complete[0].losses===2?'A 3–2 win requires tester discretion.':'The initial set does not meet 3–1 or better.';}
 else if((target==='HT3'&&final)||(target==='HT1'&&final)){passed=complete[0].wins>complete[0].losses&&(target!=='HT3'||complete[0].wins>=4);summary=passed?'Required final opponent beaten.':'A win against the final opponent is required.';}
 else if(final){passed=wins>=7&&wins>=losses&&complete.every(s=>s.wins>=3);summary=passed?'At least 7–7 overall, with 3+ rounds on every opponent.':'Need 7+ wins, an equal or better overall score, and 3+ rounds on each opponent.';}
 else if(['LT1','HT1'].includes(target)&&phase===1){passed=complete[0].wins>=4&&complete[0].losses<=2;summary=passed?'Lower-tier set meets 4–2 or better.':'Need a 4–2 or better win against the lower-tier opponent.';}
 else{passed=wins>=8&&losses<=5&&complete.every(s=>s.wins>s.losses);summary=passed?'Both same-tier opponents beaten, 8–5 or better overall.':'Beat both same-tier opponents with at least 8 wins and no more than 5 losses overall.';}
 const replacements=tier?complete.filter(s=>s.opponent_tier!==tier).length:0;
 if(replacements)summary+=` ${replacements} opponent tier mismatch: replacement rules require explicit staff adjudication.`;
 return {passed:passed&&!replacements,summary,wins,losses,expected,expectedTier:tier,replacements,complete:complete.length};
}
