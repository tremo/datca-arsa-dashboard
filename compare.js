import {$,esc,num,money,readableTitle,connect,statusBadge,safeUrl,areaFacts,comparisonShort,routeShort,decisionMark,seenPill,addedAt,addedLabel,dayText} from './client.js';
import {criterionModel,shortDate} from './evidence.js';
import {effectiveRecords} from './facts.js';
import {loadLocalSeen,mergeSeen,seenState} from './seen.js';

// Every listing marked ⭐ kısa liste or “Belki”, side by side. Rows are listings,
// columns the facts Mert compares; the best value of a column is marked green.
let rows=[],feedback=new Map(),seen={},show='all',sortKey='',sortDir=1;
const brief=(t,max)=>{const s=String(t||'').replace(/\s+/g,' ').trim();return s.length>max?s.slice(0,max-1).trim()+'…':s};
const decisionOf=r=>feedback.get(String(r.id))?.decision;
const noteOf=r=>String(feedback.get(String(r.id))?.note||'').trim();
const areaValue=r=>r.ownershipScreen?.status==='shared'?r.listingArea??null:r.officialArea??r.listingArea??null;
// Criteria sort from settled-and-fine to eliminating.
const STATE_ORDER={yes:0,penalty:1,edge:2,uncertain:2,nosrc:3,nores:3,unknown:4,no:5};
function criterionCell(r,key){const c=criterionModel(r,key);return `<span class="cmp-crit state-${esc(c.state)}${c.user?' is-user':''}" title="${esc(c.sub||'')}"><i aria-hidden="true">${esc(c.icon)}</i>${esc(c.text.replace(/^(Kadastral yol|Doğal sit|Arkeolojik sit|Tapu kaydı):\s*/,''))}</span>`}
function elevationCell(r){const e=r.elevation||{};if(e.status!=='estimated')return '—';return e.min_m!=null&&e.max_m!=null&&e.min_m!==e.max_m?`${num(e.min_m)}–${num(e.max_m)} m`:`${num(e.elevation_m)} m`}
// best: which end of a numeric column is better for a buyer.
const COLUMNS=[
 {key:'price',label:'Fiyat',best:'min',num:true,value:r=>r.price??null,cell:r=>money(r.price)},
 {key:'area',label:'Alan',best:'max',num:true,value:areaValue,cell:r=>{const a=areaFacts(r);return `${esc(a.value)}${a.note?`<small>${esc(a.note)}</small>`:''}`}},
 {key:'unit',label:'m² fiyatı',best:'min',num:true,value:r=>areaFacts(r).unit??null,cell:r=>{const a=areaFacts(r);return a.unit==null?'—':`${money(a.unit)}${a.unitNote?`<small>${esc(a.unitNote)}</small>`:''}`}},
 {key:'discount',label:'Emsale göre',best:'max',value:r=>r.comparison?.discountPct??null,cell:r=>esc(comparisonShort(r))},
 {key:'type',label:'Nitelik',value:r=>r.officialType&&r.officialType!=='—'?r.officialType:null,cell:r=>esc(r.officialType&&r.officialType!=='—'?r.officialType:'—')},
 {key:'route',label:'Mertur’a',best:'min',num:true,value:r=>r.routeMax??null,cell:r=>`${esc(routeShort(r))}${r.routeKmMax!=null?`<small>${num(r.routeKmMax)} km</small>`:''}`},
 {key:'road',label:'Kadastral yol',value:r=>STATE_ORDER[criterionModel(r,'road').state]??4,cell:r=>criterionCell(r,'road')},
 {key:'natural',label:'Doğal sit',value:r=>STATE_ORDER[criterionModel(r,'natural').state]??4,cell:r=>criterionCell(r,'natural')},
 {key:'archaeological',label:'Arkeolojik sit',value:r=>STATE_ORDER[criterionModel(r,'archaeological').state]??4,cell:r=>criterionCell(r,'archaeological')},
 {key:'parcel',label:'Tapu kaydı',value:r=>STATE_ORDER[criterionModel(r,'parcel').state]??4,cell:r=>criterionCell(r,'parcel')},
 {key:'elevation',label:'Rakım',num:true,value:r=>r.elevation?.status==='estimated'?r.elevation.elevation_m:null,cell:elevationCell},
 {key:'score',label:'Puan',best:'max',num:true,value:r=>r.lifecycle==='excluded'?null:Number(r.score),cell:r=>r.lifecycle==='excluded'?'Puan dışı':num(r.score)},
 {key:'added',label:'Eklendi',value:r=>Date.parse(addedAt(r))||null,cell:r=>addedAt(r)?`<span title="${esc(addedLabel(r))}: ${esc(dayText(addedAt(r)))}">${esc(shortDate(addedAt(r)))}</span>`:'—'},
 {key:'note',label:'Notun',value:r=>noteOf(r)||null,cell:r=>noteOf(r)?esc(brief(noteOf(r),90)):'—'},
];
const DEFAULT_ORDER=(a,b)=>(decisionOf(a)==='shortlist'?0:1)-(decisionOf(b)==='shortlist'?0:1)||(a.lifecycle==='excluded')-(b.lifecycle==='excluded')||(a.rank??Infinity)-(b.rank??Infinity);
function sorted(list){
 const col=COLUMNS.find(c=>c.key===sortKey);if(!col)return list.slice().sort(DEFAULT_ORDER);
 // Unknown values stay at the bottom in both directions.
 return list.slice().sort((a,b)=>{const x=col.value(a),y=col.value(b);if(x==null||y==null)return (x==null)-(y==null)||DEFAULT_ORDER(a,b);return (typeof x==='string'?x.localeCompare(y,'tr'):x-y)*sortDir||DEFAULT_ORDER(a,b)});
}
// The best value per column, only when at least two listings can be compared and they differ.
function bests(list){const out={};for(const col of COLUMNS.filter(c=>c.best)){const values=list.map(col.value).filter(v=>v!=null&&Number.isFinite(v));if(values.length<2||Math.min(...values)===Math.max(...values))continue;out[col.key]=col.best==='min'?Math.min(...values):Math.max(...values)}return out}
function titleCell(r){
 const id=String(r.id),url=safeUrl(r.listingUrl),place=[r.neighborhood,r.parcel].filter(x=>x&&x!=='—').join(' · ')||'ada/parsel bilinmiyor';
 return `<th scope="row"><a class="cmp-title" href="index.html#ilan=${encodeURIComponent(id)}">${decisionMark(decisionOf(r))}${seenPill(seenState(r,seen,decisionOf(r)))}${esc(brief(readableTitle(r.title),72))}</a><small>${esc(place)} · #${esc(id)}</small><span class="cmp-meta">${statusBadge(r)}${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Sahibinden ↗</a>`:''}</span></th>`;
}
function render(){
 const counts={all:rows.length,shortlist:rows.filter(r=>decisionOf(r)==='shortlist').length,maybe:rows.filter(r=>decisionOf(r)==='maybe').length};
 $('compareChips').innerHTML=[['all','Hepsi'],['shortlist','★ Kısa liste'],['maybe','☆ Belki']].map(([key,label])=>`<button type="button" data-show="${key}" aria-pressed="${show===key}">${esc(label)} <b>${num(counts[key])}</b></button>`).join('');
 const list=sorted(rows.filter(r=>show==='all'||decisionOf(r)===show)),best=bests(list);
 $('compareCount').textContent=list.length?`${num(list.length)} ilan yan yana`:'';
 if(!rows.length){$('compareTable').innerHTML='<div class="empty"><h3>Karşılaştıracak ilan yok</h3><p>İlanlar sayfasında bir ilanın detayını açıp “⭐ Kısa liste” ya da “Belki” de; burada yan yana görünür.</p><a class="button" href="index.html">İlanlara git</a></div>';return}
 const head=`<thead><tr><th scope="col">İlan</th>${COLUMNS.map(c=>`<th scope="col"${sortKey===c.key?` aria-sort="${sortDir>0?'ascending':'descending'}"`:''}${c.num?' class="num"':''}><button type="button" data-sort="${c.key}">${esc(c.label)}${sortKey===c.key?`<span aria-hidden="true">${sortDir>0?' ↑':' ↓'}</span>`:''}</button></th>`).join('')}</tr></thead>`;
 const body=list.map(r=>`<tr class="${r.lifecycle==='excluded'?'is-excluded':''}">${titleCell(r)}${COLUMNS.map(c=>{const v=c.value(r),isBest=best[c.key]!=null&&v===best[c.key];return `<td class="${[c.num?'num':'',isBest?'is-best':''].filter(Boolean).join(' ')}"${isBest?' title="Bu sütunun en iyisi"':''}>${c.cell(r)}</td>`}).join('')}</tr>`).join('');
 $('compareTable').innerHTML=`<table class="compare">${head}<tbody>${body}</tbody></table>`;
}
$('compareChips').onclick=e=>{const b=e.target.closest('[data-show]');if(!b)return;show=b.dataset.show;render()};
// First tap sorts best-first where a column has a better end; a second tap reverses.
$('compareTable').addEventListener('click',e=>{const b=e.target.closest('[data-sort]');if(!b)return;const col=COLUMNS.find(c=>c.key===b.dataset.sort);if(sortKey===col.key)sortDir=-sortDir;else{sortKey=col.key;sortDir=col.best==='max'?-1:1}render();$('compareTable').querySelector(`[data-sort="${col.key}"]`)?.focus()});
connect(({records,feedback:f,seen:remoteSeen})=>{feedback=f;seen=mergeSeen(loadLocalSeen(),remoteSeen);rows=effectiveRecords(records,f).filter(r=>['shortlist','maybe'].includes(decisionOf(r)));render()},()=>{rows=[];feedback=new Map();seen={};$('compareTable').replaceChildren();$('compareChips').replaceChildren()});
