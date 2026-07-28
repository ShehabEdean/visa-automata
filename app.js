// ---- Supabase config ----
const SUPABASE_URL = 'https://czxwafbtlhmzwcikyxny.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eHdhZmJ0bGhtendjaWt5eG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5OTk2NTUsImV4cCI6MjEwMDU3NTY1NX0.0dAXpf-Ap-RVPoDYefFM-Bzkbbyf5rR945FeQyLGycE';

let _accessToken = null;
let _refreshToken = null;

function _headers(extra){
  const h = {'Content-Type':'application/json','apikey':SUPABASE_ANON,...(extra||{})};
  if(_accessToken) h['Authorization'] = 'Bearer ' + _accessToken;
  return h;
}

const _supabase = {
  auth: {
    async getSession(){
      if(_accessToken) return { data: { session: { access_token: _accessToken } }, error: null };
      const stored = localStorage.getItem('supabase_session');
      if(stored){
        try {
          const s = JSON.parse(stored);
          _accessToken = s.access_token;
          _refreshToken = s.refresh_token;
          const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
            method:'POST', headers:_headers(),
            body: JSON.stringify({ refresh_token: _refreshToken })
          });
          if(res.ok){
            const d = await res.json();
            _accessToken = d.access_token;
            _refreshToken = d.refresh_token;
            localStorage.setItem('supabase_session', JSON.stringify(d));
            return { data: { session: { access_token: _accessToken } }, error: null };
          }
        } catch(e){}
        _accessToken = null; _refreshToken = null;
        localStorage.removeItem('supabase_session');
      }
      return { data: { session: null }, error: null };
    },
    async signInWithPassword({email, password}){
      const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method:'POST', headers:_headers(),
        body: JSON.stringify({ email, password })
      });
      if(!res.ok){
        const e = await res.json();
        return { data: {}, error: { message: e.error_description || e.msg || 'Login failed' } };
      }
      const d = await res.json();
      _accessToken = d.access_token;
      _refreshToken = d.refresh_token;
      localStorage.setItem('supabase_session', JSON.stringify(d));
      return { data: {}, error: null };
    },
    async signOut(){
      _accessToken = null; _refreshToken = null;
      localStorage.removeItem('supabase_session');
    }
  },
  storage: {
    from(bucket){
      return {
        getPublicUrl(path){
          return { data: { publicUrl: SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + path } };
        },
        async upload(path, file, opts){
          const url = SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + path;
          const headers = _headers({ 'Content-Type': file.type || 'image/jpeg', 'x-upsert': (opts&&opts.upsert)?'true':'false' });
          delete headers['Content-Type'];
          headers['content-type'] = file.type || 'image/jpeg';
          const res = await fetch(url, { method: 'POST', headers, body: file });
          if(!res.ok) return { error: { message: 'Upload failed' } };
          return { error: null };
        },
        async remove(paths){
          for(const p of paths){
            const url = SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + p;
            await fetch(url, { method:'DELETE', headers:_headers() });
          }
          return { error: null };
        }
      };
    }
  }
};

// ---- Direct DB helpers (no thenable trickery) ----
function _dbUrl(table){ return SUPABASE_URL + '/rest/v1/' + table; }

async function dbSelect(table, { cols, filters, order, single }={}){
  const url = new URL(_dbUrl(table));
  url.searchParams.set('select', cols || '*');
  (filters||[]).forEach(f => url.searchParams.set(f.col, 'eq.' + f.val));
  if(order) url.searchParams.set('order', order.col + (order.asc !== false ? '.asc' : '.desc'));
  const res = await fetch(url.toString(), { method:'GET', headers: _headers({ 'Prefer':'return=representation', 'Accept':'application/json' }) });
  if(!res.ok){ const e = await res.json().catch(()=>({})); throw new Error(e.message || e.hint || 'Query failed'); }
  const data = await res.json();
  return single ? data[0] : data;
}

async function dbInsert(table, row){
  const res = await fetch(_dbUrl(table), {
    method:'POST',
    headers: _headers({ 'Prefer':'return=representation' }),
    body: JSON.stringify(row)
  });
  if(!res.ok){ const e = await res.json().catch(()=>({})); throw new Error(e.message || e.hint || 'Insert failed'); }
  return (await res.json())[0];
}

async function dbUpdate(table, row, filters){
  const url = new URL(_dbUrl(table));
  (filters||[]).forEach(f => url.searchParams.set(f.col, 'eq.' + f.val));
  const res = await fetch(url.toString(), {
    method:'PATCH',
    headers: _headers({ 'Prefer':'return=representation' }),
    body: JSON.stringify(row)
  });
  if(!res.ok){ const e = await res.json().catch(()=>({})); throw new Error(e.message || e.hint || 'Update failed'); }
  return (await res.json())[0];
}

async function dbDelete(table, filters){
  const url = new URL(_dbUrl(table));
  (filters||[]).forEach(f => url.searchParams.set(f.col, 'eq.' + f.val));
  const res = await fetch(url.toString(), { method:'DELETE', headers: _headers({ 'Prefer':'return=representation' }) });
  if(!res.ok){ const e = await res.json().catch(()=>({})); throw new Error(e.message || e.hint || 'Delete failed'); }
}

// ---- Constants ----
const CATEGORIES = [
  {id:'first', label:'First Application', color:'var(--cat-first)'},
  {id:'renewal', label:'Renewal', color:'var(--cat-renewal)'},
  {id:'family', label:'Family Visit', color:'var(--cat-family)'},
  {id:'affair', label:'Business / Affair', color:'var(--cat-affair)'},
];

const STATUSES = [
  {id:'pending',   label:'Pending',       color:'#6B7280', bg:'#F3F4F6'},
  {id:'submitted', label:'Submitted',     color:'#2563EB', bg:'#EFF6FF'},
  {id:'interview', label:'Interview',     color:'#D97706', bg:'#FFFBEB'},
  {id:'approved',  label:'Approved',      color:'#059669', bg:'#ECFDF5'},
  {id:'rejected',  label:'Rejected',      color:'#DC2626', bg:'#FEF2F2'},
  {id:'complete',  label:'Complete',      color:'#7C3AED', bg:'#F5F3FF'},
];

if(window['pdfjsLib']){
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const MRZ_COUNTRY_MAP = {
  DZA:'Algérienne', MAR:'Marocaine', TUN:'Tunisienne', LBY:'Libyenne', EGY:'Égyptienne',
  FRA:'Française', ESP:'Espagnole', ITA:'Italienne', DEU:'Allemande', GBR:'Britannique',
  USA:'Américaine', CAN:'Canadienne', TUR:'Turque', SAU:'Saoudienne', ARE:'Émiratie',
  QAT:'Qatarienne', SYR:'Syrienne', LBN:'Libanaise', JOR:'Jordanienne', MLI:'Malienne',
  NER:'Nigérienne', SEN:'Sénégalaise', CIV:'Ivoirienne', CMR:'Camerounaise', CHN:'Chinoise',
  IND:'Indienne', RUS:'Russe', PRT:'Portugaise', NLD:'Néerlandaise', BEL:'Belge', CHE:'Suisse',
};

const WILAYAS = [
  'Adrar','Chlef','Laghouat','Oum El Bouaghi','Batna','Béjaïa','Biskra','Béchar',
  'Blida','Bouira','Tamanrasset','Tébessa','Tlemcen','Tiaret','Tizi Ouzou','Alger',
  'Djelfa','Jijel','Sétif','Saïda','Skikda','Sidi Bel Abbès','Annaba','Guelma',
  'Constantine','Médéa','Mostaganem','M\'Sila','Mascara','Ouargla','Oran','El Bayadh',
  'Illizi','Bordj Bou Arréridj','Boumerdès','El Tarf','Tindouf','Tissemsilt','El Oued','Khenchela',
  'Souk Ahras','Tipaza','Mila','Aïn Defla','Naâma','Aïn Témouchent','Ghardaïa','Relizane',
  'El M\'Ghair','El Meniaa','Ouled Djellal','Bordj Badji Mokhtar','Béni Abbès','Timimoun',
  'Touggourt','Djanet','In Salah','In Guezzam'
];

const NATIONALITIES = [
  {code:'DZA',label:'Algérienne'},{code:'MAR',label:'Marocaine'},{code:'TUN',label:'Tunisienne'},
  {code:'LBY',label:'Libyenne'},{code:'EGY',label:'Égyptienne'},{code:'SYR',label:'Syrienne'},
  {code:'LBN',label:'Libanaise'},{code:'JOR',label:'Jordanienne'},{code:'MLI',label:'Malienne'},
  {code:'NER',label:'Nigérienne'},{code:'SEN',label:'Sénégalaise'},{code:'CIV',label:'Ivoirienne'},
  {code:'CMR',label:'Camerounaise'},{code:'SEN',label:'Sénégalaise'},
  {code:'FRA',label:'Française'},{code:'ESP',label:'Espagnole'},{code:'ITA',label:'Italienne'},
  {code:'DEU',label:'Allemande'},{code:'GBR',label:'Britannique'},{code:'USA',label:'Américaine'},
  {code:'CAN',label:'Canadienne'},{code:'TUR',label:'Turque'},{code:'CHN',label:'Chinoise'},
  {code:'IND',label:'Indienne'},{code:'RUS',label:'Russe'},{code:'PRT',label:'Portugaise'},
  {code:'NLD',label:'Néerlandaise'},{code:'BEL',label:'Belge'},{code:'CHE',label:'Suisse'},
  {code:'SAU',label:'Saoudienne'},{code:'ARE',label:'Émiratie'},{code:'QAT',label:'Qatarienne'},
];

let entries = [];
let activeTab = 'all';
let editingId = null;
let pendingImageDataUrl = null;
let pendingImageRemoved = false;
let pendingUploadFile = null;

const $ = (id) => document.getElementById(id);
const toastEl = $('toast');
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(()=>toastEl.classList.remove('show'), 1800);
}

// ---- Auth ----
async function checkSession(){
  try {
    const { data: { session } } = await _supabase.auth.getSession();
    if(session){
      showApp();
    } else {
      showLogin();
    }
  } catch(err) {
    console.error('checkSession error:', err);
    showLogin();
  }
}

function showLogin(){
  $('loadingScreen').style.display = 'none';
  $('loginScreen').style.display = 'flex';
  $('mainApp').style.display = 'none';
}

function showApp(){
  $('loadingScreen').style.display = 'none';
  $('loginScreen').style.display = 'none';
  $('mainApp').style.display = 'block';
  loadEntries();
}

$('loginBtn').onclick = async ()=>{
  const email = $('loginEmail').value.trim();
  const pass = $('loginPass').value;
  if(!email || !pass){ $('loginError').textContent = 'Enter email and password'; return; }
  $('loginError').textContent = '';
  $('loginBtn').textContent = 'Signing in…';
  const { error } = await _supabase.auth.signInWithPassword({ email, password: pass });
  $('loginBtn').textContent = 'Sign in';
  if(error){
    $('loginError').textContent = error.message;
  } else {
    showApp();
  }
};
$('loginPass').addEventListener('keydown', (e)=>{ if(e.key==='Enter') $('loginBtn').click(); });
$('loginEmail').addEventListener('keydown', (e)=>{ if(e.key==='Enter') $('loginPass').focus(); });

$('logoutBtn').onclick = async ()=>{
  await _supabase.auth.signOut();
  entries = [];
  showLogin();
};

// ---- Data ----
async function loadEntries(){
  try {
    const data = await dbSelect('applications', { order: { col: 'date_added', asc: false } });
    entries = data || [];
  } catch(err) {
    console.error('loadEntries error:', err);
    toast('Connection error');
    entries = [];
  }
  renderTabs();
  renderTable();
  renderStats();
}

function catInfo(id){
  return CATEGORIES.find(c=>c.id===id) || {id, label:id, color:'var(--cat-other)'};
}

function statusInfo(id){
  return STATUSES.find(s=>s.id===id) || STATUSES[0];
}

function renderStats(){
  $('statsBox').textContent = `${entries.length} entr${entries.length===1?'y':'ies'} on file`;
}

function renderTabs(){
  const tabsEl = $('tabs');
  tabsEl.innerHTML = '';
  const allTab = document.createElement('div');
  allTab.className = 'tab' + (activeTab==='all' ? ' active' : '');
  allTab.dataset.cat = 'all';
  allTab.innerHTML = `All <span class="count">${entries.length}</span>`;
  allTab.onclick = ()=>{ activeTab='all'; renderTabs(); renderTable(); };
  tabsEl.appendChild(allTab);

  CATEGORIES.forEach(cat=>{
    const count = entries.filter(e=>e.category===cat.id).length;
    const t = document.createElement('div');
    t.className = 'tab' + (activeTab===cat.id ? ' active' : '');
    t.dataset.cat = cat.id;
    t.style.borderTopColor = activeTab===cat.id ? cat.color : '';
    t.innerHTML = `${cat.label} <span class="count">${count}</span>`;
    t.onclick = ()=>{ activeTab=cat.id; renderTabs(); renderTable(); };
    tabsEl.appendChild(t);
  });
}

function matchesSearch(e, q){
  if(!q) return true;
  q = q.toLowerCase();
  return [e.last_name, e.first_name, e.passport_number, e.visa_number, e.phone, e.email, e.notes, e.nationality, e.place_of_birth, e.authority, e.group_label]
    .some(v => (v||'').toLowerCase().includes(q));
}

function renderTable(){
  const q = $('searchInput').value.trim();
  let list = entries.filter(e => (activeTab==='all' || e.category===activeTab) && matchesSearch(e,q));

  const tbody = $('tbody');
  tbody.innerHTML = '';
  $('emptyState').style.display = list.length ? 'none' : 'block';
  $('table').style.display = list.length ? 'table' : 'none';

  list.forEach(e=>{
    const cat = catInfo(e.category);
    const tr = document.createElement('tr');
    tr.onclick = ()=> openModal(e.id);
    tr.innerHTML = `
      <td class="name-cell" data-label="Last name">${esc(e.last_name||'—')}${e.group_label ? `<span class="group-badge">GROUP: ${esc(e.group_label)}</span>` : ''}</td>
      <td data-label="First name">${esc(e.first_name||'—')}</td>
      <td class="mono" data-label="Passport no.">${esc(e.passport_number||'—')}</td>
      <td data-label="Category"><span class="badge" style="background:${cat.color}">${esc(cat.label)}</span></td>
      <td data-label="Status"><span class="badge" style="background:${statusInfo(e.status).color};color:#fff">${esc(statusInfo(e.status).label)}</span></td>
      <td data-label="Paid">${e.paid ? '<span class="badge paid-badge">Paid</span>' : '<span class="badge unpaid-badge">Unpaid</span>'}</td>
      <td class="mono" data-label="Date added">${esc(isoToDisplay(e.date_added)||e.date_added||'—')}</td>
      <td data-label="">
        <div class="row-actions">
          <button class="edit" data-id="${e.id}">Edit</button>
          <button class="del" data-id="${e.id}">Delete</button>
        </div>
      </td>
    `;
    tr.querySelector('.edit').onclick = (ev)=>{ ev.stopPropagation(); openModal(e.id); };
    tr.querySelector('.del').onclick = async (ev)=>{
      ev.stopPropagation();
      if(!confirm(`Delete the entry for ${e.last_name||'this person'}?`)) return;
      try {
        await dbDelete('applications', [{col:'id', val:e.id}]);
        if(e.has_image){
          await _supabase.storage.from('scans').remove([`scans/${e.id}.jpg`]);
        }
        entries = entries.filter(x=>x.id!==e.id);
        renderTabs();
        renderTable();
        toast('Entry deleted');
      } catch(err){
        toast('Delete failed');
      }
    };
    tbody.appendChild(tr);
  });
  renderStats();
}

function esc(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---- Modal ----
function openModal(id){
  editingId = id || null;
  pendingImageDataUrl = null;
  pendingImageRemoved = false;
  pendingUploadFile = null;
  $('deleteBtn').style.display = id ? 'inline-block' : 'none';
  $('attachPrompt').style.display = 'block';
  $('attachPreview').style.display = 'none';
  $('f_image').value = '';
  setScanStatus('', '');
  $('f_scanInput').value = '';
  ['wrap_passport','wrap_nationality','wrap_lastName','wrap_firstName','wrap_dob','wrap_sex','wrap_expiryDate'].forEach(w=>{
    const el = $(w); if(el) el.classList.remove('verified','unverified');
  });

  if(id){
    const e = entries.find(x=>x.id===id);
    $('modalTitle').textContent = 'Edit entry';
    $('f_category').value = e.category;
    $('f_status').value = e.status || 'pending';
    $('f_date').value = isoToDisplay(e.date_added) || e.date_added || '';
    $('f_lastName').value = e.last_name || '';
    $('f_firstName').value = e.first_name || '';
    $('f_passport').value = e.passport_number || '';
    $('f_nationality').value = e.nationality || '';
    $('f_dob').value = isoToDisplay(e.dob) || e.dob || '';
    $('f_pob').value = e.place_of_birth || '';
    $('f_sex').value = e.sex || '';
    $('f_issueDate').value = isoToDisplay(e.issue_date) || e.issue_date || '';
    $('f_expiryDate').value = isoToDisplay(e.expiry_date) || e.expiry_date || '';
    $('f_authority').value = e.authority || '';
    $('f_visa').value = e.visa_number || '';
    $('f_phone').value = e.phone || '';
    $('f_email').value = e.email || '';
    $('f_notes').value = e.notes || '';
    $('f_paid').checked = !!e.paid;
    $('f_groupLabel').value = e.group_label || '';
    $('f_isPrimary').checked = !!e.is_primary;
    // Load existing image
    if(e.has_image){
      const { data } = _supabase.storage.from('scans').getPublicUrl(`scans/${e.id}.jpg`);
      if(data && data.publicUrl){
        $('attachPreview').src = data.publicUrl;
        $('attachPreview').style.display = 'block';
        $('attachPrompt').style.display = 'none';
      }
    }
  } else {
    $('modalTitle').textContent = 'New entry';
    $('f_category').value = activeTab !== 'all' ? activeTab : 'first';
    $('f_status').value = 'pending';
    $('f_date').value = todayStr();
    $('f_paid').checked = false;
    $('f_groupLabel').value = '';
    $('f_isPrimary').checked = false;
    ['f_lastName','f_firstName','f_passport','f_nationality','f_dob','f_pob','f_sex','f_issueDate','f_expiryDate','f_authority','f_visa','f_phone','f_email','f_notes'].forEach(id=>$(id).value='');
  }
  $('overlay').classList.add('open');
}

function closeModal(){
  $('overlay').classList.remove('open');
  editingId = null;
}

$('newBtn').onclick = ()=> openModal(null);
$('closeModal').onclick = closeModal;
$('cancelBtn').onclick = closeModal;
$('overlay').addEventListener('click', (e)=>{ if(e.target.id==='overlay') closeModal(); });

// ---- Image attach ----
$('attachBox').onclick = ()=> $('f_image').click();
$('f_image').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  pendingUploadFile = file;
  pendingImageRemoved = false;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    const img = new Image();
    img.onload = ()=>{
      const maxW = 1000;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      pendingImageDataUrl = canvas.toDataURL('image/jpeg', 0.6);
      $('attachPreview').src = pendingImageDataUrl;
      $('attachPreview').style.display = 'block';
      $('attachPrompt').style.display = 'none';
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// ---- Save ----
$('saveBtn').onclick = async ()=>{
  const data = {
    category: $('f_category').value,
    status: $('f_status').value,
    date_added: displayToIso($('f_date').value) || $('f_date').value,
    last_name: $('f_lastName').value.trim(),
    first_name: $('f_firstName').value.trim(),
    passport_number: $('f_passport').value.trim(),
    nationality: $('f_nationality').value.trim(),
    dob: displayToIso($('f_dob').value) || $('f_dob').value,
    place_of_birth: $('f_pob').value,
    sex: $('f_sex').value,
    issue_date: displayToIso($('f_issueDate').value) || $('f_issueDate').value,
    expiry_date: displayToIso($('f_expiryDate').value) || $('f_expiryDate').value,
    authority: $('f_authority').value,
    visa_number: $('f_visa').value.trim(),
    phone: $('f_phone').value.trim(),
    email: $('f_email').value.trim(),
    notes: $('f_notes').value.trim(),
    paid: $('f_paid').checked,
    group_label: $('f_groupLabel').value.trim(),
    is_primary: $('f_isPrimary').checked,
  };
  if(!data.last_name && !data.passport_number){
    toast('Add at least a last name or passport number');
    return;
  }

  $('saveBtn').textContent = 'Saving…';
  $('saveBtn').disabled = true;

  try {
    if(editingId){
      await dbUpdate('applications', data, [{col:'id', val:editingId}]);

      if(pendingImageRemoved){
        await _supabase.storage.from('scans').remove([`scans/${editingId}.jpg`]);
        await dbUpdate('applications', { has_image: false }, [{col:'id', val:editingId}]);
      } else if(pendingUploadFile){
        await _supabase.storage.from('scans').upload(`scans/${editingId}.jpg`, pendingUploadFile, { upsert: true });
        await dbUpdate('applications', { has_image: true }, [{col:'id', val:editingId}]);
      }
    } else {
      const inserted = await dbInsert('applications', data);
      editingId = inserted.id;
      entries.unshift(inserted);

      if(pendingUploadFile){
        await _supabase.storage.from('scans').upload(`scans/${editingId}.jpg`, pendingUploadFile, { upsert: true });
        await dbUpdate('applications', { has_image: true }, [{col:'id', val:editingId}]);
      }
    }

    await loadEntries();
    closeModal();
    toast('Entry saved');
  } catch(err){
    console.error(err);
    toast('Save failed — ' + (err.message || 'unknown error'));
  } finally {
    $('saveBtn').textContent = 'Save entry';
    $('saveBtn').disabled = false;
  }
};

// ---- Delete ----
$('deleteBtn').onclick = async ()=>{
  if(!editingId) return;
  if(!confirm('Delete this entry permanently?')) return;
  try {
    await dbDelete('applications', [{col:'id', val:editingId}]);
    const entry = entries.find(x=>x.id===editingId);
    if(entry && entry.has_image){
      await _supabase.storage.from('scans').remove([`scans/${editingId}.jpg`]);
    }
    entries = entries.filter(x=>x.id!==editingId);
    renderTabs();
    renderTable();
    closeModal();
    toast('Entry deleted');
  } catch(err){
    toast('Delete failed');
  }
};

// ---- Search ----
$('searchInput').addEventListener('input', renderTable);

// ---- Export CSV ----
$('exportBtn').onclick = ()=>{
  const rows = [['Category','Status','Last Name','First Name','Passport Number','Nationality','Date of Birth','Place of Birth','Sex','Issue Date','Expiry Date','Authority','Visa Number','Phone','Email','Paid','Date Added','Group','Notes']];
  entries.forEach(e=>{
    rows.push([catInfo(e.category).label, statusInfo(e.status).label, e.last_name, e.first_name, e.passport_number, e.nationality, e.dob, e.place_of_birth, e.sex, e.issue_date, e.expiry_date, e.authority, e.visa_number, e.phone, e.email, e.paid?'Yes':'No', e.date_added, e.group_label, (e.notes||'').replace(/\n/g,' ')]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'visa_registry_export.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exported');
};

// ---- MRZ Parsing ----
function mrzCharValue(c){
  if(c === '<') return 0;
  if(c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if(c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55;
  return 0;
}
function mrzCheckDigit(str){
  const weights = [7,3,1];
  let sum = 0;
  for(let i=0;i<str.length;i++) sum += mrzCharValue(str[i]) * weights[i%3];
  return sum % 10;
}
function mrzDateToISO(yymmdd, preferFuture){
  if(!/^\d{6}$/.test(yymmdd)) return '';
  const yy = parseInt(yymmdd.slice(0,2),10);
  const mm = yymmdd.slice(2,4), dd = yymmdd.slice(4,6);
  const currentYY = new Date().getFullYear() % 100;
  const century = preferFuture ? 2000 : (yy > currentYY ? 1900 : 2000);
  const y = century + yy;
  if(mm==='00' || dd==='00' || parseInt(mm,10)>12 || parseInt(dd,10)>31) return '';
  return `${y}-${mm}-${dd}`;
}

function extractMrzLines(rawText){
  const lines = rawText.toUpperCase().split('\n')
    .map(l => l.replace(/[^A-Z0-9<]/g,''))
    .filter(l => l.length >= 30 && (l.match(/</g)||[]).length >= 3);
  if(lines.length < 2) return null;
  const sorted = lines.slice().sort((a,b)=>b.length-a.length).slice(0,2);
  const ordered = lines.filter(l => sorted.includes(l)).slice(0,2);
  const pad = l => (l.length >= 44 ? l.slice(0,44) : l.padEnd(44,'<'));
  return ordered.length === 2 ? [pad(ordered[0]), pad(ordered[1])] : null;
}

function parseTD3(line1, line2){
  const result = {valid:{}};
  const country = line1.slice(2,5).replace(/</g,'');
  const nameField = line1.slice(5,44);
  const nameParts = nameField.split(/<{2,}/);
  const surnamePart = nameParts[0] || '';
  const givenPart = nameParts[1] || '';
  result.lastName = surnamePart.replace(/</g,' ').replace(/\s+/g,' ').trim();
  result.firstName = givenPart.replace(/</g,' ').replace(/\s+/g,' ').trim();
  result.nationality = MRZ_COUNTRY_MAP[country] || country;
  result.countryCode = country;

  const passportNumRaw = line2.slice(0,9);
  const passportCheck = line2[9];
  const dobRaw = line2.slice(13,19);
  const dobCheck = line2[19];
  const sex = line2[20];
  const expRaw = line2.slice(21,27);
  const expCheck = line2[27];

  result.passportNumber = passportNumRaw.replace(/</g,'').trim();
  result.sex = (sex==='M'||sex==='F') ? sex : '';
  result.dob = mrzDateToISO(dobRaw, false);
  result.expiryDate = mrzDateToISO(expRaw, true);

  result.valid.passport = /^\d$/.test(passportCheck) && mrzCheckDigit(passportNumRaw) === parseInt(passportCheck,10);
  result.valid.dob = /^\d{6}$/.test(dobRaw) && /^\d$/.test(dobCheck) && mrzCheckDigit(dobRaw) === parseInt(dobCheck,10);
  result.valid.expiry = /^\d{6}$/.test(expRaw) && /^\d$/.test(expCheck) && mrzCheckDigit(expRaw) === parseInt(expCheck,10);
  return result;
}

function setScanStatus(msg, cls){
  const el = $('scanStatus');
  el.textContent = msg;
  el.className = 'scan-status' + (cls ? ' '+cls : '');
}
function markFieldVerified(wrapId, ok){
  const el = $(wrapId);
  if(!el) return;
  el.classList.remove('verified','unverified');
  el.classList.add(ok ? 'verified' : 'unverified');
}

async function fileToImageCanvas(file, maxW){
  if(file.type === 'application/pdf'){
    if(!window['pdfjsLib']) throw new Error('PDF reader unavailable');
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({data:buf}).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({scale:2.5});
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({canvasContext:canvas.getContext('2d'), viewport}).promise;
    return canvas;
  }
  const dataUrl = await new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result); r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise((res,rej)=>{
    const im = new Image(); im.onload=()=>res(im); im.onerror=rej; im.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  const scale = maxW ? Math.min(1, maxW/img.width) : 1;
  canvas.width = img.width*scale; canvas.height = img.height*scale;
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  return canvas;
}

function cropBottom(canvas, fraction){
  const h = Math.round(canvas.height * fraction);
  const crop = document.createElement('canvas');
  crop.width = canvas.width; crop.height = h;
  crop.getContext('2d').drawImage(canvas, 0, canvas.height-h, canvas.width, h, 0, 0, canvas.width, h);
  return crop;
}

function cropStrip(canvas, topFrac, bottomFrac){
  const y0 = Math.round(canvas.height * topFrac);
  const y1 = Math.round(canvas.height * bottomFrac);
  const h = Math.max(1, y1 - y0);
  const crop = document.createElement('canvas');
  crop.width = canvas.width; crop.height = h;
  crop.getContext('2d').drawImage(canvas, 0, y0, canvas.width, h, 0, 0, canvas.width, h);
  return crop;
}

async function ocrText(canvas, singleLine){
  const { data } = await window.Tesseract.recognize(canvas, 'eng', {
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
    tessedit_pageseg_mode: singleLine ? '7' : '6',
    logger: (m)=>{
      if(m.status === 'recognizing text'){
        setScanStatus(`Reading MRZ… ${Math.round((m.progress||0)*100)}%`, 'busy');
      }
    }
  });
  return data.text;
}

async function handleScanFile(file){
  if(!window['Tesseract']){
    setScanStatus('OCR engine failed to load — check your connection, or fill fields manually.', 'warn');
    return;
  }
  try{
    setScanStatus('Preparing image…', 'busy');
    const fullCanvas = await fileToImageCanvas(file, 1600);

    // Auto-attach the scan
    pendingUploadFile = file;
    pendingImageDataUrl = fullCanvas.toDataURL('image/jpeg', 0.6);
    pendingImageRemoved = false;
    $('attachPreview').src = pendingImageDataUrl;
    $('attachPreview').style.display = 'block';
    $('attachPrompt').style.display = 'none';

    setScanStatus('Reading MRZ…', 'busy');
    const mrzCrop = cropBottom(fullCanvas, 0.30);

    let lines = null;
    try{
      const line1Text = await ocrText(cropStrip(mrzCrop, 0.10, 0.52), true);
      const line2Text = await ocrText(cropStrip(mrzCrop, 0.52, 0.95), true);
      const clean = t => t.toUpperCase().replace(/[^A-Z0-9<]/g,'');
      const l1 = clean(line1Text), l2 = clean(line2Text);
      if(l1.length >= 30 && l2.length >= 30){
        const pad = l => (l.length >= 44 ? l.slice(0,44) : l.padEnd(44,'<'));
        lines = [pad(l1), pad(l2)];
      }
    }catch(e){}

    if(!lines){
      const text = await ocrText(mrzCrop, false);
      lines = extractMrzLines(text);
    }
    if(!lines){
      const text = await ocrText(fullCanvas, false);
      lines = extractMrzLines(text);
    }
    if(!lines){
      setScanStatus('Could not locate the MRZ — scan attached, fill fields manually.', 'warn');
      return;
    }

    const parsed = parseTD3(lines[0], lines[1]);
    if(parsed.passportNumber) $('f_passport').value = parsed.passportNumber;
    if(parsed.nationality) $('f_nationality').value = parsed.nationality;
    if(parsed.lastName) $('f_lastName').value = parsed.lastName;
    if(parsed.firstName) $('f_firstName').value = parsed.firstName;
    if(parsed.dob) $('f_dob').value = isoToDisplay(parsed.dob);
    if(parsed.sex) $('f_sex').value = parsed.sex;
    if(parsed.expiryDate) $('f_expiryDate').value = isoToDisplay(parsed.expiryDate);

    markFieldVerified('wrap_passport', parsed.valid.passport);
    markFieldVerified('wrap_dob', parsed.valid.dob);
    markFieldVerified('wrap_expiryDate', parsed.valid.expiry);

    const allOk = parsed.valid.passport && parsed.valid.dob && parsed.valid.expiry;
    if(allOk){
      setScanStatus('MRZ read and verified — fields filled below.', 'ok');
    } else {
      setScanStatus('MRZ read, some checksums failed (red) — double-check those fields.', 'warn');
    }
    toast('Passport scan processed');
  }catch(err){
    setScanStatus('Error reading file — scan attached, fill fields manually.', 'warn');
  }
}

$('scanZone').addEventListener('click', ()=> $('f_scanInput').click());
$('f_scanInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(file) handleScanFile(file);
});
$('scanZone').addEventListener('dragover', (e)=>{ e.preventDefault(); });
$('scanZone').addEventListener('drop', (e)=>{
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if(file) handleScanFile(file);
});

// ---- Init ----
checkSession();

// ---- Populate select dropdowns ----
(function(){
  // POB + Authority wilayas
  ['f_pob','f_authority'].forEach(id=>{
    const sel = $(id);
    WILAYAS.forEach(w=>{ const o=document.createElement('option'); o.value=w; o.textContent=w; sel.appendChild(o); });
  });
  // Nationalities
  const natSel = $('f_nationality');
  NATIONALITIES.forEach(n=>{ const o=document.createElement('option'); o.value=n.label; o.textContent=n.label+' ('+n.code+')'; natSel.appendChild(o); });
  // Allow typing custom nationality
  natSel.setAttribute('list','natlist');
})();

// ---- Passport number: digits only, max 9 ----
$('f_passport').addEventListener('keydown', function(e){
  if(this.value.replace(/[^0-9]/g,'').length >= 9 && !['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End'].includes(e.key)){
    e.preventDefault();
  }
});
$('f_passport').addEventListener('input', function(){
  this.value = this.value.replace(/[^0-9]/g,'').slice(0,9);
});

// ---- Auto-insert / in date fields ----
['f_dob','f_issueDate','f_expiryDate','f_date'].forEach(id=>{
  $(id).addEventListener('input', function(e){
    let raw = this.value.replace(/[^0-9]/g,'').slice(0,8);
    let dd = raw.slice(0,2);
    let mm = raw.slice(2,4);
    let yyyy = raw.slice(4,8);
    if(parseInt(dd,10) > 31) dd = '31';
    if(parseInt(dd,10) < 1 && raw.length >= 2) dd = '01';
    if(parseInt(mm,10) > 12) mm = '12';
    if(parseInt(mm,10) < 1 && raw.length >= 4) mm = '01';
    let out = dd;
    if(raw.length > 2) out += '/' + mm;
    if(raw.length > 4) out += '/' + yyyy;
    this.value = out;
  });
});

// ---- Dark mode toggle ----
(function(){
  const saved = localStorage.getItem('theme');
  if(saved === 'dark') document.documentElement.setAttribute('data-theme','dark');
  $('themeToggle').onclick = ()=>{
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if(isDark){
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('theme');
      $('themeToggle').textContent = '☀️';
    } else {
      document.documentElement.setAttribute('data-theme','dark');
      localStorage.setItem('theme','dark');
      $('themeToggle').textContent = '🌙';
    }
  };
  // Set initial icon
  if(saved === 'dark') $('themeToggle').textContent = '🌙';
})();

// ---- Date helpers (DD/MM/YYYY) ----
function isoToDisplay(iso){
  if(!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y,m,d] = iso.split('-');
  return d+'/'+m+'/'+y;
}
function displayToIso(disp){
  if(!disp) return '';
  const parts = disp.split('/');
  if(parts.length !== 3) return '';
  const [d,m,y] = parts;
  if(y.length!==4 || m.length!==2 || d.length!==2) return '';
  if(parseInt(m)<1||parseInt(m)>12||parseInt(d)<1||parseInt(d)>31) return '';
  return y+'-'+m+'-'+d;
}
function todayStr(){
  const now = new Date();
  const dd = String(now.getDate()).padStart(2,'0');
  const mm = String(now.getMonth()+1).padStart(2,'0');
  const yyyy = now.getFullYear();
  return dd+'/'+mm+'/'+yyyy;
}
