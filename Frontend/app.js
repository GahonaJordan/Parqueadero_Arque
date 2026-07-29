const GW = `${window.location.protocol}//${window.location.host}`;
const STORAGE_AUTH = 'park.auth';
const STORAGE_TENANT = 'park.tenant';

try {
  localStorage.removeItem('monitoreo.zonasEspacios.apiBaseUrl');
  localStorage.removeItem('park.gateway');
} catch (_) {}

const $ = (id) => document.getElementById(id);

const state = {
  token: null,
  user: null,
  roles: [],
  /** Tenant operativo actual (header X-Tenant-Id). */
  tenant: localStorage.getItem(STORAGE_TENANT) || '',
  /** Tenant asignado al usuario ADMIN u OPERADOR; viene del login/validate. */
  assignedTenant: null,
  tenantsCatalog: [],
  espacios: [],
  zonas: [],
  users: [],
  vehiculos: [],
  rolesCatalog: [],
  editingUserId: null,
  sse: null,
};

const show = (name) => {
  ['login', 'register', 'recover', 'app'].forEach((v) => {
    $(`view-${v}`).classList.toggle('hidden', v !== name);
  });
};

const setTenantLabels = () => {
  document.querySelectorAll('.tenant-name').forEach((el) => {
    el.textContent = state.tenant;
  });
  if ($('tenantSelect')) $('tenantSelect').value = state.tenant;
};

const hasRole = (...roles) => roles.some((r) => state.roles.includes(r));
const isSuperAdmin = () => hasRole('SUPER_ADMIN');
const isAdmin = () => hasRole('SUPER_ADMIN', 'ADMIN');
const isOperador = () => hasRole('OPERADOR');
const isOperadorOnly = () => isOperador() && !isAdmin();
const isUsuarioOnly = () => hasRole('USUARIO') && !isAdmin() && !isOperador();
const operadorAssignedTenant = () => state.assignedTenant || null;
const adminAssignedTenant = () => state.assignedTenant || null;

/** Roles que el usuario actual puede asignar / quitar en el selector */
const assignableRoleNames = () => {
  if (isSuperAdmin()) return ['ADMIN', 'USUARIO'];
  if (hasRole('ADMIN')) return ['OPERADOR', 'USUARIO'];
  return [];
};
const removableRoleNames = () => {
  if (isSuperAdmin()) return ['ADMIN', 'OPERADOR', 'USUARIO'];
  if (hasRole('ADMIN')) return ['OPERADOR', 'USUARIO'];
  return [];
};

const applyTenantLock = () => {
  const loginSel = $('loginTenant');
  const appSel = $('tenantSelect');
  const assigned = state.assignedTenant; // slug del tenant asignado (para ADMIN y OPERADOR)
  const needLock = isOperadorOnly() || (hasRole('ADMIN') && !isSuperAdmin());
  const lockTenant = (sel) => {
    if (!sel) return;
    [...sel.options].forEach((opt) => {
      if (!opt.value) return;
      const allowed = !needLock || !assigned || opt.value === assigned;
      opt.disabled = !allowed;
      opt.hidden = !allowed;
    });
  };
  lockTenant(loginSel);
  lockTenant(appSel);
  if (needLock && assigned) {
    state.tenant = assigned;
    localStorage.setItem(STORAGE_TENANT, assigned);
    if (loginSel) loginSel.value = assigned;
    if (appSel) {
      appSel.value = assigned;
      appSel.disabled = true;
    }
  } else if (appSel) {
    appSel.disabled = false;
  }
};

const applyRoleUi = () => {
  $('rolesBadge').textContent = state.roles.join(', ') || 'sin roles';
  $('userLabel').textContent = state.user?.username || '—';
  applyTenantLock();
  document.querySelectorAll('#mainNav [data-roles]').forEach((btn) => {
    const need = btn.dataset.roles.split(',');
    const ok = need.some((r) => state.roles.includes(r.trim()));
    btn.classList.toggle('hidden', !ok);
    btn.disabled = !ok;
    btn.classList.toggle('opacity-40', !ok);
  });
  document.querySelectorAll('[data-roles]').forEach((el) => {
    if (el.closest('#mainNav')) return;
    const need = el.dataset.roles.split(',');
    // data-roles="USUARIO" = solo visible para usuario puro (hints)
    const onlyUsuario = need.length === 1 && need[0].trim() === 'USUARIO';
    const ok = onlyUsuario
      ? isUsuarioOnly()
      : need.some((r) => state.roles.includes(r.trim()));
    el.classList.toggle('hidden', !ok);
  });
  if ($('usuariosHint')) {
    $('usuariosHint').textContent = isSuperAdmin()
      ? 'SUPER_ADMIN: asigna ADMIN/USUARIO y el tenant de cada ADMIN.'
      : 'ADMIN: asigna OPERADOR; el OPERADOR hereda automáticamente su tenant.';
  }
};

async function api(path, { method = 'GET', body, auth = true, tenant = true } = {}) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;
  if (tenant) {
    if (!state.tenant) {
      throw new Error('Debes seleccionar un parqueadero (X-Tenant-Id): condado | cci | espe');
    }
    headers['X-Tenant-Id'] = state.tenant;
  }
  // No enviar X-Internal-Key desde el navegador (solo MS→MS)

  const res = await fetch(`${GW}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      (typeof data === 'string' ? data : `HTTP ${res.status}`);
    const errMsg = Array.isArray(msg) ? msg.join(', ') : msg;
    throw new Error(errMsg);
  }
  return data;
}

async function login(username, password) {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: { username, password },
    auth: false,
    tenant: false,
  });
  state.token = data.accessToken;
  state.user = {
    userId: data.userId,
    username: data.username,
    person: data.person,
  };
  state.roles = data.roles || [];
  state.assignedTenant = data.tenantId || null;
  localStorage.setItem(
    STORAGE_AUTH,
    JSON.stringify({
      token: state.token,
      user: state.user,
      roles: state.roles,
      assignedTenant: state.assignedTenant,
    }),
  );
  await refreshRolesFromServer();
  enterApp();
}

async function refreshRolesFromServer() {
  if (!state.token) return;
  try {
    const v = await api('/api/auth/validate', { auth: true, tenant: false });
    if (v?.valid && Array.isArray(v.roles)) {
      state.roles = v.roles;
      if (v.tenantId !== undefined) {
        state.assignedTenant = v.tenantId || null;
      }
      const saved = JSON.parse(localStorage.getItem(STORAGE_AUTH) || '{}');
      saved.roles = v.roles;
      saved.assignedTenant = state.assignedTenant;
      localStorage.setItem(STORAGE_AUTH, JSON.stringify(saved));
    } else if (v && v.valid === false) {
      logout();
    }
  } catch {
    /* keep login roles */
  }
}

function logout() {
  state.token = null;
  state.user = null;
  state.roles = [];
  state.assignedTenant = null;
  localStorage.removeItem(STORAGE_AUTH);
  if (state.sse) {
    state.sse.close();
    state.sse = null;
  }
  show('login');
}

function enterApp() {
  const needTenant = isOperadorOnly() || (hasRole('ADMIN') && !isSuperAdmin());
  const assigned = state.assignedTenant;

  if (needTenant && !assigned) {
    logout();
    const label = isOperadorOnly() ? 'Operador' : 'Admin';
    $('loginError').textContent =
      `Este ${label} no tiene tenant asignado. Un SUPER_ADMIN debe asociarlo a un parqueadero.`;
    $('loginError').classList.remove('hidden');
    return;
  }

  if (needTenant && assigned) {
    state.tenant = assigned;
    localStorage.setItem(STORAGE_TENANT, assigned);
  }

  applyTenantLock();

  if (!state.tenant) {
    show('login');
    $('loginError').textContent = 'Selecciona un parqueadero para continuar.';
    $('loginError').classList.remove('hidden');
    return;
  }

  if (needTenant && state.tenant !== assigned) {
    show('login');
    const label = isOperadorOnly() ? 'operador' : 'admin';
    $('loginError').textContent = `El ${label} solo puede ingresar a "${assigned}".`;
    $('loginError').classList.remove('hidden');
    return;
  }
  show('app');
  applyRoleUi();
  setTenantLabels();
  if (isAdmin()) {
    cargarTenantsCatalog().catch(() => {});
  }
  switchTab('espacios');
  cargarEspacios();
  renderPerfil();
}

function restoreSession() {
  const raw = localStorage.getItem(STORAGE_AUTH);
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    state.token = saved.token;
    state.user = saved.user;
    state.roles = saved.roles || [];
    state.assignedTenant = saved.assignedTenant || null;
    return !!state.token;
  } catch {
    return false;
  }
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
  const panel = $(`tab-${name}`);
  if (panel) panel.classList.remove('hidden');
  if (name === 'tickets') cargarTickets();
  if (name === 'tickets') cargarVehiculosParaTicket();
  if (name === 'usuarios') cargarUsuarios();
  if (name === 'tenants') cargarTenantsAdmin();
  if (name === 'zonas') cargarZonasAdmin();
  if (name === 'vehiculos') cargarVehiculos();
  if (name === 'auditoria') cargarAuditoria();
  if (name === 'perfil') renderPerfil();
}

async function cargarTenantsCatalog() {
  if (!isAdmin()) return;
  try {
    const list = await api('/api/tenants?activeOnly=true', { tenant: false });
    state.tenantsCatalog = Array.isArray(list) ? list : [];
    fillAssignTenantSelect();
    fillTenantSelectOptions();
  } catch {
    state.tenantsCatalog = [];
  }
}

function fillAssignTenantSelect() {
  const sel = $('assignTenantSelect');
  if (!sel) return;
  const opts = state.tenantsCatalog
    .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.slug)} — ${escapeHtml(t.name)}</option>`)
    .join('');
  sel.innerHTML = `<option value="">Seleccionar tenant…</option>${opts}`;
}

function fillTenantSelectOptions() {
  if (!state.tenantsCatalog.length) return;
  const fill = (sel) => {
    if (!sel) return;
    const current = sel.value || state.tenant || '';
    sel.innerHTML =
      `<option value="">Selecciona…</option>` +
      state.tenantsCatalog
        .map((t) => `<option value="${escapeHtml(t.slug)}">${escapeHtml(t.name)}</option>`)
        .join('');
    if (current) sel.value = current;
  };
  fill($('loginTenant'));
  fill($('tenantSelect'));
  applyTenantLock();
}

async function cargarTenantsAdmin() {
  if (!isSuperAdmin()) return;
  const tbody = $('tenantsBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td class="px-3 py-3" colspan="4">Cargando…</td></tr>';
  try {
    const list = await api('/api/tenants', { tenant: false });
    state.tenantsCatalog = Array.isArray(list) ? list : [];
    fillAssignTenantSelect();
    fillTenantSelectOptions();
    if (!state.tenantsCatalog.length) {
      tbody.innerHTML = '<tr><td class="px-3 py-3 text-slate-500" colspan="4">Sin tenants</td></tr>';
      return;
    }
    tbody.innerHTML = state.tenantsCatalog
      .map(
        (t) => `<tr class="border-t">
        <td class="px-3 py-2 font-semibold">${escapeHtml(t.slug)}</td>
        <td class="px-3 py-2">${escapeHtml(t.name)}</td>
        <td class="px-3 py-2">${t.active ? 'Sí' : 'No'}</td>
        <td class="px-3 py-2">
          <button data-del-tenant="${escapeHtml(t.id)}" class="text-red-600 font-semibold">Eliminar</button>
        </td>
      </tr>`,
      )
      .join('');
    tbody.querySelectorAll('[data-del-tenant]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar tenant? Solo si no tiene usuarios asociados.')) return;
        try {
          await api(`/api/tenants/${btn.dataset.delTenant}`, { method: 'DELETE', tenant: false });
          await cargarTenantsAdmin();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td class="px-3 py-3 text-red-600" colspan="4">${escapeHtml(err.message)}</td></tr>`;
  }
}

const estadoMeta = {
  DISPONIBLE: { label: 'Disponible', className: 'estado-disponible' },
  OCUPADO: { label: 'Ocupado', className: 'estado-ocupado' },
  RESERVADO: { label: 'Reservado', className: 'estado-reservado' },
};

function setStatus(ok, msg) {
  $('indicator').className = `h-3 w-3 rounded-full ${ok === true ? 'bg-emerald-500' : ok === false ? 'bg-red-500' : 'bg-amber-500'}`;
  $('statusText').textContent = msg;
}

async function cargarEspacios() {
  setStatus(null, 'Consultando…');
  try {
    const [espacios, zonas] = await Promise.all([
      api('/api/espacios'),
      api('/api/zonas').catch(() => []),
    ]);
    state.espacios = Array.isArray(espacios) ? espacios : [];
    state.zonas = Array.isArray(zonas) ? zonas : [];
    fillEspacioZonaSelect();
    renderEspacios();
    setStatus(true, `OK · ${state.tenant}`);
    connectSse();
  } catch (err) {
    $('zonasContainer').innerHTML = `<div class="rounded-md border border-red-200 bg-red-50 p-6 text-red-700">${escapeHtml(err.message)}</div>`;
    setStatus(false, 'Error');
  }
}

function fillEspacioZonaSelect() {
  const sel = $('espZona');
  if (!sel) return;
  sel.innerHTML = state.zonas
    .map((z) => `<option value="${escapeHtml(z.id)}">${escapeHtml(z.nombre || z.id)}</option>`)
    .join('');
}

function connectSse() {
  if (state.sse) state.sse.close();
  try {
    state.sse = new EventSource(`${GW}/sse/espacios?tenantId=${encodeURIComponent(state.tenant)}`);
    state.sse.addEventListener('espacio-actualizado', (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        const data = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data || payload;
        if (data.tenantId && data.tenantId !== state.tenant) return;
        const idx = state.espacios.findIndex((e) => String(e.id) === String(data.idEspacio || data.id));
        if (idx >= 0 && data.estado) {
          state.espacios[idx] = { ...state.espacios[idx], estado: data.estado };
          renderEspacios();
          setStatus(true, `SSE · ${state.tenant}`);
        }
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

function renderEspacios() {
  const totales = state.espacios.reduce((a, e) => {
    a[e.estado] = (a[e.estado] || 0) + 1;
    return a;
  }, {});
  $('totalEspacios').textContent = state.espacios.length;
  $('totalDisponibles').textContent = totales.DISPONIBLE || 0;
  $('totalOcupados').textContent = totales.OCUPADO || 0;
  $('totalReservados').textContent = totales.RESERVADO || 0;

  const byZona = new Map();
  for (const e of state.espacios) {
    const zid = String(e.idzona || 'x');
    if (!byZona.has(zid)) {
      byZona.set(zid, { nombre: e.nombrezona || 'Zona', espacios: [] });
    }
    byZona.get(zid).espacios.push(e);
  }

  if (!state.espacios.length) {
    $('zonasContainer').innerHTML = `<div class="rounded-md border bg-white p-8 text-center text-slate-500">No hay espacios en <strong>${escapeHtml(state.tenant)}</strong>.</div>`;
    return;
  }

  const canDeleteEspacio = isAdmin(); // SUPER_ADMIN o ADMIN
  const canMaintenanceEspacio = hasRole('SUPER_ADMIN', 'ADMIN');
  $('zonasContainer').innerHTML = [...byZona.values()]
    .map((z) => {
      const cards = z.espacios
        .map((e) => {
          const meta = estadoMeta[e.estado] || { label: e.estado, className: '' };
          const actions = [];
          if (canMaintenanceEspacio && e.estado !== 'MANTENIMIENTO') {
            actions.push(`<button data-maint-esp="${escapeHtml(e.id)}" class="text-xs text-amber-600 font-semibold">Mantenimiento</button>`);
          }
          if (canMaintenanceEspacio && e.estado === 'MANTENIMIENTO') {
            actions.push(`<button data-avail-esp="${escapeHtml(e.id)}" class="text-xs text-emerald-600 font-semibold">Disponible</button>`);
          }
          if (canDeleteEspacio) {
            actions.push(`<button data-del-esp="${escapeHtml(e.id)}" class="text-xs text-red-600 font-semibold">Eliminar</button>`);
          }
          const actionsHtml = actions.length > 0 ? actions.join(' | ') : '';
          return `<div class="espacio-card ${meta.className}" data-id="${escapeHtml(e.id)}" data-zona="${escapeHtml(e.nombrezona || '')}">
            <div><p class="font-semibold">${escapeHtml(e.nombre || e.descripcion || 'Espacio')}</p><p class="text-xs text-slate-600">Tipo: ${escapeHtml(String(e.tipo || 'SIN TIPO').replaceAll('_', ' '))}</p><p class="text-xs text-slate-500">${escapeHtml(e.id)}</p>${actionsHtml ? `<p class="text-xs mt-1">${actionsHtml}</p>` : ''}</div>
            <span class="estado-badge">${escapeHtml(meta.label)}</span>
          </div>`;
        })
        .join('');
      return `<article class="zona-panel"><div class="border-b p-4 font-bold">${escapeHtml(z.nombre)}</div><div class="grid gap-2 p-4 sm:grid-cols-2">${cards}</div></article>`;
    })
    .join('');

  $('zonasContainer').querySelectorAll('.espacio-card').forEach((card) => {
    card.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-del-esp]')) return;
      if ($('tkEspacio') && hasRole('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'USUARIO')) {
        $('tkEspacio').value = card.dataset.id;
        $('tkZona').value = card.dataset.zona || '';
        switchTab('tickets');
      }
    });
  });
  $('zonasContainer').querySelectorAll('[data-del-esp]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('¿Eliminar espacio?')) return;
      try {
        await api(`/api/espacios/${btn.dataset.delEsp}`, { method: 'DELETE' });
        await cargarEspacios();
      } catch (err) {
        alert(err.message);
      }
    });
  });
  $('zonasContainer').querySelectorAll('[data-maint-esp]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('¿Poner espacio en mantenimiento?')) return;
      try {
        await api(`/api/espacios/${btn.dataset.maintEsp}/estado`, {
          method: 'PUT',
          body: { estado: 'MANTENIMIENTO' },
        });
        await cargarEspacios();
      } catch (err) {
        alert(err.message);
      }
    });
  });
  $('zonasContainer').querySelectorAll('[data-avail-esp]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('¿Poner espacio disponible?')) return;
      try {
        await api(`/api/espacios/${btn.dataset.availEsp}/estado`, {
          method: 'PUT',
          body: { estado: 'DISPONIBLE' },
        });
        await cargarEspacios();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function cargarTickets() {
  if (!hasRole('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'USUARIO')) return;
  const tbody = $('ticketsBody');
  tbody.innerHTML = '<tr><td class="px-3 py-3" colspan="5">Cargando…</td></tr>';
  const canClose = hasRole('SUPER_ADMIN', 'ADMIN', 'OPERADOR');
  const canReserve = hasRole('USUARIO');
  const canManageReserva = hasRole('USUARIO', 'OPERADOR');
  try {
    const list = await api('/tickets/activos');
    if (!Array.isArray(list) || !list.length) {
      tbody.innerHTML = '<tr><td class="px-3 py-3 text-slate-500" colspan="5">Sin tickets activos ni reservas</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map(
        (t) => `<tr class="border-t">
        <td class="px-3 py-2 font-semibold">${escapeHtml(t.placa)}</td>
        <td class="px-3 py-2">${escapeHtml(t.dni)}</td>
        <td class="px-3 py-2">${escapeHtml(t.fechaIngreso || '')}</td>
        <td class="px-3 py-2"><span class="text-xs font-semibold px-2 py-1 rounded ${
          t.estado === 'RESERVADO' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
        }">${escapeHtml(t.estado || 'ACTIVO')}</span></td>
        <td class="px-3 py-2">${
          t.estado === 'RESERVADO' && canManageReserva
            ? `<button data-activar="${escapeHtml(t.id)}" class="text-teal-700 font-semibold mr-2">Activar</button>
               <button data-cancelar="${escapeHtml(t.id)}" class="text-red-600 font-semibold">Cancelar</button>`
            : canClose && t.estado !== 'RESERVADO'
            ? `<button data-close="${escapeHtml(t.id)}" class="text-teal-700 font-semibold">Cerrar</button>`
            : '—'
        }</td>
      </tr>`,
      )
      .join('');
    tbody.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api(`/tickets/${btn.dataset.close}`, { method: 'PATCH', body: { activo: false } });
          await cargarTickets();
          await cargarEspacios();
        } catch (err) {
          alert(err.message);
        }
      });
    });
    tbody.querySelectorAll('[data-activar]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api(`/tickets/${btn.dataset.activar}/activar`, { method: 'PATCH' });
          await cargarTickets();
          await cargarEspacios();
        } catch (err) {
          alert(err.message);
        }
      });
    });
    tbody.querySelectorAll('[data-cancelar]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Cancelar esta reserva?')) return;
        try {
          await api(`/tickets/${btn.dataset.cancelar}/reserva`, { method: 'DELETE' });
          await cargarTickets();
          await cargarEspacios();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td class="px-3 py-3 text-red-600" colspan="5">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function cargarUsuarios() {
  if (!isAdmin()) return;
  const tbody = $('usersBody');
  tbody.innerHTML = '<tr><td class="px-3 py-3" colspan="7">Cargando…</td></tr>';
  try {
    const [users, roles] = await Promise.all([
      api('/api/users', { tenant: false }),
      api('/api/roles', { tenant: false }).catch(() => []),
      cargarTenantsCatalog(),
    ]);
    state.users = Array.isArray(users) ? users : [];
    state.rolesCatalog = Array.isArray(roles) ? roles : [];
    fillRoleSelect();
    fillAssignTenantSelect();
    if (!state.users.length) {
      tbody.innerHTML = '<tr><td class="px-3 py-3 text-slate-500" colspan="7">Sin usuarios</td></tr>';
      return;
    }
    tbody.innerHTML = state.users
      .map((u) => {
        const p = u.person || {};
        const isSuperAdminUser = String(u.username || '').toLowerCase() === 'superadmin';
        const tenantLabel = u.tenantSlug || '—';

        const editBtn = !isSuperAdminUser
          ? `<button data-edit-user="${escapeHtml(u.id)}" class="text-teal-700 font-semibold">Editar</button>`
          : `<button disabled title="El Super Administrador no puede modificarse."
                class="text-slate-400 cursor-not-allowed font-semibold">
                Editar
            </button>`;

        const delBtn = isAdmin() && !isSuperAdminUser
          ? `<button data-del-user="${escapeHtml(u.id)}" class="text-red-600 font-semibold">Eliminar</button>`
          : `<button disabled title="${isSuperAdminUser ? 'El Super Administrador está protegido.' : 'No tiene permisos.'}"
                class="text-slate-400 cursor-not-allowed font-semibold">
                Eliminar
            </button>`;

        return `<tr class="border-t">
          <td class="px-3 py-2 font-semibold">${escapeHtml(u.username)}</td>
          <td class="px-3 py-2">${escapeHtml([p.firstName, p.lastName].filter(Boolean).join(' '))}</td>
          <td class="px-3 py-2">${escapeHtml(p.email || '')}</td>
          <td class="px-3 py-2">${escapeHtml((u.roles || []).join(', '))}</td>
          <td class="px-3 py-2 uppercase">${escapeHtml(tenantLabel)}</td>
          <td class="px-3 py-2">${u.active ? 'Sí' : 'No'}</td>
          <td class="px-3 py-2 space-x-2">
            ${editBtn}
            ${delBtn}
          </td>
        </tr>`;
    })
    .join('');

    tbody.querySelectorAll('[data-edit-user]').forEach((btn) => {
      btn.addEventListener('click', () => openUserEdit(btn.dataset.editUser));
    });
    tbody.querySelectorAll('[data-del-user]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar usuario? Solo ADMIN.')) return;
        try {
          await api(`/api/users/${btn.dataset.delUser}`, { method: 'DELETE', tenant: false });
          await cargarUsuarios();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td class="px-3 py-3 text-red-600" colspan="7">${escapeHtml(err.message)}</td></tr>`;
  }
}

function fillRoleSelect() {
  if (!$('roleSelect')) return;
  const allowed = new Set([...assignableRoleNames(), ...removableRoleNames()]);
  const filtered = state.rolesCatalog.filter((r) => allowed.has(r.name));
  $('roleSelect').innerHTML = filtered
    .map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`)
    .join('');
}

function openUserEdit(userId) {
  const u = state.users.find((x) => String(x.id) === String(userId));
  if (!u) return;
  state.editingUserId = u.id;
  const p = u.person || {};
  $('editUserId').value = u.id;
  $('editFirst').value = p.firstName || '';
  $('editLast').value = p.lastName || '';
  $('editEmail').value = p.email || '';
  $('editPhone').value = p.phone || '';
  $('editActive').value = u.active ? 'true' : 'false';
  $('userEditPanel').classList.remove('hidden');
  $('userEditMsg').textContent = '';
  fillRoleSelect();
  const selectedRole = state.rolesCatalog.find((role) =>
    (u.roles || []).includes(role.name) && removableRoleNames().includes(role.name),
  );
  if (selectedRole && $('roleSelect')) {
    $('roleSelect').value = selectedRole.id;
  }
  if (isAdmin()) {
    $('assignRoleBox').classList.remove('hidden');
    $('assignTenantBox').classList.toggle('hidden', !isSuperAdmin());
    fillAssignTenantSelect();
    if ($('assignTenantSelect')) {
      $('assignTenantSelect').value = u.tenantId || '';
    }
    // Show current tenant info in the select
    const hint = $('tenantBoxHint');
    if (isSuperAdmin()) {
      hint.innerHTML = 'SUPER_ADMIN: asigna un tenant únicamente a usuarios con rol ADMIN.';
    } else {
      hint.innerHTML = 'Los OPERADORES heredan automáticamente el tenant del ADMIN.';
    }
  } else {
    $('assignRoleBox').classList.add('hidden');
    $('assignTenantBox').classList.add('hidden');
  }
}

async function cargarZonasAdmin() {
  if (!isAdmin()) return;
  const tbody = $('zonasBody');
  tbody.innerHTML = '<tr><td class="px-3 py-3" colspan="4">Cargando…</td></tr>';
  try {
    const zonas = await api('/api/zonas');
    state.zonas = Array.isArray(zonas) ? zonas : [];
    fillEspacioZonaSelect();
    if (!state.zonas.length) {
      tbody.innerHTML = '<tr><td class="px-3 py-3 text-slate-500" colspan="4">Sin zonas</td></tr>';
      return;
    }
    tbody.innerHTML = state.zonas
      .map(
        (z) => `<tr class="border-t">
        <td class="px-3 py-2 font-semibold">${escapeHtml(z.nombre)}</td>
        <td class="px-3 py-2">${escapeHtml(z.tipo)}</td>
        <td class="px-3 py-2">${escapeHtml(z.capacidad)}</td>
        <td class="px-3 py-2"><button data-del-zona="${escapeHtml(z.id)}" class="text-red-600 font-semibold">Eliminar</button></td>
      </tr>`,
      )
      .join('');
    tbody.querySelectorAll('[data-del-zona]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar zona?')) return;
        try {
          await api(`/api/zonas/${btn.dataset.delZona}`, { method: 'DELETE' });
          await cargarZonasAdmin();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td class="px-3 py-3 text-red-600" colspan="4">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function cargarVehiculos() {
  const tbody = $('vehiculosBody');
  tbody.innerHTML = '<tr><td class="px-3 py-3" colspan="5">Cargando…</td></tr>';
  try {
    const list = await api('/vehiculo');
    state.vehiculos = Array.isArray(list) ? list : [];
    fillTicketVehicleSelect();
    if (!Array.isArray(list) || !list.length) {
      tbody.innerHTML = '<tr><td class="px-3 py-3 text-slate-500" colspan="5">Sin vehículos</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map((v) => {
        const d = v.datos || v;
        const canEditDelete = hasRole('USUARIO', 'ADMIN', 'SUPER_ADMIN');
        const del = canEditDelete
          ? `<button data-del-vh="${escapeHtml(v.id)}" class="text-red-600 font-semibold">Eliminar</button>`
          : '—';
        return `<tr class="border-t">
          <td class="px-3 py-2 font-semibold">${escapeHtml(d.placa || v.placa)}</td>
          <td class="px-3 py-2">${escapeHtml(v.tipo || d.tipo || '')}</td>
          <td class="px-3 py-2">${escapeHtml(d.marca || '')}</td>
          <td class="px-3 py-2">${escapeHtml(d.modelo || '')}</td>
          <td class="px-3 py-2">${del}</td>
        </tr>`;
      })
      .join('');
    tbody.querySelectorAll('[data-del-vh]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar vehículo?')) return;
        try {
          await api(`/vehiculo/${btn.dataset.delVh}`, { method: 'DELETE' });
          await cargarVehiculos();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td class="px-3 py-3 text-red-600" colspan="5">${escapeHtml(err.message)}</td></tr>`;
  }
}

function vehicleValue(vehicle) {
  return vehicle?.datos || vehicle || {};
}

function fillTicketVehicleSelect() {
  const select = $('tkPlaca');
  const dniInput = $('tkDni');
  if (!select || !dniInput) return;
  const dni = dniInput.value.trim();
  const vehicles = (state.vehiculos || []).filter((vehicle) => {
    const data = vehicleValue(vehicle);
    const ownerDni = vehicle.ownerDni || data.ownerDni;
    return !dni || !ownerDni || ownerDni === dni;
  });
  select.disabled = !dni || vehicles.length === 0;
  select.innerHTML = !dni
    ? '<option value="">Primero ingresa la cédula…</option>'
    : vehicles.length === 0
      ? '<option value="">No hay vehículos para esta cédula</option>'
      : `<option value="">Selecciona una placa…</option>${vehicles.map((vehicle) => {
          const data = vehicleValue(vehicle);
          const plate = String(data.placa || vehicle.placa || '').toUpperCase();
          const type = vehicle.vehiculoTipo || vehicle.tipo || data.tipo || '';
          return `<option value="${escapeHtml(plate)}">${escapeHtml(plate)}${type ? ` · ${escapeHtml(type)}` : ''}</option>`;
        }).join('')}`;
}

async function cargarVehiculosParaTicket() {
  try {
    state.vehiculos = await api('/vehiculo');
    if (!Array.isArray(state.vehiculos)) state.vehiculos = [];
    const dni = state.user?.person?.dni;
    if (isUsuarioOnly() && dni && !$('tkDni').value) $('tkDni').value = dni;
    fillTicketVehicleSelect();
  } catch {
    state.vehiculos = [];
    fillTicketVehicleSelect();
  }
}

async function cargarAuditoria() {
  if (!isAdmin()) return;
  const tbody = $('auditBody');
  tbody.innerHTML = '<tr><td class="px-3 py-3" colspan="5">Cargando…</td></tr>';
  try {
    const list = await api('/audit', { tenant: false });
    if (!Array.isArray(list) || !list.length) {
      tbody.innerHTML =
        '<tr><td class="px-3 py-3 text-slate-500" colspan="5">Sin eventos. Verifica RabbitMQ y publishers de cada MS.</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .slice(0, 100)
      .map(
        (e) => `<tr class="border-t">
        <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(e.timestamp || e.createdAt || '')}</td>
        <td class="px-3 py-2">${escapeHtml(e.servicio)}</td>
        <td class="px-3 py-2">${escapeHtml(e.accion)}</td>
        <td class="px-3 py-2">${escapeHtml(e.entidad)} <span class="text-xs text-slate-400">${escapeHtml(e.entidadId || '')}</span></td>
        <td class="px-3 py-2">${escapeHtml(e.usuario || '')}</td>
      </tr>`,
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td class="px-3 py-3 text-red-600" colspan="5">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderPerfil() {
  const p = state.user?.person;
  $('perfilDl').innerHTML = `
    <div><dt class="text-slate-500">Usuario</dt><dd class="font-semibold">${escapeHtml(state.user?.username)}</dd></div>
    <div><dt class="text-slate-500">Roles (servidor)</dt><dd class="font-semibold">${escapeHtml(state.roles.join(', '))}</dd></div>
    <div><dt class="text-slate-500">DNI</dt><dd>${escapeHtml(p?.dni || '—')}</dd></div>
    <div><dt class="text-slate-500">Nombre</dt><dd>${escapeHtml([p?.firstName, p?.lastName].filter(Boolean).join(' ') || '—')}</dd></div>
    <div><dt class="text-slate-500">Email</dt><dd>${escapeHtml(p?.email || '—')}</dd></div>
    <div><dt class="text-slate-500">Parqueadero actual</dt><dd class="font-semibold uppercase">${escapeHtml(state.tenant)}</dd></div>
    <div><dt class="text-slate-500">Tenant asignado (OPERADOR)</dt><dd class="font-semibold uppercase">${escapeHtml(state.assignedTenant || '—')}</dd></div>
  `;
}

function escapeHtml(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildVehiculoPayload() {
  const tipo = $('vhTipo').value;
  const datos = {
    placa: $('vhPlaca').value.trim().toUpperCase(),
    marca: $('vhMarca').value.trim(),
    modelo: $('vhModelo').value.trim(),
    color: $('vhColor').value.trim(),
    anio: Number($('vhAnio').value),
    clasificacion: $('vhClasif').value.trim() || 'Gasolina',
  };
  if (tipo === 'auto') {
    datos.numeroPuertas = Number($('vhExtra1').value);
    datos.capacidadMaletero = Number($('vhExtra2').value);
  } else if (tipo === 'motocicleta') {
    datos.tipo = $('vhExtra1').value || 'Naked';
  } else {
    datos.cabina = $('vhExtra1').value || 'Simple';
    datos.capacidadCarga = Number($('vhExtra2').value || 500);
  }
  return { tipo, datos };
}

function syncVehiculoExtraFields() {
  const tipo = $('vhTipo').value;
  if (tipo === 'auto') {
    $('vhExtraLabel').innerHTML = 'Puertas<input id="vhExtra1" type="number" value="4" class="mt-1 w-full rounded-md border px-3 py-2" />';
    $('vhExtraLabel2').classList.remove('hidden');
    $('vhExtraLabel2').innerHTML = 'Maletero (L)<input id="vhExtra2" type="number" value="400" class="mt-1 w-full rounded-md border px-3 py-2" />';
  } else if (tipo === 'motocicleta') {
    $('vhExtraLabel').innerHTML =
      'Tipo moto<select id="vhExtra1" class="mt-1 w-full rounded-md border px-3 py-2"><option>Naked</option><option>Deportiva</option><option>Crucero</option><option>Scooter</option><option>Enduro</option></select>';
    $('vhExtraLabel2').classList.add('hidden');
  } else {
    $('vhExtraLabel').innerHTML =
      'Cabina<select id="vhExtra1" class="mt-1 w-full rounded-md border px-3 py-2"><option>Simple</option><option>Doble</option></select>';
    $('vhExtraLabel2').classList.remove('hidden');
    $('vhExtraLabel2').innerHTML = 'Carga (kg)<input id="vhExtra2" type="number" value="500" class="mt-1 w-full rounded-md border px-3 py-2" />';
  }
}

// ——— Events ———
$('gwLabel').textContent = GW;

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('loginError').classList.add('hidden');
  let tenant = $('loginTenant').value;
  if (!tenant) {
    $('loginError').textContent = 'Debes seleccionar el parqueadero (Condado, CCI o ESPE).';
    $('loginError').classList.remove('hidden');
    return;
  }
  state.tenant = tenant;
  localStorage.setItem(STORAGE_TENANT, tenant);
  try {
    await login($('loginUser').value.trim(), $('loginPass').value);
    // enterApp() ya fuerza Condado si es OPERADOR
  } catch (err) {
    $('loginError').textContent = err.message;
    $('loginError').classList.remove('hidden');
  }
});

$('showRegister').addEventListener('click', () => show('register'));
$('showLogin').addEventListener('click', () => show('login'));
$('showRecover').addEventListener('click', () => show('recover'));
$('showLoginFromRecover').addEventListener('click', () => show('login'));
$('goRecoverFromPerfil').addEventListener('click', () => {
  logout();
  show('recover');
});

$('forgotForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('forgotMsg');
  msg.textContent = '';
  msg.className = 'mt-2 text-sm';
  try {
    const r = await api('/api/auth/forgot-password', {
      method: 'POST',
      auth: false,
      tenant: false,
      body: {
        username: $('recUser').value.trim(),
        email: $('recEmail').value.trim(),
        dni: $('recDni').value.trim(),
      },
    });
    $('recToken').value = r.resetToken || '';
    msg.textContent = `${r.message} (válido ${r.expiresInSeconds}s)`;
    msg.classList.add('text-emerald-700');
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('text-red-600');
  }
});

$('resetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('resetMsg');
  msg.textContent = '';
  msg.className = 'mt-2 text-sm';
  if ($('recPass').value !== $('recPass2').value) {
    msg.textContent = 'Las contraseñas no coinciden';
    msg.classList.add('text-red-600');
    return;
  }
  try {
    const r = await api('/api/auth/reset-password', {
      method: 'POST',
      auth: false,
      tenant: false,
      body: {
        resetToken: $('recToken').value.trim(),
        newPassword: $('recPass').value,
      },
    });
    msg.textContent = r.message || 'Contraseña actualizada';
    msg.classList.add('text-emerald-700');
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('text-red-600');
  }
});

$('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('regError').classList.add('hidden');
  $('regOk').classList.add('hidden');
  try {
    await api('/api/users', {
      method: 'POST',
      auth: false,
      tenant: false,
      body: {
        dni: $('regDni').value.trim(),
        firstName: $('regFirst').value.trim(),
        middleName: $('regMiddle').value.trim() || 'N',
        lastName: $('regLast').value.trim(),
        email: $('regEmail').value.trim(),
        phone: $('regPhone').value.trim(),
        address: $('regAddress').value.trim() || 'Quito',
        nationality: $('regNationality').value.trim() || 'Ecuatoriana',
        password: $('regPass').value,
      },
    });
    $('regOk').textContent =
      'Cuenta creada. Ya puedes iniciar sesión y recuperar contraseña si la olvidas.';
    $('regOk').classList.remove('hidden');
  } catch (err) {
    let msg = err.message;
    if (/dni|email|existe/i.test(msg)) {
      msg += ' — Si ya te registraste, inicia sesión o recupera la contraseña.';
    }
    $('regError').textContent = msg;
    $('regError').classList.remove('hidden');
  }
});

$('logoutBtn').addEventListener('click', logout);
$('refreshEspacios').addEventListener('click', cargarEspacios);
$('refreshTickets')?.addEventListener('click', cargarTickets);
$('refreshUsers')?.addEventListener('click', cargarUsuarios);
$('refreshVehiculos')?.addEventListener('click', cargarVehiculos);
$('refreshAudit')?.addEventListener('click', cargarAuditoria);

$('tenantSelect').addEventListener('change', () => {
  const v = $('tenantSelect').value;
  if (!v) {
    alert('Debes elegir un parqueadero.');
    $('tenantSelect').value = state.tenant || '';
    return;
  }
  const assigned = state.assignedTenant;
  const needLock = isOperadorOnly() || (hasRole('ADMIN') && !isSuperAdmin());
  if (needLock && assigned && v !== assigned) {
    alert(`Solo puedes operar en el parqueadero "${assigned}".`);
    $('tenantSelect').value = assigned;
    return;
  }
  state.tenant = v;
  localStorage.setItem(STORAGE_TENANT, state.tenant);
  setTenantLabels();
  cargarEspacios();
  const active = document.querySelector('.tab-btn.active')?.dataset.tab;
  if (active === 'tickets') cargarTickets();
  if (active === 'zonas') cargarZonasAdmin();
});

$('mainNav').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (!btn || btn.disabled) return;
  switchTab(btn.dataset.tab);
});

async function validarPersona(dni) {
  try {
    const data = await api(`/api/users/personas/${encodeURIComponent(dni)}`, { tenant: false });
    const p = data?.person;
    if (!p || !p.dni) return { ok: false, error: 'No se encontró la persona en el sistema' };
    return {
      ok: true,
      nombre: [p.firstName, p.lastName].filter(Boolean).join(' '),
      email: p.email || '',
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function validarPlaca(placa) {
  try {
    const data = await api(`/vehiculo/placa/${encodeURIComponent(placa.trim().toUpperCase())}`);
    if (!data || !data.placa) return { ok: false, error: 'No se encontró el vehículo en el sistema' };
    return {
      ok: true,
      tipo: data.tipo || data.vehiculoTipo || '',
      marca: data.marca || '',
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

$('tkDni').addEventListener('blur', async (e) => {
  const dni = e.target.value.trim();
  const msg = $('ticketMsg');
  const tkPlaca = $('tkPlaca');
  if (!dni) return;
  msg.textContent = 'Validando cédula…';
  msg.className = 'mt-2 text-sm text-slate-500';
  const result = await validarPersona(dni);
  if (result.ok) {
    msg.textContent = `✓ Persona encontrada: ${result.nombre}`;
    msg.className = 'mt-2 text-sm text-emerald-700';
    // Habilitar select de placas y filtrar por este DNI
    tkPlaca.disabled = false;
    cargarVehiculosParaTicket();
  } else {
    msg.textContent = `✗ ${result.error} — Registra la persona primero en la sección "Registrarse"`;
    msg.className = 'mt-2 text-sm text-red-600';
    tkPlaca.disabled = true;
    tkPlaca.innerHTML = '<option value="">Cédula no válida…</option>';
  }
});

$('tkPlaca').addEventListener('blur', async (e) => {
  const placa = e.target.value.trim();
  const msg = $('ticketMsg');
  if (!placa) return;
  msg.textContent = 'Validando placa…';
  msg.className = 'mt-2 text-sm text-slate-500';
  const result = await validarPlaca(placa);
  if (result.ok) {
    msg.textContent = `✓ Vehículo encontrado: ${placa.toUpperCase()}${result.marca ? ' · ' + result.marca : ''}`;
    msg.className = 'mt-2 text-sm text-emerald-700';
  } else {
    msg.textContent = `✗ ${result.error} — Registra el vehículo primero en la sección "Vehículos"`;
    msg.className = 'mt-2 text-sm text-red-600';
  }
});

$('ticketForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('ticketMsg');
  msg.textContent = '';
  msg.className = 'mt-2 text-sm';

  // Validar persona antes de crear ticket
  const dni = $('tkDni').value.trim();
  const valida = await validarPersona(dni);
  if (!valida.ok) {
    msg.textContent = valida.error + ' — Registra la persona primero en usuarios.';
    msg.className = 'mt-2 text-sm text-red-600';
    return;
  }

  // Validar placa antes de crear ticket
  const placa = $('tkPlaca').value;
  if (!placa) {
    msg.textContent = 'Selecciona o ingresa una placa válida.';
    msg.className = 'mt-2 text-sm text-red-600';
    return;
  }
  const validaPlaca = await validarPlaca(placa);
  if (!validaPlaca.ok) {
    msg.textContent = validaPlaca.error + ' — Registra el vehículo primero en la sección "Vehículos".';
    msg.className = 'mt-2 text-sm text-red-600';
    return;
  }

  try {
    const r = await api('/tickets', {
      method: 'POST',
      body: {
        dni,
        placa,
        idEspacio: $('tkEspacio').value.trim(),
        zona: $('tkZona').value.trim(),
        tenantId: state.tenant,
      },
    });
    msg.textContent = typeof r === 'string' ? r : JSON.stringify(r);
    msg.classList.add('text-emerald-700');
    await cargarTickets();
    await cargarEspacios();
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('text-red-600');
  }
});

$('crearReservaBtn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const msg = $('ticketMsg');
  msg.textContent = '';
  msg.className = 'mt-2 text-sm';

  const dni = $('tkDni').value.trim();
  const valida = await validarPersona(dni);
  if (!valida.ok) {
    msg.textContent = valida.error + ' — Registra la persona primero en usuarios.';
    msg.className = 'mt-2 text-sm text-red-600';
    return;
  }

  const placa = $('tkPlaca').value;
  if (!placa) {
    msg.textContent = 'Selecciona o ingresa una placa válida.';
    msg.className = 'mt-2 text-sm text-red-600';
    return;
  }
  const validaPlaca = await validarPlaca(placa);
  if (!validaPlaca.ok) {
    msg.textContent = validaPlaca.error + ' — Registra el vehículo primero en la sección "Vehículos".';
    msg.className = 'mt-2 text-sm text-red-600';
    return;
  }

  try {
    const r = await api('/tickets/reservas', {
      method: 'POST',
      body: {
        dni,
        placa,
        idEspacio: $('tkEspacio').value.trim(),
        zona: $('tkZona').value.trim(),
        tenantId: state.tenant,
      },
    });
    msg.textContent = typeof r === 'string' ? r : JSON.stringify(r);
    msg.classList.add('text-emerald-700');
    await cargarTickets();
    await cargarEspacios();
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('text-red-600');
  }
});

$('espacioForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('espacioMsg');
  msg.textContent = '';
  msg.className = 'mb-2 text-sm';
  try {
    await api('/api/espacios', {
      method: 'POST',
      body: {
        idzona: $('espZona').value,
        tipo: $('espTipo').value,
        descripcion: $('espDesc').value.trim() || null,
      },
    });
    msg.textContent = 'Espacio creado';
    msg.classList.add('text-emerald-700');
    await cargarEspacios();
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('text-red-600');
  }
});

$('userEditForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('userEditMsg');
  msg.textContent = '';
  msg.className = 'mt-2 text-sm';
  try {
    await api(`/api/users/${$('editUserId').value}`, {
      method: 'PUT',
      tenant: false,
      body: {
        firstName: $('editFirst').value.trim(),
        lastName: $('editLast').value.trim(),
        email: $('editEmail').value.trim(),
        phone: $('editPhone').value.trim(),
        active: $('editActive').value === 'true',
      },
    });
    msg.textContent = 'Usuario actualizado';
    msg.classList.add('text-emerald-700');
    await cargarUsuarios();
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('text-red-600');
  }
});

$('cancelUserEdit')?.addEventListener('click', () => {
  $('userEditPanel').classList.add('hidden');
});

$('assignTenantBtn')?.addEventListener('click', async () => {
  const msg = $('userEditMsg');
  if (!isSuperAdmin() || !state.editingUserId) {
    msg.textContent = 'Solo SUPER_ADMIN puede asignar un tenant a un ADMIN.';
    msg.className = 'mt-2 text-sm text-red-600';
    return;
  }
  const tenantId = $('assignTenantSelect').value;
  if (!tenantId) {
    msg.textContent = 'Selecciona un tenant para asignar.';
    msg.className = 'mt-2 text-sm text-red-600';
    return;
  }
  try {
    await api(`/api/users/${state.editingUserId}/tenant/${tenantId}`, {
      method: 'PUT',
      tenant: false,
    });
    msg.textContent = 'Tenant asignado correctamente';
    msg.className = 'mt-2 text-sm text-emerald-700';
    await cargarUsuarios();
    openUserEdit(state.editingUserId);
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'mt-2 text-sm text-red-600';
  }
});

$('unassignTenantBtn')?.addEventListener('click', async () => {
  if (!isAdmin() || !state.editingUserId) return;
  const msg = $('userEditMsg');
  try {
    await api(`/api/users/${state.editingUserId}/tenant`, {
      method: 'DELETE',
      tenant: false,
    });
    msg.textContent = 'Tenant removido correctamente';
    msg.className = 'mt-2 text-sm text-emerald-700';
    await cargarUsuarios();
    openUserEdit(state.editingUserId);
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'mt-2 text-sm text-red-600';
  }
});

$('assignRoleBtn')?.addEventListener('click', async () => {
  if (!isAdmin() || !state.editingUserId) return;
  const msg = $('userEditMsg');
  const roleId = $('roleSelect').value;
  const role = state.rolesCatalog.find((r) => String(r.id) === String(roleId));
  if (role && !assignableRoleNames().includes(role.name)) {
    msg.textContent = 'No puedes asignar ese rol con tu perfil actual.';
    msg.className = 'mt-2 text-sm text-red-600';
    return;
  }
  try {
    await api(`/api/users/${state.editingUserId}/role/${roleId}`, {
      method: 'PUT',
      tenant: false,
    });
    msg.textContent = 'Rol actualizado';
    msg.className = 'mt-2 text-sm text-emerald-700';
    await cargarUsuarios();
    openUserEdit(state.editingUserId);
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'mt-2 text-sm text-red-600';
  }
});

$('refreshTenants')?.addEventListener('click', cargarTenantsAdmin);

$('tenantForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isSuperAdmin()) return;
  const msg = $('tenantMsg');
  msg.textContent = '';
  msg.className = 'mb-2 text-sm';
  try {
    await api('/api/tenants', {
      method: 'POST',
      tenant: false,
      body: {
        slug: $('tenantSlug').value.trim().toLowerCase(),
        name: $('tenantName').value.trim(),
        description: $('tenantDesc').value.trim() || null,
        active: true,
      },
    });
    msg.textContent = 'Tenant creado';
    msg.classList.add('text-emerald-700');
    e.target.reset();
    await cargarTenantsAdmin();
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('text-red-600');
  }
});

$('unassignRoleBtn')?.addEventListener('click', async () => {
  if (!isAdmin() || !state.editingUserId) return;
  const msg = $('userEditMsg');
  const roleId = $('roleSelect').value;
  const role = state.rolesCatalog.find((r) => String(r.id) === String(roleId));
  if (role && !removableRoleNames().includes(role.name)) {
    msg.textContent = 'No puedes quitar ese rol con tu perfil actual.';
    msg.className = 'mt-2 text-sm text-red-600';
    return;
  }
  try {
    await api(`/api/users/${state.editingUserId}/roles/${roleId}`, {
      method: 'DELETE',
      tenant: false,
    });
    msg.textContent = 'Rol quitado';
    msg.className = 'mt-2 text-sm text-emerald-700';
    await cargarUsuarios();
    $('userEditPanel').classList.add('hidden');
    state.editingUserId = null;
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'mt-2 text-sm text-red-600';
  }
});

$('zonaForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('zonaMsg');
  msg.textContent = '';
  msg.className = 'mt-2 text-sm';
  try {
    await api('/api/zonas', {
      method: 'POST',
      body: {
        nombre: $('zonaNombre').value.trim(),
        tipo: $('zonaTipo').value,
        capacidad: Number($('zonaCap').value),
        descripcion: $('zonaDesc').value.trim() || null,
        tenantId: state.tenant,
        activo: true,
      },
    });
    msg.textContent = 'Zona creada';
    msg.classList.add('text-emerald-700');
    await cargarZonasAdmin();
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('text-red-600');
  }
});

$('vhTipo')?.addEventListener('change', syncVehiculoExtraFields);
$('tkDni')?.addEventListener('input', fillTicketVehicleSelect);

$('vehiculoForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('vehiculoMsg');
  msg.textContent = '';
  msg.className = 'mb-2 text-sm';
  try {
    await api('/vehiculo', { method: 'POST', body: buildVehiculoPayload() });
    msg.textContent = 'Vehículo registrado';
    msg.classList.add('text-emerald-700');
    await cargarVehiculos();
    await cargarVehiculosParaTicket();
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('text-red-600');
  }
});

(async () => {
  syncVehiculoExtraFields();
  if (restoreSession()) {
    await refreshRolesFromServer();
    if (state.token) enterApp();
    else show('login');
  } else {
    show('login');
  }
})();
