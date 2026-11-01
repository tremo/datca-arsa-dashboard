// Verda's own results laid over the older listing records. The older record stays the base; what Verda has verified since replaces it:
// price, area, parcel, type, route, the elimination (rule, outside the search, taken off Sahibinden) and the score. A listing only Verda
// knows gets a record of its own. Pure functions: no Firebase, no DOM, so the rules can be tried on their own.

const CLOSED=new Set(['removed','outside_search','excluded']);
const GATE={price_over_limit:'overBudget',area_below_minimum:'underMinimumArea',shared_title:'sharedTitle',archaeological_sit:'archaeologicalSit',first_degree_natural_sit:'naturalFirstDegree',no_access:'noDirectAccess',route_over_limit:'route'};
const MISSING={price:'Fiyat',sale_area:'Alan',natural_sit:'Doğal sit',archaeological_sit:'Arkeolojik sit',access:'Kadastral yol',route:'Mertur rotası'};
const PARALLEL={natural_sit:'natural_sit',archaeological_sit:'archaeological_sit',access:'neighbor_access',route:'route'};
const PENALTY_LINE={natural_sit_second_degree:'2. derece doğal sit: -30 puan',natural_sit_third_degree:'3. derece doğal sit: -30 puan',access_existing_easement:'Geçiş hakkı; doğrudan kadastral yol değil: -10 puan'};
const tr=new Intl.NumberFormat('tr-TR',{maximumFractionDigits:1}),mTL=v=>v>=1e6?`₺${new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(v/1e6)} M`:`₺${new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0}).format(v)}`;
const day=v=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleDateString('tr-TR',{day:'numeric',month:'short'}):'';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const fv=(f,k)=>f?.[k]?.value,official=(f,k)=>f?.[k]?.grade==='resmi'&&fv(f,k)!=null;

// Why Verda took a listing out, in the page's own wording; each part is one reason the list can be filtered by.
export function closureReasons(d,r={}){
 if(d.state==='removed')return {keys:['removed'],text:`İlan yayından kalktı · Sahibinden “yayında değildir” diyor${d.removedAt?` (${day(d.removedAt)})`:''}`};
 const keys=d.state==='outside_search'?['route']:(d.decisionReasons||[]).map(x=>GATE[x]).filter(Boolean);
 const part=k=>k==='overBudget'?`Fiyat 15 milyon TL üstü${isNum(r.price)?` (${mTL(r.price)})`:''}`:k==='underMinimumArea'?`Alan 1.000 m² altında${isNum(d.areaM2)?` (${tr.format(d.areaM2)} m²)`:''}`:k==='sharedTitle'?'Hisseli / paylı tapu':k==='archaeologicalSit'?'Arkeolojik sit':k==='naturalFirstDegree'?'1. derece doğal sit':k==='noDirectAccess'?'Kadastral yola cephesi yok; geçiş hakkı da yok':'Mertur’a 45 dakikadan uzak';
 if(!keys.length&&(d.decisionReasons||[]).includes('user_excluded'))return {keys,text:'Sen eledin · panoda “İlgilenmiyorum” dedin'};
 return {keys,text:keys.map(part).join('; ')||'Verda eledi'};
}

// The older system's exclusion for price alone is a fact about one day: when the price is back under the limit and Verda keeps the listing open, it is a candidate again.
const reopenable=(r,d)=>r.lifecycle==='excluded'&&r.closedBy!=='verda'&&r.scenarioOfficialRelaxable!==false&&(r.scenarioOfficialGateKeys||[]).join()==='overBudget'&&isNum(d.priceTl)&&d.priceTl<=15e6;
function reopen(r){
 Object.assign(r,{lifecycle:'verifying',funnelStage:'listingDetail',defaultVisible:true,reason:'',scenarioOfficialGateKeys:[],scenarioFacts:{...(r.scenarioFacts||{}),overBudget:false},priceReopened:true});
}

function close(r,d){
 if(r.lifecycle==='excluded')return;                                  // already out; the older reason stays
 const {keys,text}=closureReasons(d,r),relaxable=d.state==='excluded'&&keys.length>0&&keys.every(k=>['overBudget','underMinimumArea','sharedTitle','archaeologicalSit','naturalFirstDegree','noDirectAccess'].includes(k));
 Object.assign(r,{lifecycle:'excluded',funnelStage:'excluded',recommended:false,reason:text,scenarioOfficialGateKeys:keys,scenarioOfficialRelaxable:relaxable,closedBy:'verda',closedKind:d.state,
  scenarioFacts:{...(r.scenarioFacts||{}),...Object.fromEntries(keys.map(k=>[k,true]))}});
}

// A fact Verda holds, written in the older record's own codes, so the criterion rows say who said it, where and when.
function check(r,kind,{result,role,channel,method,at,claim}){
 r.checks={...(r.checks||{}),[kind]:{...(r.checks?.[kind]||{}),status:'verified',observed_at:at||null,evidence:{verification:{result,source_role:role,source_channel:channel,verification_method:method,observed_at:at||null}}}};
 r.criterionMeta={...(r.criterionMeta||{}),[kind]:{...(r.criterionMeta?.[kind]||{}),claim:claim||null,observedAt:at||null,method,source:null}};
}
const said=f=>f?.quote?`${f.grade==='kullanici'?'Sen':'Satıcı'}: “${String(f.quote).replace(/\s+/g,' ').trim().slice(0,200)}”`:null;
const said_=f=>f?.grade==='beyan'||f?.grade==='kullanici',who=f=>f?.grade==='kullanici'?'user':'seller';
const settled=(r,key)=>/^verified(_by_user_policy)?$/.test(String(r.evidence?.[key]||''));     // an official record already there
const statement=(r,key)=>!/^verified/.test(String(r.evidence?.[key]||''));       // a statement fills a gap; it never replaces a verified record

export function applyFacts(r,f,d={}){
 if(!f)return;r.evidence={...(r.evidence||{})};
 const replaced=official(f,'parcel_key')&&String(fv(f,'parcel_key'))!==String(r.parcel||'').trim();      // the older record is about another number
 if(official(f,'parcel_key')){const key=String(fv(f,'parcel_key'));if(key!==String(r.parcel||'').trim())r.parcel=key;r.evidence.parselKimliği='verified'}
 else if(fv(f,'parcel_key')&&(!r.parcel||r.parcel==='—')){r.parcel=String(fv(f,'parcel_key'));r.evidence.parselKimliği='verified'}
 if(official(f,'parcel_key')&&official(f,'sale_area_m2'))r.evidence.resmîParsel='verified';
 if(official(f,'sale_area_m2'))r.officialArea=fv(f,'sale_area_m2');
 if(official(f,'property_type'))r.officialType=String(fv(f,'property_type'));
 else if(fv(f,'property_type')&&(!r.officialType||r.officialType==='—'))r.officialType=String(fv(f,'property_type'));
 const n=f.natural_sit,a=f.archaeological_sit,access=f.access;
 if(said_(n)&&fv(f,'natural_sit')==='none'&&statement(r,'doğalSit')){r.evidence.doğalSit='verified_by_statement';check(r,'natural_sit',{result:'seller_states_no_natural_sit',role:who(n),channel:'message',method:'seller message',at:n.at,claim:said(n)})}
 if(said_(n)&&/^(second|third)_degree$/.test(fv(f,'natural_sit'))&&!/^[123]\./.test(String(r.sitStatus||''))){r.sitStatus=`${fv(f,'natural_sit')==='second_degree'?2:3}. derece doğal sit`;r.evidence.doğalSit='verified_by_statement';check(r,'natural_sit',{result:'sit_present_type_unknown',role:who(n),channel:'message',method:'seller message',at:n.at,claim:said(n)})}
 if(said_(a)&&fv(f,'archaeological_sit')===false&&statement(r,'arkeolojikSit')){r.evidence.arkeolojikSit='verified_by_statement';check(r,'archaeological_sit',{result:'seller_states_no_archaeological_sit',role:who(a),channel:'message',method:'seller message',at:a.at,claim:said(a)})}
 if(n?.grade==='resmi'&&(replaced||!settled(r,'doğalSit'))&&/^(none|first_degree|second_degree|third_degree)$/.test(fv(f,'natural_sit'))){
  const v=fv(f,'natural_sit'),degree={first_degree:1,second_degree:2,third_degree:3}[v];
  r.evidence.doğalSit='verified';if(replaced)r.sitStatus='';if(degree&&!/^[123]\./.test(String(r.sitStatus||'')))r.sitStatus=`${degree}. derece doğal sit`;
  check(r,'natural_sit',{result:v==='none'?'no_natural_sit':'sit_present',role:'official',channel:'ministry map',method:'says_polygon_overlay',at:n.at,claim:null})}      // the older records' own name for it: the criterion row reads it as an official map result
 const road=fv(f,'access');
 if(road==='direct'&&statement(r,'yolKomşu')){r.evidence.yolKomşu='verified_by_statement';check(r,'neighbor_access',{result:'cadastral_road_claimed',role:access.grade==='kullanici'?'user':'seller',channel:'message',method:'seller message',at:access.at,claim:said(access)})}
 if(road==='existing_easement'&&!r.rightOfWay?.present){r.rightOfWay={status:'claimed',scorePenalty:10,present:true};r.evidence.yolKomşu='verified_by_statement';check(r,'neighbor_access',{result:'right_of_way_claimed',role:access.grade==='kullanici'?'user':'seller',channel:'message',method:'seller message',at:access.at,claim:said(access)})}
 r.v2Road=road==='corridor_conditional'||road==null?String(d.opp?.road||''):'';          // what the TKGM corridor check says, while no statement settles the road
}

// Where a candidate stands, from everything known about it (the older record and what Verda found), not from Verda's list alone: a sit
// check the older system settled from the ministry's map still counts.
const STAGE_ORDER=['listingDetail','parcelIdentity','officialParcel','verification','finalReview'];
const verified=v=>/^verified/.test(String(v||''));
function funnel(r,d){
 const ev=r.evidence||{},area=r.officialArea??r.listingArea,corridor=String(r.v2Road||'');
 const unknown=[];
 if(!isNum(r.price))unknown.push('price');
 if(!isNum(area))unknown.push('sale_area');
 if(!verified(ev.doğalSit))unknown.push('natural_sit');
 if(!verified(ev.arkeolojikSit))unknown.push('archaeological_sit');
 if(!verified(ev.yolKomşu)&&!corridor.startsWith('koşullu')&&!corridor.startsWith('yok'))unknown.push('access');
 if(!isNum(r.routeMax))unknown.push('route');
 const passed=[];
 if(isNum(r.price)&&isNum(area))passed.push('listingDetail');
 if(ev.parselKimliği==='verified')passed.push('parcelIdentity');
 if(ev.resmîParsel==='verified')passed.push('officialParcel');
 const checks=['natural_sit','archaeological_sit','access','route'].every(k=>!unknown.includes(k));
 if(passed.includes('officialParcel')&&checks)passed.push('verification');
 const reviewed=false;                     // the older system's final review is not carried over; Verda's own screening is the verdict
 const stage=STAGE_ORDER.find(k=>!passed.includes(k));
 r.funnelPassed=passed;r.funnelStage=reviewed?r.funnelStage:stage||'finalReview';r.funnelReached=[...new Set([...passed,r.funnelStage])];r.technicalComplete=passed.includes('verification');
 r.parallelMissing=unknown.map(k=>PARALLEL[k]).filter(Boolean);
 if(!reviewed)r.nextStep=!passed.includes('parcelIdentity')?'Ada/parsel kimliğinin netleşmesi bekleniyor':!passed.includes('officialParcel')?'Tapu kaydı (TKGM) bekleniyor':unknown.length&&!passed.includes('verification')?`Eksik: ${unknown.filter(k=>MISSING[k]).map(k=>MISSING[k]).join(', ')}`:'Tarama tamam; senin incelemeni bekliyor';
 const grade=(f,k)=>f?.[k]?.grade==='resmi'?'official':f?.[k]?.grade==='beyan'||f?.[k]?.grade==='kullanici'?'statement':f?.[k]?'provisional':null;
 const f=d.facts||{},next={...(r.evidenceGrades||{})},fill=(key,g)=>{if(g&&(!next[key]||next[key]==='pending'))next[key]=g};
 fill('natural_sit',grade(f,'natural_sit'));fill('archaeological_sit',grade(f,'archaeological_sit'));fill('neighbor_access',grade(f,'access'));
 if(isNum(d.routeMinutesMax))next.route=isNum(d.routeMinutesMin)&&d.routeMinutesMin<=45&&d.routeMinutesMax>45?'conflict':'official';
 for(const [k,key] of [['natural_sit','natural_sit'],['archaeological_sit','archaeological_sit'],['neighbor_access','access'],['route','route']])if(!next[k]&&unknown.includes(key))next[k]='pending';
 r.evidenceGrades=next;
}

// The funnel the "Araştırma adımları" panel draws, counted from the records, so it follows the same data as the list.
const STAGE_LABEL={listingDetail:'İlan ayrıntısı',parcelIdentity:'Ada / parsel',officialParcel:'Tapu kaydı (TKGM)',verification:'Sit · yol · rota',finalReview:'Senin incelemen'};
const CHECKS=[['natural_sit','Doğal sit','natural_sit'],['archaeological_sit','Arkeolojik sit','archaeological_sit'],['neighbor_access','Kadastral yol','neighbor_access'],['route','Mertur rotası','route']];
export function funnelFromRecords(records,old={}){
 const live=records.filter(r=>r.lifecycle!=='excluded'),latest=rs=>rs.map(r=>r.lastActivityAt).filter(Boolean).sort().at(-1)||null;
 const reasons=(rs,labelOf)=>{const by=new Map();for(const r of rs){const label=labelOf(r);if(!label)continue;const g=by.get(label)||{key:label,label,count:0,lastAt:null};g.count++;if(r.lastActivityAt&&(!g.lastAt||r.lastActivityAt>g.lastAt))g.lastAt=r.lastActivityAt;by.set(label,g)}return [...by.values()].sort((a,b)=>b.count-a.count)};
 const stages=STAGE_ORDER.map(key=>{const entered=live.filter(r=>(r.funnelReached||[]).includes(key)),waiting=entered.filter(r=>!(r.funnelPassed||[]).includes(key));return {key,label:STAGE_LABEL[key],entered:entered.length,passed:entered.length-waiting.length,blocked:waiting.length,lastAt:latest(entered),reasons:reasons(waiting,r=>r.nextStep)}});
 const eligible=live.filter(r=>(r.funnelPassed||[]).includes('officialParcel'));
 const parallelChecks=CHECKS.map(([key,label,gradeKey])=>{const pending=eligible.filter(r=>(r.parallelMissing||[]).includes(key)),grades={};for(const r of eligible){const g=r.evidenceGrades?.[gradeKey];if(g)grades[g]=(grades[g]||0)+1}
  return {key,label,eligible:eligible.length,done:eligible.length-pending.length,pending:pending.length,grades,lastAt:latest(pending),reasons:reasons(pending,r=>(r.actions||[]).find(a=>a.field===(key==='neighbor_access'?'access':key))?.label||'Henüz soru gönderilmedi')}});
 return {...old,active:live.length,positive:live.filter(r=>r.recommended).length,reviewed:live.filter(r=>(r.funnelPassed||[]).includes('finalReview')).length,technicallyComplete:live.filter(r=>r.technicalComplete).length,stages,parallelChecks};
}

function override(r,d){
 if(isNum(d.priceTl)&&d.priceTl>0&&d.priceTl!==r.price){if(isNum(r.price))r.priceHistory={...(r.priceHistory||{}),status:'changed',previous:r.price,current:d.priceTl,source:'verda'};r.price=d.priceTl}
 if(isNum(d.areaM2)&&d.areaM2>0&&!r.officialArea&&d.areaM2!==r.listingArea)r.listingArea=d.areaM2;
 const area=r.officialArea??r.listingArea;if(isNum(r.price)&&isNum(area)&&area>0)r.unitPrice=Math.round(r.price/area);
 const otherParcel=d.facts?.parcel_key?.grade==='resmi'&&String(d.facts.parcel_key.value)!==String(r.parcel||'').trim();
 if(d.geometry&&d.centroid&&(!r.geometry||otherParcel)){r.geometry=d.geometry;r.centroid=d.centroid}           // the outline Verda got from TKGM, where the older record has none or draws another parcel
 if(d.links?.tkgm)r.parcelUrl=d.links.tkgm;if(d.links?.listing&&!r.listingUrl)r.listingUrl=d.links.listing;
 if(d.neighborhood&&(!r.neighborhood||r.neighborhood==='—'))r.neighborhood=d.neighborhood;
 if(isNum(d.routeMinutesMax)){r.routeMax=d.routeMinutesMax;r.routeMin=isNum(d.routeMinutesMin)?d.routeMinutesMin:d.routeMinutesMax;r.evidence={...(r.evidence||{}),rota:'verified'}}
}

// The new score replaces the older one as THE score. The penalties it already contains are written the way the page's own arithmetic reads them,
// so a correction made on the page is not subtracted a second time.
function score(r,d){
 const o=d.opp;if(!o||!isNum(o.score))return;
 if(r.legacyScore==null)r.legacyScore=Number.isFinite(Number(r.score))?Number(r.score):null;
 r.legacyDiscount=r.legacyDiscount??r.comparison?.discountPct??null;
 Object.assign(r,{opp:o,score:o.score,scoreSource:'v2',why:Object.keys(d.penalties||{}).map(k=>PENALTY_LINE[k]).filter(Boolean),scoreAdjusted:undefined});
 r.comparison={...(r.comparison||{}),discountPct:o.gapPct??null,median:o.fairUnitPrice??null,label:o.label,fair:true};
}

// The verdict is Verda's too: screening complete (eligible, or conditional with its conditions listed) reads "Koşullu olumlu"; the older review's verdict and risk note are dropped.
function verdict(r,d){r.recommended=d.state==='eligible'||d.state==='conditional';r.reviewOutcome=null;r.reason='';r.published=undefined}

// A listing only Verda knows: a record in the older shape, so every part of the page treats it like any other.
function synthesize(d){
 const f=d.facts||{},id=String(d.listingId);
 return {id,title:d.title||`İlan ${id}`,neighborhood:d.neighborhood||'—',category:'Araştırılıyor',marketType:d.type||null,price:isNum(d.priceTl)?d.priceTl:null,listingArea:isNum(d.areaM2)&&!official(f,'sale_area_m2')?d.areaM2:null,
  officialArea:official(f,'sale_area_m2')?fv(f,'sale_area_m2'):null,officialType:official(f,'property_type')?String(fv(f,'property_type')):d.type||null,parcel:fv(f,'parcel_key')?String(fv(f,'parcel_key')):'—',
  parcelUrl:d.links?.tkgm||null,listingUrl:d.links?.listing||null,lifecycle:'verifying',funnelStage:'listingDetail',funnelPassed:[],funnelReached:[],status:'',nextStep:'',rank:null,score:null,recommended:false,reviewOutcome:null,
  technicalComplete:false,parallelMissing:[],scenarioFacts:Object.fromEntries(['naturalFirstDegree','archaeologicalSit','sharedTitle','noDirectAccess','overBudget','underMinimumArea'].map(k=>[k,false])),
  scenarioOfficialGateKeys:[],scenarioOfficialRelaxable:true,evidence:{},evidenceGrades:{},criterionMeta:{},checks:{},why:[],defaultVisible:true,listedAt:d.publishedAt||null,firstSeenAt:d.discoveredAt||null,lastActivityAt:d.updatedAt||null,
  ownershipScreen:{officiallyVerified:false,status:'assumed_independent',label:'İlanda hisseli ibaresi yok'},rightOfWay:{status:'not_recorded',scorePenalty:0,present:false},roadProof:{images:[],files:[]},photoEvidence:{status:'none',items:[]},
  comparison:null,priceHistory:{status:'single'},sitEvidence:null,sitStatus:'',unitPrice:null,routeMin:null,routeMax:null,contact:null,v2Only:true};
}

// Every overlay document is laid over its record; ids the older data does not have are added. Returns the records that were added.
// Verda found the official parcel far smaller or larger than the land advertised (two title deeds, a wrong parcel number, a share):
// the advertised area is shown and priced, the official one is named, and the listing waits for the user's look.
const areaLine=c=>`Alan uyuşmazlığı: ilan ${tr.format(c.statedM2)} m², TKGM parseli ${tr.format(c.officialM2)} m² (birden çok tapu, yanlış parsel ya da hisse olabilir); senin incelemeni bekliyor`;
function areaInDispute(r,c){
 if(!isNum(c.statedM2)||!isNum(c.officialM2))return;
 r.areaConflict=c;r.officialArea=null;r.listingArea=c.statedM2;
 r.unitPrice=isNum(r.price)&&c.statedM2>0?Math.round(r.price/c.statedM2):null;
}

export function overlay(records,docs){
 const byId=new Map(records.map(r=>[String(r.id),r])),added=[];
 for(const [id,d] of docs){
  let r=byId.get(String(id));
  if(!r){r=synthesize({...d,listingId:id});records.push(r);byId.set(String(id),r);added.push(r)}
  r.v2=d;
  if(Array.isArray(d.actions)&&d.actions.length)r.actions=d.actions;
  if(Array.isArray(d.thread)&&d.thread.length)r.thread=d.thread;
  if(Array.isArray(d.proposals)&&d.proposals.length)r.proposals=d.proposals;
  if(d.contact)r.contact=d.contact;
  if(!r.listedAt&&d.publishedAt)r.listedAt=d.publishedAt;
  if(!r.firstSeenAt&&d.discoveredAt)r.firstSeenAt=d.discoveredAt;
  override(r,d);
  applyFacts(r,d.facts,d);
  if(d.areaConflict)areaInDispute(r,d.areaConflict);
  if(Array.isArray(d.parcels)&&d.parcels.length>1){r.parcel=d.parcels.map(p=>p.parcel).join(' + ');r.saleParcels=d.parcels}   // a sale of several deeds
  if(!CLOSED.has(d.state)&&reopenable(r,d))reopen(r);
  if(CLOSED.has(d.state)){close(r,d);continue}
  if(r.lifecycle!=='excluded'){funnel(r,d);score(r,d);verdict(r,d);if(r.areaConflict)r.nextStep=areaLine(r.areaConflict)}
 }
 rerank(records);
 return added;
}

// Candidates are ranked by the score they now carry; ties keep the older order.
export function rerank(records){
 records.filter(r=>r.lifecycle!=='excluded').sort((a,b)=>(Number.isFinite(Number(b.score))?Number(b.score):-1)-(Number.isFinite(Number(a.score))?Number(a.score):-1)||(a.legacyRank??a.rank??1e9)-(b.legacyRank??b.rank??1e9)).forEach((r,i)=>{if(r.legacyRank==null)r.legacyRank=r.rank;r.rank=i+1});
}
