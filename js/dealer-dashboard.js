// Dealer Dashboard JavaScript
let currentUser = null;
let dealerInfo = null;
let agents = [];
let leads = [];
let orders = [];
let packages = [];

document.addEventListener('DOMContentLoaded', async function() {
    const auth = await requireAuth('dealer');
    if (!auth) return;
    
    currentUser = auth.profile;
    document.getElementById('userName').textContent = currentUser.full_name;
    document.getElementById('userInitials').textContent = getInitials(currentUser.full_name);
    
    await loadDealerInfo();
    await Promise.all([loadAgents(), loadDealerLeads(), loadDealerOrders(), loadPackages()]);
    updateDashboardStats();
    initDealerCharts();
});

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

async function loadDealerInfo() {
    try {
        const { data } = await window.supabaseClient
            .from('dealers')
            .select('*')
            .eq('id', currentUser.dealer_id)
            .single();
        dealerInfo = data;
        document.getElementById('dealerName').textContent = dealerInfo?.name || 'Dealership';
    } catch (error) {
        console.error('Error loading dealer info:', error);
    }
}

async function loadAgents() {
    try {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('dealer_id', currentUser.dealer_id)
            .eq('role', 'agent')
            .order('full_name');
        
        if (error) throw error;
        agents = data || [];
        document.getElementById('totalAgents').textContent = agents.length;
        
        const countEl = document.getElementById('agentCount');
        if (countEl && agents.length > 0) {
            countEl.textContent = agents.length;
            countEl.classList.remove('hidden');
        }
        renderAgentsGrid();
        populateAgentFilter();
    } catch (error) {
        console.error('Error loading agents:', error);
    }
}

function renderAgentsGrid() {
    const grid = document.getElementById('agentsGrid');
    if (agents.length === 0) {
        grid.innerHTML = '<p class="text-gray-500 col-span-full text-center py-8">No agents found</p>';
        return;
    }
    
    grid.innerHTML = agents.map(agent => {
        const agentLeads = leads.filter(l => l.agent_id === agent.id);
        const converted = agentLeads.filter(l => l.status === 'converted').length;
        const rate = agentLeads.length > 0 ? Math.round((converted / agentLeads.length) * 100) : 0;
        
        return `
            <div class="card p-6 cursor-pointer hover:shadow-lg transition" onclick="openEditAgentModal('${agent.id}')">
                <div class="flex items-center gap-4 mb-4">
                    <div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                        ${getInitials(agent.full_name)}
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800">${agent.full_name}</h4>
                        <p class="text-gray-500 text-sm">${agent.email}</p>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="bg-gray-50 rounded-lg p-2">
                        <p class="text-lg font-bold text-gray-800">${agentLeads.length}</p>
                        <p class="text-xs text-gray-500">Leads</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-2">
                        <p class="text-lg font-bold text-emerald-600">${converted}</p>
                        <p class="text-xs text-gray-500">Converted</p>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-2">
                        <p class="text-lg font-bold text-blue-600">${rate}%</p>
                        <p class="text-xs text-gray-500">Rate</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function populateAgentFilter() {
    const filter = document.getElementById('leadAgentFilter');
    if (filter) {
        filter.innerHTML = '<option value="">All Agents</option>';
        agents.forEach(a => {
            filter.innerHTML += `<option value="${a.id}">${a.full_name}</option>`;
        });
    }
}

async function loadDealerLeads() {
    try {
        const { data, error } = await window.supabaseClient
            .from('leads')
            .select(`*, agent:profiles!leads_agent_id_fkey(id, full_name), package:packages(id, name, price)`)
            .eq('dealer_id', currentUser.dealer_id)
            .order('created_at', { ascending: false })
            .limit(500);
        
        if (error) throw error;
        leads = data || [];
        document.getElementById('totalLeads').textContent = leads.length;
        renderDealerLeadsTable();
    } catch (error) {
        console.error('Error loading leads:', error);
    }
}

function renderDealerLeadsTable(filteredLeads = null) {
    const table = document.getElementById('dealerLeadsTable');
    const displayLeads = filteredLeads || leads;
    
    const countEl = document.getElementById('dealerLeadCount');
    if (countEl) countEl.textContent = `Showing ${displayLeads.length} leads`;
    
    if (displayLeads.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-500">No leads found</td></tr>';
        return;
    }
    
    const statusColors = {
        'new': 'bg-blue-100 text-blue-700',
        'contacted': 'bg-purple-100 text-purple-700',
        'qualified': 'bg-yellow-100 text-yellow-700',
        'converted': 'bg-emerald-100 text-emerald-700',
        'lost': 'bg-red-100 text-red-700'
    };
    
    table.innerHTML = displayLeads.map(lead => {
        const clientName = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '-';
        return `
            <tr class="table-row border-b hover:bg-gray-50">
                <td class="py-3 text-sm font-medium text-gray-800">${clientName}</td>
                <td class="py-3 text-sm text-gray-600">${lead.email || lead.phone || '-'}</td>
                <td class="py-3 text-sm text-gray-600">${lead.agent?.full_name || '-'}</td>
                <td class="py-3 text-sm text-gray-600">${lead.package?.name || '-'}</td>
                <td class="py-3"><span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[lead.status] || 'bg-gray-100'}">${lead.status}</span></td>
                <td class="py-3 text-sm text-gray-500">${lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '-'}</td>
            </tr>
        `;
    }).join('');
}

function filterDealerLeads() {
    const search = (document.getElementById('leadSearchFilter')?.value || '').toLowerCase().trim();
    const status = document.getElementById('leadStatusFilter')?.value || '';
    const agentId = document.getElementById('leadAgentFilter')?.value || '';
    
    let filtered = leads;
    if (search) {
        filtered = filtered.filter(l => {
            const name = (l.full_name || `${l.first_name || ''} ${l.last_name || ''}`).toLowerCase();
            return name.includes(search) || (l.email || '').toLowerCase().includes(search) || (l.phone || '').includes(search);
        });
    }
    if (status) filtered = filtered.filter(l => l.status === status);
    if (agentId) filtered = filtered.filter(l => l.agent_id === agentId);
    
    renderDealerLeadsTable(filtered);
}

async function loadDealerOrders() {
    try {
        const { data, error } = await window.supabaseClient
            .from('leads')
            .select(`*, agent:profiles!leads_agent_id_fkey(id, full_name), package:packages(id, name, price)`)
            .eq('dealer_id', currentUser.dealer_id)
            .eq('status', 'converted')
            .order('updated_at', { ascending: false });
        
        if (error) throw error;
        orders = data || [];
        document.getElementById('totalOrders').textContent = orders.length;
        renderDealerOrdersTable();
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function renderDealerOrdersTable() {
    const table = document.getElementById('dealerOrdersTable');
    if (orders.length === 0) {
        table.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-gray-500">No orders found</td></tr>';
        return;
    }
    
    table.innerHTML = orders.map(order => {
        const clientName = order.full_name || `${order.first_name || ''} ${order.last_name || ''}`.trim() || '-';
        const statusClass = order.commission_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700';
        return `
            <tr class="table-row border-b hover:bg-gray-50">
                <td class="py-3 text-sm font-medium text-gray-800">${order.order_number || '-'}</td>
                <td class="py-3 text-sm text-gray-600">${clientName}</td>
                <td class="py-3 text-sm text-gray-600">${order.agent?.full_name || '-'}</td>
                <td class="py-3 text-sm text-gray-600">${order.package?.name || '-'}</td>
                <td class="py-3 text-sm font-semibold text-emerald-600">R${order.commission_amount || 0}</td>
                <td class="py-3"><span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">${order.commission_status || 'pending'}</span></td>
                <td class="py-3 text-sm text-gray-500">${order.updated_at ? new Date(order.updated_at).toLocaleDateString() : '-'}</td>
            </tr>
        `;
    }).join('');
}

async function loadPackages() {
    try {
        const { data } = await window.supabaseClient.from('packages').select('*').order('name');
        packages = data || [];
    } catch (error) {
        console.error('Error loading packages:', error);
    }
}

function updateDashboardStats() {
    const totalCommission = orders.reduce((sum, o) => sum + (o.commission_amount || 0), 0);
    document.getElementById('totalCommission').textContent = `R${totalCommission.toLocaleString()}`;
    renderTopAgents();
}

function renderTopAgents() {
    const container = document.getElementById('topAgentsList');
    const agentStats = agents.map(agent => {
        const agentOrders = orders.filter(o => o.agent_id === agent.id);
        return { ...agent, orders: agentOrders.length, commission: agentOrders.reduce((sum, o) => sum + (o.commission_amount || 0), 0) };
    }).sort((a, b) => b.commission - a.commission).slice(0, 5);
    
    if (agentStats.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No agent data</p>';
        return;
    }
    
    container.innerHTML = agentStats.map((agent, idx) => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-3">
                <span class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">${idx + 1}</span>
                <span class="font-medium text-gray-800">${agent.full_name}</span>
            </div>
            <div class="text-right">
                <p class="font-semibold text-emerald-600">R${agent.commission.toLocaleString()}</p>
                <p class="text-xs text-gray-500">${agent.orders} orders</p>
            </div>
        </div>
    `).join('');
}

function initDealerCharts() {
    const ctx = document.getElementById('dealerPerformanceChart');
    if (!ctx) return;
    
    const now = new Date();
    const labels = [], leadsData = [], convData = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
        leadsData.push(leads.filter(l => { const c = new Date(l.created_at); return c.getMonth() === d.getMonth() && c.getFullYear() === d.getFullYear(); }).length);
        convData.push(orders.filter(o => { const u = new Date(o.updated_at); return u.getMonth() === d.getMonth() && u.getFullYear() === d.getFullYear(); }).length);
    }
    
    new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [
            { label: 'Leads', data: leadsData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4 },
            { label: 'Conversions', data: convData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 }
        ]},
        options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
    });
}

function showSection(section) {
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`section-${section}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active', 'text-white');
        item.classList.add('text-white/70');
    });
    
    const activeNav = document.querySelector(`[href="#${section}"]`);
    if (activeNav) {
        activeNav.classList.add('active', 'text-white');
        activeNav.classList.remove('text-white/70');
    }
    
    const titles = {
        'dashboard': { title: 'Dashboard', subtitle: 'Dealership overview' },
        'agents': { title: 'My Agents', subtitle: 'Manage your sales team' },
        'leads': { title: 'All Leads', subtitle: 'View all dealership leads' },
        'orders': { title: 'All Orders', subtitle: 'Track all orders' },
        'performance': { title: 'Agent Performance', subtitle: 'Compare agent metrics' },
        'commissions': { title: 'Dealer Commission', subtitle: 'Commission due from Openserve' },
        'reports': { title: 'Reports', subtitle: 'Dealership analytics' }
    };
    
    if (titles[section]) {
        document.getElementById('pageTitle').textContent = titles[section].title;
        document.getElementById('pageSubtitle').textContent = titles[section].subtitle;
    }
    
    if (section === 'agents') renderAgentsGrid();
    else if (section === 'performance') loadPerformanceSection();
    else if (section === 'commissions') loadCommissionSection();
    else if (section === 'reports') loadReportsSection();
}

function loadPerformanceSection() {
    const ctx = document.getElementById('agentComparisonChart');
    if (ctx) {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: agents.map(a => a.full_name),
                datasets: [
                    { label: 'Leads', data: agents.map(a => leads.filter(l => l.agent_id === a.id).length), backgroundColor: 'rgba(59,130,246,0.7)' },
                    { label: 'Converted', data: agents.map(a => orders.filter(o => o.agent_id === a.id).length), backgroundColor: 'rgba(16,185,129,0.7)' }
                ]
            },
            options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
        });
    }
    
    const table = document.getElementById('performanceTable');
    if (table) {
        table.innerHTML = agents.map(agent => {
            const aLeads = leads.filter(l => l.agent_id === agent.id);
            const aOrders = orders.filter(o => o.agent_id === agent.id);
            const rate = aLeads.length > 0 ? Math.round((aOrders.length / aLeads.length) * 100) : 0;
            const comm = aOrders.reduce((s, o) => s + (o.commission_amount || 0), 0);
            return `<tr class="table-row border-b hover:bg-gray-50">
                <td class="py-3 text-sm font-medium text-gray-800">${agent.full_name}</td>
                <td class="py-3 text-sm text-gray-600">${aLeads.length}</td>
                <td class="py-3 text-sm text-emerald-600 font-medium">${aOrders.length}</td>
                <td class="py-3 text-sm text-blue-600 font-medium">${rate}%</td>
                <td class="py-3 text-sm font-semibold text-emerald-600">R${comm.toLocaleString()}</td>
            </tr>`;
        }).join('');
    }
}

function loadCommissionSection() {
    let total = 0, pending = 0, paid = 0;
    orders.forEach(o => {
        const amt = o.commission_amount || 0;
        total += amt;
        if (o.commission_status === 'paid') paid += amt;
        else pending += amt;
    });
    
    document.getElementById('dealerTotalCommission').textContent = `R${total.toLocaleString()}`;
    document.getElementById('dealerPendingCommission').textContent = `R${pending.toLocaleString()}`;
    document.getElementById('dealerPaidCommission').textContent = `R${paid.toLocaleString()}`;
    
    const table = document.getElementById('commissionBreakdownTable');
    if (table) {
        table.innerHTML = agents.map(agent => {
            const aOrders = orders.filter(o => o.agent_id === agent.id);
            const aPending = aOrders.filter(o => o.commission_status !== 'paid').reduce((s, o) => s + (o.commission_amount || 0), 0);
            const aPaid = aOrders.filter(o => o.commission_status === 'paid').reduce((s, o) => s + (o.commission_amount || 0), 0);
            const aTotal = aPending + aPaid;
            return `<tr class="table-row border-b hover:bg-gray-50">
                <td class="py-3 text-sm font-medium text-gray-800">${agent.full_name}</td>
                <td class="py-3 text-sm text-gray-600">${aOrders.length}</td>
                <td class="py-3 text-sm text-yellow-600">R${aPending.toLocaleString()}</td>
                <td class="py-3 text-sm text-blue-600">R${aPaid.toLocaleString()}</td>
                <td class="py-3 text-sm font-semibold text-emerald-600">R${aTotal.toLocaleString()}</td>
            </tr>`;
        }).join('');
    }
}

function loadReportsSection() {
    const now = new Date();
    const thisMonth = leads.filter(l => { const c = new Date(l.created_at); return c.getMonth() === now.getMonth() && c.getFullYear() === now.getFullYear(); });
    const thisMonthConv = orders.filter(o => { const u = new Date(o.updated_at); return u.getMonth() === now.getMonth() && u.getFullYear() === now.getFullYear(); });
    const avgRate = leads.length > 0 ? Math.round((orders.length / leads.length) * 100) : 0;
    const monthlyComm = thisMonthConv.reduce((s, o) => s + (o.commission_amount || 0), 0);
    
    document.getElementById('reportActiveAgents').textContent = agents.length;
    document.getElementById('reportMonthlyLeads').textContent = thisMonth.length;
    document.getElementById('reportMonthlyConversions').textContent = thisMonthConv.length;
    document.getElementById('reportAvgConversion').textContent = `${avgRate}%`;
    document.getElementById('reportMonthlyCommission').textContent = `R${monthlyComm.toLocaleString()}`;
    
    const ctx = document.getElementById('dealerLeadStatusChart');
    if (ctx) {
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'],
                datasets: [{
                    data: [
                        leads.filter(l => l.status === 'new').length,
                        leads.filter(l => l.status === 'contacted').length,
                        leads.filter(l => l.status === 'qualified').length,
                        leads.filter(l => l.status === 'converted').length,
                        leads.filter(l => l.status === 'lost').length
                    ],
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444']
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

function logout() {
    window.supabaseClient.auth.signOut();
    window.location.href = 'index.html';
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Edit Agent Modal
function openEditAgentModal(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    
    document.getElementById('editAgentId').value = agentId;
    document.getElementById('editAgentName').value = agent.full_name || '';
    document.getElementById('editAgentEmail').value = agent.email || '';
    document.getElementById('editAgentPhone').value = agent.phone || '';
    
    // Calculate stats
    const agentLeads = leads.filter(l => l.agent_id === agentId);
    const agentOrders = orders.filter(o => o.agent_id === agentId);
    const commission = agentOrders.reduce((sum, o) => sum + (o.commission_amount || 0), 0);
    
    document.getElementById('editAgentLeads').textContent = agentLeads.length;
    document.getElementById('editAgentConverted').textContent = agentOrders.length;
    document.getElementById('editAgentCommission').textContent = `R${commission.toLocaleString()}`;
    
    openModal('editAgentModal');
}

// Setup form handlers
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('editAgentForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const agentId = document.getElementById('editAgentId').value;
        const formData = new FormData(e.target);
        
        try {
            const { error } = await window.supabaseClient
                .from('profiles')
                .update({
                    full_name: formData.get('full_name'),
                    phone: formData.get('phone') || null
                })
                .eq('id', agentId);
            
            if (error) throw error;
            
            alert('Agent updated successfully!');
            closeModal('editAgentModal');
            await loadAgents();
        } catch (error) {
            console.error('Error updating agent:', error);
            alert('Error updating agent: ' + error.message);
        }
    });
});
