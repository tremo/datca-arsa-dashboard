import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {collection,doc,getDoc,getDocs,getDocsFromCache,getFirestore,initializeFirestore,persistentLocalCache,persistentMultipleTabManager,terminate,clearIndexedDbPersistence,query,where,setDoc,serverTimestamp,deleteField} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
const firebaseConfig={projectId:'datca-arsa',appId:'1:978587692621:web:0cf933d39328b1138d7604',storageBucket:'datca-arsa.firebasestorage.app',apiKey:'AIzaSyClWwdWqDg4ABvgyqkUAkGypFVJ9HJxGgY',authDomain:'datca-arsa.firebaseapp.com',messagingSenderId:'978587692621'};
const app=initializeApp(firebaseConfig),auth=getAuth(app),provider=new GoogleAuthProvider();
// E4: listings are kept in the browser's Firestore cache; they are read from the server again only when a new publish changes meta.generatedAt.
let db;try{db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})})}catch{db=getFirestore(app)}
const STAMP_KEY='datca-listings-stamp';
const readStamp=()=>{try{return localStorage.getItem(STAMP_KEY)||''}catch{return ''}};
const writeStamp=v=>{try{v?localStorage.setItem(STAMP_KEY,v):localStorage.removeItem(STAMP_KEY)}catch{}};
async function loadListings(meta){const q=query(collection(db,'listings'),where('dashboardIncluded','==',true)),stamp=String(meta.generatedAt||'');if(stamp&&readStamp()===stamp){try{const cached=await getDocsFromCache(q);if(cached.size===meta.recordCount)return cached}catch{}}const fresh=await getDocs(q);writeStamp(stamp);return fresh}
provider.setCustomParameters({prompt:'select_account'});
export const $=id=>document.getElementById(id);
export const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const num=v=>v==null?'—':new Intl.NumberFormat('tr-TR',{maximumFractionDigits:1}).format(v);
export const money=v=>v==null?'Fiyat yok':new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(v);
export const date=v=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):'Zaman kaydı yok';
export const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}};
export const link=(url,label,extra='')=>safeUrl(url)?`<a class="button${extra?' '+extra:''}" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:'';
export const labels={official:'Resmî kaynak',statement:'Satıcı / emlakçı beyanı',provisional:'Kendi kuralın / sit sınırında',pending:'Bekliyor',conflict:'Çelişkili'};
export const kindLabels={natural_sit:'Doğal sit',archaeological_sit:'Arkeolojik sit',neighbor_access:'Kadastral yol',route:'Mertur rotası'};
export const stageLabels={listingDetail:'İlan ayrıntısı',parcelIdentity:'Ada / parsel',officialParcel:'Tapu kaydı (TKGM)',verification:'Sit · yol · rota',finalReview:'Final inceleme',complete:'Final sonuçlandı',excluded:'Sistem eledi'};
export const badge=(text,grade='')=>`<span class="badge ${esc(grade)}">${esc(text)}</span>`;
// B11: one status vocabulary and colour for the list, the detail and the map. “Final: olumlu değil” covers every final decision that is not positive.
export const STATUS={active:{label:'Araştırılıyor',color:'#00d7ef'},positive:{label:'Koşullu olumlu',color:'#ffd94a'},held:{label:'Final: olumlu değil',color:'#c38bff'},excluded:{label:'Elendi',color:'#ff5b55',dashed:true}};
export const statusKey=r=>r.lifecycle==='excluded'?'excluded':r.recommended?'positive':r.reviewOutcome==='held'?'held':'active';
export const swatch=key=>`<i class="swatch${STATUS[key].dashed?' is-dashed':''}" style="--swatch:${STATUS[key].color}" aria-hidden="true"></i>`;
// List order: candidates, then final review not positive, then the ones the system eliminated; last the ones Mert eliminated ("İlgilenmiyorum" or a correction).
export const listTier=(r,decision)=>decision==='excluded'||r.userExcluded?3:r.lifecycle==='excluded'?2:statusKey(r)==='held'?1:0;
// ★ kısa liste, ☆ belki: shown before the title wherever a listing is named.
export const decisionMark=d=>d==='shortlist'?'<span class="mark mark-shortlist" role="img" aria-label="Kısa listende" title="Kısa listende">★</span>':d==='maybe'?'<span class="mark mark-maybe" role="img" aria-label="Belki dedin" title="Belki dedin">☆</span>':'';
// When the listing appeared: Sahibinden's listing date if the pipeline has it, otherwise the day the pipeline first saw it.
export const addedAt=r=>r.listedAt||r.firstSeenAt||'';
export const addedLabel=r=>r.listedAt?'İlan tarihi':r.firstSeenAt?'Sisteme girdi':'Eklenme tarihi';
export const dayText=v=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'}):'';
// “Yeni” and “Güncellendi” (seen.js) before the title.
export const seenPill=state=>state==='new'?'<span class="new-pill" title="Bu ilanı henüz açmadın">Yeni</span>':state==='updated'?'<span class="new-pill is-updated" title="Son bakışından sonra yeni bilgi geldi">Güncellendi</span>':'';
export const statusBadge=r=>{const key=statusKey(r);return `<span class="badge status-badge status-${key}">${swatch(key)}${esc(STATUS[key].label)}</span>`};
export const area=r=>r.officialArea??r.listingArea;
// A8: a share sale lists the sold share and the whole parcel separately; m² price follows the share.
export function areaFacts(r){const listing=r.listingArea,official=r.officialArea,shared=r.ownershipScreen?.status==='shared';if(shared&&listing!=null)return {label:'Satılan pay',value:`${num(listing)} m²`,note:official!=null?`parselin tamamı ${num(official)} m²`:'',unit:r.price!=null&&listing?r.price/listing:null,unitNote:'paya göre'};if(listing!=null&&official!=null&&Math.abs(official-listing)/Math.max(listing,1)>.15)return {label:'Alan',value:`${num(official)} m²`,note:`tapuda; ilanda ${num(listing)} m²`,unit:r.unitPrice,unitNote:''};return {label:'Toplam alan',value:`${num(official??listing)} m²`,note:'',unit:r.unitPrice,unitNote:''}}
// Short lines shared by the phone card and the comparison table.
export function comparisonShort(r){const d=r.comparison?.discountPct;return d==null?'emsal yok':Math.abs(d)<5?'emsaline yakın':d>0?`emsalden %${num(d)} ucuz`:`emsalden %${num(-d)} pahalı`}
export function routeShort(r){if(r.routeMax==null)return 'ölçüm bekliyor';const estimate=r.evidence?.rota!=='verified';return `${estimate?'≈ ':''}${num(r.routeMax)} dk${estimate?' (tahmini)':''}`}
// B13: titles typed in capitals are shown in sentence case (place names keep their capital); the original stays in the detail.
const PLACES=['datça','datca','palamutbükü','knidos','yaka','sındı','cumalı','hızırşah','mesudiye','karaköy','kızlan','emecik','reşadiye','iskele','yazı','ovabükü','hayıtbükü','kargı','gebekum','eksera','mersincik','bencik','aktur','ılıca','kurubük','değirmenbükü','marmaris','muğla','bozburun','pınarönü','körmen','pelit','zeytincik','ege','yunan'];
const WORD_FIXES=[['tıny','tiny'],['knıdos','knidos'],['mesudıye','mesudiye'],['ımar','imar'],['ılan','ilan'],['acıl','acil'],['ıdeal','ideal']];
const FRONT='eiöü',VOWELS='eiöüaıou';
// An ASCII capital I in a Turkish word is i or ı depending on the neighbouring vowels.
function lowerWord(w){const chars=[...w];let out='';for(let i=0;i<chars.length;i++){const c=chars[i];if(c!=='I'){out+=c.toLocaleLowerCase('tr');continue}let v=[...out].reverse().find(x=>VOWELS.includes(x));if(!v)v=chars.slice(i+1).map(x=>x.toLocaleLowerCase('tr')).find(x=>VOWELS.includes(x)&&x!=='ı');out+=v&&FRONT.includes(v)?'i':'ı'}return out}
export function readableTitle(t){let s=String(t??'').replace(/\s+/g,' ').trim();if(!s)return '—';const letters=s.replace(/[^\p{L}]/gu,''),upper=letters.replace(/[^A-ZÇĞİÖŞÜ]/g,'');if(letters.length>8&&upper.length/letters.length>.6){s=s.replace(/\p{L}+/gu,w=>{let low=lowerWord(w);for(const [from,to] of WORD_FIXES)if(low.startsWith(from))low=to+low.slice(from.length);const place=PLACES.find(p=>low.startsWith(p)&&low.length-p.length<=4);return place?low[0].toLocaleUpperCase('tr')+low.slice(1):low}).replace(/^\P{L}*\p{L}/u,m=>m.toLocaleUpperCase('tr')).replace(/([!?.]\s+)(\p{L})/gu,(m,a,b)=>a+b.toLocaleUpperCase('tr'))}return s.replace(/(^|\s)(\p{L}+)(\s+\2)+(?=\s|$|[!,.])/giu,'$1$2').replace(/m2(?=$|[^\p{L}\d])/gu,'m²').replace(/\.{3,}/g,'…').replace(/\.\./g,'.').replace(/([!?])\1+/g,'$1')}
export const route=r=>{if(r.routeMax==null&&r.routeKmMax==null)return 'Ölçüm bekliyor';const range=(lo,hi,unit)=>hi==null?null:`${lo!=null&&lo!==hi?num(lo)+'–':''}${num(hi)} ${unit}`;return [range(r.routeMin,r.routeMax,'dk')||'Süre kaydı yok',range(r.routeKmMin,r.routeKmMax,'km')].filter(Boolean).join(' · ')||'Ölçüm bekliyor'};
export function decode(v){if(Array.isArray(v))return v.map(x=>decode(x?.items??x));if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]));return v}
let epoch=0;
export function connect(onLoaded,onReset){
 const message=$('authMessage');
 $('signIn').onclick=async()=>{message.className='';message.textContent='Google giriş penceresi açılıyor…';try{await signInWithPopup(auth,provider)}catch(e){message.className='auth-error';message.textContent=e.code==='auth/popup-blocked'?'Giriş penceresi engellendi. Bu adresi Safari / Chrome’da açıp yeniden dene.':e.code==='auth/popup-closed-by-user'?'Giriş tamamlanmadı. Hazır olduğunda yeniden deneyebilirsin.':'Giriş tamamlanamadı: '+e.code}};
 // Signing out also drops the cached listings from this device.
 $('signOut').onclick=async()=>{try{await signOut(auth)}catch(e){message.textContent='Çıkış yapılamadı: '+e.code;return}writeStamp('');try{await terminate(db);await clearIndexedDbPersistence(db)}catch{}location.reload()};
 async function load(user){const token=++epoch;onReset();$('workspace').hidden=true;$('gate').hidden=false;$('signOut').hidden=!user;$('signIn').hidden=!!user;$('retry').hidden=true;message.className='';
 if(!user){$('gateTitle').textContent='Giriş gerekli';message.textContent='İlanlar ve notların yalnız yetkili Google hesabına açık.';$('source').textContent='Yalnız yetkili hesap';return}
 $('gateTitle').textContent='Veriler yükleniyor…';message.textContent='İlanlar, kanıtlar ve kararların yükleniyor.';
 try{const m=await getDoc(doc(db,'meta','status'));if(!m.exists())throw Error('Kaynak özeti bulunamadı');const meta=decode(m.data());if(meta.schemaVersion!==2)throw Error('Yeni görünümün veri yayını henüz tamamlanmadı');
 const [l,f,seen]=await Promise.all([loadListings(meta),getDocs(collection(db,'listingFeedback')),getDoc(doc(db,'userState','seen')).then(d=>d.exists()&&d.data().items||{}).catch(()=>({}))]);if(token!==epoch||!auth.currentUser)return;
 const records=l.docs.map(d=>decode(d.data()));
 // E7: a publish in progress no longer locks the app; the page opens with a warning instead.
 document.querySelector('.stale-banner')?.remove();if(records.length!==meta.recordCount){writeStamp('');const warn=document.createElement('p');warn.className='stale-banner';warn.setAttribute('role','status');warn.textContent=`Veri yayını sürüyor olabilir: ${meta.recordCount} ilan beklenirken ${records.length} ilan geldi. Birkaç dakika sonra sayfayı yenile.`;$('workspace').prepend(warn)}
 await onLoaded({meta,records,feedback:new Map(f.docs.map(d=>[d.id,d.data()])),seen});if(token!==epoch)return;$('source').textContent=`Veri: ${date(meta.sourceUpdatedAt)} · ${records.length} ilan · son yayın ${date(meta.generatedAt)}`;$('gate').hidden=true;$('workspace').hidden=false;
 }catch(e){if(token!==epoch)return;$('gateTitle').textContent='Veriler yüklenemedi';message.className='auth-error';message.textContent=e.code==='permission-denied'?'Bu hesabın erişim yetkisi yok. Çıkış yapıp yetkili Google hesabıyla giriş yap.':(e.code||e.message);$('retry').hidden=false}}
 $('retry').onclick=()=>load(auth.currentUser);onAuthStateChanged(auth,load);
}
// Corrections live in the same feedback document; a correction set back to "sistemdeki gibi" is deleted from it.
// Only the changed field is written, so a note or decision saved on another device is never overwritten.
export async function saveFacts(id,changes,current={}){if(!auth.currentUser)throw Error('Oturum kapalı');const facts={},local={...(current.userFacts||{})};for(const [key,value] of Object.entries(changes)){if(value){facts[key]={...value,at:serverTimestamp()};local[key]={...value,at:new Date().toISOString()}}else{facts[key]=deleteField();delete local[key]}}const value={listingId:String(id),userFacts:facts,updatedBy:auth.currentUser.email,updatedAt:serverTimestamp()};await setDoc(doc(db,'listingFeedback',String(id)),value,{merge:true});return {...current,...value,userFacts:local,updatedAt:new Date()}}
// Questions for Verda live in the feedback document, one map entry each; Verda writes `answer` and `answeredAt` next to the question.
const isoOf=v=>typeof v?.toDate==='function'?v.toDate().toISOString():v instanceof Date?v.toISOString():typeof v==='string'?v:'';
export const questionsOf=f=>Object.entries(f?.questions||{}).map(([id,q])=>({id,text:String(q?.text||'').trim(),askedAt:isoOf(q?.askedAt),answer:String(q?.answer||'').trim(),answeredAt:isoOf(q?.answeredAt)})).filter(q=>q.text).sort((a,b)=>a.askedAt.localeCompare(b.askedAt)||a.id.localeCompare(b.id));
export async function saveQuestion(id,text,current={}){if(!auth.currentUser)throw Error('Oturum kapalı');const qid=`q${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,by=auth.currentUser.email,value={listingId:String(id),questions:{[qid]:{text,askedAt:serverTimestamp(),askedBy:by}},updatedBy:by,updatedAt:serverTimestamp()};await setDoc(doc(db,'listingFeedback',String(id)),value,{merge:true});return {...current,...value,questions:{...(current.questions||{}),[qid]:{text,askedAt:new Date().toISOString(),askedBy:by}},updatedAt:new Date()}}
// Small per-user settings in userState/{name}, such as the comparison order. A refused read returns null.
export async function loadUserState(name){try{const d=await getDoc(doc(db,'userState',name));return d.exists()?d.data():null}catch{return null}}
export async function saveUserState(name,data){if(!auth.currentUser)return;await setDoc(doc(db,'userState',name),{...data,updatedBy:auth.currentUser.email,updatedAt:serverTimestamp()},{merge:true})}
// The listing whose detail was opened last in this tab; the list and the comparison highlight it.
export const LAST_VIEWED='datca-last-viewed';
export const lastViewed=()=>{try{return sessionStorage.getItem(LAST_VIEWED)||''}catch{return ''}};
export const rememberViewed=id=>{try{sessionStorage.setItem(LAST_VIEWED,String(id))}catch{}};
// Looked-at snapshots (seen.js), one map entry per listing.
export async function saveSeen(entries){if(!auth.currentUser||!entries.length)return;await setDoc(doc(db,'userState','seen'),{items:Object.fromEntries(entries.map(([id,v])=>[String(id),{v,at:serverTimestamp()}])),updatedBy:auth.currentUser.email},{merge:true})}
// One listing's feedback read again, so answers written since the page opened show up.
export async function refreshFeedback(id){const d=await getDoc(doc(db,'listingFeedback',String(id)));return d.exists()?d.data():null}
export async function saveFeedback(id,note,decision){if(!auth.currentUser)throw Error('Oturum kapalı');const value={listingId:String(id),note,decision,updatedBy:auth.currentUser.email,updatedAt:serverTimestamp()};await setDoc(doc(db,'listingFeedback',String(id)),value,{merge:true});return {...value,updatedAt:new Date()}}
const assets=new Map();
export function clearAssets(){assets.clear()}
export async function getAsset(id){if(assets.has(id))return assets.get(id);const d=await getDoc(doc(db,'evidenceAssets',id));if(!d.exists())throw Error('Kanıt görseli bulunamadı');const v=d.data();if(!/^image\/(jpeg|png|webp)$/.test(v.mime))throw Error('Desteklenmeyen görsel');const src=`data:${v.mime};base64,${v.chunks.join('')}`;assets.set(id,src);return src}
