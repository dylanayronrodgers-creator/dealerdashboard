// ═══════════════════════════════════════════════════════════
// AXXESS SALES MODULE — Ported from Project 4 agent dashboard
// Integrates into admin-dashboard.html as the "Axxess Sales" section
// ═══════════════════════════════════════════════════════════

let axxessAgents = [];
let axxessSales = [];
let axxessTeams = [];
let axxessManagers = [];
let axxessPricing = [];
let axxessReminders = [];
let axxessStatusChecks = [];

// Pagination helper — fetches ALL rows from a table (bypasses Supabase 1000-row default)
async function fetchAllRows(table, query = {}) {
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        let q = window.supabaseClient.from(table).select(query.select || '*');
        if (query.eq) query.eq.forEach(e => { q = q.eq(e[0], e[1]); });
        if (query.order) q = q.order(query.order[0], query.order[1] || {});
        q = q.range(from, from + PAGE_SIZE - 1);

        const { data, error } = await q;
        if (error) throw error;

        allData = allData.concat(data || []);
        if (!data || data.length < PAGE_SIZE) {
            hasMore = false;
        } else {
            from += PAGE_SIZE;
        }
    }
    return allData;
}
let axxessCurrentAgent = null; // The linked agents table row for logged-in user
let axxessCurrentTab = 'ax-overview';
let axxessEditingSale = null;
let axxessPendingImport = [];
let axxessReminderView = 'active';
let axxessShownNotifications = new Set();

// Status reason options (same as project 4)
const AX_REASON_OPTIONS = {
    'Paid-Active': [
        { value: 'Full Payment', label: 'Full Payment' },
        { value: 'Pro-rata Paid', label: 'Pro-rata Paid but Renewal NOT Paid' }
    ],
    'Pending': [
        { value: 'Awaiting Provider Completion', label: 'Awaiting Provider Completion' },
        { value: 'Awaiting Client Feedback', label: 'Awaiting Client Feedback' }
    ],
    'Partial': [
        { value: 'Pro-rata Paid but Renewal NOT Paid', label: 'Pro-rata Paid but Renewal NOT Paid' },
        { value: 'Renewal Paid but Pro-rata NOT Paid', label: 'Renewal Paid but Pro-rata NOT Paid' },
        { value: 'Short Payment', label: 'Short Payment' },
        { value: 'Modem Delivery Fee NOT Paid - R249.00', label: 'Modem Delivery Fee NOT Paid - R249.00' }
    ],
    'Failed': [
        { value: 'No Coverage', label: 'No Coverage' },
        { value: 'Non-Payment', label: 'Non-Payment' },
        { value: 'No Feedback from Client', label: 'No Feedback from Client' }
    ]
};

// ─── Permission helpers ───
function axCanManageSales() {
    if (!currentUser) return false;
    return ['super_admin', 'admin'].includes(currentUser.role);
}

function axCanAssignLeads() {
    if (!currentUser) return false;
    return currentUser.role === 'super_admin';
}

function axCanManagePermissions() {
    if (!currentUser) return false;
    return currentUser.role === 'super_admin';
}

function axHasPermission(perm) {
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin') return true;
    const perms = currentUser.permissions || {};
    return perms[perm] === true;
}

// ─── Data Loading ───
async function loadAxxessSalesData() {
    try {
        // Small tables: normal queries (well under 1000 rows)
        const [agentsRes, teamsRes, pricingRes, checksRes] = await Promise.all([
            window.supabaseClient.from('agents').select('*').order('name'),
            window.supabaseClient.from('teams').select('*'),
            window.supabaseClient.from('axxess_pricing').select('*').eq('is_active', true),
            window.supabaseClient.from('service_status_checks').select('*').order('checked_at', { ascending: false }).limit(100)
        ]);

        axxessAgents = agentsRes.data || [];
        axxessTeams = teamsRes.data || [];
        axxessPricing = pricingRes.data || [];
        axxessStatusChecks = checksRes.data || [];

        // Large tables: paginated fetch (bypasses 1000-row cap)
        const [allSales, allReminders] = await Promise.all([
            fetchAllRows('sales_log', { order: ['created_at', { ascending: false }] }),
            fetchAllRows('agent_reminders', { order: ['reminder_datetime', { ascending: false }] })
        ]);

        axxessSales = allSales;
        axxessReminders = allReminders;

        // Find the current user's linked agent record
        if (currentUser && currentUser.agent_table_id) {
            axxessCurrentAgent = axxessAgents.find(a => a.id === currentUser.agent_table_id) || null;
        }

        renderAxxessSection();
        console.log(`Axxess loaded: ${axxessAgents.length} agents, ${axxessSales.length} sales, ${axxessPricing.length} packages`);
    } catch (error) {
        console.error('Error loading Axxess data:', error);
    }
}

// ─── Main render ───
function renderAxxessSection() {
    renderAxStats();
    renderAxAgentSelector();
    renderAxCurrentTab();
    axCheckDueReminders();
}

// ─── Sub-tab switching ───
function axSwitchTab(tab) {
    axxessCurrentTab = tab;
    document.querySelectorAll('.ax-tab-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-ax-tab="${tab}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    renderAxCurrentTab();
}

function renderAxCurrentTab() {
    const container = document.getElementById('axTabContent');
    if (!container) return;

    switch (axxessCurrentTab) {
        case 'ax-overview': renderAxOverview(container); break;
        case 'ax-add-sale': renderAxAddSale(container); break;
        case 'ax-mass-import': renderAxMassImport(container); break;
        case 'ax-current-month': renderAxCurrentMonth(container); break;
        case 'ax-sales-history': renderAxSalesHistory(container); break;
        case 'ax-commission': renderAxCommission(container); break;
        case 'ax-reminders': renderAxReminders(container); break;
        case 'ax-export': renderAxExport(container); break;
        case 'ax-status-checks': renderAxStatusChecks(container); break;
        case 'ax-permissions': renderAxPermissions(container); break;
        default: container.innerHTML = '<p class="text-gray-500 p-4">Select a tab</p>';
    }
}

// ─── Stats Cards ───
function renderAxStats() {
    const mySales = axGetMySales();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthSales = mySales.filter(s => s.created_at >= monthStart);
    const metrics = axCalcCommission(monthSales, axxessCurrentAgent?.target || 0);

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('axxessAgentCount', axxessAgents.length);
    el('axxessTotalSales', mySales.length);
    el('axxessMonthSales', monthSales.length);
    el('axxessTotalValue', 'R' + metrics.commissionedValue.toLocaleString());
}

// ─── Agent selector (super_admin sees all, admin sees own) ───
function renderAxAgentSelector() {
    const container = document.getElementById('axAgentSelector');
    if (!container) return;

    if (currentUser.role === 'super_admin') {
        let html = `<div class="flex items-center gap-3 mb-4">
            <label class="text-sm font-medium text-gray-700">Viewing as:</label>
            <select id="axAgentSelect" onchange="axChangeAgent()" class="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="all">All Agents (Overview)</option>`;
        axxessAgents.forEach(a => {
            const sel = axxessCurrentAgent && axxessCurrentAgent.id === a.id ? ' selected' : '';
            html += `<option value="${a.id}"${sel}>${a.name} (${a.email || 'no email'})</option>`;
        });
        html += `</select></div>`;
        container.innerHTML = html;
    } else if (axxessCurrentAgent) {
        container.innerHTML = `<div class="flex items-center gap-3 mb-4">
            <span class="text-sm text-gray-500">Logged in as:</span>
            <span class="font-semibold text-gray-800">${axxessCurrentAgent.name}</span>
            <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">${currentUser.role}</span>
        </div>`;
    } else {
        container.innerHTML = `<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
            <p class="text-yellow-800 text-sm font-medium">Your profile is not linked to an Axxess sales agent. Ask a super admin to link your account.</p>
        </div>`;
    }
}

function axChangeAgent() {
    const val = document.getElementById('axAgentSelect')?.value;
    if (val === 'all') {
        axxessCurrentAgent = null;
    } else {
        axxessCurrentAgent = axxessAgents.find(a => a.id === parseInt(val)) || null;
    }
    renderAxxessSection();
}

// ─── Get sales for current view ───
function axGetMySales() {
    if (axxessCurrentAgent) {
        return axxessSales.filter(s => s.agent_id === axxessCurrentAgent.id);
    }
    return axxessSales; // super_admin viewing all
}

function axGetMyReminders() {
    if (axxessCurrentAgent) {
        return axxessReminders.filter(r => r.agent_id === axxessCurrentAgent.id);
    }
    return axxessReminders;
}

// ─── Commission calculation (same logic as project 4) ───
function axCalcCommission(sales, target) {
    const validSales = sales.filter(s => s.sale_status !== 'Failed');
    const commissioned = sales.filter(s => s.sale_status === 'Paid-Active' && s.status_reason === 'Full Payment');
    const totalValue = validSales.reduce((sum, s) => sum + (parseFloat(s.total_sale) || 0), 0);
    const commValue = commissioned.reduce((sum, s) => sum + (parseFloat(s.total_sale) || 0), 0);
    const totalProg = target > 0 ? (totalValue / target) * 100 : 0;
    const commProg = target > 0 ? (commValue / target) * 100 : 0;

    let rate = 0;
    if (commProg >= 100) rate = 12;
    else if (commProg >= 80) rate = 8;

    const gross = (commValue * rate) / 100;
    const vat = gross * 0.15;
    const net = gross - vat;

    return { totalCount: validSales.length, totalValue, totalProg, commCount: commissioned.length, commValue, commProg, rate, gross, vat, net };
}

// ═══════════════════════════════════════
// TAB RENDERERS
// ═══════════════════════════════════════

// ─── Overview Tab ───
function renderAxOverview(container) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">';
    
    const agentsToShow = axxessCurrentAgent ? [axxessCurrentAgent] : axxessAgents;
    
    agentsToShow.forEach(agent => {
        const agentSales = axxessSales.filter(s => s.agent_id === agent.id);
        const monthSales = agentSales.filter(s => s.created_at >= monthStart);
        const metrics = axCalcCommission(monthSales, agent.target || 0);
        const team = axxessTeams.find(t => t.id === agent.team_id);
        const pct = Math.round(metrics.commProg);
        const pctColor = pct >= 100 ? 'text-emerald-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500';
        const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400';

        html += `<div class="card p-5">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    ${(agent.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-semibold text-gray-800 truncate">${agent.name || 'Unknown'}</h4>
                    <p class="text-gray-400 text-xs">${team ? team.name : 'No team'}</p>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center mb-3">
                <div class="bg-gray-50 rounded-lg p-2">
                    <p class="text-lg font-bold text-gray-800">${metrics.totalCount}</p>
                    <p class="text-xs text-gray-500">Valid</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-2">
                    <p class="text-lg font-bold text-blue-600">${metrics.commCount}</p>
                    <p class="text-xs text-gray-500">Comm.</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-2">
                    <p class="text-lg font-bold ${pctColor}">${pct}%</p>
                    <p class="text-xs text-gray-500">Target</p>
                </div>
            </div>
            ${agent.target > 0 ? `<div class="w-full bg-gray-200 rounded-full h-2"><div class="${barColor} h-2 rounded-full" style="width:${Math.min(pct, 100)}%"></div></div>` : ''}
            <p class="text-xs text-gray-400 mt-2">Net Commission: R${metrics.net.toFixed(2)}</p>
        </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

// ─── Add Sale Tab ───
function renderAxAddSale(container) {
    if (!axxessCurrentAgent) {
        container.innerHTML = '<div class="card p-6"><p class="text-yellow-600">Select an agent or link your profile to add sales.</p></div>';
        return;
    }

    const categories = [...new Set(axxessPricing.map(p => p.category))].sort();
    const isSalesTeam = axxessCurrentAgent.team_id === 1;

    container.innerHTML = `
    <div class="card p-6">
        <h4 class="font-semibold text-gray-800 mb-4">Add New Sale</h4>
        <div id="axSaleMsg"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select id="axCategory" onchange="axUpdateProviders()" class="w-full border rounded-xl px-3 py-2">
                    <option value="">Select Category...</option>
                    ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Provider *</label>
                <select id="axProvider" onchange="axUpdatePackages()" class="w-full border rounded-xl px-3 py-2">
                    <option value="">Select Provider...</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Package *</label>
                <select id="axPackage" onchange="axUpdatePrice()" class="w-full border rounded-xl px-3 py-2">
                    <option value="">Select Package...</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Amount (R) *</label>
                <input type="number" id="axAmount" class="w-full border rounded-xl px-3 py-2" step="0.01" min="0">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Account Number *</label>
                <input type="text" id="axAccountNum" class="w-full border rounded-xl px-3 py-2" placeholder="ACC-001234">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Service ID *</label>
                <input type="text" id="axServiceId" class="w-full border rounded-xl px-3 py-2" placeholder="VUMA-12345">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select id="axStatus" onchange="axUpdateReasons()" class="w-full border rounded-xl px-3 py-2">
                    <option value="Paid-Active">Paid-Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                    <option value="Failed">Failed</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Status Details *</label>
                <select id="axReason" class="w-full border rounded-xl px-3 py-2">
                    <option value="">Select Details...</option>
                </select>
            </div>
            ${isSalesTeam ? `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Sale Origin *</label>
                <select id="axSaleOrigin" onchange="axToggleCampaign()" class="w-full border rounded-xl px-3 py-2">
                    <option value="">Select Origin...</option>
                    <option value="Incoming Sales Leads">Incoming Sales Leads</option>
                    <option value="Marketing Campaign">Marketing Campaign</option>
                    <option value="FNO Call Centre">FNO Call Centre</option>
                    <option value="FNO Leads">FNO Leads</option>
                    <option value="Vuma Reach">Vuma Reach</option>
                    <option value="Referrals">Referrals</option>
                    <option value="Self-sourced">Self-sourced</option>
                </select>
            </div>
            <div id="axCampaignField" class="hidden">
                <label class="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                <input type="text" id="axCampaignName" class="w-full border rounded-xl px-3 py-2">
            </div>` : ''}
            <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea id="axNotes" class="w-full border rounded-xl px-3 py-2" rows="2" placeholder="Optional notes..."></textarea>
            </div>
        </div>
        <button onclick="axAddSale()" class="btn-primary text-white px-6 py-2 rounded-xl font-medium mt-4 w-full">Add Sale</button>
    </div>`;

    // Initialize reason options
    axUpdateReasons();
}

// ─── Add Sale form helpers ───
window.axUpdateProviders = function() {
    const cat = document.getElementById('axCategory')?.value;
    const providers = [...new Set(axxessPricing.filter(p => p.category === cat).map(p => p.provider))].sort();
    const sel = document.getElementById('axProvider');
    sel.innerHTML = '<option value="">Select Provider...</option>' + providers.map(p => `<option value="${p}">${p}</option>`).join('');
    document.getElementById('axPackage').innerHTML = '<option value="">Select Package...</option>';
    document.getElementById('axAmount').value = '';
};

window.axUpdatePackages = function() {
    const cat = document.getElementById('axCategory')?.value;
    const prov = document.getElementById('axProvider')?.value;
    const filtered = axxessPricing.filter(p => p.category === cat && p.provider === prov);
    const sel = document.getElementById('axPackage');
    sel.innerHTML = '<option value="">Select Package...</option>' + filtered.map(p => `<option value="${p.id}" data-price="${p.price}">${p.name}</option>`).join('');
    document.getElementById('axAmount').value = '';
};

window.axUpdatePrice = function() {
    const sel = document.getElementById('axPackage');
    const opt = sel?.options[sel.selectedIndex];
    const price = opt?.getAttribute('data-price');
    if (price) document.getElementById('axAmount').value = parseFloat(price);
};

window.axUpdateReasons = function() {
    const status = document.getElementById('axStatus')?.value;
    const sel = document.getElementById('axReason');
    if (!sel) return;
    const opts = AX_REASON_OPTIONS[status] || [];
    sel.innerHTML = '<option value="">Select Details...</option>' + opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
};

window.axToggleCampaign = function() {
    const origin = document.getElementById('axSaleOrigin')?.value;
    const field = document.getElementById('axCampaignField');
    if (field) field.classList.toggle('hidden', origin !== 'Marketing Campaign');
};

window.axAddSale = async function() {
    const msg = document.getElementById('axSaleMsg');
    msg.innerHTML = '';

    const pkgId = document.getElementById('axPackage')?.value;
    const serviceId = document.getElementById('axServiceId')?.value.trim();
    const accountNum = document.getElementById('axAccountNum')?.value.trim();
    const amount = parseFloat(document.getElementById('axAmount')?.value);
    const status = document.getElementById('axStatus')?.value;
    const reason = document.getElementById('axReason')?.value;
    const notes = document.getElementById('axNotes')?.value.trim();

    if (!serviceId || !accountNum) { msg.innerHTML = '<p class="text-red-600 text-sm mb-2">Service ID and Account Number are required</p>'; return; }
    if (!pkgId || isNaN(amount) || amount <= 0) { msg.innerHTML = '<p class="text-red-600 text-sm mb-2">Select a package with valid amount</p>'; return; }
    if (!reason) { msg.innerHTML = '<p class="text-red-600 text-sm mb-2">Select Status Details</p>'; return; }

    // Duplicate check
    const now = new Date();
    const dup = axGetMySales().find(s => s.service_id === serviceId && new Date(s.created_at).getMonth() === now.getMonth() && new Date(s.created_at).getFullYear() === now.getFullYear());
    if (dup) { msg.innerHTML = '<p class="text-red-600 text-sm mb-2">Service ID already exists this month</p>'; return; }

    // Sales team validation
    let saleOrigin = null, campaignName = null;
    if (axxessCurrentAgent?.team_id === 1) {
        saleOrigin = document.getElementById('axSaleOrigin')?.value;
        if (!saleOrigin) { msg.innerHTML = '<p class="text-red-600 text-sm mb-2">Sale Origin required for Sales Team</p>'; return; }
        if (saleOrigin === 'Marketing Campaign') {
            campaignName = document.getElementById('axCampaignName')?.value.trim();
            if (!campaignName) { msg.innerHTML = '<p class="text-red-600 text-sm mb-2">Campaign Name required</p>'; return; }
        }
    }

    try {
        const pkg = axxessPricing.find(p => p.id === parseInt(pkgId));
        const saleData = {
            agent_id: axxessCurrentAgent.id,
            account_number: accountNum,
            service_id: serviceId,
            package_name: pkg?.name || 'Package',
            category: pkg?.category || 'General',
            provider: pkg?.provider || 'Unknown',
            total_sale: amount,
            sale_status: status,
            status_reason: reason,
            sale_origin: saleOrigin,
            campaign_name: campaignName,
            notes: notes || '',
            commission_status: (status === 'Paid-Active' && reason === 'Full Payment') ? 'Counts' : 'Does Not Count',
            import_source: null,
            created_at: new Date().toISOString()
        };

        const { error } = await window.supabaseClient.from('sales_log').insert([saleData]).select();
        if (error) throw error;

        msg.innerHTML = '<p class="text-emerald-600 text-sm mb-2 font-medium">Sale added successfully!</p>';
        setTimeout(() => loadAxxessSalesData(), 1000);
    } catch (error) {
        msg.innerHTML = `<p class="text-red-600 text-sm mb-2">Error: ${error.message}</p>`;
    }
};

// ─── Current Month Tab ───
function renderAxCurrentMonth(container) {
    const now = new Date();
    const sales = axGetMySales().filter(s => {
        const d = new Date(s.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const target = axxessCurrentAgent?.target || 0;
    const metrics = axCalcCommission(sales, target);

    let html = `<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div class="bg-gray-50 rounded-xl p-3 text-center"><p class="text-2xl font-bold">${metrics.totalCount}</p><p class="text-xs text-gray-500">Valid Sales</p></div>
        <div class="bg-gray-50 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-emerald-600">${metrics.commCount}</p><p class="text-xs text-gray-500">Commissioned</p></div>
        <div class="bg-gray-50 rounded-xl p-3 text-center"><p class="text-2xl font-bold">${Math.round(metrics.commProg)}%</p><p class="text-xs text-gray-500">Target Progress</p></div>
        <div class="bg-gray-50 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-blue-600">R${metrics.net.toFixed(2)}</p><p class="text-xs text-gray-500">Net Commission</p></div>
    </div>`;

    if (sales.length === 0) {
        html += '<div class="card p-6 text-center text-gray-500">No sales this month</div>';
    } else {
        html += `<div class="card overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm">
            <thead class="bg-gray-50"><tr class="text-left text-gray-500">
                <th class="px-3 py-2">Date</th><th class="px-3 py-2">Account #</th><th class="px-3 py-2">Service ID</th>
                <th class="px-3 py-2">Package</th><th class="px-3 py-2">Amount</th><th class="px-3 py-2">Status</th>
                <th class="px-3 py-2">Details</th><th class="px-3 py-2">Commission</th><th class="px-3 py-2">Actions</th>
            </tr></thead><tbody>`;

        sales.forEach(s => {
            const date = new Date(s.created_at).toLocaleDateString();
            const statusCls = s.sale_status === 'Paid-Active' ? 'bg-emerald-100 text-emerald-700' : s.sale_status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : s.sale_status === 'Partial' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';
            let commDisp = '-';
            if (s.sale_status === 'Paid-Active' && s.status_reason === 'Full Payment' && metrics.rate > 0) {
                const c = (parseFloat(s.total_sale) * metrics.rate / 100) * 0.85;
                commDisp = `<span class="text-emerald-600 font-medium">${metrics.rate}%: R${c.toFixed(2)}</span>`;
            }
            const src = s.import_source === 'MASS_IMPORT' ? '<span class="text-xs bg-purple-100 text-purple-700 px-1 rounded">Import</span>' : s.import_source === 'AUTO_LEAD' ? '<span class="text-xs bg-blue-100 text-blue-700 px-1 rounded">Auto</span>' : '';

            html += `<tr class="border-t hover:bg-gray-50">
                <td class="px-3 py-2">${date}</td>
                <td class="px-3 py-2 font-mono font-medium">${s.account_number || '-'}</td>
                <td class="px-3 py-2 font-mono">${s.service_id || '-'}</td>
                <td class="px-3 py-2">${s.package_name} ${src}</td>
                <td class="px-3 py-2 font-medium">R${parseFloat(s.total_sale).toFixed(2)}</td>
                <td class="px-3 py-2"><span class="px-2 py-0.5 rounded-full text-xs ${statusCls}">${s.sale_status}</span></td>
                <td class="px-3 py-2 text-xs text-gray-500">${s.status_reason || '-'}</td>
                <td class="px-3 py-2">${commDisp}</td>
                <td class="px-3 py-2"><button onclick="axOpenStatusModal('${s.id}')" class="text-blue-600 hover:underline text-xs">Edit</button></td>
            </tr>`;
        });

        html += '</tbody></table></div></div>';
    }

    container.innerHTML = html;
}

// ─── Sales History Tab ───
function renderAxSalesHistory(container) {
    const sales = axGetMySales();
    const grouped = {};
    sales.forEach(s => {
        const d = new Date(s.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
    });

    const months = Object.keys(grouped).sort().reverse();
    if (months.length === 0) {
        container.innerHTML = '<div class="card p-6 text-center text-gray-500">No sales history</div>';
        return;
    }

    let html = '';
    months.forEach((key, idx) => {
        const [y, m] = key.split('-');
        const name = new Date(y, m - 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
        const total = grouped[key].filter(s => s.sale_status !== 'Failed').reduce((sum, s) => sum + (parseFloat(s.total_sale) || 0), 0);
        const isOpen = idx === 0;

        html += `<div class="card mb-3 overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100" onclick="this.nextElementSibling.classList.toggle('hidden')">
                <span class="font-semibold text-gray-800">${name}</span>
                <span class="text-sm text-gray-500">${grouped[key].length} sales · R${total.toLocaleString()}</span>
            </div>
            <div class="${isOpen ? '' : 'hidden'}"><div class="overflow-x-auto"><table class="w-full text-sm">
                <thead class="bg-gray-50"><tr class="text-left text-gray-500 text-xs">
                    <th class="px-3 py-2">Date</th><th class="px-3 py-2">Account</th><th class="px-3 py-2">Service</th>
                    <th class="px-3 py-2">Package</th><th class="px-3 py-2">Amount</th><th class="px-3 py-2">Status</th>
                </tr></thead><tbody>`;

        grouped[key].forEach(s => {
            const statusCls = s.sale_status === 'Paid-Active' ? 'text-emerald-600' : s.sale_status === 'Pending' ? 'text-yellow-600' : s.sale_status === 'Failed' ? 'text-red-500' : 'text-orange-500';
            html += `<tr class="border-t"><td class="px-3 py-2 text-xs">${new Date(s.created_at).toLocaleDateString()}</td>
                <td class="px-3 py-2 font-mono text-xs">${s.account_number || '-'}</td>
                <td class="px-3 py-2 font-mono text-xs">${s.service_id || '-'}</td>
                <td class="px-3 py-2 text-xs">${s.package_name}</td>
                <td class="px-3 py-2 text-xs font-medium">R${parseFloat(s.total_sale).toFixed(2)}</td>
                <td class="px-3 py-2 text-xs ${statusCls} font-medium">${s.sale_status}</td></tr>`;
        });

        html += '</tbody></table></div></div></div>';
    });

    container.innerHTML = html;
}

// ─── Commission Tab ───
function renderAxCommission(container) {
    const now = new Date();
    const sales = axGetMySales().filter(s => {
        const d = new Date(s.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const target = axxessCurrentAgent?.target || 0;
    const m = axCalcCommission(sales, target);

    container.innerHTML = `<div class="card p-6">
        <h4 class="font-semibold text-gray-800 mb-4">Commission Breakdown — ${now.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}</h4>
        <div class="space-y-3">
            <div class="flex justify-between py-2 border-b"><span class="text-gray-600">Total Valid Sales</span><span class="font-bold">${m.totalCount}</span></div>
            <div class="flex justify-between py-2 border-b"><span class="text-gray-600">Commissioned Sales (Paid-Active + Full Payment)</span><span class="font-bold text-emerald-600">${m.commCount}</span></div>
            <div class="flex justify-between py-2 border-b"><span class="text-gray-600">Commissioned Value</span><span class="font-bold">R${m.commValue.toFixed(2)}</span></div>
            <div class="flex justify-between py-2 border-b"><span class="text-gray-600">Target</span><span class="font-bold">R${target.toLocaleString()}</span></div>
            <div class="flex justify-between py-2 border-b"><span class="text-gray-600">Progress</span><span class="font-bold ${m.commProg >= 100 ? 'text-emerald-600' : m.commProg >= 80 ? 'text-yellow-600' : 'text-red-500'}">${Math.round(m.commProg)}%</span></div>
            <div class="flex justify-between py-2 border-b"><span class="text-gray-600">Commission Rate</span><span class="font-bold text-blue-600">${m.rate}%</span></div>
            <div class="flex justify-between py-2 border-b"><span class="text-gray-600">Gross Commission</span><span class="font-bold">R${m.gross.toFixed(2)}</span></div>
            <div class="flex justify-between py-2 border-b"><span class="text-gray-600">VAT (15%)</span><span class="font-bold text-red-500">-R${m.vat.toFixed(2)}</span></div>
            <div class="flex justify-between py-2 bg-emerald-50 rounded-lg px-3"><span class="text-gray-800 font-semibold">Net Commission</span><span class="font-bold text-emerald-600 text-lg">R${m.net.toFixed(2)}</span></div>
        </div>
        <div class="mt-4 text-xs text-gray-400">
            Rate: 0% below 80% target · 8% at 80-99% · 12% at 100%+
        </div>
    </div>`;
}

// ─── Mass Import Tab ───
function renderAxMassImport(container) {
    if (!axxessCurrentAgent) {
        container.innerHTML = '<div class="card p-6"><p class="text-yellow-600">Select an agent to import sales.</p></div>';
        return;
    }

    container.innerHTML = `<div class="card p-6">
        <h4 class="font-semibold text-gray-800 mb-2">Mass Import Sales from Excel</h4>
        <p class="text-gray-500 text-sm mb-4">Upload an Excel file (.xlsx) with sales data. Max 100 rows per import.</p>
        <div id="axImportMsg"></div>
        <div class="flex gap-3 mb-4">
            <button onclick="axDownloadTemplate()" class="border px-4 py-2 rounded-xl text-sm hover:bg-gray-50">Download Template</button>
            <button onclick="axDownloadPackageList()" class="border px-4 py-2 rounded-xl text-sm hover:bg-gray-50">Download Package List</button>
        </div>
        <div class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition" onclick="document.getElementById('axFileInput').click()" id="axUploadArea">
            <p class="text-gray-500">Click to upload or drag & drop</p>
            <p class="text-xs text-gray-400 mt-1">Excel files only (.xlsx, .xls)</p>
        </div>
        <input type="file" id="axFileInput" class="hidden" accept=".xlsx,.xls" onchange="axHandleFile(event)">
        <div id="axImportPreview" class="hidden mt-4"></div>
    </div>`;
}

window.axDownloadTemplate = function() {
    if (typeof XLSX === 'undefined') { alert('XLSX library not loaded'); return; }
    const wb = XLSX.utils.book_new();
    const headers = ['Package Name', 'Account Number', 'Service ID', 'Amount', 'Status', 'Status Details', 'Sale Origin', 'Campaign Name', 'Notes'];
    const example = [['Vuma 100Mbps Uncapped', 'ACC-001234', 'VUMA-12345', '549.00', 'Paid-Active', 'Full Payment', '', '', 'Example - delete this row']];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Import');
    XLSX.writeFile(wb, 'Axxess_Sales_Import_Template.xlsx');
};

window.axDownloadPackageList = function() {
    if (typeof XLSX === 'undefined') { alert('XLSX library not loaded'); return; }
    const wb = XLSX.utils.book_new();
    const data = [['Package Name', 'Category', 'Provider', 'Price'], ...axxessPricing.map(p => [p.name, p.category, p.provider, p.price])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Packages');
    XLSX.writeFile(wb, 'Axxess_Package_List.xlsx');
};

window.axHandleFile = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const msg = document.getElementById('axImportMsg');
    if (!file.name.match(/\.(xlsx|xls)$/i)) { msg.innerHTML = '<p class="text-red-600 text-sm mb-2">Please upload an Excel file</p>'; return; }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
            if (json.length <= 1) { msg.innerHTML = '<p class="text-red-600 text-sm mb-2">File is empty</p>'; return; }
            axProcessImport(json);
        } catch (err) { msg.innerHTML = `<p class="text-red-600 text-sm mb-2">Error: ${err.message}</p>`; }
    };
    reader.readAsArrayBuffer(file);
};

function axProcessImport(data) {
    const rows = data.slice(1).filter(r => r.some(c => c != null && c !== ''));
    if (rows.length > 100) { document.getElementById('axImportMsg').innerHTML = '<p class="text-red-600 text-sm mb-2">Max 100 rows</p>'; return; }

    const now = new Date();
    const existing = axGetMySales().filter(s => { const d = new Date(s.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && s.service_id; }).map(s => s.service_id.toUpperCase());

    axxessPendingImport = [];
    let valid = 0, errors = 0;

    rows.forEach((row, i) => {
        const r = { rowNum: i + 2, pkg: String(row[0] || '').trim(), acc: String(row[1] || '').trim(), svc: String(row[2] || '').trim(), amt: row[3], status: String(row[4] || '').trim(), details: String(row[5] || '').trim(), origin: String(row[6] || '').trim(), campaign: String(row[7] || '').trim(), notes: String(row[8] || '').trim(), errors: [] };
        if (!r.pkg) r.errors.push('Package required');
        else { r.pkgData = axxessPricing.find(p => p.name === r.pkg); if (!r.pkgData) r.errors.push('Package not found'); }
        if (!r.acc && !r.svc) r.errors.push('Account # or Service ID required');
        if (r.svc && existing.includes(r.svc.toUpperCase())) r.errors.push('Duplicate Service ID');
        if (!r.amt || isNaN(parseFloat(r.amt)) || parseFloat(r.amt) <= 0) r.errors.push('Valid amount required');
        if (!['Paid-Active', 'Pending', 'Partial', 'Failed'].includes(r.status)) r.errors.push('Invalid status');
        if (!r.details) r.errors.push('Status Details required');
        r.errors.length === 0 ? valid++ : errors++;
        axxessPendingImport.push(r);
    });

    const preview = document.getElementById('axImportPreview');
    preview.classList.remove('hidden');
    preview.innerHTML = `<div class="flex gap-4 mb-3">
        <span class="text-sm">Total: <strong>${axxessPendingImport.length}</strong></span>
        <span class="text-sm text-emerald-600">Valid: <strong>${valid}</strong></span>
        <span class="text-sm text-red-600">Errors: <strong>${errors}</strong></span>
    </div>
    <div class="flex gap-3">
        <button onclick="axConfirmImport()" class="btn-primary text-white px-4 py-2 rounded-xl text-sm" ${valid === 0 ? 'disabled' : ''}>Import ${valid} Sales</button>
        <button onclick="axCancelImport()" class="border px-4 py-2 rounded-xl text-sm">Cancel</button>
    </div>`;
}

window.axConfirmImport = async function() {
    const validRows = axxessPendingImport.filter(r => r.errors.length === 0);
    if (!validRows.length || !confirm(`Import ${validRows.length} sales?`)) return;

    try {
        const inserts = validRows.map(r => ({
            agent_id: axxessCurrentAgent.id, account_number: r.acc || null, service_id: r.svc || null,
            package_name: r.pkg, category: r.pkgData?.category || 'Unknown', provider: r.pkgData?.provider || 'Unknown',
            total_sale: parseFloat(r.amt), sale_status: r.status, status_reason: r.details,
            sale_origin: r.origin || null, campaign_name: r.campaign || null, notes: r.notes || '',
            commission_status: (r.status === 'Paid-Active' && r.details === 'Full Payment') ? 'Counts' : 'Does Not Count',
            import_source: 'MASS_IMPORT', created_at: new Date().toISOString()
        }));
        const { error } = await window.supabaseClient.from('sales_log').insert(inserts);
        if (error) throw error;
        document.getElementById('axImportMsg').innerHTML = `<p class="text-emerald-600 text-sm mb-2 font-medium">Imported ${inserts.length} sales!</p>`;
        axxessPendingImport = [];
        document.getElementById('axImportPreview').classList.add('hidden');
        setTimeout(() => loadAxxessSalesData(), 1500);
    } catch (err) { document.getElementById('axImportMsg').innerHTML = `<p class="text-red-600 text-sm mb-2">Error: ${err.message}</p>`; }
};

window.axCancelImport = function() {
    axxessPendingImport = [];
    document.getElementById('axImportPreview')?.classList.add('hidden');
    document.getElementById('axFileInput').value = '';
};

// ─── Export Tab ───
function renderAxExport(container) {
    container.innerHTML = `<div class="card p-6">
        <h4 class="font-semibold text-gray-800 mb-4">Export Sales Data</h4>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div><label class="block text-xs text-gray-500 mb-1">Date From</label><input type="date" id="axExpFrom" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="block text-xs text-gray-500 mb-1">Date To</label><input type="date" id="axExpTo" class="w-full border rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="block text-xs text-gray-500 mb-1">Status</label><select id="axExpStatus" class="w-full border rounded-lg px-3 py-2 text-sm"><option value="">All</option><option>Paid-Active</option><option>Pending</option><option>Partial</option><option>Failed</option></select></div>
        </div>
        <button onclick="axExportCSV()" class="btn-primary text-white px-4 py-2 rounded-xl text-sm">Export as CSV</button>
    </div>`;
}

window.axExportCSV = function() {
    let sales = axGetMySales();
    const from = document.getElementById('axExpFrom')?.value;
    const to = document.getElementById('axExpTo')?.value;
    const status = document.getElementById('axExpStatus')?.value;
    if (from) sales = sales.filter(s => s.created_at >= from);
    if (to) sales = sales.filter(s => s.created_at <= to + 'T23:59:59');
    if (status) sales = sales.filter(s => s.sale_status === status);

    const headers = ['Date', 'Account Number', 'Service ID', 'Package', 'Amount', 'Status', 'Details', 'Origin', 'Commission Status', 'Notes'];
    const rows = sales.map(s => [new Date(s.created_at).toLocaleDateString(), s.account_number, s.service_id, s.package_name, s.total_sale, s.sale_status, s.status_reason, s.sale_origin, s.commission_status, s.notes]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `axxess_sales_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
};

// ─── Reminders Tab ───
function renderAxReminders(container) {
    const reminders = axGetMyReminders();
    const active = reminders.filter(r => !r.is_completed && !r.is_dismissed);
    const completed = reminders.filter(r => r.is_completed);
    const dismissed = reminders.filter(r => r.is_dismissed && !r.is_completed);

    const current = axxessReminderView === 'active' ? active : axxessReminderView === 'completed' ? completed : dismissed;
    const now = new Date();

    let html = `<div class="flex gap-2 mb-4">
        <button onclick="axxessReminderView='active';renderAxCurrentTab()" class="px-3 py-1.5 rounded-lg text-sm ${axxessReminderView === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}">Active (${active.length})</button>
        <button onclick="axxessReminderView='completed';renderAxCurrentTab()" class="px-3 py-1.5 rounded-lg text-sm ${axxessReminderView === 'completed' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}">Completed (${completed.length})</button>
        <button onclick="axxessReminderView='dismissed';renderAxCurrentTab()" class="px-3 py-1.5 rounded-lg text-sm ${axxessReminderView === 'dismissed' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700'}">Dismissed (${dismissed.length})</button>
        ${axxessCurrentAgent ? `<button onclick="axOpenReminderModal()" class="ml-auto btn-primary text-white px-3 py-1.5 rounded-lg text-sm">+ New Reminder</button>` : ''}
    </div>`;

    if (current.length === 0) {
        html += `<div class="card p-6 text-center text-gray-500">No ${axxessReminderView} reminders</div>`;
    } else {
        current.forEach(r => {
            const rd = new Date(r.reminder_datetime);
            const overdue = rd < now && axxessReminderView === 'active';
            const borderCls = overdue ? 'border-l-4 border-red-500' : r.priority === 'urgent' ? 'border-l-4 border-orange-500' : r.priority === 'high' ? 'border-l-4 border-yellow-500' : '';
            const agent = axxessAgents.find(a => a.id === r.agent_id);

            html += `<div class="card p-4 mb-3 ${borderCls}">
                <div class="flex items-start justify-between">
                    <div>
                        <h5 class="font-semibold text-gray-800">${r.reminder_title}</h5>
                        ${r.reminder_description ? `<p class="text-sm text-gray-500 mt-1">${r.reminder_description}</p>` : ''}
                        <div class="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                            <span class="${overdue ? 'text-red-600 font-medium' : ''}">${overdue ? 'OVERDUE ' : ''}${rd.toLocaleString()}</span>
                            ${r.client_name ? `<span>Client: ${r.client_name}</span>` : ''}
                            ${agent ? `<span>Agent: ${agent.name}</span>` : ''}
                        </div>
                    </div>
                    <div class="flex gap-1">
                        ${axxessReminderView === 'active' ? `
                            <button onclick="axCompleteReminder(${r.id})" class="text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded text-xs">Complete</button>
                            <button onclick="axDismissReminder(${r.id})" class="text-gray-500 hover:bg-gray-100 px-2 py-1 rounded text-xs">Dismiss</button>` : ''}
                        ${axxessReminderView !== 'active' ? `<button onclick="axReactivateReminder(${r.id})" class="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs">Reactivate</button>` : ''}
                        <button onclick="axDeleteReminder(${r.id})" class="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs">Delete</button>
                    </div>
                </div>
            </div>`;
        });
    }

    container.innerHTML = html;
}

// ─── Reminder CRUD ───
window.axOpenReminderModal = function() {
    openModal('axReminderModal');
    const dt = new Date(); dt.setHours(dt.getHours() + 1);
    const el = id => document.getElementById(id);
    if (el('axRemTitle')) el('axRemTitle').value = '';
    if (el('axRemDesc')) el('axRemDesc').value = '';
    if (el('axRemDatetime')) el('axRemDatetime').value = dt.toISOString().slice(0, 16);
    if (el('axRemPriority')) el('axRemPriority').value = 'normal';
    if (el('axRemClient')) el('axRemClient').value = '';
    if (el('axRemAccount')) el('axRemAccount').value = '';
    if (el('axRemService')) el('axRemService').value = '';
};

window.axSaveReminder = async function() {
    const title = document.getElementById('axRemTitle')?.value.trim();
    const datetime = document.getElementById('axRemDatetime')?.value;
    if (!title || !datetime) { alert('Title and date/time required'); return; }
    if (new Date(datetime) < new Date()) { alert('Date must be in the future'); return; }

    try {
        const { error } = await window.supabaseClient.from('agent_reminders').insert([{
            agent_id: axxessCurrentAgent.id,
            reminder_title: title,
            reminder_description: document.getElementById('axRemDesc')?.value.trim() || null,
            reminder_datetime: new Date(datetime).toISOString(),
            priority: document.getElementById('axRemPriority')?.value || 'normal',
            client_name: document.getElementById('axRemClient')?.value.trim() || null,
            account_number: document.getElementById('axRemAccount')?.value.trim() || null,
            service_id: document.getElementById('axRemService')?.value.trim() || null,
            is_completed: false, is_dismissed: false
        }]);
        if (error) throw error;
        closeModal('axReminderModal');
        loadAxxessSalesData();
    } catch (err) { alert('Error: ' + err.message); }
};

window.axCompleteReminder = async function(id) {
    if (!confirm('Mark as complete?')) return;
    const { error } = await window.supabaseClient.from('agent_reminders').update({ is_completed: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) loadAxxessSalesData();
};

window.axDismissReminder = async function(id) {
    if (!confirm('Dismiss this reminder?')) return;
    const { error } = await window.supabaseClient.from('agent_reminders').update({ is_dismissed: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) loadAxxessSalesData();
};

window.axDeleteReminder = async function(id) {
    if (!confirm('Permanently delete?')) return;
    const { error } = await window.supabaseClient.from('agent_reminders').delete().eq('id', id);
    if (!error) loadAxxessSalesData();
};

window.axReactivateReminder = async function(id) {
    const { error } = await window.supabaseClient.from('agent_reminders').update({ is_completed: false, is_dismissed: false, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) loadAxxessSalesData();
};

function axCheckDueReminders() {
    const now = new Date();
    axGetMyReminders().filter(r => !r.is_completed && !r.is_dismissed).forEach(r => {
        const rd = new Date(r.reminder_datetime);
        const key = `ax-rem-${r.id}`;
        if (rd <= now && !axxessShownNotifications.has(key)) {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Reminder: ' + r.reminder_title, { body: r.reminder_description || 'You have a reminder due', icon: 'https://i.ibb.co/1GrhnMc4/images.jpg' });
            }
            axxessShownNotifications.add(key);
        }
    });
}

// ─── Status Checks Tab ───
function renderAxStatusChecks(container) {
    if (axxessStatusChecks.length === 0) {
        container.innerHTML = '<div class="card p-6 text-center text-gray-500">No status checks yet. Use the Tampermonkey script to sync.</div>';
        return;
    }
    let html = `<div class="card overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm">
        <thead class="bg-gray-50"><tr class="text-left text-gray-500"><th class="px-3 py-2">Service ID</th><th class="px-3 py-2">Company</th><th class="px-3 py-2">Product</th><th class="px-3 py-2">Bob Status</th><th class="px-3 py-2">Checked By</th><th class="px-3 py-2">Checked At</th></tr></thead><tbody>`;
    axxessStatusChecks.forEach(c => {
        const bobCls = (c.bob_status || '').toLowerCase().includes('active') ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium';
        html += `<tr class="border-t hover:bg-gray-50"><td class="px-3 py-2 font-mono">${c.service_id || '-'}</td><td class="px-3 py-2">${c.company || '-'}</td><td class="px-3 py-2">${c.product || '-'}</td><td class="px-3 py-2 ${bobCls}">${c.bob_status || '-'}</td><td class="px-3 py-2">${c.checked_by || '-'}</td><td class="px-3 py-2 text-gray-500">${c.checked_at ? new Date(c.checked_at).toLocaleString() : '-'}</td></tr>`;
    });
    html += '</tbody></table></div></div>';
    container.innerHTML = html;
}

// ─── Permissions Tab (super_admin only) ───
function renderAxPermissions(container) {
    if (!axCanManagePermissions()) {
        container.innerHTML = '<div class="card p-6 text-center text-gray-500">Only super admins can manage permissions.</div>';
        return;
    }

    container.innerHTML = `<div class="card p-6">
        <h4 class="font-semibold text-gray-800 mb-4">Agent-Profile Linking</h4>
        <p class="text-sm text-gray-500 mb-4">Link admin/agent profiles to Axxess sales agent records. This enables auto-sale creation when leads are qualified.</p>
        <div id="axLinkingTable">Loading...</div>
    </div>
    <div class="card p-6 mt-4">
        <h4 class="font-semibold text-gray-800 mb-4">Lead Assignment</h4>
        <p class="text-sm text-gray-500 mb-4">Assign leads to specific internal agents. When a lead is qualified, a sale is auto-created for the assigned agent.</p>
        <p class="text-xs text-gray-400">This is managed from the Leads section — use the "Assign To" dropdown when editing a lead.</p>
    </div>`;

    // Load profiles for linking
    loadAxLinkingTable();
}

async function loadAxLinkingTable() {
    const { data: profiles } = await window.supabaseClient.from('profiles').select('id, email, full_name, role, agent_table_id').in('role', ['super_admin', 'admin', 'agent']).order('full_name');
    const el = document.getElementById('axLinkingTable');
    if (!profiles || profiles.length === 0) { el.innerHTML = '<p class="text-gray-500">No profiles found</p>'; return; }

    let html = `<table class="w-full text-sm"><thead class="bg-gray-50"><tr class="text-left text-gray-500"><th class="px-3 py-2">Profile</th><th class="px-3 py-2">Role</th><th class="px-3 py-2">Linked Agent</th><th class="px-3 py-2">Action</th></tr></thead><tbody>`;
    profiles.forEach(p => {
        const linked = axxessAgents.find(a => a.id === p.agent_table_id);
        html += `<tr class="border-t"><td class="px-3 py-2">${p.full_name} <span class="text-xs text-gray-400">${p.email}</span></td>
            <td class="px-3 py-2"><span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">${p.role}</span></td>
            <td class="px-3 py-2">
                <select onchange="axLinkProfile('${p.id}', this.value)" class="border rounded-lg px-2 py-1 text-sm">
                    <option value="">Not linked</option>
                    ${axxessAgents.map(a => `<option value="${a.id}" ${p.agent_table_id === a.id ? 'selected' : ''}>${a.name} (${a.email || ''})</option>`).join('')}
                </select>
            </td>
            <td class="px-3 py-2">${linked ? '<span class="text-emerald-600 text-xs">Linked</span>' : '<span class="text-gray-400 text-xs">Unlinked</span>'}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
}

window.axLinkProfile = async function(profileId, agentId) {
    try {
        const { error } = await window.supabaseClient.from('profiles').update({ agent_table_id: agentId ? parseInt(agentId) : null }).eq('id', profileId);
        if (error) throw error;
        // Reload current user if it's their own profile
        if (currentUser && currentUser.id === profileId) {
            currentUser.agent_table_id = agentId ? parseInt(agentId) : null;
            axxessCurrentAgent = axxessAgents.find(a => a.id === parseInt(agentId)) || null;
        }
        alert('Profile linked successfully');
    } catch (err) { alert('Error: ' + err.message); }
};

// ─── Status Update Modal ───
window.axOpenStatusModal = function(saleId) {
    axxessEditingSale = axxessSales.find(s => String(s.id) === String(saleId));
    if (!axxessEditingSale) { alert('Sale not found'); return; }

    document.getElementById('axModalSaleInfo').textContent = `${axxessEditingSale.service_id || axxessEditingSale.account_number} · R${parseFloat(axxessEditingSale.total_sale).toFixed(2)}`;
    document.getElementById('axModalStatus').value = axxessEditingSale.sale_status || '';
    axModalUpdateReasons();
    document.getElementById('axModalReason').value = axxessEditingSale.status_reason || '';
    document.getElementById('axModalNotes').value = axxessEditingSale.notes || '';
    openModal('axStatusModal');
};

window.axModalUpdateReasons = function() {
    const status = document.getElementById('axModalStatus')?.value;
    const sel = document.getElementById('axModalReason');
    const opts = AX_REASON_OPTIONS[status] || [];
    sel.innerHTML = '<option value="">Select Details...</option>' + opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
};

window.axUpdateSaleStatus = async function() {
    if (!axxessEditingSale) return;
    const status = document.getElementById('axModalStatus')?.value;
    const reason = document.getElementById('axModalReason')?.value;
    const notes = document.getElementById('axModalNotes')?.value.trim();
    if (!status || !reason) { alert('Fill in status and details'); return; }

    try {
        const { error } = await window.supabaseClient.from('sales_log').update({
            sale_status: status, status_reason: reason, notes,
            commission_status: (status === 'Paid-Active' && reason === 'Full Payment') ? 'Counts' : 'Does Not Count',
            updated_at: new Date().toISOString()
        }).eq('id', axxessEditingSale.id);
        if (error) throw error;
        closeModal('axStatusModal');
        loadAxxessSalesData();
    } catch (err) { alert('Error: ' + err.message); }
};

// Make key functions globally accessible
window.axSwitchTab = axSwitchTab;
window.loadAxxessSalesData = loadAxxessSalesData;
