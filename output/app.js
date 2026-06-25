/* 知识百科平台 v3 — 公共脚本 */
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

/* ── Sidebar ────────────────────────────── */
let currentCardId=null;

function toggleSidebar(){
  const s=document.getElementById('sidebar');
  const o=document.getElementById('sidebarOverlay');
  const open=!s.classList.contains('open');
  s.classList.toggle('open',open);
  o.classList.toggle('open',open);
}

async function loadCards(){
  const nav=document.getElementById('sidebarNav');
  nav.innerHTML='<div class="skeleton skeleton-text" style="margin:8px 12px"></div><div class="skeleton skeleton-text short" style="margin:8px 12px"></div><div class="skeleton skeleton-text" style="margin:8px 12px"></div>';
  const data=await API.get('/api/cards');
  const cards=data.cards||[];
  if(!cards.length){
    nav.innerHTML='<div class="empty"><div class="empty-icon"><img class="ico ico-lg" src="/api/icons/solid_glyph_enterprise_ui_svg/17_folder.svg" alt=""></div><p style="font-size:.85rem">暂无卡片</p><button class="empty-action" onclick="openNewCardModal()">+ 新建第一张卡片</button></div>';
    return;
  }
  nav.innerHTML=cards.map(c=>`
    <div class="sidebar-item${currentCardId===c.id?' active':''}" onclick="selectCard('${c.id}')">
      <span class="si-dot" style="background:${c.accent_color||'#0891b2'}"></span>
      <span>${c.title}</span>
      <span class="si-meta">${(c.ai_image_count||0)}/${c.image_count||0}</span>
    </div>
  `).join('');
  if(!currentCardId&&cards.length)selectCard(cards[0].id);
}

function selectCard(id){
  currentCardId=id;
  document.getElementById('cardFrame').src='/card/'+id;
  const iframe=document.getElementById('cardFrame');
  iframe.onload=()=>{if(_displayMode!=='web')resizePptStage(_displayMode);};
  // Close mobile sidebar after selection
  if(window.innerWidth<=768)toggleSidebar();
  // Refresh active state
  loadCards();
}

/* ── Display Mode (Web / PPT) ──────────── */
let _displayMode='web';

function setDisplayMode(mode){
  _displayMode=mode;
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
  if(availRatio>targetRatio){
    stageH=availH;
    stageW=availH*targetRatio;
  }else{
    stageW=availW;
    stageH=availW/targetRatio;
  }

  const scale=stageW/(w*100);
  const iframeW=w*100;
  const iframeH=h*100;

  stage.style.width=stageW+'px';
  stage.style.height=stageH+'px';
  stage.style.overflow='hidden';
  stage.style.position='relative';
  iframe.style.position='absolute';
  iframe.style.top='0';
  iframe.style.left='0';
  iframe.style.width=iframeW+'px';
  iframe.style.height=iframeH+'px';
  iframe.style.transform='scale('+scale+')';
  iframe.style.transformOrigin='top left';
  iframe.style.border='none';
  iframe.setAttribute('scrolling','no');
}

window.addEventListener('resize',()=>{
  if(_displayMode!=='web')resizePptStage(_displayMode);
});

// Restore saved mode on load
(function(){
  const saved=localStorage.getItem('card-display-mode')||'web';
  _displayMode=saved;
  const sel=document.getElementById('displayMode');
  if(sel)sel.value=saved;
  setTimeout(()=>setDisplayMode(saved),100);
})();

/* ── New Card Modal ────────────────────── */
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

/* ── Settings Page ─────────────────────── */
async function initSettings(){
  const hash=(location.hash.replace('#','')||'template').split('?')[0];
  document.querySelectorAll('.st-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===hash));
  document.querySelectorAll('.tab-content').forEach(t=>{
    if(t.dataset.tab===hash){
      t.style.display=hash==='template'?'flex':'block';
    }else{
      t.style.display='none';
    }
  });
  if(hash==='template')loadTemplates();
  if(hash==='image')loadImageManager();
  if(hash==='icon')loadIconPlaceholder();
}

function switchTab(tab){
  location.hash=tab;
  initSettings();
}

/* Template tab */
let _tplCache=null;

async function loadTemplates(){
  const container=document.getElementById('templateContent');
  container.innerHTML='<div class="skeleton skeleton-card"></div>';

  const settings=await API.get('/api/settings');
  const templates=settings.templates||[{id:'产品介绍',file:'template-产品介绍.html',description:'Apple/Stripe风格'}];
  _tplCache=templates;
  const current=settings.default_template||'产品介绍';

  container.innerHTML=`
    <div class="tpl-selector">
      <div class="tpl-select-row">
        <select id="tplSelect" onchange="onTemplateChange()">
          ${templates.map(t=>`<option value="${t.id}" ${t.id===current?'selected':''}>${t.id} — ${t.description||''}</option>`).join('')}
        </select>
        <span class="tpl-current-badge" id="tplCurrentBadge">${current===templates.find(t=>t.id===current)?.id?'当前默认：'+current:''}</span>
      </div>
      <div class="tpl-actions">
        <button class="btn btn-sm" onclick="previewTemplateSource(getSelectedTemplate().id,getSelectedTemplate().file)">查看源码</button>
        <button class="btn btn-sm active-btn" id="tplSetDefaultBtn" onclick="setDefaultTemplate(getSelectedTemplate().id)">设为默认</button>
      </div>
    </div>
    <div class="tpl-preview" id="preview-main"></div>
  `;

  updateTplUI(current);
  loadTemplatePreview(current,templates.find(t=>t.id===current)?.file||templates[0].file);
}

function getSelectedTemplate(){
  const sel=document.getElementById('tplSelect');
  const id=sel?.value||'';
  return (_tplCache||[]).find(t=>t.id===id)||_tplCache[0]||{id:'产品介绍',file:'template-产品介绍.html'};
}

function onTemplateChange(){
  const t=getSelectedTemplate();
  const settingsDefault=document.getElementById('tplSetDefaultBtn')?.dataset?.default||'';
  updateTplUI(settingsDefault);
  loadTemplatePreview(t.id,t.file);
}

function updateTplUI(defaultId){
  const t=getSelectedTemplate();
  const badge=document.getElementById('tplCurrentBadge');
  const btn=document.getElementById('tplSetDefaultBtn');
  if(badge)badge.textContent=t.id===defaultId?'当前默认：'+defaultId:'';
  if(btn){
    btn.disabled=t.id===defaultId;
    btn.textContent=t.id===defaultId?'当前默认':'设为默认';
    btn.dataset.default=defaultId;
  }
}

async function loadTemplatePreview(id,file){
  try{
    const r=await fetch('/api/templates/'+encodeURIComponent(file));
    const html=await r.text();
    const filled=html
      .replace(/{{标题}}/g,'示例知识卡片')
      .replace(/{{主题色}}/g,'#0891b2')
      .replace(/{{主题色深}}/g,'#0e7490')
      .replace(/{{浅色背景}}/g,'#e0f2fe')
      .replace(/{{分类标签}}/g,'知识百科')
      .replace(/{{主标题第一行}}/g,'这是标题第一行')
      .replace(/{{主标题第二行}}/g,'标题第二行')
      .replace(/{{主标题高亮}}/g,'高亮关键词')
      .replace(/{{一句话摘要，不超过两行。}}/g,'这是一段示例摘要文字，展示模板中副标题/摘要区域的排版效果。')
      .replace(/{{主图URL}}/g,'')
      .replace(/{{数字1}}/g,'128').replace(/{{标签1}}/g,'统计项一')
      .replace(/{{数字2}}/g,'3.2K').replace(/{{标签2}}/g,'统计项二')
      .replace(/{{数字3}}/g,'2024').replace(/{{标签3}}/g,'统计项三')
      .replace(/{{数字4}}/g,'99%').replace(/{{标签4}}/g,'统计项四')
      .replace(/{{分类1 英文}}/g,'Overview').replace(/{{分类2 英文}}/g,'Details').replace(/{{分类3 英文}}/g,'Analysis')
      .replace(/{{标题第一行}}/g,'这是板块标题').replace(/{{标题第二行}}/g,'副标题展示')
      .replace(/{{段落一。}}/g,'这段正文展示了模板中正文段落的排版效果，包括字号、行距和字体颜色的综合呈现，帮助预览实际内容的视觉效果。')
      .replace(/{{段落二。}}/g,'第二段正文补充更多细节，展示多段落排版时的间距与节奏感。')
      .replace(/{{标签A}}/g,'标签A').replace(/{{标签B}}/g,'标签B')
      .replace(/{{图片URL}}/g,'').replace(/{{图片描述}}/g,'示例图片')
      .replace(/{{引用文}}/g,'这是一段拉出的引用文字，用于在正文中突出某个观点。')
      .replace(/{{卡片区标题}}/g,'关键特点一览').replace(/{{卡片区副标题}}/g,'这里有六个核心优势的详细介绍')
      .replace(/{{分类}}/g,'分类').replace(/{{标题}}/g,'功能名称').replace(/{{描述，一到两行。}}/g,'功能描述文字，展示卡片内容的排版效果。')
      .replace(/{{图标Emoji}}/g,'✦')
      .replace(/{{书籍链接}}/g,'#').replace(/{{书籍封面URL}}/g,'')
      .replace(/{{书名}}/g,'示例书籍名称').replace(/{{作者}}/g,'作者名').replace(/{{出版年份}}/g,'2024')
      .replace(/{{一句话推荐理由。}}/g,'一句话推荐这本书的理由。')
      .replace(/{{文章链接}}/g,'#').replace(/{{文章封面URL}}/g,'')
      .replace(/{{文章标题}}/g,'相关文章标题').replace(/{{来源}}/g,'文章来源').replace(/{{日期}}/g,'2024-06')
      .replace(/{{引用原文}}/g,'"这段引用文字展示了模板中引用区块的排版样式。"')
      .replace(/{{引用来源}}/g,'—— 引用来源名称')
      .replace(/{{URL}}/g,'#').replace(/{{来源名称}}/g,'来源链接')
      .replace(/{{生成日期}}/g,new Date().toISOString().slice(0,10))
      .replace(/\{\{[^}]+\}\}/g,'');
    const el=document.getElementById('preview-main')||document.getElementById('preview-'+id);
    if(el)el.innerHTML=`<iframe srcdoc="${filled.replace(/"/g,'&quot;')}" sandbox="allow-scripts"></iframe>`;
  }catch(e){}
}

async function previewTemplateSource(id,file){
  try{
    const r=await fetch('/api/templates/'+encodeURIComponent(file));
    const html=await r.text();
    const overlay=document.createElement('div');overlay.className='modal-overlay';
    overlay.innerHTML=`<div class="modal" style="max-width:720px"><div class="modal-header"><h2>${id} — 源码</h2><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div><div class="modal-body"><div class="code-preview">${html.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div></div>`;
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
    document.body.appendChild(overlay);
  }catch(e){toast('加载模板失败','error')}
}

async function setDefaultTemplate(id){
  await API.put('/api/settings',{default_template:id});
  toast('默认模板已切换为: '+id,'success');
  updateTplUI(id);
}

/* Image tab */
async function loadImageManager(){
  const container=document.getElementById('imageContent');
  const data=await API.get('/api/cards');
  const cards=data.cards||[];
  let sel=document.getElementById('imgCardSelect')?.value||currentCardId;
  if(!sel&&cards.length)sel=cards[0].id;
  currentCardId=sel;

  container.innerHTML=`<div class="img-selector">
    <select id="imgCardSelect" onchange="currentCardId=this.value;loadImageManager()">
      ${cards.map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${c.title}</option>`).join('')}
    </select>
    <span style="font-size:.85rem;color:var(--color-text-tertiary)">共 ${cards.length} 张卡片</span>
    <button class="btn-ghost" onclick="addImageToCard('${sel}')"><img class="ico" src="/api/icons/solid_glyph_enterprise_ui_svg/33_add_circle.svg" alt=""> 添加图片</button>
  </div>
  <div id="imgGrid"></div>`;
  loadCardImages(sel);
  container.addEventListener('paste', async(e)=>{
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
  const grid=document.getElementById('imgGrid');
  if(!grid)return;
  grid.innerHTML='<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
  const meta=await API.get('/api/cards/'+cardId);
  const images=meta.images||[];
  if(!images.length){grid.innerHTML='<div class="empty"><div class="empty-icon"><img class="ico ico-lg" src="/api/icons/solid_glyph_enterprise_ui_svg/21_eye.svg" alt=""></div><p style="font-size:.85rem">此卡片暂无图片</p><button class="empty-action" onclick="addImageToCard(\''+cardId+'\')">+ 上传图片</button></div>';return}
  grid.className='img-grid';
  grid.innerHTML=images.map((img,i)=>{
    const src=img.ai_file?('/card/'+cardId+'/'+img.ai_file):img.original_url;
    const fname=img.ai_file?img.ai_file.split('/').pop():img.original_url.split('/').pop().split('?')[0];
    return`<div class="img-card">
      <div class="img-preview">
        <img src="${src}" alt="${img.alt}" onerror="this.style.opacity='0.2'" loading="lazy">
      </div>
      <div class="img-info">
        <div class="img-section">${img.section||'未分类'}</div>
        <div class="img-alt">${img.alt||'无描述'}</div>
        <div class="img-fname"><img class="ico" src="/api/icons/solid_glyph_enterprise_ui_svg/18_file.svg" alt=""> ${fname}</div>
        <div class="img-actions">
          <button onclick="copyImgUrl('${src}')"><img class="ico" src="/api/icons/solid_glyph_enterprise_ui_svg/46_link.svg" alt=""> 复制URL</button>
          <button class="danger" onclick="deleteImg('${cardId}','${img.id}')"><img class="ico" src="/api/icons/solid_glyph_enterprise_ui_svg/28_trash.svg" alt=""> 删除</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function copyImgUrl(url){
  navigator.clipboard.writeText(url).then(()=>toast('URL已复制','success')).catch(()=>toast('复制失败','error'));
}

async function deleteImg(cardId,imgId){
  if(!confirm('确认删除此图片？'))return;
  await API.del('/api/cards/'+cardId+'/images/'+imgId);
  toast('图片已删除','success');
  loadCardImages(cardId);
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

/* Icon tab */
async function loadIconPlaceholder(){
  const container=document.getElementById('iconContent');
  container.innerHTML='<div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div>';
  try{
    const data=await API.get('/api/icons');
    const styles=data.styles||[];
    if(!styles.length){container.innerHTML='<div class="empty"><div class="empty-icon"><img class="ico ico-lg" src="/api/icons/solid_glyph_enterprise_ui_svg/15_star.svg" alt=""></div><p>暂无图标</p><p style="font-size:.75rem;color:var(--color-text-tertiary)">将 SVG 图标放入 icons/ 文件夹即可自动识别</p></div>';return}

    const labels={'enterprise_3d_blue_svg':'3D 蓝色','solid_glyph_enterprise_ui_svg':'纯色 Glyph','button_icons_svg_only':'按钮图标'};
    let currentStyle=styles[0].style;

    const render=()=>{
      const style=styles.find(s=>s.style===currentStyle)||styles[0];
      const icons=style.icons||[];
      container.innerHTML=`<div class="icon-toolbar">
        <div class="icon-style-tabs">
          ${styles.map(s=>`<button class="icon-stab ${s.style===currentStyle?'active':''}" onclick="switchIconStyle('${s.style}')">${labels[s.style]||s.style}<span>${s.icons.length}</span></button>`).join('')}
        </div>
        <span class="icon-count">共 ${icons.length} 个图标</span>
        <button class="btn-ghost" onclick="copyAllIconNames()"><img class="ico" src="/api/icons/solid_glyph_enterprise_ui_svg/20_form_list.svg" alt=""> 复制全部名称</button>
      </div>
      <div class="icon-grid">
        ${icons.map(icon=>{
          const name=icon.name.replace(/^\d+_/,'');
          return`<div class="icon-card" onclick="copyIconSvg('${icon.file}','${name}')" title="点击复制 SVG">
            <div class="icon-preview"><img src="/api/icons/${icon.file}" alt="${name}" loading="lazy" onerror="this.style.display='none'"></div>
            <div class="icon-name">${name}</div>
          </div>`;
        }).join('')}
      </div>`;
    };

    window.switchIconStyle=(style)=>{currentStyle=style;render();};
    render();
  }catch(e){container.innerHTML='<div class="empty"><div class="empty-icon"><img class="ico ico-lg" src="/api/icons/solid_glyph_enterprise_ui_svg/15_star.svg" alt=""></div><p>加载失败</p></div>'}
}

async function copyIconSvg(file,name){
  try{
    const r=await fetch('/api/icons/'+file);
    const svg=await r.text();
    await navigator.clipboard.writeText(svg);
    toast('已复制 '+name+' SVG 代码','success');
  }catch(e){toast('复制失败','error')}
}

function copyAllIconNames(){
  const cards=document.querySelectorAll('.icon-name');
  const names=Array.from(cards).map(c=>c.textContent).join('\n');
  navigator.clipboard.writeText(names).then(()=>toast('已复制全部图标名称','success')).catch(()=>toast('复制失败','error'));
}
