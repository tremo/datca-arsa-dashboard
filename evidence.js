// Turns the pipeline's evidence codes into plain Turkish: what the evidence says
// (result), who said it and where (source), and when. Presentation only; nothing
// here changes eligibility, scores or the published records.

const KIND={parcel:'official_parcel',road:'neighbor_access',natural:'natural_sit',archaeological:'archaeological_sit'};
const LABEL={parcel:'Tapu kaydı',road:'Kadastral yol',natural:'Doğal sit',archaeological:'Arkeolojik sit'};
const ICON={yes:'✓',no:'✕',penalty:'−',edge:'!',uncertain:'!',unknown:'?',nores:'?',nosrc:'?'};

const ROLE={seller:'Satıcı',seller_or_agent:'İlan sahibi',seller_or_listing_contact:'İlan sahibi',listing_publisher_seller_or_agent:'İlan sahibi',real_estate_agent:'Emlakçı',agent:'Emlakçı',listing_agent:'Emlakçı',listing_publisher_agent:'Emlakçı'};
const RESULT={
 archaeological_sit:{no_archaeological_sit:'no',seller_states_no_archaeological_sit:'no',archaeological_sit_present_a1:'present',sit_present_type_unknown:'typeUnknown',first_degree_sit_type_unknown:'typeUnknown'},
 natural_sit:{no_natural_sit:'no',seller_states_no_natural_sit:'no',sit_present_type_unknown:'typeUnknown',first_degree_sit_type_unknown:'typeUnknown',natural_sit_not_addressed:'notAddressed'},
 neighbor_access:{direct_cadastral_frontage_screening_verified:'cadastral',cadastral_road_claimed:'cadastral',road_claimed:'road',direct_road_claimed:'road',road_frontage_claimed:'road',main_road_adjacent_claim:'road',direct_road_frontage_claim_without_cadastral_qualification:'road',dere_road_only_cadastral_status_unknown:'dere',no_direct_cadastral_road:'none',no_direct_road_frontage:'none',road_statement_unintelligible:'unclear',future_access_claim:'future'}
};

export const isEnglish=t=>!!t&&!/[çğıöşüÇĞİÖŞÜâîû]/.test(t)&&/\b(the|and|an|not|is|of|no|only|does|was|for|with|from|accepted|statement|verified|evidence|parcel|parcels|road|corridor|shares|strip)\b/i.test(t);
const join=(...parts)=>parts.filter(Boolean).join(' · ');
const isPath=v=>/(^|[\s/])(research|Users)\/|\.json\b/.test(String(v||''));
const firstSentence=(t,max=110)=>{const s=String(t||'').replace(/^\?\s*/,'').split(/[.;]\s/)[0].trim();return s.length>max?s.slice(0,max-1).trim()+'…':s};
export const shortDate=v=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleDateString('tr-TR',{day:'numeric',month:'short'}):'';

function verification(r,kind){const ev=r.checks?.[kind]?.evidence;return ev&&!Array.isArray(ev)&&typeof ev==='object'?ev.verification||{}:{}}
function cmeta(r,kind){return r.criterionMeta?.[kind]||{}}
function resultOf(r,kind){const code=verification(r,kind).result;if(!code)return null;const known=RESULT[kind]?.[code];if(known)return known;if(/present/.test(code))return kind==='neighbor_access'?'road':'present';if(/^no_|_no_|absent/.test(code))return kind==='neighbor_access'?'none':'no';return 'unclear'}

function channelLabel(raw){const s=String(raw||'').toLocaleLowerCase('tr');if(!s||isPath(raw))return '';if(/re\/max|website/.test(s))return 'ilan ve emlakçı sitesi';if(/message|mesaj|notification|reply/.test(s))return 'Sahibinden mesajı';if(/listing|ilan|description/.test(s))return 'ilan metni';if(/sahibinden/.test(s))return 'Sahibinden';return ''}
function whoFromMethod(m){const s=String(m||'').toLowerCase();if(/agent/.test(s))return 'Emlakçı';if(/seller/.test(s))return 'Satıcı';if(/publisher|listing/.test(s))return 'İlan sahibi';return ''}
// A long seller message is cut around the words that matter for this criterion.
const FOCUS={archaeological_sit:/sit|arkeoloj/i,natural_sit:/sit|doğal/i,neighbor_access:/yol|cephe|kadastr/i};
function quote(claim,kind){let t=String(claim||'').trim(),who='';if(!t||isEnglish(t)||/^eski yol doğrulaması/i.test(t))return {text:'',who};const m=t.match(/^(satıcı|emlakçı)\s*:\s*['‘’“"](.+)['’”"]\s*$/i);if(m){who=m[1][0].toLocaleUpperCase('tr')+m[1].slice(1).toLocaleLowerCase('tr');t=m[2]}if(t.length<=70)return {text:t,who};const at=t.search(FOCUS[kind]||/$^/),start=at>40?t.lastIndexOf(' ',at-12)+1:0,end=start+68,cut=t.slice(start,end).trim();return {text:`${start?'…':''}${cut}${end<t.length?'…':''}`,who}}

// Where a check's evidence came from: a state map layer, TKGM geometry, or a
// seller / agent statement (who · where · quote · date).
function source(r,kind){
 const v=verification(r,kind),m=cmeta(r,kind),method=String(v.verification_method||m.method||''),at=v.observed_at||m.observedAt;
 if(/says|polygon_overlay/i.test(method))return {label:'Bakanlık sit haritası (SAYS)',at,badge:'Resmî kaynak',tone:'official'};
 if(!v.source_role&&/tkgm|geometry|geojson|corridor|intersection/i.test(method)&&!/statement|agent|seller/i.test(method))return {label:'TKGM parsel haritası',at,badge:'Resmî kaynak',tone:'official'};
 const q=quote(m.claim,kind),any=v.source_role||m.claim||method||v.source_channel||(m.source&&!isPath(m.source));
 const who=ROLE[v.source_role]||q.who||whoFromMethod(method)||(any?'İlan sahibi':'');
 const where=channelLabel(v.source_channel)||channelLabel(m.source)||(/listing/i.test(method)?'ilan metni':/message|reply/i.test(method)?'Sahibinden mesajı':'');
 return {who,where,quote:q.text,at,badge:who==='Satıcı'?'Satıcı beyanı':who==='Emlakçı'?'Emlakçı beyanı':'İlan sahibi beyanı',tone:'statement'};
}
function sourceLine(s){if(s.label)return join(s.label,shortDate(s.at));if(!s.who&&!s.where&&!s.quote)return '';return join(s.who&&s.where?`${s.who}, ${s.where}`:s.who||s.where,s.quote&&`“${s.quote}”`,shortDate(s.at))}

function devFacts(r,kind){const v=verification(r,kind),m=cmeta(r,kind),ch=r.checks?.[kind]||{};return [['Durum kodu',ch.status],['Sonuç kodu',v.result],['Rol',v.source_role],['Kanal',v.source_channel],['Yöntem',v.verification_method||m.method],['Ham iddia',m.claim],['Kaynak',m.source||v.source_reference],['Sınır',m.limitations||v.limitations]].filter(([,value])=>value)}
function model(r,key,state,text,sub,{badge='',tone=''}={}){return {key,label:LABEL[key],state,icon:ICON[state],text,sub,badge,tone,dev:devFacts(r,KIND[key])}}

// The published reason sometimes says why a listing was eliminated while the
// criterion record itself is empty (for example an archived seller disclosure).
function exclusionSays(r,topic){
 if(r.lifecycle!=='excluded')return false;const t=String(r.reason||'');
 if(topic==='archaeological')return /arkeolojik|archaeolog/i.test(t)&&/disclosure|beyan|vardır|\bvar\b|present|\bA[123]\b/i.test(t);
 if(topic==='natural1')return /first-degree[^.;]*natural|1\. derece doğal|first_degree_natural_sit/i.test(t);
 if(topic==='noRoad')return /direct_cadastral_road_absent|no_direct_cadastral_road|explicit_no_direct_cadastral|no cadastral road|frontage criterion not met|frontage is required|not directly fronting|kadastro yolu sorusuna satıcı yol olmadığını|denies direct cadastral/i.test(t);
 return false;
}
function penaltyText(r){const hit=(r.why||[]).map(String).find(w=>/sit: *-\d+ *puan/i.test(w));const n=hit?.match(/-(\d+)\s*puan/);return n?`puan −${n[1]}`:'puan düşülür'}
const typeUnknownSit=r=>{const s=String(r.sitStatus||'');return /sit var|tarih/i.test(s)&&!/^\d\./.test(s)};

function parcelModel(r){
 const raw=String(r.evidence?.resmîParsel||'missing'),m=cmeta(r,'official_parcel');
 if(raw==='verified')return model(r,'parcel','yes','Tapu kaydı: bulundu',join('TKGM parsel sorgusu',r.geometry?'':'sınır yayında yok',shortDate(m.observedAt)),{badge:'Resmî kaynak',tone:'official'});
 if(/conflict|excluded|mismatch/.test(raw))return model(r,'parcel','no','Tapu kaydı: uyuşmuyor',m.claim||m.limitations||'Ada/parsel ya da sınır ilanla uyuşmuyor',{badge:'Çelişkili',tone:'conflict'});
 return model(r,'parcel','unknown','Tapu kaydı: henüz yok',r.evidence?.parselKimliği==='verified'?'Ada/parsel belli; TKGM sorgusu bekleniyor':'Ada/parsel henüz belli değil',{badge:'Bekliyor',tone:'pending'});
}

function roadModel(r){
 const kind='neighbor_access',raw=String(r.evidence?.yolKomşu||'missing'),result=resultOf(r,kind),m=cmeta(r,kind),note=String(r.roadProof?.note||''),src=source(r,kind);
 if(raw.startsWith('excluded')||result==='none')return model(r,'road','no','Kadastral yol: yok · eler',sourceLine(src),{badge:src.badge,tone:'conflict'});
 if(exclusionSays(r,'noRoad'))return model(r,'road','no','Kadastral yol: yok · eler','Eleme nedeninde yazıyor',{badge:'Eleme nedeni',tone:'conflict'});
 if(result==='cadastral')return model(r,'road','yes','Kadastral yol: var',sourceLine(src),{badge:src.badge,tone:src.tone});
 if(result==='road')return model(r,'road','yes','Yol cephesi: var',join(sourceLine(src),'kadastral olduğu ayrıca yazmıyor'),{badge:src.badge,tone:src.tone});
 if(result==='dere')return model(r,'road','yes','Kadastral yol: var sayıldı',join('Kendi kuralın: dere yolu',shortDate(src.at)),{badge:'Kendi kuralın',tone:'provisional'});
 if(result==='unclear')return model(r,'road','nores','Kadastral yol: cevap anlaşılmadı',sourceLine(src),{badge:src.badge,tone:'pending'});
 if(result==='future')return model(r,'road','unknown','Kadastral yol: henüz yok (açılacak yol)',sourceLine(src),{badge:src.badge,tone:'pending'});
 if(raw==='verified_by_user_policy'){const dere=/dere/i.test(`${note} ${m.claim||''} ${m.method||''}`);return model(r,'road','yes','Kadastral yol: var sayıldı',join(dere?'Kendi kuralın: dere yolu':'Kendi kuralın: iki kadastro parseli arası numarasız koridor',shortDate(m.observedAt)),{badge:'Kendi kuralın',tone:'provisional'})}
 if(raw==='verified'){
  // An archive boundary sketch alone does not prove a road; show it as unknown until the pipeline re-checks it.
  if(/^Local official-geometry archive only|does not prove cadastral road/i.test(note))return model(r,'road','unknown','Kadastral yol: bilinmiyor',join('Elde yalnız arşivdeki sınır çizimi var; yol kanıtlanmadı',shortDate(m.observedAt)),{badge:'Kaynak yolu kanıtlamıyor',tone:'pending'});
  if(/teyidi değildir|kanıtı değildir|cephe yok|segmenti yok/i.test(note))return model(r,'road','unknown','Kadastral yol: bilinmiyor',join(`TKGM: ${firstSentence(note)}`,shortDate(m.observedAt)),{badge:'Kaynak yolu kanıtlamıyor',tone:'pending'});
  if(/numaras[ıi]z|unnumbered|koridor|corridor|yol şeridi|strip/i.test(note))return model(r,'road','yes','Kadastral yol: var',join('TKGM parsel haritası: numarasız yol koridoruna cephe',shortDate(m.observedAt)),{badge:'Resmî kaynak',tone:'official'});
  if(src.label||src.who)return model(r,'road','yes','Kadastral yol: var',sourceLine(src),{badge:src.badge,tone:src.tone});
  return model(r,'road','nosrc','Kadastral yol: var görünüyor',join('Kaynak kayıtlı değil',shortDate(m.observedAt)),{badge:'Kaynak kayıtlı değil',tone:'pending'});
 }
 if(raw==='verified_by_statement')return model(r,'road','yes','Kadastral yol: var',sourceLine(src),{badge:src.badge,tone:src.tone});
 const recheck=/^eski yol doğrulaması/i.test(m.claim||'');
 return model(r,'road','unknown','Kadastral yol: bilinmiyor',recheck?'Önceki kayıt kanıtsızdı; yeniden bakılacak':r.evidence?.resmîParsel==='verified'?'Yol kanıtı bekleniyor':'Ada/parsel belli olmadan bakılamıyor',{badge:'Bekliyor',tone:'pending'});
}

function naturalModel(r){
 const kind='natural_sit',raw=String(r.evidence?.doğalSit||'missing'),sit=String(r.sitStatus||''),result=resultOf(r,kind),m=cmeta(r,kind);
 const layer=/says|polygon_overlay/i.test(m.method||'')||/Resmî katman/i.test(r.sitEvidence||'');
 const src=layer?{label:'Bakanlık sit haritası (SAYS)',at:m.observedAt,badge:'Resmî kaynak',tone:'official'}:source(r,kind),line=sourceLine(src);
 if(r.boundaryNote)return model(r,'natural','edge','1. derece doğal sit sınırında',join('Bakanlık sit haritası: parsel sınıra çok yakın ya da küçük bir kısmı içinde; sınırı kontrol et',shortDate(m.observedAt)),{badge:'Sınırda · kontrol et',tone:'provisional'});
 if(/^1\./.test(sit))return model(r,'natural','no','1. derece doğal sit: var · eler',line||'Kaynak kayıtlı değil',{badge:src.badge,tone:'conflict'});
 if(exclusionSays(r,'natural1'))return model(r,'natural','no','1. derece doğal sit: var · eler','Eleme nedeninde yazıyor',{badge:'Eleme nedeni',tone:'conflict'});
 const degree=sit.match(/^([23])\./);
 if(degree)return model(r,'natural','penalty',`${degree[1]}. derece doğal sit: var · ${penaltyText(r)}`,line||'Kaynak kayıtlı değil',{badge:src.badge,tone:src.tone});
 if(typeUnknownSit(r)||result==='typeUnknown')return model(r,'natural','uncertain','Sit var · türü belirsiz',join('Arkeolojik de olabilir; teyit et',line),{badge:'Türü belirsiz',tone:'pending'});
 if(result==='no'||raw==='verified_by_statement')return model(r,'natural','yes','Doğal sit: yok',line,{badge:src.badge,tone:src.tone});
 if(raw==='verified'||/sit yok/i.test(sit))return line?model(r,'natural','yes','Doğal sit: yok',line,{badge:src.badge,tone:src.tone}):model(r,'natural','nosrc','Doğal sit: yok görünüyor',join('Kaynak kayıtlı değil',shortDate(m.observedAt)),{badge:'Kaynak kayıtlı değil',tone:'pending'});
 if(result==='notAddressed')return model(r,'natural','unknown','Doğal sit: bilinmiyor',join('Satıcı cevabı doğal sitten söz etmiyor',line),{badge:'Bekliyor',tone:'pending'});
 return model(r,'natural','unknown','Doğal sit: bilinmiyor','Bakanlık haritası ya da beyan bekleniyor',{badge:'Bekliyor',tone:'pending'});
}

// Short seller replies such as “sit yok” or “A1 var”; anything else stays “sonuç kayıtlı değil”.
function claimOutcome(claim){const t=String(claim||'').toLocaleLowerCase('tr');if(!t||/belli değil|bilinmiyor|bilmiyor|emin değil|sorulacak/.test(t))return null;if(/(^|\s)(yok|yoktur|olmayan|bulunmuyor|bulunmamakta|bulunmamaktadır|değil|değildir|almayan)(?=$|[\s.,;!'’"])/.test(t))return 'no';if(/(^|\s)(var|vardır|mevcut|a1|a2|a3)(?=$|[\s.,;!'’"])|içinde/.test(t))return 'present';return null}

function archaeologicalModel(r){
 const kind='archaeological_sit',raw=String(r.evidence?.arkeolojikSit||'missing'),result=resultOf(r,kind),m=cmeta(r,kind),src=source(r,kind),line=sourceLine(src);
 if(raw.startsWith('excluded')||result==='present'||r.scenarioFacts?.archaeologicalSit===true)return model(r,'archaeological','no','Arkeolojik sit: var · eler',line||'Eleme nedeninde yazıyor',{badge:line?src.badge:'Eleme nedeni',tone:'conflict'});
 if(exclusionSays(r,'archaeological'))return model(r,'archaeological','no','Arkeolojik sit: var · eler','Eleme nedeninde yazıyor',{badge:'Eleme nedeni',tone:'conflict'});
 if(result==='typeUnknown'||typeUnknownSit(r)&&raw==='missing')return model(r,'archaeological','uncertain','Arkeolojik sit: olabilir',join('Sitin türü belirsiz; teyit et',line),{badge:'Türü belirsiz',tone:'pending'});
 if(result==='no')return model(r,'archaeological','yes','Arkeolojik sit: yok',line,{badge:src.badge,tone:src.tone});
 if(raw==='verified_by_statement'){const outcome=claimOutcome(m.claim);if(outcome==='no')return model(r,'archaeological','yes','Arkeolojik sit: yok',line,{badge:src.badge,tone:src.tone});if(outcome==='present')return model(r,'archaeological','no','Arkeolojik sit: var · eler',line,{badge:src.badge,tone:'conflict'});return model(r,'archaeological','nores','Arkeolojik sit: kaynak var, sonuç kayıtlı değil',line,{badge:src.badge,tone:'pending'})}
 if(raw==='verified'){const onlyPath=!line&&isPath(m.source);return model(r,'archaeological','nores',line||onlyPath?'Arkeolojik sit: kaynak var, sonuç kayıtlı değil':'Arkeolojik sit: sonuç kayıtlı değil',line||(onlyPath?join('Kayıtta yalnız bir dosya yolu var',shortDate(m.observedAt)):'Sistem “doğrulandı” diyor, ama kayıtta belge ya da beyan yok'),{badge:'Sonuç kayıtlı değil',tone:'pending'})}
 return model(r,'archaeological','unknown','Arkeolojik sit: bilinmiyor','Karar belgesi ya da satıcı beyanı bekleniyor',{badge:'Bekliyor',tone:'pending'});
}

export function criterionModel(r,key){return key==='parcel'?parcelModel(r):key==='road'?roadModel(r):key==='natural'?naturalModel(r):archaeologicalModel(r)}

// Card-level colour for the doğal sit rule: orange for a 2./3. derece penalty,
// dashed orange when the sit type is unknown or the parcel sits on a 1. derece boundary.
export function sitTone(r){const n=naturalModel(r).state;if(n==='penalty')return 'penalty';return n==='uncertain'||n==='edge'||archaeologicalModel(r).state==='uncertain'?'uncertain':''}

// Badge text per check; the same grade means different things per criterion.
export function gradeLabel(kind,grade){if(grade==='provisional')return kind==='natural_sit'?'Sınırda · kontrol et':'Kendi kuralın';return {official:'Resmî kaynak',statement:'Satıcı / emlakçı beyanı',pending:'Bekliyor',conflict:'Çelişkili'}[grade]||grade}

const CODE={no_direct_cadastral_frontage:'Doğrudan kadastral yol yok',listing_area_under_1000:'1.000 m² altı',listing_area_below_1000_m2:'1.000 m² altı',price_over_15m:'15 M TL üstü',direct_cadastral_road_absent:'Doğrudan kadastral yol yok',no_direct_cadastral_road_frontage:'Doğrudan kadastral yol yok',explicit_no_direct_cadastral_frontage_second_parcel:'Kadastral yola cephesi yok (bir parsel içeride)',shared_title_excluded:'Hisseli tapu',first_degree_natural_sit:'1. derece doğal sit',user_rejected_location_quality:'Konumunu beğenmedin',listing_unavailable:'İlan yayından kalkmış'};
const ROAD_CHECKS={neighbor_parcel_corridor:'komşu parseller arası koridor',physical_road_contact:'fiziksel yola temas',legal_cadastral_road:'hukuki kadastral yol'};
const EN_TR=[
 [/^Sit and cadastral frontage accepted at seller-statement grade, not official legal verification\.?$/i,'Sit ve kadastral yol satıcı beyanıyla kabul edildi; resmî belge değil'],
 [/^Routing stops approximately\s*(\d+)\s*m from parcel\.?$/i,'Rota parsele yaklaşık $1 m kala bitiyor'],
 [/^physical vehicle approach unverified\.?$/i,'araçla yaklaşma doğrulanmadı'],
 [/^Mertur parcel route estimates conflict across 45-minute eligibility threshold: OSRM ([\d.]+) min, Valhalla ([\d.]+) min\.?$/i,'Rota motorları 45 dakika eşiğinin iki yanında: OSRM $1 dk, Valhalla $2 dk'],
 [/^geographic eligibility unresolved, no exclusion on approximate endpoint\.?$/i,'konum uygunluğu netleşmedi; yaklaşık uç noktaya göre elenmedi']
];
const TR_FIX=[[/eski aktarım kanıtsız verified üretmiş\.?/i,'önceki kayıt kanıtsız “doğrulandı” demişti'],[/^Arşiv SAYS /,'Bakanlık sit haritasına göre ']];

// Splits a published reason into readable Turkish parts. Codes and known
// English notes are translated; other English and cut-off fragments are left
// for the collapsed developer section.
function readable(text){
 const parts=[],road=[];let hidden=0;
 for(const seg of [...new Set(String(text||'').split(';').map(s=>s.trim()).filter(Boolean))]){
  if(/^[a-z0-9_]+$/.test(seg)){if(ROAD_CHECKS[seg])road.push(ROAD_CHECKS[seg]);else if(CODE[seg])parts.push(CODE[seg]);else hidden++;continue}
  if(seg.endsWith('…')&&seg.length<20){hidden++;continue}
  const coded=seg.match(/^([a-z0-9_]+):\s*(.+)$/);if(coded){parts.push(`${CODE[coded[1]]||'Not'}: ${coded[2]}`);continue}
  const en=EN_TR.find(([re])=>re.test(seg));if(en){parts.push(seg.replace(en[0],en[1]));continue}
  if(isEnglish(seg)){hidden++;continue}
  parts.push(TR_FIX.reduce((s,[re,to])=>s.replace(re,to),seg));
 }
 if(road.length)parts.push(`Yol için bekleyen kontroller: ${road.join(', ')}`);
 return {parts:[...new Set(parts)],hidden};
}
function englishTopics(text){const t=String(text||''),out=[];if(/archaeolog/i.test(t))out.push('arkeolojik sit');if(/first-degree[^.;]*natural/i.test(t))out.push('1. derece doğal sit');if(/shared[- ]title/i.test(t))out.push('hisseli tapu');if(/cadastral (road|frontage)|frontage|road is \d+|numbered neighbo|no boundary segment remains/i.test(t))out.push('doğrudan kadastral yol yok');if(/45[- ]?min|rout(e|ing) engines|routes exceed|osrm|valhalla/i.test(t))out.push('Mertur’a 45 dakikadan uzak');return out}

const tidy=parts=>parts.map(p=>p.replace(/[.\s]+$/,''));
export function riskText(r){const {parts,hidden}=readable(r.reason);if(!parts.length)return hidden?'Risk notu İngilizce ya da kod; ayrıntı detayda':'';return tidy(parts).join('; ')+(hidden?' · ayrıntının bir kısmı detayda':'')}
export function exclusionText(r){const {parts,hidden}=readable(r.reason);if(parts.length)return tidy(parts).join(' · ')+(hidden?' · ayrıntı detayda':'');const topics=englishTopics(r.reason);if(topics.length)return topics.join(' · ')+' · ayrıntı detayda';return r.reason?'Eleme nedeni İngilizce ya da kod; ayrıntı detayda':'Eleme nedeni kayıtlı değil'}

const NOTE_TR=[[/^Local official-geometry archive only/i,'Elde yalnız yerel arşivdeki sınır çizimi var; kadastral yol, fiziksel yol ya da yasal erişim bununla kanıtlanmaz.'],[/^Failed\/empty query is missing evidence/i,'TKGM sorgusu boş döndü; bu, numarasız yol koridoru olduğu anlamına gelmez.']];
export function roadNoteText(r){const note=String(r.roadProof?.note||'').trim();if(!note)return '';const known=NOTE_TR.find(([re])=>re.test(note));if(known)return known[1];return isEnglish(note)?'Yol notu İngilizce; geliştirici bilgisinde.':note.replace(/^\?\s*/,'')}
