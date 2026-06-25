/* 知识百科平台 v4 — 双列侧边栏 */
const API={
  async get(url){const r=await fetch(url);return r.json()},
  async post(url,data){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return r.json()},
  async put(url,data){const r=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return r.json()},
  async del(url){const r=await fetch(url,{method:'DELETE'});return r.json()},
  async upload(url,fd){const r=await fetch(url,{method:'POST',body:fd});return r.json()}
};

function toast(msg,type='info'){
  let c=document.querySelector('.toast-container');
  if(!c){c=document.createElement('div');c.className='toast-container';document.body.appendChild(c)}
  const t=document.createElement('div');t.className='toast '+type;t.textContent=msg;c.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

function showConfirm(title,message,onConfirm){
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal" style="max-width:380px">
    <div class="modal-header"><h2>${title}</h2></div>
    <div class="modal-body"><p style="font-size:.88rem;color:var(--color-text-secondary);line-height:1.6">${message}</p></div>
    <div class="modal-footer"><button class="btn" id="cfmCancel">取消</button><button class="btn btn-danger" id="cfmOk">确认删除</button></div>
  </div>`;
  overlay.querySelector('#cfmCancel').onclick=()=>overlay.remove();
  overlay.querySelector('#cfmOk').onclick=()=>{overlay.remove();onConfirm();};
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
  document.body.appendChild(overlay);
}

function showContextMenu(e,callback){
  e.preventDefault();
  document.querySelectorAll('.ctx-menu').forEach(m=>m.remove());
  const menu=document.createElement('div');menu.className='ctx-menu';
  menu.innerHTML=`<button>删除</button>`;
  menu.querySelector('button').onclick=()=>{menu.remove();callback();};
  const x=Math.min(e.clientX,window.innerWidth-120);
  const y=Math.min(e.clientY,window.innerHeight-50);
  menu.style.left=x+'px';menu.style.top=y+'px';
  document.body.appendChild(menu);
  const close=ev=>{if(!menu.contains(ev.target)){menu.remove();document.removeEventListener('click',close);document.removeEventListener('contextmenu',close)}};
  setTimeout(()=>{document.addEventListener('click',close);document.addEventListener('contextmenu',close)},0);
}

/* ── Sidebar ────────────────────────────── */
let currentCardId=null;
let _settingsOpen=false;
let _currentSettingsTab='template';
let _settingsDefault=null;

function toggleSidebar(){
  const s=document.getElementById('sidebar');
  const o=document.getElementById('sidebarOverlay');
  const open=!s.classList.contains('open');
  s.classList.toggle('open',open);
  o.classList.toggle('open',open);
}

function toggleSettingsSidebar(){
  const s=document.getElementById('sidebar');
  const btn=document.getElementById('settingsToggle');
  _settingsOpen=!s.classList.contains('settings-open');
  s.classList.toggle('settings-open',_settingsOpen);
  btn.classList.toggle('active',_settingsOpen);
  if(_settingsOpen)switchSettingsTab(_currentSettingsTab);
}

function switchSettingsTab(tab){
  _currentSettingsTab=tab;
  if(!_settingsOpen){toggleSettingsSidebar();return}
  document.querySelectorAll('.ss-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const body=document.getElementById('sidebarSettingsBody');
  if(!body)return;
  if(tab==='template')loadTemplates();
  if(tab==='image')loadImageManager();
  if(tab==='icon')loadIconPlaceholder();
}

/* ── Card Navigation ────────────────────── */
async function loadCards(){
  const nav=document.getElementById('sidebarNav');
  nav.innerHTML='<div class="empty"><p>加载中...</p></div>';
  const data=await API.get('/api/cards');
  const cards=data.cards||[];
  if(!cards.length){
    nav.innerHTML='<div class="empty"><p>暂无卡片</p><button class="empty-action" onclick="openNewCardModal()">+ 新建卡片</button></div>';
    return;
  }
  const label=_settingsOpen?'<div class="nav-label">知识卡片</div>':'';
  nav.innerHTML=label+cards.map(c=>`
    <div class="sidebar-item${currentCardId===c.id?' active':''}" onclick="selectCard('${c.id}')" oncontextmenu="showContextMenu(event,()=>deleteCard('${c.id}','${c.title.replace(/'/g,"\\'")}'))">
      <span class="si-dot" style="background:${c.accent_color||'#0891b2'}"></span>
      <span class="si-title">${c.title}</span>
      <span class="si-meta">${(c.ai_image_count||0)}/${c.image_count||0}</span>
    </div>
  `).join('');
  if(!currentCardId&&cards.length)selectCard(cards[0].id);
}

function selectCard(id){
  currentCardId=id;
  document.getElementById('cardFrame').src='/card/'+id;
  const iframe=document.getElementById('cardFrame');
  iframe.onload=()=>{if(_displayMode!=='web')resizePptStage(_displayMode)};
  if(window.innerWidth<=768)toggleSidebar();
  loadCards();
  // Refresh image tab if settings open
  if(document.getElementById('sidebar').classList.contains('settings-open')&&_currentSettingsTab==='image'){
    loadCardImages(id);
  }
}

/* ── Display Mode ───────────────────────── */
let _displayMode='web';
const _displayModes=['web','16:9','4:3'];
const _displayLabels={web:'Web','16:9':'16:9','4:3':'4:3'};

function cycleDisplayMode(){
  const idx=_displayModes.indexOf(_displayMode);
  const next=_displayModes[(idx+1)%_displayModes.length];
  setDisplayMode(next);
}

function setDisplayMode(mode){
  _displayMode=mode;
  const btn=document.getElementById('displayModeBtn');
  if(btn)btn.textContent=_displayLabels[mode]||mode;
  const ca=document.getElementById('contentArea');
  const stage=document.querySelector('.ppt-stage');
  const iframe=document.getElementById('cardFrame');
  if(!ca||!stage||!iframe)return;
  ca.classList.remove('web','ppt');
  if(mode==='web'){
    ca.classList.add('web');
    stage.style.cssText='';
    iframe.style.cssText='width:100%;height:100%;border:none';
    iframe.removeAttribute('scrolling');
  }else{
    ca.classList.add('ppt');
    resizePptStage(mode);
  }
  localStorage.setItem('card-display-mode',mode);
}

function resizePptStage(ratio){
  const ca=document.getElementById('contentArea');
  const stage=document.querySelector('.ppt-stage');
  const iframe=document.getElementById('cardFrame');
  if(!ca||!stage||!iframe)return;
  const [w,h]=ratio.split(':').map(Number);
  const targetRatio=w/h;
  const availW=ca.clientWidth;
  const availH=ca.clientHeight;
  const availRatio=availW/availH;
  let stageW,stageH;
  if(availRatio>targetRatio){stageH=availH;stageW=availH*targetRatio}
  else{stageW=availW;stageH=availW/targetRatio}
  const scale=stageW/(w*100);
  const iframeW=w*100;
  const iframeH=h*100;
  stage.style.width=stageW+'px';stage.style.height=stageH+'px';stage.style.overflow='hidden';stage.style.position='relative';
  iframe.style.position='absolute';iframe.style.top='0';iframe.style.left='0';
  iframe.style.width=iframeW+'px';iframe.style.height=iframeH+'px';
  iframe.style.transform='scale('+scale+')';iframe.style.transformOrigin='top left';iframe.style.border='none';
  iframe.setAttribute('scrolling','no');
}

window.addEventListener('resize',()=>{if(_displayMode!=='web')resizePptStage(_displayMode)});

(function(){
  const saved=localStorage.getItem('card-display-mode')||'web';
  _displayMode=saved;
  const btn=document.getElementById('displayModeBtn');
  if(btn)btn.textContent=_displayLabels[saved]||saved;
  setTimeout(()=>setDisplayMode(saved),100);
})();

/* ── New Card Modal ──────────────────────── */
function openNewCardModal(){
  const overlay=document.createElement('div');overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal">
    <div class="modal-header"><h2>新建知识卡片</h2><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
    <div class="modal-body"><label>话题关键词</label><input id="ncTopic" placeholder="例如：量子计算的原理"></div>
    <div class="modal-footer"><button class="btn" onclick="this.closest('.modal-overlay').remove()">取消</button><button class="btn btn-primary" onclick="submitNewCard()">提交</button></div>
  </div>`;
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
  document.body.appendChild(overlay);
}

async function submitNewCard(){
  const topic=document.getElementById('ncTopic')?.value.trim();
  if(!topic){toast('请输入话题','error');return}
  await API.post('/api/generate',{topic});
  toast('已加入生成队列','success');
  document.querySelector('.modal-overlay')?.remove();
}

/* ── Template Tab ────────────────────────── */
let _tplCache=null;
let _selectedTplId=null;

async function loadTemplates(){
  const body=document.getElementById('sidebarSettingsBody');
  if(!body)return;
  const [settings,previewsData]=await Promise.all([API.get('/api/settings'),API.get('/api/previews')]);
  const templates=settings.templates||[{id:'产品介绍',file:'template-产品介绍.html',description:'Apple/Stripe风格'}];
  const previewFiles=previewsData.files||[];
  // Auto-match preview files to templates: name the file 模板id.png
  for(const t of templates){
    if(!t.preview){
      const match=previewFiles.find(f=>f.stem===t.id);
      if(match)t.preview=match.name;
    }
  }
  _tplCache=templates;
  const current=settings.default_template||templates[0].id;
  _selectedTplId=current;
  _settingsDefault=current;

  // Collect tags
  const allTags=[...new Set(templates.flatMap(t=>t.tags||[]))];
  body.innerHTML=`
    ${allTags.length?`<div class="tpl-tags" id="tplTags">
      <button class="tpl-tag active" onclick="filterTemplates('all')" data-tag="all">全部</button>
      ${allTags.map(t=>`<button class="tpl-tag" onclick="filterTemplates('${t}')" data-tag="${t}">${t}</button>`).join('')}
    </div>`:''}
    <div class="tpl-grid" id="tplGrid"></div>
  `;
  renderTplCards(templates,current);
}

function renderTplCards(templates,current){
  const grid=document.getElementById('tplGrid');
  if(!grid)return;
  grid.innerHTML=templates.map(t=>`
    <div class="tpl-card${t.id===_selectedTplId?' selected':''}" onclick="selectTplCard('${t.id}','${t.file||''}')" id="tplCard-${t.id.replace(/[^a-zA-Z0-9一-鿿]/g,'_')}" data-tags="${(t.tags||[]).join(',')}" oncontextmenu="showContextMenu(event,()=>deleteTemplate('${t.id}'))">
      <div class="tpl-card-preview" id="tplPreview-${t.id.replace(/[^a-zA-Z0-9一-鿿]/g,'_')}" onclick="event.stopPropagation();uploadTplPreview('${t.id}')">
        ${t.preview?`<img src="/previews/${t.preview}" alt="${t.id}" loading="lazy">`:`<span class="tpl-no-preview">点击上传预览图<br><span style="font-size:.6rem;opacity:.6">推荐 800×600</span></span>`}
        <div class="tpl-upload-overlay"><span>${t.preview?'替换预览图':'上传预览图'}</span></div>
      </div>
      <div class="tpl-card-info">
        <div class="tpl-card-name">${t.id}</div>
        <div class="tpl-card-desc">${t.description||''}</div>
        ${t.id===current?`<span class="tpl-card-badge">当前默认</span>`:''}
      </div>
    </div>
  `).join('');

  templates.forEach(t=>{}); // previews loaded inline in HTML template
}

function filterTemplates(tag){
  document.querySelectorAll('.tpl-tag').forEach(b=>b.classList.toggle('active',b.dataset.tag===tag));
  document.querySelectorAll('.tpl-card').forEach(card=>{
    if(tag==='all'){card.style.display='';return}
    const tags=(card.dataset.tags||'').split(',').filter(Boolean);
    card.style.display=tags.includes(tag)?'':'none';
  });
}

function deleteCard(id,title){
  showConfirm('删除知识卡片',`确认删除「${title}」？<br><small style="color:var(--color-text-tertiary)">卡片文件夹及所有图片将被彻底删除，不可恢复。</small>`,async()=>{
    await API.del('/api/cards/'+id);
    if(currentCardId===id)currentCardId=null;
    toast('卡片已删除','success');
    loadCards();
  });
}

function deleteTemplate(id){
  showConfirm('删除模板',`确认从列表中移除模板「${id}」？<br><small style="color:var(--color-text-tertiary)">仅从设置中移除，不会删除模板文件。</small>`,async()=>{
    await API.del('/api/template-settings/'+encodeURIComponent(id));
    toast('模板已移除','success');
    loadTemplates();
  });
}

async function uploadTplPreview(id){
  const input=document.createElement('input');input.type='file';input.accept='.png,.jpg,.jpeg,.webp';
  input.onchange=async()=>{
    const file=input.files[0];if(!file)return;
    const fd=new FormData();fd.append('file',file);
    await API.upload('/api/templates/'+encodeURIComponent(id)+'/preview',fd);
    toast('预览图已上传','success');
    loadTemplates();
  };
  input.click();
}

async function selectTplCard(id,file){
  if(id===_settingsDefault)return;
  await API.put('/api/settings',{default_template:id});
  _settingsDefault=id;
  _selectedTplId=id;
  toast('默认模板: '+id,'success');
  const templates=_tplCache||[];
  renderTplCards(templates,_settingsDefault);
}

async function previewTemplateSource(){
  const t=(_tplCache||[]).find(t=>t.id===_selectedTplId)||_tplCache[0];
  if(!t)return;
  try{
    const r=await fetch('/api/templates/'+encodeURIComponent(t.file));
    const html=await r.text();
    const overlay=document.createElement('div');overlay.className='modal-overlay';
    overlay.innerHTML=`<div class="modal" style="max-width:720px"><div class="modal-header"><h2>${t.id} — 源码</h2><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div><div class="modal-body"><div class="code-preview">${html.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div></div>`;
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
    document.body.appendChild(overlay);
  }catch(e){toast('加载模板失败','error')}
}

/* ── Image Tab ──────────────────────────── */
async function loadImageManager(){
  const body=document.getElementById('sidebarSettingsBody');
  if(!body)return;
  if(!currentCardId){
    const data=await API.get('/api/cards');
    const cards=data.cards||[];
    if(cards.length)currentCardId=cards[0].id;
  }
  body.innerHTML=`
    <div class="img-compact">
      <div class="img-toolbar">
        <span class="img-count" id="imgCount">0 张图片</span>
        <button class="img-add-btn" onclick="addImageToCard('${currentCardId}')" title="添加图片">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div id="imgList"></div>
    </div>
  `;
  loadCardImages(currentCardId);
  body.addEventListener('paste', async(e)=>{
    const items=e.clipboardData?.items||[];
    for(const item of items){
      if(item.type.startsWith('image/')){
        e.preventDefault();
        const file=item.getAsFile();
        const fd=new FormData();fd.append('file',file);fd.append('replace_image_id','new_'+Date.now());
        await API.upload('/api/cards/'+currentCardId+'/images/upload',fd);
        toast('图片已粘贴','success');
        loadCardImages(currentCardId);
        return;
      }
    }
  });
}

async function loadCardImages(cardId){
  const list=document.getElementById('imgList');
  if(!list)return;
  list.innerHTML='<div class="empty"><p>加载中...</p></div>';
  const meta=await API.get('/api/cards/'+cardId);
  const images=meta.images||[];
  const cnt=document.getElementById('imgCount');if(cnt)cnt.textContent=images.length+' 张图片';
  if(!images.length){list.innerHTML='<div class="empty"><p>暂无图片</p><button class="empty-action" onclick="addImageToCard(\''+cardId+'\')">+ 上传图片</button></div>';return}
  list.className='img-grid-2';
  list.innerHTML=images.map(img=>{
    const src=img.ai_file?('/card/'+cardId+'/'+img.ai_file):img.original_url;
    const name=img.alt||'未命名';
    return`<div class="img-card-mini" oncontextmenu="showContextMenu(event,()=>deleteImg('${cardId}','${img.id}'))">
      <div class="img-thumb"><img src="${src}" alt="${name}" loading="lazy" onerror="this.style.opacity='0.2'"></div>
      <span class="img-name" data-card="${cardId}" data-img="${img.id}" ondblclick="startImgRename(this)" title="双击编辑名称">${name.replace(/</g,'&lt;')}</span>
    </div>`;
  }).join('');
}

function copyImgUrl(url){
  navigator.clipboard.writeText(url).then(()=>toast('URL已复制','success')).catch(()=>toast('复制失败','error'));
}

function startImgRename(span){
  const cardId=span.dataset.card;
  const imgId=span.dataset.img;
  const oldName=span.textContent;
  const input=document.createElement('input');
  input.className='img-name-input';
  input.value=oldName;
  input.onblur=()=>finishImgRename(input,span,cardId,imgId);
  input.onkeydown=(e)=>{if(e.key==='Enter')input.blur();if(e.key==='Escape'){span.style.display='';input.remove()}};
  span.style.display='none';
  span.parentNode.insertBefore(input,span.nextSibling);
  input.focus();
  input.select();
}

async function finishImgRename(input,span,cardId,imgId){
  const newName=input.value.trim()||span.textContent;
  span.textContent=newName;
  span.style.display='';
  input.remove();
  if(newName!==span.dataset.orig)await API.put('/api/cards/'+cardId+'/images/'+imgId,{alt:newName});
}

async function renameImage(cardId,imgId,newName){
  if(!newName.trim())return;
  await API.put('/api/cards/'+cardId+'/images/'+imgId,{alt:newName.trim()});
}

async function deleteImg(cardId,imgId){
  showConfirm('删除图片','确认删除此图片？<br><small style="color:var(--color-text-tertiary)">文件将被彻底删除，不可恢复。</small>',async()=>{
    await API.del('/api/cards/'+cardId+'/images/'+imgId);
    toast('图片已删除','success');
    loadCardImages(cardId);
    loadCards();
  });
}

async function addImageToCard(cardId){
  const input=document.createElement('input');input.type='file';input.accept='.png,.jpg,.jpeg,.webp';input.multiple=true;
  input.onchange=async()=>{
    for(const file of input.files){
      const fd=new FormData();fd.append('file',file);fd.append('replace_image_id','new_'+Date.now());
      await API.upload('/api/cards/'+cardId+'/images/upload',fd);
    }
    toast('图片已添加','success');
    loadCardImages(cardId);
  };
  input.click();
}

/* ── Icon Tab ──────────────────────────── */
async function loadIconPlaceholder(){
  const body=document.getElementById('sidebarSettingsBody');
  if(!body)return;
  body.innerHTML='<div class="empty"><p>加载中...</p></div>';
  try{
    const data=await API.get('/api/icons');
    const styles=data.styles||[];
    if(!styles.length){body.innerHTML='<div class="empty"><p>暂无图标</p><p style="font-size:.68rem;color:var(--color-text-tertiary)">将 SVG 图标放入 icons/ 文件夹</p></div>';return}
    const labels={'enterprise_3d_blue_svg':'3D 蓝色','solid_glyph_enterprise_ui_svg':'纯色 Glyph','button_icons_svg_only':'按钮图标'};
    let currentStyle=styles[0].style;

    const render=()=>{
      const style=styles.find(s=>s.style===currentStyle)||styles[0];
      const icons=style.icons||[];
      body.innerHTML=`
        <div class="icon-toolbar">
          <div class="icon-style-tabs">
            ${styles.map(s=>`<button class="icon-stab ${s.style===currentStyle?'active':''}" onclick="switchIconStyle('${s.style}')">${labels[s.style]||s.style}<span>${s.icons.length}</span></button>`).join('')}
          </div>
          <span class="icon-count">${icons.length} 个</span>
          <button class="btn-ghost" style="font-size:.68rem;padding:4px 8px" onclick="copyAllIconNames()">复制名称</button>
        </div>
        <div class="icon-grid">
          ${icons.map(icon=>{
            const name=icon.name.replace(/^\d+_/,'');
            return`<div class="icon-card" onclick="copyIconSvg('${icon.file}','${name}')" title="${name}">
              <div class="icon-preview"><img src="/api/icons/${icon.file}" alt="${name}" loading="lazy" onerror="this.style.display='none'"></div>
              <div class="icon-name">${name}</div>
            </div>`;
          }).join('')}
        </div>`;
    };

    window.switchIconStyle=(style)=>{currentStyle=style;render();};
    render();
  }catch(e){body.innerHTML='<div class="empty"><p>加载失败</p></div>'}
}

async function copyIconSvg(file,name){
  try{
    const r=await fetch('/api/icons/'+file);
    const svg=await r.text();
    await navigator.clipboard.writeText(svg);
    toast('已复制 '+name,'success');
  }catch(e){toast('复制失败','error')}
}

function copyAllIconNames(){
  const cards=document.querySelectorAll('.icon-name');
  const names=Array.from(cards).map(c=>c.textContent).join('\n');
  navigator.clipboard.writeText(names).then(()=>toast('已复制','success')).catch(()=>toast('复制失败','error'));
}
