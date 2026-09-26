// What Mert has already looked at. Opening a listing's detail stores a small
// snapshot of the facts that matter; a later publish that changes one of them
// marks the listing “Güncellendi” and names the change. A candidate never
// opened is “Yeni”. Kept in this browser and, when the database rule allows it,
// in userState/seen so the phone and the computer agree.
import {statusKey,STATUS,money,num} from './client.js';
import {criterionModel} from './evidence.js';

const STORE='datca-seen-v1',CRITERIA=['parcel','road','natural','archaeological'];
const CONTACT={'İletişim kuruldu':'satıcıya mesaj gönderildi','Yanıt işlendi':'satıcı yanıtladı'};

export function snapshotOf(r){
 const c=CRITERIA.map(key=>criterionModel(r,key));
 return {s:statusKey(r),p:r.price??null,a:r.officialArea??r.listingArea??null,r:r.routeMax==null?null:Math.round(r.routeMax),cs:c.map(x=>x.state),ct:c.map(x=>x.text),t:r.officialType&&r.officialType!=='—'?r.officialType:null,i:r.parcel&&r.parcel!=='—'?r.parcel:null,f:r.photoEvidence?.items?.length||0,e:r.elevation?.status==='estimated'?Math.round(r.elevation.elevation_m):null,n:r.contact||null};
}

// Plain-language list of what changed between two snapshots. Wording-only changes
// in a criterion (same state) are not counted, so a new panel version does not flag everything.
export function changesBetween(o,n){
 if(!o||!n)return [];const out=[];
 if(o.s!==n.s)out.push(`durum: ${STATUS[o.s]?.label||o.s} → ${STATUS[n.s]?.label||n.s}`);
 if(o.p!==n.p&&n.p!=null)out.push(o.p==null?`fiyat eklendi: ${money(n.p)}`:`fiyat: ${money(o.p)} → ${money(n.p)}`);
 if(o.a!==n.a&&n.a!=null)out.push(o.a==null?`alan eklendi: ${num(n.a)} m²`:`alan: ${num(o.a)} → ${num(n.a)} m²`);
 if(o.r!==n.r&&n.r!=null)out.push(o.r==null?`Mertur süresi eklendi: ${num(n.r)} dk`:`Mertur: ${num(o.r)} → ${num(n.r)} dk`);
 (n.cs||[]).forEach((state,i)=>{const before=o.cs?.[i];if(before!==undefined&&before!==state)out.push(`${n.ct[i]} (önceden: ${String(o.ct?.[i]||'—').replace(/^[^:]+:\s*/,'')})`)});
 if(o.t!==n.t&&n.t)out.push(`nitelik: ${n.t}`);
 if(o.i!==n.i&&n.i)out.push(`ada/parsel: ${n.i}`);
 if(n.f>(o.f||0))out.push(`${n.f-(o.f||0)} yeni fotoğraf`);
 if(o.e==null&&n.e!=null)out.push(`rakım eklendi: ${num(n.e)} m`);
 if(o.n!==n.n&&CONTACT[n.n])out.push(CONTACT[n.n]);
 return out;
}

const iso=v=>typeof v?.toDate==='function'?v.toDate().toISOString():v instanceof Date?v.toISOString():typeof v==='string'?v:'';
export function loadLocalSeen(){try{const v=JSON.parse(localStorage.getItem(STORE)||'{}');return v&&typeof v==='object'?v:{}}catch{return {}}}
export function saveLocalSeen(map){try{localStorage.setItem(STORE,JSON.stringify(map))}catch{}}
// The later look wins, whichever device it came from.
export function mergeSeen(local,remote){
 const out={...local};
 for(const [id,x] of Object.entries(remote||{})){if(!x?.v)continue;const at=iso(x.at);if(!out[id]||at>String(out[id].at||''))out[id]={at,v:x.v}}
 return out;
}

// '' | 'new' | 'updated'. Eliminated listings never opened and the ones Mert dismissed are left alone.
export function seenState(r,seen,decision){
 if(decision==='excluded')return '';
 const x=seen[String(r.id)];
 if(!x)return r.lifecycle==='excluded'?'':'new';
 return changesBetween(x.v,snapshotOf(r)).length?'updated':'';
}
