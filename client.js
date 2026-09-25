import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {collection,doc,getDoc,getDocs,getDocsFromCache,getFirestore,initializeFirestore,persistentLocalCache,persistentMultipleTabManager,terminate,clearIndexedDbPersistence,query,where,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';
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
export const statusBadge=r=>{const key=statusKey(r);return `<span class="badge status-badge status-${key}">${swatch(key)}${esc(STATUS[key].label)}</span>`};
export const area=r=>r.officialArea??r.listingArea;
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
 const [l,f]=await Promise.all([loadListings(meta),getDocs(collection(db,'listingFeedback'))]);if(token!==epoch||!auth.currentUser)return;
 const records=l.docs.map(d=>decode(d.data()));
 // E7: a publish in progress no longer locks the app; the page opens with a warning instead.
 document.querySelector('.stale-banner')?.remove();if(records.length!==meta.recordCount){writeStamp('');const warn=document.createElement('p');warn.className='stale-banner';warn.setAttribute('role','status');warn.textContent=`Veri yayını sürüyor olabilir: ${meta.recordCount} ilan beklenirken ${records.length} ilan geldi. Birkaç dakika sonra sayfayı yenile.`;$('workspace').prepend(warn)}
 await onLoaded({meta,records,feedback:new Map(f.docs.map(d=>[d.id,d.data()]))});if(token!==epoch)return;$('source').textContent=`Veri: ${date(meta.sourceUpdatedAt)} · ${records.length} ilan · son yayın ${date(meta.generatedAt)}`;$('gate').hidden=true;$('workspace').hidden=false;
 }catch(e){if(token!==epoch)return;$('gateTitle').textContent='Veriler yüklenemedi';message.className='auth-error';message.textContent=e.code==='permission-denied'?'Bu hesabın erişim yetkisi yok. Çıkış yapıp yetkili Google hesabıyla giriş yap.':(e.code||e.message);$('retry').hidden=false}}
 $('retry').onclick=()=>load(auth.currentUser);onAuthStateChanged(auth,load);
}
export async function saveFeedback(id,note,decision){if(!auth.currentUser)throw Error('Oturum kapalı');const value={listingId:String(id),note,decision,updatedBy:auth.currentUser.email,updatedAt:serverTimestamp()};await setDoc(doc(db,'listingFeedback',String(id)),value,{merge:true});return {...value,updatedAt:new Date()}}
const assets=new Map();
export function clearAssets(){assets.clear()}
export async function getAsset(id){if(assets.has(id))return assets.get(id);const d=await getDoc(doc(db,'evidenceAssets',id));if(!d.exists())throw Error('Kanıt görseli bulunamadı');const v=d.data();if(!/^image\/(jpeg|png|webp)$/.test(v.mime))throw Error('Desteklenmeyen görsel');const src=`data:${v.mime};base64,${v.chunks.join('')}`;assets.set(id,src);return src}
