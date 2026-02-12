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
let axxessCurrentTab = window.location.pathname.includes('internal-agent') ? 'ax-add-sale' : 'ax-overview';
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
    ],
    'Free Trial': [
        { value: 'Openserve 30-Day Free Trial', label: 'Openserve 30-Day Free Trial' },
        { value: 'Provider Free Trial', label: 'Provider Free Trial' },
        { value: 'Promotional Trial', label: 'Promotional Trial' }
    ]
};

// ─── Free Trial helpers ───
const FREE_TRIAL_DAYS = 30;

function axGetTrialDaysLeft(sale) {
    if (sale.sale_status !== 'Free Trial') return null;
    const start = sale.trial_start_date ? new Date(sale.trial_start_date) : new Date(sale.created_at);
    const now = new Date();
    const elapsed = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return Math.max(FREE_TRIAL_DAYS - elapsed, 0);
}

function axTrialBadge(sale) {
    const days = axGetTrialDaysLeft(sale);
    if (days === null) return '';
    if (days === 0) return '<span class="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-bold">EXPIRED</span>';
    if (days <= 7) return `<span class="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-bold">${days}d left</span>`;
    if (days <= 14) return `<span class="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 font-bold">${days}d left</span>`;
    return `<span class="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">${days}d left</span>`;
}

function axGetFreeTrialSales() {
    return axGetMySales().filter(s => s.sale_status === 'Free Trial');
}

// ─── Permission helpers ───
function axCanManageSales() {
    if (!currentUser) return false;
    return ['super_admin', 'admin', 'internal_agent'].includes(currentUser.role);
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
        const [agentsRes, teamsRes, pricingRes] = await Promise.all([
            window.supabaseClient.from('agents').select('*').order('name'),
            window.supabaseClient.from('teams').select('*'),
            window.supabaseClient.from('axxess_pricing').select('*').eq('is_active', true)
        ]);

        axxessAgents = agentsRes.data || [];
        axxessTeams = teamsRes.data || [];
        axxessPricing = pricingRes.data || [];

        // Status checks — separate query, fails gracefully if table doesn't exist
        const checksRes = await window.supabaseClient.from('service_status_checks').select('*').order('checked_at', { ascending: false }).limit(100);
        if (checksRes.error) {
            console.warn('service_status_checks not available:', checksRes.error.message);
            axxessStatusChecks = [];
        } else {
            axxessStatusChecks = checksRes.data || [];
        }

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
    renderAxTabBadges();
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
        case 'ax-free-trials': renderAxFreeTrials(container); break;
        default: container.innerHTML = '<p class="text-gray-500 p-4">Select a tab</p>';
    }
}

// ─── Tab Badge Counts (shown without clicking) ───
function renderAxTabBadges() {
    const mySales = axGetMySales();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthSales = mySales.filter(s => s.created_at >= monthStart);

    const pending = monthSales.filter(s => s.sale_status === 'Pending').length;
    const partial = monthSales.filter(s => s.sale_status === 'Partial').length;
    const freeTrials = mySales.filter(s => s.sale_status === 'Free Trial').length;
    const activeReminders = axGetMyReminders().filter(r => !r.is_completed && !r.is_dismissed).length;

    const setBadge = (tabName, count, color) => {
        const btn = document.querySelector(`[data-ax-tab="${tabName}"]`);
        if (!btn) return;
        // Remove existing badge
        const existing = btn.querySelector('.ax-tab-badge');
        if (existing) existing.remove();
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = `ax-tab-badge ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${color}`;
            badge.textContent = count;
            btn.appendChild(badge);
        }
    };

    setBadge('ax-current-month', pending, 'bg-yellow-100 text-yellow-700');
    setBadge('ax-free-trials', freeTrials, 'bg-cyan-100 text-cyan-700');
    setBadge('ax-reminders', activeReminders, 'bg-red-100 text-red-700');
}

// ─── Stats Cards ───
function renderAxStats() {
    const mySales = axGetMySales();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthSales = mySales.filter(s => s.created_at >= monthStart);
    const metrics = axCalcCommission(monthSales, axxessCurrentAgent?.target || 0);

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };

    // Internal agent dashboard shows agent-specific stats
    const isInternalAgent = window.location.pathname.includes('internal-agent');
    if (isInternalAgent) {
        const validSales = monthSales.filter(s => s.sale_status !== 'Failed');
        el('axxessAgentCount', validSales.length);
        el('axxessTotalSales', metrics.commCount);
        const pct = Math.round(metrics.commProg);
        el('axxessMonthSales', pct + '%');
        el('axxessTotalValue', 'R' + metrics.net.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
    } else {
        el('axxessAgentCount', axxessAgents.length);
        el('axxessTotalSales', mySales.length);
        el('axxessMonthSales', monthSales.length);
        el('axxessTotalValue', 'R' + (metrics.commValue || 0).toLocaleString());
    }
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
                <select id="axStatus" onchange="axUpdateReasons();axToggleTrialDate()" class="w-full border rounded-xl px-3 py-2">
                    <option value="Paid-Active">Paid-Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                    <option value="Failed">Failed</option>
                    <option value="Free Trial">Free Trial</option>
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
            <div id="axTrialDateField" class="hidden">
                <label class="block text-sm font-medium text-gray-700 mb-1">Trial Start Date</label>
                <input type="date" id="axTrialStartDate" class="w-full border rounded-xl px-3 py-2" value="${new Date().toISOString().slice(0,10)}">
            </div>
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

window.axToggleTrialDate = function() {
    const status = document.getElementById('axStatus')?.value;
    const field = document.getElementById('axTrialDateField');
    if (field) field.classList.toggle('hidden', status !== 'Free Trial');
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
            commission_status: (status === 'Free Trial' || (status === 'Paid-Active' && reason === 'Full Payment')) ? 'Counts' : 'Does Not Count',
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
            const statusCls = s.sale_status === 'Paid-Active' ? 'bg-emerald-100 text-emerald-700' : s.sale_status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : s.sale_status === 'Partial' ? 'bg-orange-100 text-orange-700' : s.sale_status === 'Free Trial' ? 'bg-cyan-100 text-cyan-700' : 'bg-red-100 text-red-700';
            const trialBadge = axTrialBadge(s);
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
                <td class="px-3 py-2"><span class="px-2 py-0.5 rounded-full text-xs ${statusCls}">${s.sale_status}</span> ${trialBadge}</td>
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
            const statusCls = s.sale_status === 'Paid-Active' ? 'text-emerald-600' : s.sale_status === 'Pending' ? 'text-yellow-600' : s.sale_status === 'Failed' ? 'text-red-500' : s.sale_status === 'Free Trial' ? 'text-cyan-600' : 'text-orange-500';
            const trialBadge = axTrialBadge(s);
            html += `<tr class="border-t"><td class="px-3 py-2 text-xs">${new Date(s.created_at).toLocaleDateString()}</td>
                <td class="px-3 py-2 font-mono text-xs">${s.account_number || '-'}</td>
                <td class="px-3 py-2 font-mono text-xs">${s.service_id || '-'}</td>
                <td class="px-3 py-2 text-xs">${s.package_name}</td>
                <td class="px-3 py-2 text-xs font-medium">R${parseFloat(s.total_sale).toFixed(2)}</td>
                <td class="px-3 py-2 text-xs ${statusCls} font-medium">${s.sale_status} ${trialBadge}</td></tr>`;
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
            commission_status: (r.status === 'Free Trial' || (r.status === 'Paid-Active' && r.details === 'Full Payment')) ? 'Counts' : 'Does Not Count',
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

// ─── Free Trials Tab ───
function renderAxFreeTrials(container) {
    const trials = axGetFreeTrialSales();

    // Summary stats
    const active = trials.filter(s => axGetTrialDaysLeft(s) > 0);
    const expiring = trials.filter(s => { const d = axGetTrialDaysLeft(s); return d > 0 && d <= 7; });
    const expired = trials.filter(s => axGetTrialDaysLeft(s) === 0);

    let html = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div class="bg-cyan-50 rounded-xl p-3 text-center border border-cyan-200">
            <p class="text-2xl font-bold text-cyan-700">${trials.length}</p>
            <p class="text-xs text-gray-500">Total Free Trials</p>
        </div>
        <div class="bg-blue-50 rounded-xl p-3 text-center border border-blue-200">
            <p class="text-2xl font-bold text-blue-700">${active.length}</p>
            <p class="text-xs text-gray-500">Active Trials</p>
        </div>
        <div class="bg-orange-50 rounded-xl p-3 text-center border border-orange-200">
            <p class="text-2xl font-bold text-orange-700">${expiring.length}</p>
            <p class="text-xs text-gray-500">Expiring Soon (≤7d)</p>
        </div>
        <div class="bg-red-50 rounded-xl p-3 text-center border border-red-200">
            <p class="text-2xl font-bold text-red-700">${expired.length}</p>
            <p class="text-xs text-gray-500">Expired</p>
        </div>
    </div>`;

    if (trials.length === 0) {
        html += '<div class="card p-6 text-center text-gray-500">No free trial clients. Add a sale with status "Free Trial" to start tracking.</div>';
        container.innerHTML = html;
        return;
    }

    // Sort: expired first, then by days left ascending (most urgent first)
    const sorted = [...trials].sort((a, b) => {
        const da = axGetTrialDaysLeft(a);
        const db = axGetTrialDaysLeft(b);
        return da - db;
    });

    html += `<div class="card overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm">
        <thead class="bg-cyan-600 text-white"><tr class="text-left">
            <th class="px-3 py-2">Days Left</th>
            <th class="px-3 py-2">Account #</th>
            <th class="px-3 py-2">Service ID</th>
            <th class="px-3 py-2">Package</th>
            <th class="px-3 py-2">Amount</th>
            <th class="px-3 py-2">Trial Started</th>
            <th class="px-3 py-2">Trial Ends</th>
            <th class="px-3 py-2">Details</th>
            <th class="px-3 py-2">Actions</th>
        </tr></thead><tbody>`;

    sorted.forEach(s => {
        const days = axGetTrialDaysLeft(s);
        const startDate = s.trial_start_date ? new Date(s.trial_start_date) : new Date(s.created_at);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + FREE_TRIAL_DAYS);

        const rowCls = days === 0 ? 'bg-red-50' : days <= 7 ? 'bg-orange-50' : days <= 14 ? 'bg-yellow-50' : '';
        const daysBadge = axTrialBadge(s);
        const progressPct = Math.round(((FREE_TRIAL_DAYS - days) / FREE_TRIAL_DAYS) * 100);
        const barColor = days === 0 ? 'bg-red-500' : days <= 7 ? 'bg-orange-500' : days <= 14 ? 'bg-yellow-500' : 'bg-cyan-500';

        html += `<tr class="border-t ${rowCls}">
            <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                    ${daysBadge}
                    <div class="w-16 bg-gray-200 rounded-full h-1.5"><div class="${barColor} h-1.5 rounded-full" style="width:${progressPct}%"></div></div>
                </div>
            </td>
            <td class="px-3 py-2 font-mono font-medium">${s.account_number || '-'}</td>
            <td class="px-3 py-2 font-mono">${s.service_id || '-'}</td>
            <td class="px-3 py-2">${s.package_name}</td>
            <td class="px-3 py-2 font-medium">R${parseFloat(s.total_sale).toFixed(2)}</td>
            <td class="px-3 py-2 text-xs">${startDate.toLocaleDateString()}</td>
            <td class="px-3 py-2 text-xs font-medium ${days === 0 ? 'text-red-600' : ''}">${endDate.toLocaleDateString()}</td>
            <td class="px-3 py-2 text-xs text-gray-500">${s.status_reason || '-'}</td>
            <td class="px-3 py-2">
                <button onclick="axOpenStatusModal('${s.id}')" class="text-blue-600 hover:underline text-xs mr-2">Edit Status</button>
            </td>
        </tr>`;
    });

    html += '</tbody></table></div></div>';
    container.innerHTML = html;
}

// ─── CSV Status → Sale Status mapping ───
const CSV_STATUS_MAP = {
    'active':                        { sale_status: 'Paid-Active', status_reason: 'Full Payment' },
    'awaiting provider completion':  { sale_status: 'Pending',     status_reason: 'Awaiting Provider Completion' },
    'awaiting client feedback':      { sale_status: 'Pending',     status_reason: 'Awaiting Client Feedback' },
    'not found':                     { sale_status: 'Failed',      status_reason: 'No Feedback from Client' },
    'non payment':                   { sale_status: 'Failed',      status_reason: 'Non-Payment' }
};

// ─── Status Checks Tab ───
function renderAxStatusChecks(container) {
    let html = `
    <div class="card p-6 mb-4">
        <h4 class="font-semibold text-gray-800 mb-2">Upload Status Check CSV</h4>
        <p class="text-sm text-gray-500 mb-3">Upload a CSV with <strong>Service ID</strong> and <strong>Status</strong> columns. This will log each check and auto-update matching sales.</p>
        <div class="bg-gray-50 rounded-xl p-4 mb-3 text-xs text-gray-500">
            <strong>Status Mapping:</strong><br>
            <span class="text-emerald-600 font-medium">Active</span> → Paid-Active (Full Payment) &nbsp;|&nbsp;
            <span class="text-yellow-600 font-medium">Awaiting Provider Completion</span> → Pending &nbsp;|&nbsp;
            <span class="text-yellow-600 font-medium">Awaiting Client Feedback</span> → Pending &nbsp;|&nbsp;
            <span class="text-red-600 font-medium">Not Found</span> → Failed &nbsp;|&nbsp;
            <span class="text-red-600 font-medium">Non Payment</span> → Failed (Non-Payment)
        </div>
        <div class="flex items-center gap-3">
            <input type="file" id="axStatusCsvFile" accept=".csv" class="text-sm">
            <button onclick="axProcessStatusCsv()" class="btn-primary text-white px-4 py-2 rounded-xl text-sm font-medium">Upload & Process</button>
        </div>
        <div id="axStatusCsvMsg" class="mt-3"></div>
        <div id="axStatusCsvPreview" class="mt-3"></div>
    </div>`;

    // Existing checks table
    if (axxessStatusChecks.length > 0) {
        html += `<div class="card overflow-hidden"><div class="flex items-center justify-between px-4 py-3 bg-gray-50">
            <span class="font-semibold text-gray-800">Recent Status Checks (${axxessStatusChecks.length})</span>
        </div><div class="overflow-x-auto"><table class="w-full text-sm">
            <thead class="bg-gray-50"><tr class="text-left text-gray-500"><th class="px-3 py-2">Service ID</th><th class="px-3 py-2">Company</th><th class="px-3 py-2">Product</th><th class="px-3 py-2">Bob Status</th><th class="px-3 py-2">Checked By</th><th class="px-3 py-2">Checked At</th></tr></thead><tbody>`;
        axxessStatusChecks.forEach(c => {
            const bobCls = (c.bob_status || '').toLowerCase().includes('active') ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium';
            html += `<tr class="border-t hover:bg-gray-50"><td class="px-3 py-2 font-mono">${c.service_id || '-'}</td><td class="px-3 py-2">${c.company || '-'}</td><td class="px-3 py-2">${c.product || '-'}</td><td class="px-3 py-2 ${bobCls}">${c.bob_status || '-'}</td><td class="px-3 py-2">${c.checked_by || '-'}</td><td class="px-3 py-2 text-gray-500">${c.checked_at ? new Date(c.checked_at).toLocaleString() : '-'}</td></tr>`;
        });
        html += '</tbody></table></div></div>';
    }

    container.innerHTML = html;
}

// ─── CSV Upload Processing ───
window.axProcessStatusCsv = async function() {
    const msg = document.getElementById('axStatusCsvMsg');
    const preview = document.getElementById('axStatusCsvPreview');
    const fileInput = document.getElementById('axStatusCsvFile');
    msg.innerHTML = '';
    preview.innerHTML = '';

    if (!fileInput.files.length) {
        msg.innerHTML = '<p class="text-red-600 text-sm">Please select a CSV file</p>';
        return;
    }

    const file = fileInput.files[0];
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) {
        msg.innerHTML = '<p class="text-red-600 text-sm">CSV must have a header row and at least one data row</p>';
        return;
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const sidIdx = header.findIndex(h => h.includes('service') && h.includes('id') || h === 'service_id' || h === 'serviceid');
    const statusIdx = header.findIndex(h => h === 'status' || h === 'bob_status' || h === 'bob status');
    const companyIdx = header.findIndex(h => h === 'company' || h === 'client' || h === 'name');
    const productIdx = header.findIndex(h => h === 'product' || h === 'package');

    if (sidIdx === -1 || statusIdx === -1) {
        msg.innerHTML = '<p class="text-red-600 text-sm">CSV must have "Service ID" and "Status" columns. Found headers: <strong>' + header.join(', ') + '</strong></p>';
        return;
    }

    // Parse rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^['"]|['"]$/g, ''));
        const serviceId = cols[sidIdx]?.trim();
        const csvStatus = cols[statusIdx]?.trim();
        if (!serviceId || !csvStatus) continue;

        const mapped = CSV_STATUS_MAP[csvStatus.toLowerCase()];
        rows.push({
            service_id: serviceId,
            csv_status: csvStatus,
            company: companyIdx >= 0 ? cols[companyIdx] || '' : '',
            product: productIdx >= 0 ? cols[productIdx] || '' : '',
            mapped: mapped || null
        });
    }

    if (rows.length === 0) {
        msg.innerHTML = '<p class="text-red-600 text-sm">No valid data rows found in CSV</p>';
        return;
    }

    // Show preview
    const unmapped = rows.filter(r => !r.mapped);
    let previewHtml = `<p class="text-sm text-gray-600 mb-2">Found <strong>${rows.length}</strong> rows. ${unmapped.length > 0 ? `<span class="text-orange-600">${unmapped.length} with unknown status (will be logged but not mapped).</span>` : ''}</p>`;
    previewHtml += `<div class="overflow-x-auto max-h-64 overflow-y-auto"><table class="w-full text-xs">
        <thead class="bg-gray-100 sticky top-0"><tr><th class="px-2 py-1 text-left">Service ID</th><th class="px-2 py-1 text-left">CSV Status</th><th class="px-2 py-1 text-left">→ Sale Status</th><th class="px-2 py-1 text-left">→ Reason</th></tr></thead><tbody>`;
    rows.forEach(r => {
        const cls = r.mapped ? '' : 'bg-orange-50';
        previewHtml += `<tr class="border-t ${cls}"><td class="px-2 py-1 font-mono">${r.service_id}</td><td class="px-2 py-1">${r.csv_status}</td><td class="px-2 py-1">${r.mapped ? r.mapped.sale_status : '<span class="text-orange-500">Unknown</span>'}</td><td class="px-2 py-1">${r.mapped ? r.mapped.status_reason : '-'}</td></tr>`;
    });
    previewHtml += '</tbody></table></div>';
    previewHtml += `<button onclick="axConfirmStatusCsvUpload()" class="btn-primary text-white px-4 py-2 rounded-xl text-sm font-medium mt-3">Confirm & Process ${rows.length} Rows</button>`;
    preview.innerHTML = previewHtml;

    // Store parsed rows for confirmation
    window._axPendingCsvRows = rows;
};

window.axConfirmStatusCsvUpload = async function() {
    const msg = document.getElementById('axStatusCsvMsg');
    const preview = document.getElementById('axStatusCsvPreview');
    const rows = window._axPendingCsvRows;

    if (!rows || rows.length === 0) {
        msg.innerHTML = '<p class="text-red-600 text-sm">No data to process</p>';
        return;
    }

    msg.innerHTML = '<p class="text-blue-600 text-sm font-medium">Processing... please wait</p>';
    preview.innerHTML = '';

    const checkedBy = currentUser?.full_name || currentUser?.email || 'CSV Upload';
    const now = new Date().toISOString();
    let loggedCount = 0, updatedCount = 0, errorCount = 0;
    const results = [];

    for (const row of rows) {
        try {
            // 1. Log to service_status_checks
            const checkData = {
                service_id: row.service_id,
                company: row.company || null,
                product: row.product || null,
                bob_status: row.csv_status,
                checked_by: checkedBy,
                checked_at: now
            };

            const { error: checkErr } = await window.supabaseClient.from('service_status_checks').insert([checkData]);
            if (checkErr) throw checkErr;
            loggedCount++;

            // 2. Auto-update matching sales_log if mapped
            if (row.mapped) {
                const { data: matchingSales } = await window.supabaseClient
                    .from('sales_log')
                    .select('id, sale_status, status_reason')
                    .eq('service_id', row.service_id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (matchingSales && matchingSales.length > 0) {
                    const sale = matchingSales[0];
                    // Only update if status actually changed
                    if (sale.sale_status !== row.mapped.sale_status || sale.status_reason !== row.mapped.status_reason) {
                        const updateData = {
                            sale_status: row.mapped.sale_status,
                            status_reason: row.mapped.status_reason,
                            commission_status: (row.mapped.sale_status === 'Free Trial' || (row.mapped.sale_status === 'Paid-Active' && row.mapped.status_reason === 'Full Payment')) ? 'Counts' : 'Does Not Count'
                        };
                        const { error: updateErr } = await window.supabaseClient
                            .from('sales_log')
                            .update(updateData)
                            .eq('id', sale.id);

                        if (!updateErr) {
                            updatedCount++;
                        }
                    }
                }
            }

            results.push({ ...row, success: true });
        } catch (err) {
            errorCount++;
            results.push({ ...row, success: false, error: err.message });
        }
    }

    // Show results
    let resultHtml = `<div class="bg-gray-50 rounded-xl p-4 space-y-1">
        <p class="text-sm font-medium text-gray-800">Upload Complete</p>
        <p class="text-sm"><span class="text-emerald-600 font-bold">${loggedCount}</span> status checks logged</p>
        <p class="text-sm"><span class="text-blue-600 font-bold">${updatedCount}</span> sales updated</p>
        ${errorCount > 0 ? `<p class="text-sm"><span class="text-red-600 font-bold">${errorCount}</span> errors</p>` : ''}
    </div>`;

    msg.innerHTML = resultHtml;
    window._axPendingCsvRows = null;

    // Reload data to reflect changes
    setTimeout(() => loadAxxessSalesData(), 1000);
};

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
    const { data: profiles } = await window.supabaseClient.from('profiles').select('id, email, full_name, role, agent_table_id').order('full_name');
    const el = document.getElementById('axLinkingTable');
    if (!profiles || profiles.length === 0) { el.innerHTML = '<p class="text-gray-500">No profiles found</p>'; return; }

    const roleOptions = ['super_admin', 'admin', 'internal_agent', 'agent', 'external_agent', 'dealer', 'openserve'];
    const roleColors = { super_admin: 'bg-red-100 text-red-700', admin: 'bg-blue-100 text-blue-700', internal_agent: 'bg-purple-100 text-purple-700', agent: 'bg-green-100 text-green-700', external_agent: 'bg-teal-100 text-teal-700', dealer: 'bg-orange-100 text-orange-700', openserve: 'bg-yellow-100 text-yellow-700' };

    let html = `<table class="w-full text-sm"><thead class="bg-gray-50"><tr class="text-left text-gray-500"><th class="px-3 py-2">Profile</th><th class="px-3 py-2">Role</th><th class="px-3 py-2">Linked Agent</th><th class="px-3 py-2">Status</th></tr></thead><tbody>`;
    profiles.forEach(p => {
        const linked = axxessAgents.find(a => a.id === p.agent_table_id);
        const rc = roleColors[p.role] || 'bg-gray-100 text-gray-700';
        html += `<tr class="border-t">
            <td class="px-3 py-2">${p.full_name || 'Unnamed'} <span class="text-xs text-gray-400">${p.email}</span></td>
            <td class="px-3 py-2">
                <select onchange="axChangeRole('${p.id}', this.value)" class="border rounded-lg px-2 py-1 text-xs">
                    ${roleOptions.map(r => `<option value="${r}" ${p.role === r ? 'selected' : ''}>${r.replace('_', ' ')}</option>`).join('')}
                </select>
            </td>
            <td class="px-3 py-2">
                <select onchange="axLinkProfile('${p.id}', this.value)" class="border rounded-lg px-2 py-1 text-sm">
                    <option value="">Not linked</option>
                    ${axxessAgents.map(a => `<option value="${a.id}" ${p.agent_table_id === a.id ? 'selected' : ''}>${a.name} (${a.email || ''})</option>`).join('')}
                </select>
            </td>
            <td class="px-3 py-2">${linked ? '<span class="text-emerald-600 text-xs font-medium">Linked</span>' : '<span class="text-gray-400 text-xs">Unlinked</span>'}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
}

window.axChangeRole = async function(profileId, newRole) {
    try {
        const { error } = await window.supabaseClient.from('profiles').update({ role: newRole }).eq('id', profileId);
        if (error) throw error;
        alert('Role updated to ' + newRole.replace('_', ' '));
    } catch (err) { alert('Error changing role: ' + err.message); }
};

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
            commission_status: (status === 'Free Trial' || (status === 'Paid-Active' && reason === 'Full Payment')) ? 'Counts' : 'Does Not Count',
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
