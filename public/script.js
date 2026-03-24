// ═══════════════════════════════════════════════════════
//  STORAGE & DB
// ═══════════════════════════════════════════════════════
const STORAGE_KEY = 'ipt_demo_v1';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { window.db = JSON.parse(raw); return; }
  } catch(e) {}
  // Seed default data
  window.db = {
    accounts: [
      { id: uid(), firstName: 'Main', lastName: 'Admin', email: 'admin@example.com', password: 'Password123!', role: 'admin', verified: true }
    ],
    departments: [
      { id: uid(), name: 'Engineering',     description: 'Builds and maintains software systems.' },
      { id: uid(), name: 'Human Resources', description: 'Manages people operations and culture.' }
    ],
    employees: [],
    requests: []
  };
  saveToStorage();
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ═══════════════════════════════════════════════════════
//  AUTH STATE
// ═══════════════════════════════════════════════════════
let currentUser = null;

function setAuthState(isAuth, user = null) {
  currentUser = user;
  const body = document.body;
  if (isAuth && user) {
    body.classList.remove('not-authenticated');
    body.classList.add('authenticated');
    if (user.role === 'admin') body.classList.add('is-admin');
    else body.classList.remove('is-admin');
    document.getElementById('navAvatar').textContent = user.firstName[0].toUpperCase();
    document.getElementById('navName').textContent   = user.firstName;
  } else {
    body.classList.remove('authenticated', 'is-admin');
    body.classList.add('not-authenticated');
    currentUser = null;
  }
}

// CHANGED: also clears sessionStorage authToken (real JWT)
function doLogout() {
  localStorage.removeItem('auth_token');
  sessionStorage.removeItem('authToken');
  setAuthState(false);
  showToast('Logged out successfully.', 'info');
  navigateTo('#/');
}

// ═══════════════════════════════════════════════════════
//  ROUTER
// ═══════════════════════════════════════════════════════
const routes = {
  '#/'            : { pageId: 'page-home'         },
  '#/register'    : { pageId: 'page-register'     },
  '#/verify-email': { pageId: 'page-verify-email' },
  '#/login'       : { pageId: 'page-login'        },
  '#/profile'     : { pageId: 'page-profile',     auth: true,              render: renderProfile       },
  '#/employees'   : { pageId: 'page-employees',   auth: true, admin: true, render: renderEmployeesTable },
  '#/accounts'    : { pageId: 'page-accounts',    auth: true, admin: true, render: renderAccountsList   },
  '#/departments' : { pageId: 'page-departments', auth: true, admin: true, render: renderDeptTable      },
  '#/requests'    : { pageId: 'page-requests',    auth: true,              render: renderRequestsTable  },
};

function navigateTo(hash) {
  window.location.hash = hash;
}

function handleRouting() {
  const hash  = window.location.hash || '#/';
  const route = routes[hash] || routes['#/'];

  if (route.auth && !currentUser) {
    showToast('Please log in first.', 'error');
    navigateTo('#/login'); return;
  }
  if (route.admin && currentUser?.role !== 'admin') {
    showToast('Admin access required.', 'error');
    navigateTo('#/'); return;
  }

  // Force-hide all pages with inline style to beat any CSS specificity issues
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });
  const target = document.getElementById(route.pageId);
  if (target) {
    target.classList.add('active');
    target.style.display = 'block';
  }
  if (route.render) route.render();
}

window.addEventListener('hashchange', handleRouting);

// ═══════════════════════════════════════════════════════
//  DROPDOWN TOGGLE
// ═══════════════════════════════════════════════════════
const userPill  = document.getElementById('userPill');
const dropPanel = document.getElementById('dropPanel');

userPill.addEventListener('click', (e) => {
  e.stopPropagation();
  dropPanel.classList.toggle('open');
});

// Close dropdown when any dd-item is clicked
dropPanel.querySelectorAll('.dd-item').forEach(item => {
  item.addEventListener('click', () => dropPanel.classList.remove('open'));
});

// Close dropdown when clicking anywhere else on the page
document.addEventListener('click', () => dropPanel.classList.remove('open'));

// ═══════════════════════════════════════════════════════
//  REGISTER
// ═══════════════════════════════════════════════════════
document.getElementById('navRegisterBtn').addEventListener('click', () => navigateTo('#/register'));
document.getElementById('navLoginBtn').addEventListener('click',    () => navigateTo('#/login'));

document.getElementById('regSubmitBtn').addEventListener('click', () => {
  const fn = document.getElementById('reg-fn').value.trim();
  const ln = document.getElementById('reg-ln').value.trim();
  const em = document.getElementById('reg-em').value.trim().toLowerCase();
  const pw = document.getElementById('reg-pw').value;
  let ok = true;

  setFieldErr('f-reg-fn', !fn);
  setFieldErr('f-reg-ln', !ln);
  if (!fn || !ln) ok = false;

  if (!em) {
    setFieldErr('f-reg-em', true, 'Required'); ok = false;
  } else if (!/\S+@\S+\.\S+/.test(em)) {
    setFieldErr('f-reg-em', true, 'Invalid email'); ok = false;
  } else {
    setFieldErr('f-reg-em', false);
  }

  if (pw.length < 6) {
    setFieldErr('f-reg-pw', true, 'Min 6 characters'); ok = false;
  } else {
    setFieldErr('f-reg-pw', false);
  }

  if (!ok) return;

  if (window.db.accounts.find(a => a.email === em)) {
    setFieldErr('f-reg-em', true, 'Email already registered'); return;
  }

  const account = { id: uid(), firstName: fn, lastName: ln, email: em, password: pw, role: 'user', verified: false };
  window.db.accounts.push(account);
  saveToStorage();

  localStorage.setItem('unverified_email', em);
  document.getElementById('verifyEmailLbl').textContent = em;
  showToast('Account created! Please verify your email.', 'success');
  navigateTo('#/verify-email');
});

// ═══════════════════════════════════════════════════════
//  VERIFY
// ═══════════════════════════════════════════════════════
document.getElementById('verifyBtn').addEventListener('click', () => {
  const em = localStorage.getItem('unverified_email');
  if (!em) { showToast('No pending verification.', 'error'); return; }
  const acc = window.db.accounts.find(a => a.email === em);
  if (acc) { acc.verified = true; saveToStorage(); }
  localStorage.removeItem('unverified_email');
  showToast('Email verified! You can now log in.', 'success');
  navigateTo('#/login');
});

// ═══════════════════════════════════════════════════════
//  LOGIN  ← CHANGED: now calls the real backend API
// ═══════════════════════════════════════════════════════
document.getElementById('loginSubmitBtn').addEventListener('click', async () => {
  const em = document.getElementById('log-em').value.trim().toLowerCase();
  const pw = document.getElementById('log-pw').value;
  let ok = true;
  setFieldErr('f-log-em', !em); if (!em) ok = false;
  setFieldErr('f-log-pw', !pw); if (!pw) ok = false;
  if (!ok) return;

  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: em, password: pw })
    });

    const data = await response.json();

    if (response.ok) {
      // Save the real JWT token from the backend
      sessionStorage.setItem('authToken', data.token);
      // Look up local db for full user info (firstName, lastName, etc.)
      const acc = window.db.accounts.find(a => a.email === em);
      setAuthState(true, acc || { firstName: data.user.username, email: em, role: data.user.role });
      showToast(`Welcome back!`, 'success');
      setTimeout(() => navigateTo('#/profile'), 50);
    } else {
      showToast(data.error || 'Login failed.', 'error');
    }
  } catch (err) {
    showToast('Network error — is the backend running?', 'error');
  }
});

['log-em', 'log-pw'].forEach(id =>
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginSubmitBtn').click();
  })
);

// ═══════════════════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════════════════
function renderProfile() {
  if (!currentUser) return;
  const u = currentUser;
  document.getElementById('profAvatar').textContent  = u.firstName[0].toUpperCase();
  document.getElementById('profName').textContent    = `${u.firstName} ${u.lastName}`;
  const rb = document.getElementById('profRoleBadge');
  rb.textContent = u.role.toUpperCase();
  rb.className   = `role-badge ${u.role}`;

  document.getElementById('profInfoGrid').innerHTML = `
    <div class="info-card"><div class="lbl">Email</div><div class="val">${u.email}</div></div>
    <div class="info-card"><div class="lbl">Role</div><div class="val">${u.role.charAt(0).toUpperCase() + u.role.slice(1)}</div></div>
    <div class="info-card"><div class="lbl">Account Status</div><div class="val">${u.verified ? '✅ Verified' : '⏳ Unverified'}</div></div>
    <div class="info-card"><div class="lbl">Account ID</div><div class="val" style="font-size:.8rem;color:var(--ink-3)">${u.id}</div></div>
  `;
}

function openEditProfileModal() {
  if (!currentUser) return;
  document.getElementById('edit-prof-fn').value = currentUser.firstName;
  document.getElementById('edit-prof-ln').value = currentUser.lastName;
  document.getElementById('edit-prof-pw').value = '';
  setFieldErr('f-edit-prof-pw', false);
  openModal('modal-edit-profile');
}

function saveProfileEdit() {
  const fn = document.getElementById('edit-prof-fn').value.trim();
  const ln = document.getElementById('edit-prof-ln').value.trim();
  const pw = document.getElementById('edit-prof-pw').value;

  if (!fn || !ln) { showToast('Name fields are required.', 'error'); return; }
  if (pw && pw.length < 6) { setFieldErr('f-edit-prof-pw', true, 'Min 6 characters'); return; }
  setFieldErr('f-edit-prof-pw', false);

  // Update in db
  const acc = window.db.accounts.find(a => a.id === currentUser.id);
  if (acc) {
    acc.firstName = fn;
    acc.lastName  = ln;
    if (pw) acc.password = pw;
    saveToStorage();
    // Refresh currentUser reference
    currentUser = acc;
    // Update navbar name
    document.getElementById('navName').textContent = fn;
  }

  closeModal('modal-edit-profile');
  renderProfile();
  showToast('Profile updated!', 'success');
}

// ═══════════════════════════════════════════════════════
//  EMPLOYEES
// ═══════════════════════════════════════════════════════
function renderEmployeesTable() {
  const wrap = document.getElementById('employees-table-wrap');
  const emps = window.db.employees;
  if (!emps.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="emo">👥</div>No employees yet.</div>';
    return;
  }
  const rows = emps.map(e => {
    const dept = window.db.departments.find(d => d.id === e.deptId);
    return `<tr>
      <td>${e.empId}</td>
      <td>${e.email}</td>
      <td>${e.position}</td>
      <td>${dept ? dept.name : '—'}</td>
      <td>${e.hireDate || '—'}</td>
      <td><div class="tbl-actions">
        <button class="tbl-btn edit" onclick="openEmployeeModal('${e.id}')">Edit</button>
        <button class="tbl-btn del"  onclick="deleteEmployee('${e.id}')">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>ID</th><th>Email</th><th>Position</th><th>Department</th><th>Hire Date</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function openEmployeeModal(id = null) {
  clearFields(['emp-id', 'emp-email', 'emp-pos', 'emp-hire']);
  document.getElementById('emp-edit-id').value = '';
  document.getElementById('emp-modal-title').textContent = id ? 'Edit Employee' : 'Add Employee';

  const sel = document.getElementById('emp-dept');
  sel.innerHTML = window.db.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

  if (id) {
    const e = window.db.employees.find(x => x.id === id);
    if (e) {
      document.getElementById('emp-id').value    = e.empId;
      document.getElementById('emp-email').value = e.email;
      document.getElementById('emp-pos').value   = e.position;
      document.getElementById('emp-hire').value  = e.hireDate;
      sel.value = e.deptId;
      document.getElementById('emp-edit-id').value = e.id;
    }
  }
  openModal('modal-employee');
}

function saveEmployee() {
  const empId    = document.getElementById('emp-id').value.trim();
  const email    = document.getElementById('emp-email').value.trim().toLowerCase();
  const position = document.getElementById('emp-pos').value.trim();
  const deptId   = document.getElementById('emp-dept').value;
  const hireDate = document.getElementById('emp-hire').value;
  const editId   = document.getElementById('emp-edit-id').value;

  const accExists = window.db.accounts.find(a => a.email === email);
  setFieldErr('f-emp-email', !accExists, 'Must match an existing account');
  if (!empId || !email || !position || !accExists) {
    showToast('Fill in all required fields.', 'error'); return;
  }

  if (editId) {
    const e = window.db.employees.find(x => x.id === editId);
    if (e) Object.assign(e, { empId, email, position, deptId, hireDate });
  } else {
    window.db.employees.push({ id: uid(), empId, email, position, deptId, hireDate });
  }
  saveToStorage();
  closeModal('modal-employee');
  renderEmployeesTable();
  showToast('Employee saved.', 'success');
}

function deleteEmployee(id) {
  if (!confirm('Delete this employee?')) return;
  window.db.employees = window.db.employees.filter(e => e.id !== id);
  saveToStorage();
  renderEmployeesTable();
  showToast('Employee removed.', 'info');
}

// ═══════════════════════════════════════════════════════
//  ACCOUNTS
// ═══════════════════════════════════════════════════════
function renderAccountsList() {
  const wrap = document.getElementById('accounts-table-wrap');
  const accs = window.db.accounts;
  const rows = accs.map(a => `<tr>
    <td>${a.firstName} ${a.lastName}</td>
    <td>${a.email}</td>
    <td>${a.role.charAt(0).toUpperCase() + a.role.slice(1)}</td>
    <td><span class="status-badge ${a.verified ? 'verified' : 'unverified'}">${a.verified ? 'Verified' : 'Unverified'}</span></td>
    <td><div class="tbl-actions">
      <button class="tbl-btn edit" onclick="openAccountModal('${a.id}')">Edit</button>
      <button class="tbl-btn rst"  onclick="resetPassword('${a.id}')">Reset PW</button>
      <button class="tbl-btn del"  onclick="deleteAccount('${a.id}')">Delete</button>
    </div></td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function openAccountModal(id = null) {
  clearFields(['acc-fn', 'acc-ln', 'acc-em', 'acc-pw']);
  document.getElementById('acc-verified').checked = false;
  document.getElementById('acc-edit-id').value = '';
  document.getElementById('acc-modal-title').textContent = id ? 'Edit Account' : 'Add Account';

  if (id) {
    const a = window.db.accounts.find(x => x.id === id);
    if (a) {
      document.getElementById('acc-fn').value        = a.firstName;
      document.getElementById('acc-ln').value        = a.lastName;
      document.getElementById('acc-em').value        = a.email;
      document.getElementById('acc-role').value      = a.role;
      document.getElementById('acc-verified').checked = a.verified;
      document.getElementById('acc-edit-id').value   = a.id;
    }
  }
  openModal('modal-account');
}

function saveAccount() {
  const fn       = document.getElementById('acc-fn').value.trim();
  const ln       = document.getElementById('acc-ln').value.trim();
  const em       = document.getElementById('acc-em').value.trim().toLowerCase();
  const pw       = document.getElementById('acc-pw').value;
  const role     = document.getElementById('acc-role').value;
  const verified = document.getElementById('acc-verified').checked;
  const editId   = document.getElementById('acc-edit-id').value;

  if (!fn || !ln || !em) { showToast('Fill in all required fields.', 'error'); return; }
  if (!editId && pw.length < 6) { setFieldErr('f-acc-pw', true); showToast('Password too short.', 'error'); return; }

  if (editId) {
    const a = window.db.accounts.find(x => x.id === editId);
    if (a) { a.firstName = fn; a.lastName = ln; a.email = em; a.role = role; a.verified = verified; }
  } else {
    window.db.accounts.push({ id: uid(), firstName: fn, lastName: ln, email: em, password: pw, role, verified });
  }
  saveToStorage();
  closeModal('modal-account');
  renderAccountsList();
  showToast('Account saved.', 'success');
}

function resetPassword(id) {
  const newPw = prompt('Enter new password (min 6 chars):');
  if (!newPw) return;
  if (newPw.length < 6) { showToast('Password too short.', 'error'); return; }
  const a = window.db.accounts.find(x => x.id === id);
  if (a) { a.password = newPw; saveToStorage(); showToast('Password reset.', 'success'); }
}

function deleteAccount(id) {
  if (currentUser?.id === id) { showToast("You can't delete your own account!", 'error'); return; }
  if (!confirm('Delete this account?')) return;
  window.db.accounts = window.db.accounts.filter(a => a.id !== id);
  saveToStorage();
  renderAccountsList();
  showToast('Account deleted.', 'info');
}

// ═══════════════════════════════════════════════════════
//  DEPARTMENTS
// ═══════════════════════════════════════════════════════
function renderDeptTable() {
  const wrap  = document.getElementById('departments-table-wrap');
  const depts = window.db.departments;
  if (!depts.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="emo">🏢</div>No departments yet.</div>';
    return;
  }
  const rows = depts.map(d => `<tr>
    <td>${d.name}</td>
    <td>${d.description || '—'}</td>
    <td><div class="tbl-actions">
      <button class="tbl-btn edit" onclick="openDeptModal('${d.id}')">Edit</button>
      <button class="tbl-btn del"  onclick="deleteDept('${d.id}')">Delete</button>
    </div></td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function openDeptModal(id = null) {
  clearFields(['dept-name', 'dept-desc']);
  document.getElementById('dept-edit-id').value = '';
  document.getElementById('dept-modal-title').textContent = id ? 'Edit Department' : 'Add Department';
  if (id) {
    const d = window.db.departments.find(x => x.id === id);
    if (d) {
      document.getElementById('dept-name').value    = d.name;
      document.getElementById('dept-desc').value    = d.description || '';
      document.getElementById('dept-edit-id').value = d.id;
    }
  }
  openModal('modal-dept');
}

function saveDept() {
  const name   = document.getElementById('dept-name').value.trim();
  const desc   = document.getElementById('dept-desc').value.trim();
  const editId = document.getElementById('dept-edit-id').value;
  if (!name) { showToast('Department name is required.', 'error'); return; }
  if (editId) {
    const d = window.db.departments.find(x => x.id === editId);
    if (d) { d.name = name; d.description = desc; }
  } else {
    window.db.departments.push({ id: uid(), name, description: desc });
  }
  saveToStorage();
  closeModal('modal-dept');
  renderDeptTable();
  showToast('Department saved.', 'success');
}

function deleteDept(id) {
  if (!confirm('Delete this department?')) return;
  window.db.departments = window.db.departments.filter(d => d.id !== id);
  saveToStorage();
  renderDeptTable();
  showToast('Department deleted.', 'info');
}

// ═══════════════════════════════════════════════════════
//  REQUESTS
// ═══════════════════════════════════════════════════════
function renderRequestsTable() {
  const wrap = document.getElementById('requests-table-wrap');
  if (!currentUser) return;
  const reqs = window.db.requests.filter(r => r.employeeEmail === currentUser.email);
  if (!reqs.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="emo">📋</div>No requests yet. Click "+ New Request" to submit one.</div>';
    return;
  }
  const rows = reqs.map(r => {
    const itemsStr = r.items.map(i => `${i.name} ×${i.qty}`).join(', ');
    return `<tr>
      <td>${r.date}</td>
      <td>${r.type}</td>
      <td style="max-width:220px;font-size:.8rem">${itemsStr}</td>
      <td><span class="status-badge ${r.status.toLowerCase()}">${r.status}</span></td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Date</th><th>Type</th><th>Items</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function openRequestModal() {
  document.getElementById('req-items-container').innerHTML = '';
  addRequestItemRow();
  openModal('modal-request');
}

function addRequestItemRow() {
  const container = document.getElementById('req-items-container');
  const div = document.createElement('div');
  div.className = 'item-row';
  div.innerHTML = `
    <input type="text"   placeholder="Item name"  class="req-item-name" style="flex:2" />
    <input type="number" placeholder="Qty" min="1" class="req-item-qty"  style="flex:.6" />
    <button class="btn-remove-item" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(div);
}

function submitRequest() {
  if (!currentUser) return;
  const type  = document.getElementById('req-type').value;
  const rows  = document.querySelectorAll('#req-items-container .item-row');
  const items = [];
  rows.forEach(r => {
    const name = r.querySelector('.req-item-name').value.trim();
    const qty  = r.querySelector('.req-item-qty').value || '1';
    if (name) items.push({ name, qty });
  });
  if (!items.length) { showToast('Add at least one item.', 'error'); return; }

  window.db.requests.push({
    id: uid(),
    type,
    items,
    status: 'Pending',
    date: new Date().toISOString().slice(0, 10),
    employeeEmail: currentUser.email
  });
  saveToStorage();
  closeModal('modal-request');
  renderRequestsTable();
  showToast('Request submitted!', 'success');
}

// ═══════════════════════════════════════════════════════
//  MODAL HELPERS
// ═══════════════════════════════════════════════════════
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-backdrop').forEach(b => {
  b.addEventListener('click', e => { if (e.target === b) b.classList.remove('open'); });
});

// ═══════════════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════════════
function setFieldErr(fieldId, show, msg) {
  const f = document.getElementById(fieldId);
  if (!f) return;
  f.classList.toggle('has-err', show);
  if (msg) { const e = f.querySelector('.err'); if (e) e.textContent = msg; }
}

function clearFields(ids) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className  = `toast ${type}`;
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
loadFromStorage();

// CHANGED: Restore session from sessionStorage (real JWT) instead of fake localStorage token
const savedToken = sessionStorage.getItem('authToken');
if (savedToken) {
  // Token exists — keep the user logged in for this session
  // In a real app you'd validate this token with the backend
  const lastEmail = sessionStorage.getItem('lastEmail');
  if (lastEmail) {
    const acc = window.db.accounts.find(a => a.email === lastEmail);
    if (acc) setAuthState(true, acc);
  }
}

// Restore verify page label if pending
const pendingEmail = localStorage.getItem('unverified_email');
if (pendingEmail) document.getElementById('verifyEmailLbl').textContent = pendingEmail;

handleRouting();