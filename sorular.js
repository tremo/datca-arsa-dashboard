import {$,esc,num,money,link,readableTitle,connect,loadV2Asks,saveAskChoice,saveDecisionOnly} from './client.js';
// The owner's word on each seller question. Nothing is sent to a listing not marked "Sor"; the choice reaches Verda within about fifteen minutes.
const FILTERS=[['undecided','Karar bekleyen',r=>!r.eff&&r.text],['ask','Sor',r=>r.eff==='ask'],['hold','Beklet',r=>r.eff==='hold'],['blocked','Şu an sorulamaz',r=>!r.eff&&!r.text],['all','Hepsi',()=>true]];
const MODE={off:'Mesaj gönderme kapalı: onayladıkların gönderim açılınca sırayla sorulur.',dry_run:'Deneme modu: onayladıkların için taslak hazırlanır, gönderilmez.',live:'Canlı: onayladıkların 08:30–21:00 arasında, aralıklı sorulur.'};
const SENT={confirmed:'gönderildi',dry_run:'deneme yapıldı',prepared:'hazırlandı',sending:'gönderiliyor',delivery_unknown:'teslim belirsiz',cancelled:'iptal'};
const when=v=>{const t=typeof v?.toDate==='function'?v.toDate():v?new Date(v):null;return t&&!Number.isNaN(t.getTime())?t.getTime():0};
let rows=[],feedback=new Map(),filter='undecided',mode='off';
// The newest word wins: a choice saved here after Verda's last publish shows at once; a later one made on the Mac panel or in Telegram wins over an older one from here.
function effective(r){const f=feedback.get(r.listing_id)?.askChoice;return f&&when(f.at)>when(r.chosenAt)?(f.value||null):(r.choice||null)}
function cases(r){const s=r.if_answered;if(!s||!(s.cases||[]).length)return '<p class="dt-note">Yol ve sit zaten biliniyor; cevap puanı değiştirmez.</p>';
 const k=s.cases.map(c=>{const d=c.score-s.now;return `<div class="ask-case"><span>${esc(c.label)}</span><b class="${d>0?'up':d<0?'down':''}">${num(c.score)}</b>${d?`<small>${d>0?'+':'−'}${num(Math.abs(d))}</small>`:''}<small>${esc(c.detail)}</small></div>`}).join('');
 return `<p class="dt-note">Cevap gelince puan (bugün ${num(s.now)}):</p><div class="ask-cases">${k}</div>${(s.eliminates||[]).length?`<p class="ask-out">Elenir: ${esc(s.eliminates.join(' · '))}</p>`:''}`}
function card(r){const best=r.if_answered?.cases?.[0]?.score,tk=r.links?.tkgm,sh=r.links?.sahibinden||`https://www.sahibinden.com/${r.listing_id}`;
 const btn=(c,label)=>`<button type="button" data-id="${esc(r.listing_id)}" data-c="${c}" aria-pressed="${r.eff===c}">${label}</button>`,dec=feedback.get(r.listing_id)?.decision;
 // The same "Kısa listem" / "Belki" as on a listing (listingFeedback.decision); a second press takes it back. They do not decide whether the seller is asked.
 const mark=(d,label,title)=>`<button type="button" class="ask-mark" data-id="${esc(r.listing_id)}" data-d="${d}" aria-pressed="${dec===d}" title="${title}">${label}</button>`;
 return `<details class="st-card ask-card${r.eff?' is-'+r.eff:''}"><summary><span class="ask-score">${num(r.score)}</span><span class="ask-main"><b>${esc(readableTitle(r.title)||'İlan '+r.listing_id)}</b>
 <span class="ask-line"><a href="index.html#ilan=${esc(r.listing_id)}">#${esc(r.listing_id)}</a>${r.parcel?` · ${esc(r.parcel)}`:''} · ${tk?link(tk,'TKGM','ask-link'):'<small>TKGM: parsel yok</small>'} ${link(sh,'Sahibinden','ask-link')}</span>
 <small>${esc([r.neighborhood,r.area_m2?num(r.area_m2)+' m²':null,money(r.price_tl)].filter(Boolean).join(' · '))}</small>
 ${(r.caps||[]).length?`<small class="ask-warn">⚠ ${esc(r.caps.join(' · '))}</small>`:''}
 <small>${r.text?`Sorulacak: ${esc((r.asks_tr||[]).join(', '))}${best!=null?` · iyi cevapla puan ${num(best)}`:''}`:`Sorulamaz: ${esc(r.why_not||'')}`}</small></span>
 <span class="ask-choice">${btn('ask','Sor')}${btn('hold','Beklet')}<button type="button" data-id="${esc(r.listing_id)}" data-c="exclude" title="İlgilenmiyorum: ilan elenir">Ele</button>${mark('shortlist','★ Kısa liste','Kısa listeme ekle')}${mark('maybe','☆ Belki','Belki dedim')}</span></summary>
 <div class="ask-detail">${r.text?`<p class="dt-note">Gönderilecek mesaj:</p><blockquote>${esc(r.text)}</blockquote>`:`<p class="dt-note">Şu an sorulacak bir şey yok: ${esc(r.why_not||'—')}</p>`}${cases(r)}
 ${r.lastMessage?`<p class="dt-note">Son mesaj: ${esc(SENT[r.lastMessage.state]||r.lastMessage.state)} · ${esc(new Date(r.lastMessage.at).toLocaleDateString('tr-TR'))}</p>`:''}</div></details>`}
function draw(){rows.forEach(r=>r.eff=effective(r));const pick=FILTERS.find(f=>f[0]===filter)[2],view=rows.filter(pick);
 $('asksFilters').innerHTML=FILTERS.map(([k,label,f])=>`<button type="button" data-f="${k}" aria-pressed="${k===filter}">${label} <b>${num(rows.filter(f).length)}</b></button>`).join('');
 $('asksBody').innerHTML=view.length?view.map(card).join(''):`<p class="notice">${filter==='undecided'?'Karar bekleyen ilan kalmadı.':'Bu süzgece uyan ilan yok.'}</p>`}
$('asksFilters').onclick=e=>{const b=e.target.closest('button');if(b){filter=b.dataset.f;draw()}};
$('asksBody').onclick=async e=>{const m=e.target.closest('button[data-d]');if(m){e.preventDefault();e.stopPropagation();const id=m.dataset.id,d=m.dataset.d,next=feedback.get(id)?.decision===d?'':d;m.disabled=true;
  try{await saveDecisionOnly(id,next);feedback.set(id,{...(feedback.get(id)||{}),decision:next});draw()}catch(err){m.disabled=false;alert('Kaydedilemedi: '+(err.code||err.message))}return}
 const b=e.target.closest('button[data-c]');if(!b)return;e.preventDefault();const id=b.dataset.id,c=b.dataset.c,r=rows.find(x=>x.listing_id===id);if(!r)return;
 const box=b.parentElement;box.querySelectorAll('button').forEach(x=>x.disabled=true);
 try{if(c==='exclude'){if(!confirm(`#${id} elensin mi? (İlan sayfasından “Kararı kaldır” ile geri alınabilir.)`)){box.querySelectorAll('button').forEach(x=>x.disabled=false);return}await saveDecisionOnly(id,'excluded');rows=rows.filter(x=>x!==r)}
 else{const next=r.eff===c?'':c,saved=await saveAskChoice(id,next);feedback.set(id,{...(feedback.get(id)||{}),askChoice:saved.askChoice})}
 draw()}catch(err){box.querySelectorAll('button').forEach(x=>x.disabled=false);alert(err.code==='permission-denied'?'Kaydedilemedi: Firestore kuralı bu alana henüz izin vermiyor.':'Kaydedilemedi: '+(err.code||err.message))}};
connect(async({feedback:f})=>{feedback=f;const d=await loadV2Asks();if(!d){$('asksBody').innerHTML='<p class="notice">Soru listesi henüz yayınlanmadı. Verda’nın yayıncısı birkaç dakikada bir yazar; sonra yenile.</p>';return}
 rows=d.rows||[];mode=d.senderMode;$('asksMeta').textContent=MODE[mode]||'';draw()},()=>{rows=[];$('asksBody').innerHTML=''});
