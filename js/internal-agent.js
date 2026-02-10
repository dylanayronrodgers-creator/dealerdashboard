// ═══════════════════════════════════════════════════════════
// INTERNAL AGENT DASHBOARD — js/internal-agent.js
// Filtered views: only shows data assigned to the logged-in agent
// ═══════════════════════════════════════════════════════════

let currentUser = null;
let myLeads = [];
let myOrders = [];
let myPreorders = [];
let myShipping = [];
let myReturned = [];
let allPackages = [];
let currentSection = 'dashboard';

// ─── Initialization ───
document.addEventListener('DOMContentLoaded', async () => {
    const auth = await requireAuth('internal_agent');
    if (!auth) return;

    currentUser = auth.profile;

    // Set user info in sidebar
    const name = currentUser.full_name || 'Agent';
    document.getElementById('userName').textContent = name;
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('userInitials').textContent = initials;
    if (document.getElementById('settingPreviewInitials')) {
        document.getElementById('settingPreviewInitials').textContent = initials;
    }

    // Apply saved color scheme
    if (currentUser.color_scheme && currentUser.color_scheme !== 'default') {
        document.body.classList.add('theme-' + currentUser.color_scheme);
    }

    // Apply profile picture
    if (currentUser.profile_picture) {
        applyProfilePicture(currentUser.profile_picture);
    }

    // Load all data
    await loadAllData();

    // Setup form handlers
    setupFormHandlers();

    // Populate settings
    populateSettings();
});

// ─── Data Loading ───
async function loadAllData() {
    try {
        const userId = currentUser.id;

        const [leadsRes, ordersRes, packagesRes, preordersRes] = await Promise.all([
            window.supabaseClient
                .from('leads')
                .select('*, package:packages(id, name, price)')
                .or(`agent_id.eq.${userId},assigned_to.eq.${userId}`)
                .neq('status', 'converted')
                .order('created_at', { ascending: false }),
            window.supabaseClient
                .from('orders')
                .select('*, lead:leads(id, first_name, last_name, full_name, email, phone, address, order_number, service_id), package:packages(id, name, price)')
                .eq('agent_id', userId)
                .order('created_at', { ascending: false }),
            window.supabaseClient
                .from('packages')
                .select('*')
                .eq('is_active', true)
                .order('name'),
            window.supabaseClient
                .from('leads')
                .select('*, package:packages(id, name, price)')
                .eq('is_preorder', true)
                .or(`agent_id.eq.${userId},assigned_to.eq.${userId}`)
                .order('created_at', { ascending: false })
        ]);

        myLeads = leadsRes.data || [];
        myOrders = ordersRes.data || [];
        allPackages = packagesRes.data || [];
        myPreorders = preordersRes.data || [];

        // Shipping: orders with shipping status
        myShipping = myOrders.filter(o => o.shipping_status || o.tracking_number);

        // Returned items: leads or orders with status 'returned'
        const returnedLeads = (leadsRes.data || []).filter(l => l.status === 'returned').map(l => ({ ...l, _type: 'lead' }));
        const returnedOrders = myOrders.filter(o => o.status === 'returned').map(o => ({ ...o, _type: 'order' }));
        myReturned = [...returnedLeads, ...returnedOrders];

        // Update stats
        updateDashboardStats();
        renderDashboardRecent();
        renderMyLeads();
        renderMyOrders();
        renderPreorders();
        renderShipping();
        renderReturned();
        updateBadges();

        console.log(`Internal agent data loaded: ${myLeads.length} leads, ${myOrders.length} orders`);
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// ─── Dashboard Stats ───
function updateDashboardStats() {
    document.getElementById('statMyLeads').textContent = myLeads.length;
    document.getElementById('statMyOrders').textContent = myOrders.length;

    // Axxess sales count (will be updated by axxess-sales.js if loaded)
    const salesCount = typeof axxessSales !== 'undefined' ? axxessSales.filter(s => {
        if (!currentUser.agent_table_id) return false;
        return s.agent_id === currentUser.agent_table_id;
    }).length : 0;
    document.getElementById('statMySales').textContent = salesCount;

    const converted = myLeads.filter(l => l.status === 'converted').length + myOrders.length;
    const total = myLeads.length + converted;
    const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
    document.getElementById('statConversion').textContent = rate + '%';
}

function renderDashboardRecent() {
    // Recent leads
    const recentLeadsEl = document.getElementById('dashRecentLeads');
    const recent5Leads = myLeads.slice(0, 5);
    if (recent5Leads.length === 0) {
        recentLeadsEl.innerHTML = '<p class="text-gray-400 text-sm">No leads assigned yet</p>';
    } else {
        recentLeadsEl.innerHTML = recent5Leads.map(l => {
            const name = l.full_name || `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Unknown';
            const date = l.created_at ? new Date(l.created_at).toLocaleDateString() : '';
            return `<div class="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                    <p class="font-medium text-sm text-gray-800">${name}</p>
                    <p class="text-xs text-gray-400">${l.package?.name || 'No package'}</p>
                </div>
                <div class="text-right">
                    <span class="px-2 py-0.5 rounded-full text-xs status-${l.status}">${l.status}</span>
                    <p class="text-xs text-gray-400 mt-1">${date}</p>
                </div>
            </div>`;
        }).join('');
    }

    // Recent orders
    const recentOrdersEl = document.getElementById('dashRecentOrders');
    const recent5Orders = myOrders.slice(0, 5);
    if (recent5Orders.length === 0) {
        recentOrdersEl.innerHTML = '<p class="text-gray-400 text-sm">No orders yet</p>';
    } else {
        recentOrdersEl.innerHTML = recent5Orders.map(o => {
            const clientName = o.lead?.full_name || `${o.lead?.first_name || ''} ${o.lead?.last_name || ''}`.trim() || 'Unknown';
            const date = o.created_at ? new Date(o.created_at).toLocaleDateString() : '';
            return `<div class="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                    <p class="font-medium text-sm text-gray-800">${clientName}</p>
                    <p class="text-xs text-gray-400">${o.package?.name || 'No package'} · ${o.order_number || ''}</p>
                </div>
                <div class="text-right">
                    <span class="px-2 py-0.5 rounded-full text-xs status-${o.status}">${o.status}</span>
                    <p class="text-xs text-gray-400 mt-1">${date}</p>
                </div>
            </div>`;
        }).join('');
    }
}

// ─── My Leads ───
function renderMyLeads(filtered = null) {
    const display = filtered || myLeads;
    const tbody = document.getElementById('myLeadsTable');
    document.getElementById('myLeadsCount').textContent = display.length;

    if (display.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No leads found</td></tr>';
        return;
    }

    tbody.innerHTML = display.map(lead => {
        const name = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '-';
        const contact = lead.email || lead.phone || '-';
        const address = lead.address || '-';
        const pkg = lead.package?.name || lead.package_name || '-';

        return `<tr class="table-row border-b">
            <td class="px-4 py-3">
                <div class="font-medium text-gray-800 text-sm">${name}</div>
                <div class="text-xs text-gray-400">${lead.order_number ? 'Order: ' + lead.order_number : ''} ${lead.service_id ? 'SID: ' + lead.service_id : ''}</div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">${contact}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${address}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${pkg}</td>
            <td class="px-4 py-3">
                <select onchange="updateMyLeadStatus('${lead.id}', this.value)" class="text-xs border rounded px-2 py-1 status-${lead.status}">
                    <option value="new" ${lead.status === 'new' ? 'selected' : ''}>New</option>
                    <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                    <option value="qualified" ${lead.status === 'qualified' ? 'selected' : ''}>Qualified</option>
                    <option value="converted" ${lead.status === 'converted' ? 'selected' : ''}>Converted</option>
                    <option value="lost" ${lead.status === 'lost' ? 'selected' : ''}>Lost</option>
                </select>
            </td>
            <td class="px-4 py-3">
                <button onclick="viewLeadDetail('${lead.id}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition">View</button>
            </td>
        </tr>`;
    }).join('');
}

function filterMyLeads() {
    const status = document.getElementById('leadStatusFilter').value;
    if (!status) {
        renderMyLeads();
    } else {
        renderMyLeads(myLeads.filter(l => l.status === status));
    }
}

async function updateMyLeadStatus(leadId, newStatus) {
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', leadId);
        if (error) throw error;

        const lead = myLeads.find(l => l.id === leadId);
        if (lead) lead.status = newStatus;

        filterMyLeads();
        updateDashboardStats();
    } catch (error) {
        console.error('Error updating lead status:', error);
        alert('Error updating status: ' + error.message);
    }
}

function viewLeadDetail(leadId) {
    const lead = myLeads.find(l => l.id === leadId);
    if (!lead) return;

    const name = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '-';
    const content = document.getElementById('leadDetailContent');
    content.innerHTML = `
        <div class="space-y-3">
            <div class="grid grid-cols-2 gap-4">
                <div><p class="text-xs text-gray-500">Name</p><p class="font-medium">${name}</p></div>
                <div><p class="text-xs text-gray-500">Email</p><p class="font-medium">${lead.email || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Phone</p><p class="font-medium">${lead.phone || '-'}</p></div>
                <div><p class="text-xs text-gray-500">ID Number</p><p class="font-medium">${lead.id_number || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Address</p><p class="font-medium">${lead.address || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Package</p><p class="font-medium">${lead.package?.name || lead.package_name || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Status</p><p class="font-medium"><span class="px-2 py-0.5 rounded-full text-xs status-${lead.status}">${lead.status}</span></p></div>
                <div><p class="text-xs text-gray-500">Order #</p><p class="font-medium">${lead.order_number || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Service ID</p><p class="font-medium">${lead.service_id || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Created</p><p class="font-medium">${lead.created_at ? new Date(lead.created_at).toLocaleString() : '-'}</p></div>
            </div>
            ${lead.notes ? `<div><p class="text-xs text-gray-500">Notes</p><p class="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg mt-1">${lead.notes}</p></div>` : ''}
        </div>
    `;
    document.getElementById('leadDetailModal').classList.add('active');
}

// ─── My Orders ───
function renderMyOrders(filtered = null) {
    const display = filtered || myOrders;
    const tbody = document.getElementById('myOrdersTable');
    document.getElementById('myOrdersCount').textContent = display.length;

    if (display.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = display.map(order => {
        const clientName = order.lead?.full_name || `${order.lead?.first_name || ''} ${order.lead?.last_name || ''}`.trim() || '-';
        const pkg = order.package?.name || '-';
        const date = order.created_at ? new Date(order.created_at).toLocaleDateString() : '-';

        return `<tr class="table-row border-b">
            <td class="px-4 py-3 text-sm font-mono">${order.order_number || '-'}</td>
            <td class="px-4 py-3 text-sm font-medium text-gray-800">${clientName}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${pkg}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs status-${order.status}">${order.status}</span></td>
            <td class="px-4 py-3 text-sm text-gray-500">${date}</td>
            <td class="px-4 py-3">
                <button onclick="viewOrderDetail('${order.id}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition">View</button>
            </td>
        </tr>`;
    }).join('');
}

function filterMyOrders() {
    const status = document.getElementById('orderStatusFilter').value;
    if (!status) {
        renderMyOrders();
    } else {
        renderMyOrders(myOrders.filter(o => o.status === status));
    }
}

function viewOrderDetail(orderId) {
    const order = myOrders.find(o => o.id === orderId);
    if (!order) return;

    const clientName = order.lead?.full_name || `${order.lead?.first_name || ''} ${order.lead?.last_name || ''}`.trim() || '-';
    const content = document.getElementById('orderDetailContent');
    content.innerHTML = `
        <div class="space-y-3">
            <div class="grid grid-cols-2 gap-4">
                <div><p class="text-xs text-gray-500">Order #</p><p class="font-medium">${order.order_number || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Client</p><p class="font-medium">${clientName}</p></div>
                <div><p class="text-xs text-gray-500">Package</p><p class="font-medium">${order.package?.name || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Status</p><p class="font-medium"><span class="px-2 py-0.5 rounded-full text-xs status-${order.status}">${order.status}</span></p></div>
                <div><p class="text-xs text-gray-500">Service ID</p><p class="font-medium">${order.lead?.service_id || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Address</p><p class="font-medium">${order.lead?.address || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Tracking #</p><p class="font-medium">${order.tracking_number || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Created</p><p class="font-medium">${order.created_at ? new Date(order.created_at).toLocaleString() : '-'}</p></div>
            </div>
            ${order.notes ? `<div><p class="text-xs text-gray-500">Notes</p><p class="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg mt-1">${order.notes}</p></div>` : ''}
        </div>
    `;
    document.getElementById('orderDetailModal').classList.add('active');
}

// ─── Preorders ───
function renderPreorders() {
    const tbody = document.getElementById('preordersTable');
    const badge = document.getElementById('preordersBadge');

    if (myPreorders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">No preorders</td></tr>';
        return;
    }

    if (badge) { badge.textContent = myPreorders.length; badge.classList.remove('hidden'); }

    tbody.innerHTML = myPreorders.map(p => {
        const name = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || '-';
        const date = p.created_at ? new Date(p.created_at).toLocaleDateString() : '-';
        return `<tr class="table-row border-b">
            <td class="px-4 py-3 text-sm font-medium text-gray-800">${name}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${p.package?.name || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${p.address || '-'}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs status-${p.status}">${p.status}</span></td>
            <td class="px-4 py-3 text-sm text-gray-500">${date}</td>
        </tr>`;
    }).join('');
}

// ─── Shipping ───
function renderShipping() {
    const tbody = document.getElementById('shippingTable');
    const badge = document.getElementById('shippingBadge');

    if (myShipping.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No shipping items</td></tr>';
        return;
    }

    if (badge) { badge.textContent = myShipping.length; badge.classList.remove('hidden'); }

    tbody.innerHTML = myShipping.map(s => {
        const clientName = s.lead?.full_name || `${s.lead?.first_name || ''} ${s.lead?.last_name || ''}`.trim() || '-';
        const date = s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '-';
        return `<tr class="table-row border-b">
            <td class="px-4 py-3 text-sm font-mono">${s.order_number || '-'}</td>
            <td class="px-4 py-3 text-sm font-medium text-gray-800">${clientName}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${s.lead?.address || '-'}</td>
            <td class="px-4 py-3 text-sm font-mono">${s.tracking_number || '-'}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs status-${s.shipping_status || s.status}">${s.shipping_status || s.status}</span></td>
            <td class="px-4 py-3 text-sm text-gray-500">${date}</td>
        </tr>`;
    }).join('');
}

// ─── Returned Items ───
function renderReturned() {
    const tbody = document.getElementById('returnedTable');
    const badge = document.getElementById('returnedBadge');

    if (myReturned.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">No returned items</td></tr>';
        return;
    }

    if (badge) { badge.textContent = myReturned.length; badge.classList.remove('hidden'); }

    tbody.innerHTML = myReturned.map(r => {
        const name = r.full_name || r.lead?.full_name || `${r.first_name || r.lead?.first_name || ''} ${r.last_name || r.lead?.last_name || ''}`.trim() || '-';
        const date = r.returned_at || r.updated_at ? new Date(r.returned_at || r.updated_at).toLocaleDateString() : '-';
        return `<tr class="table-row border-b">
            <td class="px-4 py-3 text-sm"><span class="px-2 py-0.5 rounded-full text-xs ${r._type === 'lead' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}">${r._type}</span></td>
            <td class="px-4 py-3 text-sm font-medium text-gray-800">${name}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${r.return_reason || '-'}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs status-returned">Returned</span></td>
            <td class="px-4 py-3 text-sm text-gray-500">${date}</td>
        </tr>`;
    }).join('');
}

// ─── Reports ───
function renderReports() {
    // Stats
    const allLeadsIncConverted = [...myLeads];
    const converted = myOrders.length;
    const qualified = myLeads.filter(l => l.status === 'qualified').length;
    const lost = myLeads.filter(l => l.status === 'lost').length;

    document.getElementById('rptTotalLeads').textContent = myLeads.length + converted;
    document.getElementById('rptConverted').textContent = converted;
    document.getElementById('rptQualified').textContent = qualified;
    document.getElementById('rptLost').textContent = lost;

    // Status breakdown chart
    const statusCounts = {};
    myLeads.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });

    const statusCtx = document.getElementById('statusChart');
    if (statusCtx && statusCtx.getContext) {
        if (window._statusChart) window._statusChart.destroy();
        window._statusChart = new Chart(statusCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusCounts),
                datasets: [{
                    data: Object.values(statusCounts),
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6b7280']
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // Monthly chart — leads per month for last 6 months
    const months = [];
    const leadCounts = [];
    const orderCounts = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
        months.push(label);
        leadCounts.push(myLeads.filter(l => l.created_at >= start && l.created_at <= end).length);
        orderCounts.push(myOrders.filter(o => o.created_at >= start && o.created_at <= end).length);
    }

    const monthlyCtx = document.getElementById('monthlyChart');
    if (monthlyCtx && monthlyCtx.getContext) {
        if (window._monthlyChart) window._monthlyChart.destroy();
        window._monthlyChart = new Chart(monthlyCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    { label: 'Leads', data: leadCounts, backgroundColor: '#3b82f6' },
                    { label: 'Orders', data: orderCounts, backgroundColor: '#10b981' }
                ]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

// ─── Badges ───
function updateBadges() {
    const setBadge = (id, count) => {
        const el = document.getElementById(id);
        if (el) {
            if (count > 0) { el.textContent = count; el.classList.remove('hidden'); }
            else { el.classList.add('hidden'); }
        }
    };

    setBadge('myLeadsBadge', myLeads.filter(l => l.status === 'new').length);
    setBadge('myOrdersBadge', myOrders.filter(o => o.status === 'pending').length);
    setBadge('preordersBadge', myPreorders.length);
    setBadge('shippingBadge', myShipping.length);
    setBadge('returnedBadge', myReturned.length);
}

// ─── Settings ───
function populateSettings() {
    document.getElementById('settingName').value = currentUser.full_name || '';
    document.getElementById('settingPicture').value = currentUser.profile_picture || '';
    document.getElementById('settingEmail').textContent = currentUser.email || '-';
    document.getElementById('settingRole').textContent = currentUser.role || '-';
    document.getElementById('settingAgentId').textContent = currentUser.agent_table_id || 'Not linked';

    // Highlight active color scheme
    highlightColorScheme(currentUser.color_scheme || 'default');
}

function highlightColorScheme(scheme) {
    document.querySelectorAll('#colorSchemeOptions button').forEach(btn => {
        btn.classList.remove('border-white', 'ring-2', 'ring-offset-2', 'ring-green-500');
    });
    // Find the button by matching scheme name in onclick
    document.querySelectorAll('#colorSchemeOptions button').forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        if (onclick.includes(`'${scheme}'`)) {
            btn.classList.add('ring-2', 'ring-offset-2', 'ring-green-500');
        }
    });
}

function setColorScheme(scheme) {
    // Remove all theme classes
    document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
    if (scheme !== 'default') {
        document.body.classList.add('theme-' + scheme);
    }
    highlightColorScheme(scheme);

    // Save to DB
    window.supabaseClient
        .from('profiles')
        .update({ color_scheme: scheme })
        .eq('id', currentUser.id)
        .then(({ error }) => {
            if (error) console.error('Error saving color scheme:', error);
            else currentUser.color_scheme = scheme;
        });
}

function previewProfilePicture() {
    const url = document.getElementById('settingPicture').value;
    const preview = document.getElementById('settingPicturePreview');
    if (url) {
        preview.innerHTML = `<img src="${url}" alt="Profile" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<span class=\\'text-red-400 text-xs\\'>Invalid URL</span>'">`;
    }
}

function applyProfilePicture(url) {
    if (!url) return;
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
        avatar.innerHTML = `<img src="${url}" alt="Profile" class="w-full h-full object-cover rounded-full" onerror="this.style.display='none'; this.parentElement.querySelector('#userInitials') && (this.parentElement.querySelector('#userInitials').style.display='block')">`;
    }
}

function setupFormHandlers() {
    document.getElementById('profileSettingsForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('settingName').value.trim();
        const picture = document.getElementById('settingPicture').value.trim();

        try {
            const { error } = await window.supabaseClient
                .from('profiles')
                .update({
                    full_name: name,
                    profile_picture: picture || null
                })
                .eq('id', currentUser.id);

            if (error) throw error;

            currentUser.full_name = name;
            currentUser.profile_picture = picture || null;

            // Update sidebar
            document.getElementById('userName').textContent = name;
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            document.getElementById('userInitials').textContent = initials;

            if (picture) applyProfilePicture(picture);

            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings: ' + error.message);
        }
    });
}

// ─── Section Navigation ───
function showSection(section) {
    currentSection = section;

    // Hide all sections
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));

    // Show target section
    const target = document.getElementById('section-' + section);
    if (target) target.classList.remove('hidden');

    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
        n.classList.add('text-white/70');
        n.classList.remove('text-white');
    });
    const navLink = document.querySelector(`a[href="#${section}"]`);
    if (navLink) {
        navLink.classList.add('active', 'text-white');
        navLink.classList.remove('text-white/70');
    }

    // Update page title
    const titles = {
        'dashboard': ['Dashboard', 'Your performance overview'],
        'axxess-sales': ['Axxess Sales', 'Sales tracking and management'],
        'my-leads': ['My Leads', 'Leads assigned to you'],
        'my-orders': ['My Orders', 'Your order pipeline'],
        'reports': ['Reports', 'Performance analytics'],
        'preorders': ['Preorders', 'Pending preorder installations'],
        'shipping': ['Shipping', 'Shipment tracking'],
        'returned': ['Returned Items', 'Items returned for review'],
        'settings': ['Settings', 'Profile and preferences']
    };
    const [title, subtitle] = titles[section] || ['Dashboard', ''];
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageSubtitle').textContent = subtitle;

    // Section-specific loading
    if (section === 'axxess-sales' && typeof loadAxxessSalesData === 'function') {
        loadAxxessSalesData();
    }
    if (section === 'reports') {
        renderReports();
    }
}

// ─── Utilities ───
function closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

function handleSearch(value) {
    if (!value) {
        renderMyLeads();
        return;
    }
    const q = value.toLowerCase();
    const filtered = myLeads.filter(l => {
        const name = (l.full_name || `${l.first_name || ''} ${l.last_name || ''}`).toLowerCase();
        return name.includes(q) || (l.email || '').toLowerCase().includes(q) || (l.phone || '').includes(q) || (l.order_number || '').toLowerCase().includes(q);
    });
    renderMyLeads(filtered);
}
