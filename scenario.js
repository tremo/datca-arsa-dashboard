// Pure, presentation-only scenario engine.  No persistence outside the
// browser, no dynamic expressions, and no operational data mutations.
export const SCENARIO_STORAGE_KEY='datca-scenario-v1';
export const GATE_KEYS=['naturalFirstDegree','archaeologicalSit','sharedTitle','noDirectAccess','overBudget','underMinimumArea'];
export const FIELD_TYPES={price:'number',area:'number',unitPrice:'number',routeMax:'number',discountPct:'number',officialType:'text',neighborhood:'text'};
export const NUMBER_OPERATORS=['lte','gte','lt','gt','eq','neq'];
export const TEXT_OPERATORS=['eq','neq'];

export function defaultScenario(meta={}){
 const gates=Object.fromEntries(GATE_KEYS.map(key=>[key,true]));
 for(const gate of meta?.scenario?.gates||[])if(GATE_KEYS.includes(gate.key))gates[gate.key]=gate.default!==false;
 const defaults=meta?.scenario?.scoreWeights||{},value=Number(defaults.value),proximity=Number(defaults.proximity);
 return {version:1,gates,weights:{value:Number.isFinite(value)?value:70,proximity:Number.isFinite(proximity)?proximity:30},custom:[],onlyEligible:false};
}

export function sanitizeScenario(input,meta={}){
 const base=defaultScenario(meta),source=input&&typeof input==='object'?input:{};
 const gates={...base.gates};
 for(const key of GATE_KEYS)if(typeof source.gates?.[key]==='boolean')gates[key]=source.gates[key];
 const bounded=value=>Math.max(0,Math.min(100,Number.isFinite(Number(value))?Number(value):0));
 let value=bounded(source.weights?.value??base.weights.value),proximity=bounded(source.weights?.proximity??base.weights.proximity);
 if(value+proximity===0){value=base.weights.value;proximity=base.weights.proximity}
 const custom=[];
 for(const raw of Array.isArray(source.custom)?source.custom.slice(0,12):[]){
  const field=String(raw?.field||''),type=FIELD_TYPES[field],operator=String(raw?.operator||'');
  if(!type||!(type==='number'?NUMBER_OPERATORS:TEXT_OPERATORS).includes(operator))continue;
  const parsed=type==='number'?Number(raw.value):String(raw.value??'').trim().slice(0,80);
  if(type==='number'&&!Number.isFinite(parsed)||type==='text'&&!parsed)continue;
  custom.push({id:String(raw.id||`${field}-${operator}-${custom.length}`).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48),field,operator,value:parsed,unknown:raw.unknown==='exclude'?'exclude':'include'});
 }
 return {version:1,gates,weights:{value,proximity},custom,onlyEligible:source.onlyEligible===true};
}

export function scenarioFromUrl(meta,url=location.href){
 try{const raw=new URL(url).searchParams.get('scenario');return raw?sanitizeScenario(JSON.parse(raw),meta):null}catch{return null}
}

export function scenarioIsDefault(state,meta={}){
 return JSON.stringify(sanitizeScenario(state,meta))===JSON.stringify(defaultScenario(meta));
}

export function gateFailures(record,state){
 return GATE_KEYS.filter(key=>state.gates[key]&&record.scenarioFacts?.[key]===true);
}

export function relaxedGateKeys(record,state){
 return GATE_KEYS.filter(key=>state.gates[key]===false&&record.scenarioFacts?.[key]===true);
}

// The discount rule uses the same comparison the cards show.
export function fieldValue(record,field){return field==='area'?(record.officialArea??record.listingArea):field==='discountPct'?(record.comparison?record.comparison.discountPct:record.discountPct):record[field]}
// true = fits, false = does not fit, null = the value is unknown.
export function customRuleResult(record,rule){
 const value=fieldValue(record,rule.field),type=FIELD_TYPES[rule.field];
 if(value==null||value==='')return null;
 if(type==='text'){
  const left=String(value).trim().toLocaleLowerCase('tr'),right=String(rule.value).trim().toLocaleLowerCase('tr');
  return rule.operator==='eq'?left===right:left!==right;
 }
 const left=Number(value),right=Number(rule.value);if(!Number.isFinite(left)||!Number.isFinite(right))return null;
 return {lte:left<=right,gte:left>=right,lt:left<right,gt:left>right,eq:left===right,neq:left!==right}[rule.operator]??false;
}
export function customRulePass(record,rule){return customRuleResult(record,rule)===true}

export function scenarioEligibility(record,state){
 const failedGates=gateFailures(record,state),failedRules=[],unknownRules=[];
 for(const rule of state.custom){const result=customRuleResult(record,rule);if(result===false||result===null&&rule.unknown==='exclude')failedRules.push(rule);else if(result===null)unknownRules.push(rule)}
 const keys=record.scenarioOfficialGateKeys||[];
 const officialBlock=record.lifecycle==='excluded'&&(!record.scenarioOfficialRelaxable||!keys.length||keys.some(key=>state.gates[key]));
 const eligible=!officialBlock&&!failedGates.length&&!failedRules.length;
 // status: out = not a candidate in this scenario, fail = candidate that breaks a rule, unknown = kept but a rule could not be checked.
 const status=officialBlock?'out':!eligible?'fail':unknownRules.length?'unknown':'fit';
 return {eligible,status,failedGates,failedRules,unknownRules,officialBlock,relaxed:relaxedGateKeys(record,state)};
}

export function scenarioVisible(record,state){
 const result=scenarioEligibility(record,state);
 if(record.defaultVisible===false){
  const hiddenGateStillOn=(record.scenarioOfficialGateKeys||[]).some(key=>state.gates[key]);
  if(hiddenGateStillOn)return false;
 }
 return !state.onlyEligible||result.eligible;
}

export const SCORE_RULES={missingValue:30,missingProximity:20,noComparableCap:49,min:20,max:99};
export function sitPenalty(record){
 if(Array.isArray(record.why)){const hit=record.why.map(String).find(line=>/sit: *-\d+ *puan/i.test(line));return hit?Number(hit.match(/-(\d+)\s*puan/)[1]):0}
 const sit=String(record.sitStatus||'');return /^3\./i.test(sit)?10:/^2\./i.test(sit)?20:/sit var|tarih/i.test(sit)?25:0;
}

export function scenarioScore(record,state){
 if(state.weights.value===70&&state.weights.proximity===30)return Number(record.score);
 const total=state.weights.value+state.weights.proximity||1;
 const value=record.valueScore==null?SCORE_RULES.missingValue:Number(record.valueScore),proximity=record.proximityScore==null?SCORE_RULES.missingProximity:Number(record.proximityScore);
 const raw=(state.weights.value*value+state.weights.proximity*proximity)/total,low=Math.floor(raw),fraction=raw-low;
 // Python's presentation builder uses round-half-to-even.  Mirror it so the
 // untouched 70/30 scenario is exactly the immutable official score.
 let score=fraction===.5?(low%2===0?low:low+1):Math.round(raw);
 if(record.valueScore==null)score=Math.min(score,SCORE_RULES.noComparableCap);
 score-=sitPenalty(record);
 return Math.max(SCORE_RULES.min,Math.min(SCORE_RULES.max,score));
}

export function scenarioParam(state,meta={}){return JSON.stringify(sanitizeScenario(state,meta))}
