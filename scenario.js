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
  custom.push({id:String(raw.id||`${field}-${operator}-${custom.length}`).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48),field,operator,value:parsed});
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

function fieldValue(record,field){return field==='area'?(record.officialArea??record.listingArea):record[field]}
export function customRulePass(record,rule){
 const value=fieldValue(record,rule.field),type=FIELD_TYPES[rule.field];
 if(value==null)return false;
 if(type==='text'){
  const left=String(value).trim().toLocaleLowerCase('tr'),right=String(rule.value).trim().toLocaleLowerCase('tr');
  return rule.operator==='eq'?left===right:left!==right;
 }
 const left=Number(value),right=Number(rule.value);if(!Number.isFinite(left)||!Number.isFinite(right))return false;
 return {lte:left<=right,gte:left>=right,lt:left<right,gt:left>right,eq:left===right,neq:left!==right}[rule.operator]??false;
}

export function scenarioEligibility(record,state){
 const failedGates=gateFailures(record,state),failedRules=state.custom.filter(rule=>!customRulePass(record,rule));
 const officialBlock=record.lifecycle==='excluded'&&!record.scenarioOfficialRelaxable;
 return {eligible:!officialBlock&&!failedGates.length&&!failedRules.length,failedGates,failedRules,officialBlock,relaxed:relaxedGateKeys(record,state)};
}

export function scenarioVisible(record,state){
 const result=scenarioEligibility(record,state);
 if(record.defaultVisible===false){
  const hiddenGateStillOn=(record.scenarioOfficialGateKeys||[]).some(key=>state.gates[key]);
  if(hiddenGateStillOn)return false;
 }
 return !state.onlyEligible||result.eligible;
}

export function scenarioScore(record,state){
 if(state.weights.value===70&&state.weights.proximity===30)return Number(record.score);
 const total=state.weights.value+state.weights.proximity||1;
 const value=record.valueScore==null?30:Number(record.valueScore),proximity=record.proximityScore==null?20:Number(record.proximityScore);
 const raw=(state.weights.value*value+state.weights.proximity*proximity)/total,low=Math.floor(raw),fraction=raw-low;
 // Python's presentation builder uses round-half-to-even.  Mirror it so the
 // untouched 70/30 scenario is exactly the immutable official score.
 let score=fraction===.5?(low%2===0?low:low+1):Math.round(raw);
 if(record.valueScore==null)score=Math.min(score,49);
 const sit=String(record.sitStatus||'');
 score-=(/^3\./i.test(sit)?10:/^2\./i.test(sit)?20:/sit var|tarih/i.test(sit)?25:0);
 return Math.max(20,Math.min(99,score));
}

export function scenarioParam(state,meta={}){return JSON.stringify(sanitizeScenario(state,meta))}
