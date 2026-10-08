// Mert's own corrections to the pipeline's findings (listingFeedback/{id}.userFacts).
// The panel lays them over the published record at once; the pipeline reads the
// same fields on its next run and makes them part of the record.
import {formulaScore,scorePenalty,SCORE_RULES} from './scenario.js';

// `gate` is the elimination rule a value decides; `fail` is the value that eliminates the listing.
export const FACTS={
 road:{label:'Kadastral yol',gate:'noDirectAccess',fail:'none',options:[['cadastral','Kadastral yola cephesi var'],['rightOfWay','Geçiş hakkıyla giriliyor · puan −10'],['none','Kadastral yolu yok · eler']]},
 natural:{label:'Doğal sit',gate:'naturalFirstDegree',fail:'1',options:[['none','Doğal sit yok'],['3','3. derece doğal sit · puan −30'],['2','2. derece doğal sit · puan −30'],['1','1. derece doğal sit · eler']]},
 archaeological:{label:'Arkeolojik sit',gate:'archaeologicalSit',fail:'present',options:[['none','Arkeolojik sit yok'],['present','Arkeolojik sit var · eler']]},
 sharedTitle:{label:'Hisseli tapu',gate:'sharedTitle',fail:'yes',options:[['no','Hisseli değil; parselin tamamı satılıyor'],['yes','Hisseli / paylı tapu · eler']]}
};
export const BASIS=[['site','Yerinde gördüm'],['seller','Satıcı ya da emlakçı söyledi'],['official','Resmî belgede gördüm (tapu, e-Devlet, belediye)'],['map','Haritadan baktım']];
const USER_REASON={noDirectAccess:'kadastral yolu yok',naturalFirstDegree:'1. derece doğal sit',archaeologicalSit:'arkeolojik sit',sharedTitle:'hisseli tapu'};
// The pipeline's penalties (2./3. derece doğal sit, right of way); a published line keeps its own number.
const SIT_PENALTY=30,RIGHT_OF_WAY_PENALTY=10;
const penaltyIn=(why,re)=>Number(why.map(w=>w.match(re)?.[1]).find(Boolean))||0;

const when=v=>typeof v?.toDate==='function'?v.toDate().toISOString():v instanceof Date?v.toISOString():typeof v==='string'?v:'';
const basisOf=v=>BASIS.some(([key])=>key===v)?v:'';
const noteOf=v=>typeof v==='string'?v.trim().slice(0,500):'';
// Only known keys and values are used; anything else in the document is ignored.
export function sanitizeFacts(raw){
 const out={};if(!raw||typeof raw!=='object')return out;
 for(const [key,def] of Object.entries(FACTS)){const f=raw[key],value=String(f?.value??'');if(def.options.some(([v])=>v===value))out[key]={value,basis:basisOf(f.basis),note:noteOf(f.note),at:when(f.at)}}
 const p=raw.parcelId,ada=String(p?.ada??'').trim(),parsel=String(p?.parsel??'').trim();
 if(/^\d{1,6}$/.test(ada)&&/^\d{1,6}$/.test(parsel))out.parcelId={ada,parsel,basis:basisOf(p.basis),note:noteOf(p.note),at:when(p.at)};
 return out;
}

// A listing under a 2. or 3. derece doğal sit loses 30 points. The pipeline writes that into `why` and into the score; if an
// older publish left it out, the penalty is applied here and the record says so, so such a listing never shows a clean score.
const SIT_PENALTY_LINE=/doğal sit\s*:\s*-\s*\d+/i,SIT_DEGREE=/^[23]\. derece doğal sit/i;
export function withSitPenalty(r){
 if(r.lifecycle==='excluded'||!SIT_DEGREE.test(String(r.sitStatus||''))||!Array.isArray(r.why)||!Number.isFinite(Number(r.score)))return r;
 if(r.why.some(w=>SIT_PENALTY_LINE.test(String(w))))return r;
 return {...r,score:Math.max(0,Number(r.score)-SIT_PENALTY),scoreAdjusted:SIT_PENALTY,why:[`${r.sitStatus}: -${SIT_PENALTY} puan`,...r.why].slice(0,3)};
}

// The record as the panel shows it: gates, penalties, score and status follow the corrections.
// `published` keeps the pipeline's record for the "sistemde" lines.
export function applyFacts(r,raw){
 const facts=sanitizeFacts(raw);if(!Object.keys(facts).length)return r;
 const e={...r,published:r,userFacts:facts,scenarioFacts:{...r.scenarioFacts}},passed=[],failed=[];
 for(const [key,def] of Object.entries(FACTS)){const f=facts[key];if(!f)continue;const fails=f.value===def.fail;e.scenarioFacts[def.gate]=fails;(fails?failed:passed).push(def.gate)}
 if(Array.isArray(r.why)){
  let why=r.why.map(String);
  if(facts.road){const n=penaltyIn(why,/geçiş hakkı[^:]*:\s*-\s*(\d+)/i);why=why.filter(w=>!/geçiş hakkı/i.test(w));if(facts.road.value==='rightOfWay')why.push(`Geçiş hakkı; doğrudan kadastral yol değil: -${n||Number(r.rightOfWay?.scorePenalty)||RIGHT_OF_WAY_PENALTY} puan`)}
  if(facts.natural){const n=penaltyIn(why,/doğal sit\s*:\s*-\s*(\d+)/i);why=why.filter(w=>!/doğal sit\s*:/i.test(w));if(['2','3'].includes(facts.natural.value))why.push(`${facts.natural.value}. derece doğal sit: -${n||SIT_PENALTY} puan`)}
  e.why=why;
 }
 if(facts.natural&&facts.natural.value!=='none')e.sitStatus=`${facts.natural.value}. derece doğal sit`;
 if(facts.sharedTitle)e.ownershipScreen={...r.ownershipScreen,status:facts.sharedTitle.value==='yes'?'shared':'independent_by_user',label:facts.sharedTitle.value==='yes'?'Hisseli · senin düzeltmen':'Hisseli değil · senin düzeltmen'};
 if(facts.parcelId){const id=`${facts.parcelId.ada}/${facts.parcelId.parsel}`;e.parcel=id;if(r.lifecycle!=='excluded'&&r.funnelStage==='parcelIdentity')e.nextStep=`Ada/parsel ${id} senin girdiğin; veri hattı TKGM’de sorgulayacak`}
 const keys=r.scenarioOfficialGateKeys||[],wasOut=r.lifecycle==='excluded',remaining=keys.filter(k=>!passed.includes(k));
 if(wasOut)e.userCleared=keys.filter(k=>passed.includes(k));
 if(failed.length){
  e.userExcluded=true;e.lifecycle='excluded';e.funnelStage='excluded';e.recommended=false;
  e.scenarioOfficialGateKeys=[...new Set([...(wasOut?remaining:[]),...failed])];
  e.scenarioOfficialRelaxable=wasOut?r.scenarioOfficialRelaxable!==false:true;
  e.reason=[`Senin düzeltmen: ${failed.map(g=>USER_REASON[g]).join(', ')}`,wasOut&&remaining.length?r.reason:''].filter(Boolean).join('; ');
 }else if(wasOut&&e.userCleared.length){
  e.scenarioOfficialGateKeys=remaining;
  // Every recorded reason is corrected and the pipeline marked the exclusion as gate-only: the listing is a candidate again.
  if(keys.length&&!remaining.length&&r.scenarioOfficialRelaxable!==false){e.userReopened=true;e.lifecycle='verifying';e.funnelStage='listingDetail';e.defaultVisible=true;e.reason='';e.nextStep='Senin düzeltmenle yeniden aday; veri hattı araştırmayı yeniden başlatacak'}
 }
 // An eliminated listing's published score is not a ranking score; a reopened one gets the formula's.
 const before=scorePenalty(r),after=scorePenalty(e),published=Number(r.score);
 if(e.userReopened)e.score=formulaScore(e);
 else if(before!==after&&Number.isFinite(published))e.score=formulaScore(r)===published?formulaScore(e):Math.max(0,Math.min(SCORE_RULES.max,published+before-after));
 return e;
}

// All records with the corrections applied. Candidates are ranked by score, so a
// correction that changes a score or brings a listing back moves it to its place.
export function effectiveRecords(records,feedback){
 let changed=false;
 const out=records.map(r=>{const base=withSitPenalty(r),e=applyFacts(base,feedback.get(String(r.id))?.userFacts);if(e!==r)changed=true;return e});
 if(!changed)return out;
 const order=out.map((r,i)=>[r,i]).filter(([r])=>r.lifecycle!=='excluded').sort(([a],[b])=>(Number(b.score)||0)-(Number(a.score)||0)||(a.rank??Infinity)-(b.rank??Infinity));
 order.forEach(([r,i],n)=>{if(r.rank!==n+1)out[i]={...r,rank:n+1}});
 return out;
}
