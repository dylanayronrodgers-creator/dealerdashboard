// Admin Dashboard JavaScript
let currentUser = null;
let agents = [];
let packages = [];
let leads = [];
let orders = [];
let dealers = [];
let pendingAgents = [];
let systemSettings = {};

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const auth = await requireAuth('admin');
    if (!auth) return;
    
    currentUser = auth.profile;
    
    // Update UI with user info
    document.getElementById('userName').textContent = currentUser.full_name;
    document.getElementById('userInitials').textContent = getInitials(currentUser.full_name);
    
    // Load initial data
    await Promise.all([
        loadAgents(),
        loadPackages(),
        loadLeads(),
        loadOrders(),
        loadDealers(),
        loadPendingAgents(),
        loadSystemSettings(),
        loadDashboardStats()
    ]);
    
    // Initialize charts
    initCharts();
    
    // Setup form handlers
    setupFormHandlers();
    
    // Setup filters
    setupFilters();
    
    // Update notifications
    updateNotifications();
    
    // Load Supabase settings for Settings page
    loadSupabaseSettings();
});

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Global Search
function globalSearchHandler(query) {
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) {
        renderLeadsTable();
        return;
    }
    
    // Switch to leads section
    showSection('leads');
    
    // Filter leads based on search
    const filtered = leads.filter(lead => {
        const searchFields = [
            lead.full_name,
            lead.first_name,
            lead.last_name,
            lead.email,
            lead.phone,
            lead.address,
            lead.lead_id,
            lead.agent?.full_name,
            lead.agent_name,
            lead.dealer?.name,
            lead.dealer_name,
            lead.package?.name,
            lead.package_name
        ];
        
        return searchFields.some(field => 
            field && field.toLowerCase().includes(searchTerm)
        );
    });
    
    renderLeadsTable(filtered);
}

// Notifications
let notifications = [];

function toggleNotifications() {
    const dropdown = document.getElementById('notificationsDropdown');
    dropdown.classList.toggle('hidden');
}

function updateNotifications() {
    const list = document.getElementById('notificationsList');
    const badge = document.getElementById('notificationBadge');
    
    notifications = [];
    
    // Check for pending agents
    if (pendingAgents.length > 0) {
        notifications.push({
            type: 'pending_agent',
            message: `${pendingAgents.length} agent(s) awaiting approval`,
            icon: '👤',
            action: () => showSection('pending-agents')
        });
    }
    
    // Check for new leads today
    const today = new Date().toDateString();
    const newLeadsToday = leads.filter(l => new Date(l.created_at).toDateString() === today).length;
    if (newLeadsToday > 0) {
        notifications.push({
            type: 'new_leads',
            message: `${newLeadsToday} new lead(s) today`,
            icon: '📋',
            action: () => showSection('leads')
        });
    }
    
    // Update badge
    if (notifications.length > 0) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
    
    // Render notifications
    if (notifications.length === 0) {
        list.innerHTML = '<p class="p-4 text-gray-500 text-sm text-center">No new notifications</p>';
    } else {
        list.innerHTML = notifications.map(n => `
            <div onclick="${n.action ? 'this.onclick()' : ''}" class="p-4 border-b hover:bg-gray-50 cursor-pointer flex items-start gap-3">
                <span class="text-xl">${n.icon}</span>
                <p class="text-sm text-gray-700">${n.message}</p>
            </div>
        `).join('');
        
        // Add click handlers
        const items = list.querySelectorAll('div');
        items.forEach((item, i) => {
            item.onclick = () => {
                if (notifications[i].action) {
                    notifications[i].action();
                    toggleNotifications();
                }
            };
        });
    }
}

// Close notifications when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notificationsDropdown');
    const btn = document.getElementById('notificationBtn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// Navigation
function showSection(section) {
    // Hide all sections
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
    
    // Show selected section
    document.getElementById(`section-${section}`).classList.remove('hidden');
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        item.classList.remove('text-white');
        item.classList.add('text-white/70');
    });
    
    const activeNav = document.querySelector(`[href="#${section}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
        activeNav.classList.add('text-white');
        activeNav.classList.remove('text-white/70');
    }
    
    // Update page title
    const titles = {
        'dashboard': { title: 'Dashboard', subtitle: 'Overview of your dealer network' },
        'leads': { title: 'Leads', subtitle: 'Manage all leads' },
        'orders': { title: 'Orders', subtitle: 'Track all orders' },
        'agents': { title: 'Agents', subtitle: 'Manage your sales agents' },
        'packages': { title: 'Packages', subtitle: 'Openserve fibre packages' },
        'reports': { title: 'Reports', subtitle: 'Analytics and performance metrics' },
        'import': { title: 'Import Leads', subtitle: 'Upload CSV files to import leads' },
        'dealers': { title: 'Dealers', subtitle: 'Manage dealer organizations' },
        'pending-agents': { title: 'Pending Agents', subtitle: 'Review and approve new agents' },
        'settings': { title: 'Settings', subtitle: 'System configuration' }
    };
    
    if (titles[section]) {
        document.getElementById('pageTitle').textContent = titles[section].title;
        document.getElementById('pageSubtitle').textContent = titles[section].subtitle;
    }
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Load Agents
async function loadAgents() {
    try {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('role', 'agent')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        agents = data || [];
        
        renderAgentsGrid();
        populateAgentSelects();
        document.getElementById('totalAgents').textContent = agents.length;
    } catch (error) {
        console.error('Error loading agents:', error);
    }
}

function renderAgentsGrid() {
    const grid = document.getElementById('agentsGrid');
    
    if (agents.length === 0) {
        grid.innerHTML = `
            <div class="card p-6 text-center col-span-full">
                <p class="text-gray-500">No agents found. Add your first agent!</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = agents.map(agent => `
        <div class="card p-6">
            <div class="flex items-center gap-4 mb-4">
                <div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    ${getInitials(agent.full_name)}
                </div>
                <div>
                    <h4 class="font-semibold text-gray-800">${agent.full_name}</h4>
                    <p class="text-gray-500 text-sm">${agent.email}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-center mb-4">
                <div class="bg-gray-50 rounded-lg p-3">
                    <p class="text-2xl font-bold text-gray-800" id="agent-leads-${agent.id}">0</p>
                    <p class="text-xs text-gray-500">Leads</p>
                </div>
                <div class="bg-gray-50 rounded-lg p-3">
                    <p class="text-2xl font-bold text-gray-800" id="agent-orders-${agent.id}">0</p>
                    <p class="text-xs text-gray-500">Orders</p>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="viewAgentDetails('${agent.id}')" class="flex-1 text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-sm font-medium">View</button>
                <button onclick="deleteAgent('${agent.id}')" class="flex-1 text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm font-medium">Remove</button>
            </div>
        </div>
    `).join('');
    
    // Load agent stats
    agents.forEach(agent => loadAgentStats(agent.id));
}

async function loadAgentStats(agentId) {
    try {
        const [leadsResult, ordersResult] = await Promise.all([
            window.supabaseClient.from('leads').select('id', { count: 'exact' }).eq('agent_id', agentId),
            window.supabaseClient.from('orders').select('id', { count: 'exact' }).eq('agent_id', agentId)
        ]);
        
        const leadsEl = document.getElementById(`agent-leads-${agentId}`);
        const ordersEl = document.getElementById(`agent-orders-${agentId}`);
        
        if (leadsEl) leadsEl.textContent = leadsResult.count || 0;
        if (ordersEl) ordersEl.textContent = ordersResult.count || 0;
    } catch (error) {
        console.error('Error loading agent stats:', error);
    }
}

// View/Edit Agent Details
function viewAgentDetails(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    
    document.getElementById('editAgentId').value = agentId;
    document.getElementById('editAgentName').value = agent.full_name || '';
    document.getElementById('editAgentEmail').value = agent.email || '';
    document.getElementById('editAgentPhone').value = agent.phone || '';
    document.getElementById('editAgentApproved').value = agent.is_approved ? 'true' : 'false';
    
    // Populate dealer select
    const dealerSelect = document.getElementById('editAgentDealer');
    dealerSelect.innerHTML = '<option value="">No dealer assigned</option>';
    dealers.forEach(d => {
        dealerSelect.innerHTML += `<option value="${d.id}" ${agent.dealer_id === d.id ? 'selected' : ''}>${d.name}</option>`;
    });
    
    openModal('editAgentModal');
}

// View/Edit Dealer Details
function viewDealerDetails(dealerId) {
    const dealer = dealers.find(d => d.id === dealerId);
    if (!dealer) return;
    
    document.getElementById('editDealerId').value = dealerId;
    document.getElementById('editDealerName').value = dealer.name || '';
    document.getElementById('editDealerCode').value = dealer.code || '';
    document.getElementById('editDealerEmail').value = dealer.contact_email || '';
    document.getElementById('editDealerPhone').value = dealer.contact_phone || '';
    document.getElementById('editDealerLogo').value = dealer.logo_url || '';
    document.getElementById('editDealerActive').value = dealer.is_active ? 'true' : 'false';
    
    // Preview logo
    previewDealerLogo(dealer.logo_url);
    
    // Show assigned agents
    const assignedAgents = agents.filter(a => a.dealer_id === dealerId);
    const agentsList = document.getElementById('dealerAgentsList');
    if (assignedAgents.length === 0) {
        agentsList.innerHTML = '<p class="text-gray-400">No agents assigned to this dealer</p>';
    } else {
        agentsList.innerHTML = assignedAgents.map(a => 
            `<div class="flex items-center gap-2 py-1"><span class="w-2 h-2 bg-green-500 rounded-full"></span>${a.full_name}</div>`
        ).join('');
    }
    
    openModal('editDealerModal');
}

function previewDealerLogo(url) {
    const preview = document.getElementById('dealerLogoPreview');
    if (url && url.startsWith('http')) {
        preview.innerHTML = `<img src="${url}" alt="Logo" class="w-full h-full object-contain" onerror="this.parentElement.innerHTML='<span class=\\'text-red-400 text-xs\\'>Invalid URL</span>'">`;
    } else {
        preview.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>`;
    }
}

function populateAgentSelects() {
    const selects = ['leadAgentSelect', 'leadAgentFilter', 'orderAgentFilter'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const currentValue = select.value;
            const isFilter = selectId.includes('Filter');
            
            select.innerHTML = isFilter ? '<option value="">All Agents</option>' : '<option value="">Select Agent</option>';
            
            agents.forEach(agent => {
                select.innerHTML += `<option value="${agent.id}">${agent.full_name}</option>`;
            });
            
            select.value = currentValue;
        }
    });
}

// Load Packages
async function loadPackages() {
    try {
        const { data, error } = await window.supabaseClient
            .from('packages')
            .select('*')
            .order('speed', { ascending: true });
        
        if (error) throw error;
        packages = data || [];
        
        renderPackagesGrid();
        populatePackageSelects();
    } catch (error) {
        console.error('Error loading packages:', error);
    }
}

function renderPackagesGrid() {
    const grid = document.getElementById('packagesGrid');
    
    if (packages.length === 0) {
        grid.innerHTML = `
            <div class="card p-6 text-center col-span-full">
                <p class="text-gray-500">No packages found. Add your first package!</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = packages.map(pkg => `
        <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
                <div class="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white font-bold">
                    ${pkg.speed}
                </div>
                <span class="text-2xl font-bold text-gray-800">R${pkg.price}</span>
            </div>
            <h4 class="font-semibold text-gray-800 mb-2">${pkg.name}</h4>
            <p class="text-gray-500 text-sm mb-4">${pkg.description || 'No description'}</p>
            <div class="flex gap-2">
                <button onclick="editPackage('${pkg.id}')" class="flex-1 text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-sm font-medium">Edit</button>
                <button onclick="deletePackage('${pkg.id}')" class="flex-1 text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm font-medium">Delete</button>
            </div>
        </div>
    `).join('');
}

function populatePackageSelects() {
    const selects = ['leadPackageSelect'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Select Package</option>';
            packages.forEach(pkg => {
                select.innerHTML += `<option value="${pkg.id}">${pkg.name} - R${pkg.price}/mo</option>`;
            });
        }
    });
}

// Load Leads
async function loadLeads() {
    try {
        const { data, error } = await window.supabaseClient
            .from('leads')
            .select(`
                *,
                agent:profiles!leads_agent_id_fkey(id, full_name),
                package:packages(id, name, price),
                dealer:dealers(id, name)
            `)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        leads = data || [];
        
        renderLeadsTable();
        renderRecentOrders();
        document.getElementById('totalLeads').textContent = leads.length;
    } catch (error) {
        console.error('Error loading leads:', error);
    }
}

function renderLeadsTable(filteredLeads = null) {
    const table = document.getElementById('leadsTable');
    const displayLeads = filteredLeads || leads;
    
    if (displayLeads.length === 0) {
        table.innerHTML = `
            <tr class="table-row border-b">
                <td class="py-4" colspan="7">
                    <p class="text-gray-500 text-center">No leads found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    table.innerHTML = displayLeads.map(lead => {
        const clientName = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '-';
        const contact = lead.email || lead.phone || '-';
        const phone = lead.phone || '-';
        const address = lead.address || '-';
        const packageName = lead.package?.name || lead.package_name || '-';
        const agentName = lead.agent?.full_name || lead.agent_name || '-';
        const dealerName = lead.dealer?.name || lead.dealer_name || '-';
        
        return `
        <tr class="table-row border-b">
            <td class="py-4">
                <div class="font-medium text-gray-800">${clientName}</div>
                <div class="text-xs text-gray-400">${lead.lead_id || ''}</div>
            </td>
            <td class="py-4">
                <div class="text-sm text-gray-600">${contact}</div>
                <div class="text-sm text-gray-500">${phone !== contact ? phone : ''}</div>
            </td>
            <td class="py-4 text-sm text-gray-600">${address}</td>
            <td class="py-4 text-sm text-gray-600">${packageName}</td>
            <td class="py-4 text-sm text-gray-600">${agentName}</td>
            <td class="py-4 text-sm text-gray-600">${dealerName}</td>
            <td class="py-4">
                <select onchange="updateLeadStatus('${lead.id}', this.value)" class="text-xs border rounded px-2 py-1 status-${lead.status}">
                    <option value="new" ${lead.status === 'new' ? 'selected' : ''}>New</option>
                    <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                    <option value="qualified" ${lead.status === 'qualified' ? 'selected' : ''}>Qualified</option>
                    <option value="converted" ${lead.status === 'converted' ? 'selected' : ''}>Converted</option>
                    <option value="lost" ${lead.status === 'lost' ? 'selected' : ''}>Lost</option>
                </select>
            </td>
            <td class="py-4">
                <div class="flex gap-1 flex-wrap">
                    <button onclick="viewLeadDetails('${lead.id}')" class="bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded text-xs font-medium">View</button>
                    <button onclick="openConvertModal('${lead.id}')" class="bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded text-xs font-medium">Convert</button>
                    <button onclick="returnToAgent('${lead.id}', 'lead')" class="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 px-2 py-1 rounded text-xs font-medium">Return</button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

// Load Orders
async function loadOrders() {
    try {
        const { data, error } = await window.supabaseClient
            .from('orders')
            .select(`
                *,
                agent:profiles!orders_agent_id_fkey(id, full_name),
                package:packages(id, name, price),
                lead:leads(id, first_name, last_name, email, phone, address)
            `)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        orders = data || [];
        
        renderOrdersTable();
        document.getElementById('totalOrders').textContent = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function renderOrdersTable(filteredOrders = null) {
    const table = document.getElementById('ordersTable');
    const displayOrders = filteredOrders || orders;
    
    if (displayOrders.length === 0) {
        table.innerHTML = `
            <tr class="table-row border-b">
                <td class="py-4" colspan="7">
                    <p class="text-gray-500 text-center">No orders found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    table.innerHTML = displayOrders.map(order => `
        <tr class="table-row border-b">
            <td class="py-4">
                <div class="font-medium text-gray-800">${order.order_number || order.lead?.order_number || '-'}</div>
                <div class="text-xs text-gray-400">Lead: ${order.lead?.lead_id || '-'}</div>
            </td>
            <td class="py-4">
                <div class="font-medium text-gray-800">${order.lead?.full_name || `${order.lead?.first_name || ''} ${order.lead?.last_name || ''}`.trim() || '-'}</div>
                <div class="text-sm text-gray-500">${order.lead?.email || ''}</div>
            </td>
            <td class="py-4 text-sm text-gray-600">${order.package?.name || '-'}</td>
            <td class="py-4 text-sm text-gray-600">${order.agent?.full_name || 'Unassigned'}</td>
            <td class="py-4">
                <select onchange="updateOrderStatusDropdown('${order.id}', this.value)" class="text-xs border rounded px-2 py-1 status-${order.status}">
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
                    <option value="scheduled" ${order.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                    <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td class="py-4 text-sm text-gray-500">${new Date(order.created_at).toLocaleDateString()}</td>
            <td class="py-4">
                <div class="flex gap-1">
                    <button onclick="viewOrder('${order.id}')" class="bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded text-xs">View</button>
                    <button onclick="returnToAgent('${order.id}', 'order')" class="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 px-2 py-1 rounded text-xs">Return</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderRecentOrders() {
    const table = document.getElementById('recentOrdersTable');
    const recentOrders = orders.slice(0, 5);
    
    if (recentOrders.length === 0) {
        table.innerHTML = `
            <tr class="table-row border-b">
                <td class="py-4" colspan="6">
                    <p class="text-gray-500 text-center">No recent orders</p>
                </td>
            </tr>
        `;
        return;
    }
    
    table.innerHTML = recentOrders.map(order => `
        <tr class="table-row border-b">
            <td class="py-4">
                <div class="font-medium text-gray-800">${order.lead?.first_name || ''} ${order.lead?.last_name || ''}</div>
            </td>
            <td class="py-4 text-sm text-gray-600">${order.package?.name || '-'}</td>
            <td class="py-4 text-sm text-gray-600">${order.agent?.full_name || '-'}</td>
            <td class="py-4">
                <span class="status-${order.status} px-3 py-1 rounded-full text-xs font-medium">${order.status}</span>
            </td>
            <td class="py-4 text-sm text-gray-500">${new Date(order.created_at).toLocaleDateString()}</td>
            <td class="py-4">
                <button onclick="viewOrder('${order.id}')" class="text-blue-600 hover:text-blue-800 text-sm">View</button>
            </td>
        </tr>
    `).join('');
}

// Dashboard Stats - optimized single query approach
async function loadDashboardStats() {
    try {
        // Calculate stats from already loaded data to minimize requests
        const convertedLeads = leads.filter(l => l.status === 'converted').length;
        const totalLeads = leads.length;
        const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
        
        document.getElementById('conversionRate').textContent = `${conversionRate}%`;
        
        // Calculate revenue stats from leads (uses already loaded data)
        let confirmedRevenue = 0;
        let pendingRevenue = 0;
        let rejectedRevenue = 0;
        let confirmedCount = 0;
        let pendingCount = 0;
        let rejectedCount = 0;
        
        const FIBRE_COMMISSION = 200; // R200 per fibre install
        
        leads.forEach(lead => {
            const commission = lead.commission_amount || (lead.package?.dealer_commission) || FIBRE_COMMISSION;
            
            if (lead.commission_status === 'confirmed' || lead.commission_status === 'paid') {
                confirmedRevenue += commission;
                confirmedCount++;
            } else if (lead.commission_status === 'rejected') {
                rejectedRevenue += commission;
                rejectedCount++;
            } else {
                // pending is default
                pendingRevenue += FIBRE_COMMISSION;
                pendingCount++;
            }
        });
        
        // Update UI
        const formatCurrency = (val) => `R${val.toLocaleString()}`;
        
        const confirmedRevenueEl = document.getElementById('confirmedRevenue');
        const pendingRevenueEl = document.getElementById('pendingRevenue');
        const rejectedRevenueEl = document.getElementById('rejectedRevenue');
        const confirmedCountEl = document.getElementById('confirmedCount');
        const pendingCountEl = document.getElementById('pendingCount');
        const rejectedCountEl = document.getElementById('rejectedCount');
        
        if (confirmedRevenueEl) confirmedRevenueEl.textContent = formatCurrency(confirmedRevenue);
        if (pendingRevenueEl) pendingRevenueEl.textContent = formatCurrency(pendingRevenue);
        if (rejectedRevenueEl) rejectedRevenueEl.textContent = formatCurrency(rejectedRevenue);
        if (confirmedCountEl) confirmedCountEl.textContent = confirmedCount;
        if (pendingCountEl) pendingCountEl.textContent = pendingCount;
        if (rejectedCountEl) rejectedCountEl.textContent = rejectedCount;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Charts
function initCharts() {
    // Orders Chart
    const ordersCtx = document.getElementById('ordersChart');
    if (ordersCtx) {
        new Chart(ordersCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Orders',
                    data: [12, 19, 15, 25, 22, 30],
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }
    
    // Leads Chart
    const leadsCtx = document.getElementById('leadsChart');
    if (leadsCtx) {
        new Chart(leadsCtx, {
            type: 'doughnut',
            data: {
                labels: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'],
                datasets: [{
                    data: [30, 25, 20, 15, 10],
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#22c55e', '#ef4444']
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

// Form Handlers
function setupFormHandlers() {
    // Add Lead Form
    document.getElementById('addLeadForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            const firstName = formData.get('first_name');
            const lastName = formData.get('last_name');
            const fullName = `${firstName} ${lastName}`.trim();
            
            const { error } = await window.supabaseClient.from('leads').insert({
                first_name: firstName,
                last_name: lastName,
                full_name: fullName,
                email: formData.get('email'),
                phone: formData.get('phone'),
                id_number: formData.get('id_number') || null,
                address: formData.get('address'),
                package_id: formData.get('package_id') || null,
                agent_id: formData.get('agent_id') || null,
                notes: formData.get('notes'),
                status: 'new'
            });
            
            if (error) throw error;
            
            closeModal('addLeadModal');
            e.target.reset();
            await loadLeads();
            alert('Lead added successfully!');
        } catch (error) {
            console.error('Error adding lead:', error);
            alert('Error adding lead: ' + error.message);
        }
    });
    
    // Add Agent Form
    document.getElementById('addAgentForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            // Create user in Supabase Auth
            const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
                email: formData.get('email'),
                password: formData.get('password'),
                options: {
                    data: {
                        full_name: formData.get('full_name'),
                        role: 'agent'
                    }
                }
            });
            
            if (authError) throw authError;
            
            // Create profile
            const { error: profileError } = await window.supabaseClient.from('profiles').insert({
                id: authData.user.id,
                email: formData.get('email'),
                full_name: formData.get('full_name'),
                phone: formData.get('phone'),
                role: 'agent'
            });
            
            if (profileError) throw profileError;
            
            closeModal('addAgentModal');
            e.target.reset();
            await loadAgents();
            alert('Agent created successfully! They can now log in with their credentials.');
        } catch (error) {
            console.error('Error adding agent:', error);
            alert('Error adding agent: ' + error.message);
        }
    });
    
    // Add Package Form
    document.getElementById('addPackageForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            const { error } = await window.supabaseClient.from('packages').insert({
                name: formData.get('name'),
                speed: parseInt(formData.get('speed')),
                price: parseFloat(formData.get('price')),
                description: formData.get('description')
            });
            
            if (error) throw error;
            
            closeModal('addPackageModal');
            e.target.reset();
            await loadPackages();
            alert('Package added successfully!');
        } catch (error) {
            console.error('Error adding package:', error);
            alert('Error adding package: ' + error.message);
        }
    });
    
    // Return to Agent Form
    document.getElementById('returnToAgentForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const itemId = formData.get('item_id');
        const itemType = formData.get('item_type');
        const reason = formData.get('return_reason');
        
        try {
            const table = itemType === 'lead' ? 'leads' : 'orders';
            
            const { error } = await window.supabaseClient
                .from(table)
                .update({
                    status: 'returned',
                    return_reason: reason,
                    returned_at: new Date().toISOString()
                })
                .eq('id', itemId);
            
            if (error) throw error;
            
            closeModal('returnToAgentModal');
            e.target.reset();
            
            if (itemType === 'lead') {
                await loadLeads();
            } else {
                await loadOrders();
            }
            
            alert('Item returned to agent successfully!');
        } catch (error) {
            console.error('Error returning item:', error);
            alert('Error returning item: ' + error.message);
        }
    });
    
    // Add Dealer Form
    document.getElementById('addDealerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            const { error } = await window.supabaseClient.from('dealers').insert({
                name: formData.get('name'),
                code: formData.get('code') || null,
                contact_email: formData.get('contact_email') || null,
                contact_phone: formData.get('contact_phone') || null,
                is_active: true
            });
            
            if (error) throw error;
            
            closeModal('addDealerModal');
            e.target.reset();
            await loadDealers();
            alert('Dealer added successfully!');
        } catch (error) {
            console.error('Error adding dealer:', error);
            alert('Error adding dealer: ' + error.message);
        }
    });
    
    // Approve Agent Form
    document.getElementById('approveAgentForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const pendingAgentId = formData.get('pending_agent_id');
        
        try {
            // Create user in Supabase Auth
            const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
                email: formData.get('email'),
                password: formData.get('password'),
                options: {
                    data: {
                        full_name: formData.get('full_name'),
                        role: 'agent'
                    }
                }
            });
            
            if (authError) throw authError;
            
            // Create or update profile with dealer assignment (use upsert in case trigger already created it)
            const { error: profileError } = await window.supabaseClient.from('profiles').upsert({
                id: authData.user.id,
                email: formData.get('email'),
                full_name: formData.get('full_name'),
                phone: formData.get('phone') || null,
                dealer_id: formData.get('dealer_id') || null,
                role: 'agent',
                is_approved: true
            }, { onConflict: 'id' });
            
            if (profileError) throw profileError;
            
            // Update pending agent status
            const { error: updateError } = await window.supabaseClient
                .from('pending_agents')
                .update({ status: 'approved' })
                .eq('id', pendingAgentId);
            
            if (updateError) throw updateError;
            
            closeModal('approveAgentModal');
            e.target.reset();
            await Promise.all([loadAgents(), loadPendingAgents()]);
            alert('Agent approved and created successfully!');
        } catch (error) {
            console.error('Error approving agent:', error);
            // Handle rate limit errors more gracefully
            if (error.message && error.message.includes('security purposes')) {
                alert('Rate limit reached. Please wait a few minutes before approving another agent.\n\nSupabase limits new user signups to prevent abuse.');
            } else {
                alert('Error approving agent: ' + error.message);
            }
        }
    });
    
    // Edit Agent Form
    document.getElementById('editAgentForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const agentId = document.getElementById('editAgentId').value;
        const formData = new FormData(e.target);
        
        try {
            const { error } = await window.supabaseClient
                .from('profiles')
                .update({
                    full_name: formData.get('full_name'),
                    phone: formData.get('phone') || null,
                    dealer_id: formData.get('dealer_id') || null,
                    is_approved: formData.get('is_approved') === 'true'
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
    
    // Edit Dealer Form
    document.getElementById('editDealerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dealerId = document.getElementById('editDealerId').value;
        const formData = new FormData(e.target);
        
        try {
            const { error } = await window.supabaseClient
                .from('dealers')
                .update({
                    name: formData.get('name'),
                    code: formData.get('code') || null,
                    contact_email: formData.get('contact_email') || null,
                    contact_phone: formData.get('contact_phone') || null,
                    logo_url: formData.get('logo_url') || null,
                    is_active: formData.get('is_active') === 'true'
                })
                .eq('id', dealerId);
            
            if (error) throw error;
            
            alert('Dealer updated successfully!');
            closeModal('editDealerModal');
            await loadDealers();
        } catch (error) {
            console.error('Error updating dealer:', error);
            alert('Error updating dealer: ' + error.message);
        }
    });
}

// Return to Agent
function returnToAgent(itemId, itemType) {
    document.getElementById('returnItemId').value = itemId;
    document.getElementById('returnItemType').value = itemType;
    openModal('returnToAgentModal');
}

// Filters
function setupFilters() {
    document.getElementById('leadStatusFilter')?.addEventListener('change', filterLeads);
    document.getElementById('leadAgentFilter')?.addEventListener('change', filterLeads);
    document.getElementById('orderStatusFilter')?.addEventListener('change', filterOrders);
    document.getElementById('orderAgentFilter')?.addEventListener('change', filterOrders);
}

function filterLeads() {
    const status = document.getElementById('leadStatusFilter').value;
    const agentId = document.getElementById('leadAgentFilter').value;
    
    let filtered = leads;
    
    if (status) {
        filtered = filtered.filter(l => l.status === status);
    }
    
    if (agentId) {
        filtered = filtered.filter(l => l.agent_id === agentId);
    }
    
    renderLeadsTable(filtered);
}

function filterOrders() {
    const status = document.getElementById('orderStatusFilter').value;
    const agentId = document.getElementById('orderAgentFilter').value;
    
    let filtered = orders;
    
    if (status) {
        filtered = filtered.filter(o => o.status === status);
    }
    
    if (agentId) {
        filtered = filtered.filter(o => o.agent_id === agentId);
    }
    
    renderOrdersTable(filtered);
}

// Delete functions
async function deleteAgent(agentId) {
    if (!confirm('Are you sure you want to remove this agent?')) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('profiles')
            .delete()
            .eq('id', agentId);
        
        if (error) throw error;
        
        await loadAgents();
        alert('Agent removed successfully!');
    } catch (error) {
        console.error('Error deleting agent:', error);
        alert('Error deleting agent: ' + error.message);
    }
}

async function deletePackage(packageId) {
    if (!confirm('Are you sure you want to delete this package?')) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('packages')
            .delete()
            .eq('id', packageId);
        
        if (error) throw error;
        
        await loadPackages();
        alert('Package deleted successfully!');
    } catch (error) {
        console.error('Error deleting package:', error);
        alert('Error deleting package: ' + error.message);
    }
}

// View functions
function viewLead(leadId) {
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
        alert(`Lead Details:\n\nName: ${lead.first_name} ${lead.last_name}\nEmail: ${lead.email}\nPhone: ${lead.phone}\nAddress: ${lead.address}\nStatus: ${lead.status}\nNotes: ${lead.notes || 'None'}`);
    }
}

function viewOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        alert(`Order Details:\n\nOrder ID: #${order.id.slice(0, 8)}\nClient: ${order.lead?.first_name} ${order.lead?.last_name}\nPackage: ${order.package?.name}\nStatus: ${order.status}\nCreated: ${new Date(order.created_at).toLocaleString()}`);
    }
}

function viewAgentDetails(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
        alert(`Agent Details:\n\nName: ${agent.full_name}\nEmail: ${agent.email}\nPhone: ${agent.phone || 'Not provided'}\nJoined: ${new Date(agent.created_at).toLocaleDateString()}`);
    }
}

async function updateOrderStatus(orderId) {
    const newStatus = prompt('Enter new status (pending, processing, scheduled, completed, cancelled):');
    if (!newStatus) return;
    
    const validStatuses = ['pending', 'processing', 'scheduled', 'completed', 'cancelled'];
    if (!validStatuses.includes(newStatus.toLowerCase())) {
        alert('Invalid status. Please use: ' + validStatuses.join(', '));
        return;
    }
    
    try {
        const { error } = await window.supabaseClient
            .from('orders')
            .update({ status: newStatus.toLowerCase() })
            .eq('id', orderId);
        
        if (error) throw error;
        
        await loadOrders();
        alert('Order status updated!');
    } catch (error) {
        console.error('Error updating order:', error);
        alert('Error updating order: ' + error.message);
    }
}

function editPackage(packageId) {
    const pkg = packages.find(p => p.id === packageId);
    if (pkg) {
        alert('Edit functionality coming soon. Package: ' + pkg.name);
    }
}

// ============================================
// LEAD STATUS & ORDER CONVERSION
// ============================================
async function updateLeadStatus(leadId, newStatus) {
    try {
        const updateData = { status: newStatus, updated_at: new Date().toISOString() };
        
        // If converting, set commission status
        if (newStatus === 'converted') {
            updateData.commission_status = 'pending';
        }
        
        const { error } = await window.supabaseClient
            .from('leads')
            .update(updateData)
            .eq('id', leadId);
        
        if (error) throw error;
        
        // Update local data
        const lead = leads.find(l => l.id === leadId);
        if (lead) lead.status = newStatus;
        
    } catch (error) {
        console.error('Error updating lead status:', error);
        alert('Error updating status: ' + error.message);
        await loadLeads();
    }
}

// View/Edit Lead Details
let editingLeadId = null;

function viewLeadDetails(leadId) {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    
    editingLeadId = leadId;
    const content = document.getElementById('viewLeadContent');
    const inputClass = "w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
    const labelClass = "text-xs text-gray-500 block mb-1";
    
    // Build agent options
    const agentOptions = agents.map(a => 
        `<option value="${a.id}" ${lead.agent_id === a.id ? 'selected' : ''}>${a.full_name}</option>`
    ).join('');
    
    // Build dealer options
    const dealerOptions = dealers.map(d => 
        `<option value="${d.id}" ${lead.dealer_id === d.id ? 'selected' : ''}>${d.name}</option>`
    ).join('');
    
    // Build package options
    const packageOptions = packages.map(p => 
        `<option value="${p.id}" ${lead.package_id === p.id ? 'selected' : ''}>${p.name}</option>`
    ).join('');
    
    content.innerHTML = `
        <form id="editLeadForm" class="space-y-4">
            <div class="grid grid-cols-3 gap-3">
                <div>
                    <label class="${labelClass}">Lead ID</label>
                    <input type="text" name="lead_id" value="${lead.lead_id || ''}" class="${inputClass}">
                </div>
                <div>
                    <label class="${labelClass}">Status</label>
                    <select name="status" class="${inputClass}">
                        <option value="new" ${lead.status === 'new' ? 'selected' : ''}>New</option>
                        <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                        <option value="qualified" ${lead.status === 'qualified' ? 'selected' : ''}>Qualified</option>
                        <option value="converted" ${lead.status === 'converted' ? 'selected' : ''}>Converted</option>
                        <option value="lost" ${lead.status === 'lost' ? 'selected' : ''}>Lost</option>
                    </select>
                </div>
                <div>
                    <label class="${labelClass}">Lead Type</label>
                    <input type="text" name="lead_type" value="${lead.lead_type || ''}" class="${inputClass}">
                </div>
            </div>
            
            <div class="bg-gray-50 rounded-xl p-4">
                <h4 class="font-semibold text-gray-700 mb-3">Client Details</h4>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="${labelClass}">Full Name</label>
                        <input type="text" name="full_name" value="${lead.full_name || ''}" class="${inputClass}">
                    </div>
                    <div>
                        <label class="${labelClass}">ID Number</label>
                        <input type="text" name="id_number" value="${lead.id_number || ''}" class="${inputClass}">
                    </div>
                    <div>
                        <label class="${labelClass}">First Name</label>
                        <input type="text" name="first_name" value="${lead.first_name || ''}" class="${inputClass}">
                    </div>
                    <div>
                        <label class="${labelClass}">Last Name</label>
                        <input type="text" name="last_name" value="${lead.last_name || ''}" class="${inputClass}">
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-50 rounded-xl p-4">
                    <h4 class="font-semibold text-gray-700 mb-3">Primary Contact</h4>
                    <div class="space-y-2">
                        <div>
                            <label class="${labelClass}">Email</label>
                            <input type="email" name="email" value="${lead.email || ''}" class="${inputClass}">
                        </div>
                        <div>
                            <label class="${labelClass}">Phone</label>
                            <input type="text" name="phone" value="${lead.phone || ''}" class="${inputClass}">
                        </div>
                        <div>
                            <label class="${labelClass}">Address/Region</label>
                            <input type="text" name="address" value="${lead.address || ''}" class="${inputClass}">
                        </div>
                    </div>
                </div>
                
                <div class="bg-gray-50 rounded-xl p-4">
                    <h4 class="font-semibold text-gray-700 mb-3">Secondary Contact</h4>
                    <div class="space-y-2">
                        <div>
                            <label class="${labelClass}">Name</label>
                            <input type="text" name="secondary_contact_name" value="${lead.secondary_contact_name || ''}" class="${inputClass}">
                        </div>
                        <div>
                            <label class="${labelClass}">Number</label>
                            <input type="text" name="secondary_contact_number" value="${lead.secondary_contact_number || ''}" class="${inputClass}">
                        </div>
                        <div>
                            <label class="${labelClass}">Email</label>
                            <input type="email" name="secondary_contact_email" value="${lead.secondary_contact_email || ''}" class="${inputClass}">
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-50 rounded-xl p-4">
                    <h4 class="font-semibold text-gray-700 mb-3">Assignment</h4>
                    <div class="space-y-2">
                        <div>
                            <label class="${labelClass}">Agent</label>
                            <select name="agent_id" class="${inputClass}">
                                <option value="">Select Agent</option>
                                ${agentOptions}
                            </select>
                        </div>
                        <div>
                            <label class="${labelClass}">Dealer</label>
                            <select name="dealer_id" class="${inputClass}">
                                <option value="">Select Dealer</option>
                                ${dealerOptions}
                            </select>
                        </div>
                        <div>
                            <label class="${labelClass}">Package</label>
                            <select name="package_id" class="${inputClass}">
                                <option value="">Select Package</option>
                                ${packageOptions}
                            </select>
                        </div>
                        <div>
                            <label class="${labelClass}">ISP</label>
                            <input type="text" name="isp" value="${lead.isp || ''}" class="${inputClass}">
                        </div>
                    </div>
                </div>
                
                <div class="bg-gray-50 rounded-xl p-4">
                    <h4 class="font-semibold text-gray-700 mb-3">Order Info</h4>
                    <div class="space-y-2">
                        <div>
                            <label class="${labelClass}">Order Number</label>
                            <input type="text" name="order_number" value="${lead.order_number || ''}" class="${inputClass}">
                        </div>
                        <div>
                            <label class="${labelClass}">Order Status</label>
                            <input type="text" name="order_status" value="${lead.order_status || ''}" class="${inputClass}">
                        </div>
                        <div>
                            <label class="${labelClass}">Order Date</label>
                            <input type="date" name="order_date" value="${lead.order_date ? lead.order_date.split('T')[0] : ''}" class="${inputClass}">
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="bg-yellow-50 rounded-xl p-4">
                <label class="${labelClass}">Notes</label>
                <textarea name="notes" rows="3" class="${inputClass}">${lead.notes || ''}</textarea>
            </div>
            
            <div class="flex justify-end gap-3 pt-2 border-t">
                <button type="button" onclick="closeModal('viewLeadModal')" class="px-4 py-2 border rounded-xl hover:bg-gray-50">Cancel</button>
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-medium">Save Changes</button>
            </div>
        </form>
    `;
    
    // Add form submit handler
    document.getElementById('editLeadForm').addEventListener('submit', saveLeadChanges);
    
    openModal('viewLeadModal');
}

async function saveLeadChanges(e) {
    e.preventDefault();
    
    if (!editingLeadId) return;
    
    const form = e.target;
    const formData = new FormData(form);
    
    const updateData = {
        lead_id: formData.get('lead_id') || null,
        status: formData.get('status'),
        lead_type: formData.get('lead_type') || null,
        full_name: formData.get('full_name') || null,
        first_name: formData.get('first_name') || null,
        last_name: formData.get('last_name') || null,
        id_number: formData.get('id_number') || null,
        email: formData.get('email') || null,
        phone: formData.get('phone') || null,
        address: formData.get('address') || null,
        secondary_contact_name: formData.get('secondary_contact_name') || null,
        secondary_contact_number: formData.get('secondary_contact_number') || null,
        secondary_contact_email: formData.get('secondary_contact_email') || null,
        agent_id: formData.get('agent_id') || null,
        dealer_id: formData.get('dealer_id') || null,
        package_id: formData.get('package_id') || null,
        isp: formData.get('isp') || null,
        order_number: formData.get('order_number') || null,
        order_status: formData.get('order_status') || null,
        order_date: formData.get('order_date') || null,
        notes: formData.get('notes') || null
    };
    
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update(updateData)
            .eq('id', editingLeadId);
        
        if (error) throw error;
        
        alert('Lead updated successfully!');
        closeModal('viewLeadModal');
        await loadLeads();
        
    } catch (error) {
        console.error('Error updating lead:', error);
        alert('Error updating lead: ' + error.message);
    }
}

let convertingLeadId = null;

function openConvertModal(leadId) {
    convertingLeadId = leadId;
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
        document.getElementById('convertLeadName').textContent = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown';
        document.getElementById('convertOrderNumber').value = lead.order_number || '';
    }
    openModal('convertToOrderModal');
}

async function convertToOrder() {
    if (!convertingLeadId) return;
    
    const orderNumber = document.getElementById('convertOrderNumber').value.trim();
    const productType = document.getElementById('convertProductType').value;
    
    if (!orderNumber) {
        alert('Please enter an order number');
        return;
    }
    
    try {
        const lead = leads.find(l => l.id === convertingLeadId);
        if (!lead) throw new Error('Lead not found');
        
        // Calculate commission based on product type
        const commissionAmount = productType === 'prepaid' ? 100 : 200;
        
        // Update lead with order info and commission
        const { error: leadError } = await window.supabaseClient
            .from('leads')
            .update({
                status: 'converted',
                order_number: orderNumber,
                order_status: 'pending',
                commission_status: 'pending',
                commission_amount: commissionAmount,
                updated_at: new Date().toISOString()
            })
            .eq('id', convertingLeadId);
        
        if (leadError) throw leadError;
        
        // Create order record with order_number
        const { error: orderError } = await window.supabaseClient
            .from('orders')
            .insert({
                lead_id: convertingLeadId,
                package_id: lead.package_id,
                agent_id: lead.agent_id,
                order_number: orderNumber,
                status: 'pending',
                notes: `${productType === 'prepaid' ? 'Prepaid' : 'Postpaid'} - Commission: R${commissionAmount}`
            });
        
        if (orderError) throw orderError;
        
        closeModal('convertToOrderModal');
        convertingLeadId = null;
        
        await Promise.all([loadLeads(), loadOrders(), updateRevenueStats()]);
        alert(`Lead converted! Order #${orderNumber} created.\nCommission: R${commissionAmount} (${productType === 'prepaid' ? 'Prepaid' : 'Normal'})`);
        
    } catch (error) {
        console.error('Error converting lead:', error);
        alert('Error converting lead: ' + error.message);
    }
}

async function updateOrderStatusDropdown(orderId, newStatus) {
    try {
        const updateData = { status: newStatus, updated_at: new Date().toISOString() };
        
        // If completed, confirm commission
        if (newStatus === 'completed') {
            updateData.completed_at = new Date().toISOString();
            
            // Update lead commission status to confirmed
            const order = orders.find(o => o.id === orderId);
            if (order && order.lead_id) {
                await window.supabaseClient
                    .from('leads')
                    .update({ 
                        commission_status: 'confirmed',
                        confirmed_at: new Date().toISOString(),
                        order_status: 'completed'
                    })
                    .eq('id', order.lead_id);
            }
        }
        
        // If cancelled, reject commission
        if (newStatus === 'cancelled') {
            const order = orders.find(o => o.id === orderId);
            if (order && order.lead_id) {
                await window.supabaseClient
                    .from('leads')
                    .update({ 
                        commission_status: 'rejected',
                        rejected_at: new Date().toISOString(),
                        rejection_reason: 'Order cancelled',
                        order_status: 'cancelled'
                    })
                    .eq('id', order.lead_id);
            }
        }
        
        const { error } = await window.supabaseClient
            .from('orders')
            .update(updateData)
            .eq('id', orderId);
        
        if (error) throw error;
        
        await Promise.all([loadOrders(), loadLeads(), updateRevenueStats()]);
        
    } catch (error) {
        console.error('Error updating order status:', error);
        alert('Error updating order: ' + error.message);
    }
}

async function updateRevenueStats() {
    try {
        // Get confirmed leads for revenue
        const { data: confirmedLeads } = await window.supabaseClient
            .from('leads')
            .select('commission_amount')
            .eq('commission_status', 'confirmed');
        
        const { data: pendingLeads } = await window.supabaseClient
            .from('leads')
            .select('commission_amount')
            .eq('commission_status', 'pending');
        
        const { data: rejectedLeads } = await window.supabaseClient
            .from('leads')
            .select('commission_amount')
            .eq('commission_status', 'rejected');
        
        const confirmedRevenue = (confirmedLeads || []).reduce((sum, l) => sum + (l.commission_amount || 0), 0);
        const pendingRevenue = (pendingLeads || []).reduce((sum, l) => sum + (l.commission_amount || 0), 0);
        const rejectedRevenue = (rejectedLeads || []).reduce((sum, l) => sum + (l.commission_amount || 0), 0);
        
        document.getElementById('confirmedRevenue').textContent = `R${confirmedRevenue.toLocaleString()}`;
        document.getElementById('pendingRevenue').textContent = `R${pendingRevenue.toLocaleString()}`;
        document.getElementById('confirmedCount').textContent = (confirmedLeads || []).length;
        document.getElementById('pendingCount').textContent = (pendingLeads || []).length;
        
        // Update rejected if element exists
        const rejectedEl = document.getElementById('rejectedRevenue');
        if (rejectedEl) rejectedEl.textContent = `R${rejectedRevenue.toLocaleString()}`;
        const rejectedCountEl = document.getElementById('rejectedCount');
        if (rejectedCountEl) rejectedCountEl.textContent = (rejectedLeads || []).length;
        
    } catch (error) {
        console.error('Error updating revenue stats:', error);
    }
}

// ============================================
// DEALERS FUNCTIONS
// ============================================
async function loadDealers() {
    try {
        const { data, error } = await window.supabaseClient
            .from('dealers')
            .select('*')
            .order('name');
        
        if (error) throw error;
        dealers = data || [];
        renderDealersGrid();
        populateDealerSelects();
    } catch (error) {
        console.error('Error loading dealers:', error);
        dealers = [];
    }
}

function renderDealersGrid() {
    const grid = document.getElementById('dealersGrid');
    if (!grid) return;
    
    if (dealers.length === 0) {
        grid.innerHTML = `
            <div class="card p-6 text-center col-span-full">
                <p class="text-gray-500">No dealers yet. Add your first dealer!</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = dealers.map(dealer => `
        <div class="card p-6">
            <div class="flex items-start justify-between mb-4">
                <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center overflow-hidden">
                    ${dealer.logo_url 
                        ? `<img src="${dealer.logo_url}" alt="${dealer.name}" class="w-full h-full object-contain">`
                        : `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>`
                    }
                </div>
                <span class="px-2 py-1 text-xs rounded-full ${dealer.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
                    ${dealer.is_active ? 'Active' : 'Inactive'}
                </span>
            </div>
            <h4 class="font-semibold text-gray-800 mb-1">${dealer.name}</h4>
            ${dealer.code ? `<p class="text-sm text-gray-500 mb-2">Code: ${dealer.code}</p>` : ''}
            ${dealer.contact_email ? `<p class="text-sm text-gray-600">${dealer.contact_email}</p>` : ''}
            ${dealer.contact_phone ? `<p class="text-sm text-gray-600">${dealer.contact_phone}</p>` : ''}
            <div class="mt-4 pt-4 border-t flex gap-2">
                <button onclick="viewDealerDetails('${dealer.id}')" class="text-sm text-blue-600 hover:text-blue-800">Edit</button>
                <button onclick="toggleDealerStatus('${dealer.id}', ${!dealer.is_active})" class="text-sm ${dealer.is_active ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'}">
                    ${dealer.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onclick="deleteDealer('${dealer.id}')" class="text-sm text-red-600 hover:text-red-800">Delete</button>
            </div>
        </div>
    `).join('');
}

function populateDealerSelects() {
    const selects = ['approveAgentDealer', 'agentDealerSelect'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">No dealer</option>';
            dealers.filter(d => d.is_active).forEach(dealer => {
                select.innerHTML += `<option value="${dealer.id}">${dealer.name}</option>`;
            });
            if (currentValue) select.value = currentValue;
        }
    });
}

async function toggleDealerStatus(dealerId, newStatus) {
    try {
        const { error } = await window.supabaseClient
            .from('dealers')
            .update({ is_active: newStatus })
            .eq('id', dealerId);
        
        if (error) throw error;
        await loadDealers();
    } catch (error) {
        console.error('Error updating dealer:', error);
        alert('Error updating dealer: ' + error.message);
    }
}

async function deleteDealer(dealerId) {
    if (!confirm('Are you sure you want to delete this dealer?')) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('dealers')
            .delete()
            .eq('id', dealerId);
        
        if (error) throw error;
        await loadDealers();
        alert('Dealer deleted successfully!');
    } catch (error) {
        console.error('Error deleting dealer:', error);
        alert('Error deleting dealer: ' + error.message);
    }
}

// ============================================
// PENDING AGENTS FUNCTIONS
// ============================================
async function loadPendingAgents() {
    try {
        const { data, error } = await window.supabaseClient
            .from('pending_agents')
            .select('*, dealer:dealers(name)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        pendingAgents = data || [];
        renderPendingAgentsTable();
        updatePendingAgentsBadge();
    } catch (error) {
        console.error('Error loading pending agents:', error);
        pendingAgents = [];
    }
}

function renderPendingAgentsTable() {
    const table = document.getElementById('pendingAgentsTable');
    if (!table) return;
    
    if (pendingAgents.length === 0) {
        table.innerHTML = `
            <tr class="border-t">
                <td class="px-6 py-4" colspan="5">
                    <p class="text-gray-500 text-center">No pending agents</p>
                </td>
            </tr>
        `;
        return;
    }
    
    table.innerHTML = pendingAgents.map(agent => `
        <tr class="border-t hover:bg-gray-50">
            <td class="px-6 py-4 font-medium text-gray-800">${agent.full_name}</td>
            <td class="px-6 py-4 text-gray-600">${agent.email}</td>
            <td class="px-6 py-4 text-gray-600">${agent.dealer?.name || '-'}</td>
            <td class="px-6 py-4 text-gray-500">${new Date(agent.created_at).toLocaleDateString()}</td>
            <td class="px-6 py-4">
                <div class="flex gap-2">
                    <button onclick="openApproveAgentModal('${agent.id}')" class="text-emerald-600 hover:text-emerald-800 text-sm font-medium">Approve</button>
                    <button onclick="rejectPendingAgent('${agent.id}')" class="text-red-600 hover:text-red-800 text-sm">Reject</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updatePendingAgentsBadge() {
    const badge = document.getElementById('pendingAgentsBadge');
    if (badge) {
        if (pendingAgents.length > 0) {
            badge.textContent = pendingAgents.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

function openApproveAgentModal(pendingAgentId) {
    const agent = pendingAgents.find(a => a.id === pendingAgentId);
    if (!agent) return;
    
    document.getElementById('pendingAgentId').value = pendingAgentId;
    document.getElementById('approveAgentName').value = agent.full_name;
    document.getElementById('approveAgentEmail').value = agent.email;
    
    populateDealerSelects();
    if (agent.dealer_id) {
        document.getElementById('approveAgentDealer').value = agent.dealer_id;
    }
    
    openModal('approveAgentModal');
}

async function rejectPendingAgent(pendingAgentId) {
    if (!confirm('Are you sure you want to reject this agent?')) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('pending_agents')
            .update({ status: 'rejected' })
            .eq('id', pendingAgentId);
        
        if (error) throw error;
        await loadPendingAgents();
        alert('Agent rejected.');
    } catch (error) {
        console.error('Error rejecting agent:', error);
        alert('Error rejecting agent: ' + error.message);
    }
}

// ============================================
// SYSTEM SETTINGS FUNCTIONS
// ============================================
async function loadSystemSettings() {
    try {
        const { data, error } = await window.supabaseClient
            .from('system_settings')
            .select('*');
        
        if (error) throw error;
        
        systemSettings = {};
        (data || []).forEach(setting => {
            systemSettings[setting.key] = setting.value;
        });
        
        applySystemSettings();
    } catch (error) {
        console.error('Error loading settings:', error);
        systemSettings = {};
    }
}

function applySystemSettings() {
    // Openserve API toggle
    const apiEnabled = systemSettings.openserve_api_enabled?.enabled || false;
    const toggle = document.getElementById('openserveApiToggle');
    const configDiv = document.getElementById('openserveApiConfig');
    const statusDiv = document.getElementById('openserveApiStatus');
    
    if (toggle) toggle.checked = apiEnabled;
    if (configDiv) configDiv.classList.toggle('hidden', !apiEnabled);
    if (statusDiv) {
        if (apiEnabled) {
            statusDiv.className = 'mt-4 p-3 bg-emerald-50 rounded-xl text-sm text-emerald-700';
            statusDiv.innerHTML = '<strong>Status:</strong> Active - Connected to Openserve API';
        } else {
            statusDiv.className = 'mt-4 p-3 bg-amber-50 rounded-xl text-sm text-amber-700';
            statusDiv.innerHTML = '<strong>Status:</strong> Inactive - Enable to connect to live Openserve data';
        }
    }
    
    // Load API config values
    const apiConfig = systemSettings.openserve_api_config || {};
    const urlInput = document.getElementById('openserveApiUrl');
    const keyInput = document.getElementById('openserveApiKey');
    if (urlInput && apiConfig.api_url) urlInput.value = apiConfig.api_url;
    if (keyInput && apiConfig.api_key) keyInput.value = apiConfig.api_key;
}

async function toggleOpenserveApi(enabled) {
    const configDiv = document.getElementById('openserveApiConfig');
    if (configDiv) configDiv.classList.toggle('hidden', !enabled);
    
    try {
        const { error } = await window.supabaseClient
            .from('system_settings')
            .upsert({
                key: 'openserve_api_enabled',
                value: { enabled },
                updated_at: new Date().toISOString(),
                updated_by: currentUser.id
            });
        
        if (error) throw error;
        
        systemSettings.openserve_api_enabled = { enabled };
        applySystemSettings();
    } catch (error) {
        console.error('Error updating setting:', error);
        alert('Error updating setting: ' + error.message);
    }
}

async function saveOpenserveConfig() {
    const apiUrl = document.getElementById('openserveApiUrl').value;
    const apiKey = document.getElementById('openserveApiKey').value;
    
    try {
        const { error } = await window.supabaseClient
            .from('system_settings')
            .upsert({
                key: 'openserve_api_config',
                value: { api_url: apiUrl, api_key: apiKey },
                updated_at: new Date().toISOString(),
                updated_by: currentUser.id
            });
        
        if (error) throw error;
        
        alert('Openserve API configuration saved!');
    } catch (error) {
        console.error('Error saving config:', error);
        alert('Error saving configuration: ' + error.message);
    }
}

// ============================================
// SUPABASE CONFIGURATION FUNCTIONS
// ============================================
function loadSupabaseSettings() {
    const url = localStorage.getItem('SUPABASE_URL');
    const key = localStorage.getItem('SUPABASE_ANON_KEY');
    
    const urlInput = document.getElementById('supabaseUrlSetting');
    const keyInput = document.getElementById('supabaseKeySetting');
    const statusText = document.getElementById('supabaseStatusText');
    
    if (urlInput && url) urlInput.value = url;
    if (keyInput && key) keyInput.value = key;
    
    if (url && key && window.supabaseClient) {
        if (statusText) {
            statusText.textContent = 'Connected';
            statusText.parentElement.className = 'p-3 bg-emerald-50 rounded-xl text-sm text-emerald-700';
        }
    } else if (url && key) {
        if (statusText) {
            statusText.textContent = 'Configured (reload to connect)';
            statusText.parentElement.className = 'p-3 bg-amber-50 rounded-xl text-sm text-amber-700';
        }
    } else {
        if (statusText) {
            statusText.textContent = 'Not configured';
            statusText.parentElement.className = 'p-3 bg-gray-50 rounded-xl text-sm text-gray-600';
        }
    }
}

function saveSupabaseConfig() {
    const url = document.getElementById('supabaseUrlSetting').value.trim();
    const key = document.getElementById('supabaseKeySetting').value.trim();
    
    if (!url || !key) {
        alert('Please enter both Supabase URL and API Key');
        return;
    }
    
    if (!url.includes('supabase.co')) {
        alert('Please enter a valid Supabase project URL');
        return;
    }
    
    localStorage.setItem('SUPABASE_URL', url);
    localStorage.setItem('SUPABASE_ANON_KEY', key);
    
    const statusText = document.getElementById('supabaseStatusText');
    if (statusText) {
        statusText.textContent = 'Saved! Reloading...';
        statusText.parentElement.className = 'p-3 bg-emerald-50 rounded-xl text-sm text-emerald-700';
    }
    
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

async function testSupabaseConnection() {
    const statusText = document.getElementById('supabaseStatusText');
    
    try {
        if (!window.supabaseClient) {
            throw new Error('Supabase client not initialized');
        }
        
        statusText.textContent = 'Testing...';
        
        const { data, error } = await window.supabaseClient
            .from('packages')
            .select('id')
            .limit(1);
        
        if (error) throw error;
        
        statusText.textContent = 'Connection successful!';
        statusText.parentElement.className = 'p-3 bg-emerald-50 rounded-xl text-sm text-emerald-700';
    } catch (error) {
        statusText.textContent = 'Connection failed: ' + error.message;
        statusText.parentElement.className = 'p-3 bg-red-50 rounded-xl text-sm text-red-700';
    }
}

// ============================================
// CSV IMPORT FUNCTIONS
// ============================================
let importData = [];
let packageAliases = [];
let importStats = { imported: 0, duplicates: 0, errors: 0, newAgents: [] };

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processCSVFile(file);
    }
}

function processCSVFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
            alert('CSV file must have at least a header and one data row');
            return;
        }
        
        const headers = parseCSVLine(lines[0]).map(h => normalizeHeader(h.trim()));
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index]?.trim() || '';
                });
                data.push(row);
            }
        }
        
        importData = data;
        showImportPreview(headers, data);
    };
    reader.readAsText(file);
}

function normalizeHeader(header) {
    const headerMap = {
        'lead id': 'lead_id',
        'leadid': 'lead_id',
        'agent': 'agent_name',
        'dealer': 'dealer_name',
        'deal': 'package_name',
        'isp': 'isp',
        'lead type': 'lead_type',
        'lead_type': 'lead_type',
        'status': 'status',
        'region': 'address',
        'primary contact name': 'full_name',
        'primary contact number': 'phone',
        'primary contact email': 'email',
        'secondary contact name': 'secondary_contact_name',
        'secondary contact number': 'secondary_contact_number',
        'secondary contact secondary': 'secondary_contact_secondary',
        'secondary contact email': 'secondary_contact_email',
        'secondary contact': 'secondary_contact',
        'order number': 'order_number',
        'order status': 'order_status',
        'order date': 'order_date',
        'date captured': 'date_captured',
        'last updated': 'last_updated',
        'captured by': 'captured_by_email',
        'full_name': 'full_name',
        'fullname': 'full_name',
        'name': 'full_name',
        'first_name': 'first_name',
        'firstname': 'first_name',
        'last_name': 'last_name',
        'lastname': 'last_name',
        'email': 'email',
        'phone': 'phone',
        'telephone': 'phone',
        'cell': 'phone',
        'mobile': 'phone',
        'address': 'address',
        'package': 'package_name',
        'package_name': 'package_name',
        'packagename': 'package_name',
        'notes': 'notes',
        'captured_by': 'captured_by_email',
        'capturedby': 'captured_by_email',
        'dealer_name': 'dealer_name',
        'dealername': 'dealer_name',
        'order_number': 'order_number',
        'order_status': 'order_status',
        'order_date': 'order_date',
        'date_captured': 'date_captured',
        'last_updated': 'last_updated',
        'secondary_contact_name': 'secondary_contact_name',
        'secondary_contact_number': 'secondary_contact_number',
        'secondary_contact_email': 'secondary_contact_email'
    };
    
    const normalized = header.toLowerCase().trim();
    return headerMap[normalized] || normalized.replace(/\s+/g, '_');
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function showImportPreview(headers, data) {
    const preview = document.getElementById('importPreview');
    const table = document.getElementById('previewTable');
    const countSpan = document.getElementById('importCount');
    
    let html = '<thead class="bg-gray-50"><tr>';
    headers.forEach(h => {
        html += `<th class="px-3 py-2 text-left text-gray-600">${h}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    const previewRows = data.slice(0, 5);
    previewRows.forEach(row => {
        html += '<tr class="border-b">';
        headers.forEach(h => {
            html += `<td class="px-3 py-2 text-gray-800">${row[h] || ''}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody>';
    
    table.innerHTML = html;
    countSpan.textContent = data.length;
    preview.classList.remove('hidden');
}

async function confirmImport() {
    if (importData.length === 0) {
        alert('No data to import');
        return;
    }
    
    console.log('Starting import of', importData.length, 'rows');
    console.log('Sample row:', importData[0]);
    
    const progressDiv = document.getElementById('importProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    progressDiv.classList.remove('hidden');
    importStats = { imported: 0, duplicates: 0, errors: 0, newAgents: [], newDealers: [], errorDetails: [] };
    
    for (let i = 0; i < importData.length; i++) {
        const row = importData[i];
        const progress = Math.round(((i + 1) / importData.length) * 100);
        progressBar.style.width = progress + '%';
        progressText.textContent = progress + '%';
        
        try {
            // Log row data for debugging
            console.log('Processing row', i, '- dealer_name:', row.dealer_name, 'agent_name:', row.agent_name);
            
            // Find or CREATE dealer
            let dealerId = null;
            if (row.dealer_name) {
                const { data: dealerData } = await window.supabaseClient
                    .from('dealers')
                    .select('id')
                    .ilike('name', row.dealer_name)
                    .limit(1);
                
                if (dealerData && dealerData.length > 0) {
                    dealerId = dealerData[0].id;
                    console.log('Found existing dealer:', row.dealer_name, '-> ID:', dealerId);
                } else {
                    // Create new dealer
                    const { data: newDealer, error: dealerError } = await window.supabaseClient
                        .from('dealers')
                        .insert({
                            name: row.dealer_name,
                            is_active: true
                        })
                        .select('id')
                        .single();
                    
                    if (newDealer && !dealerError) {
                        dealerId = newDealer.id;
                        importStats.newDealers.push(row.dealer_name);
                    }
                }
            }
            
            // Find agent by name, or AUTO-CREATE agent and assign to dealer
            let agentId = null;
            const agentName = row.agent_name || '';
            
            if (agentName) {
                // Try to find existing agent by name
                const { data: agentData } = await window.supabaseClient
                    .from('profiles')
                    .select('id, full_name')
                    .ilike('full_name', agentName)
                    .limit(1);
                
                if (agentData && agentData.length > 0) {
                    agentId = agentData[0].id;
                    console.log('Found existing agent:', agentName, '-> ID:', agentId);
                } else {
                    // AUTO-CREATE the agent in profiles table
                    // Generate a unique ID for the agent
                    const newAgentId = crypto.randomUUID();
                    const agentEmail = `${agentName.toLowerCase().replace(/\s+/g, '.')}@agent.local`;
                    
                    const { data: newAgent, error: agentError } = await window.supabaseClient
                        .from('profiles')
                        .insert({
                            id: newAgentId,
                            email: agentEmail,
                            full_name: agentName,
                            role: 'agent',
                            is_approved: true,
                            dealer_id: dealerId  // Assign to dealer from same row
                        })
                        .select('id')
                        .single();
                    
                    if (newAgent && !agentError) {
                        agentId = newAgent.id;
                        importStats.newAgents.push(agentName);
                        console.log('Created new agent:', agentName, '-> ID:', agentId, 'Dealer:', dealerId);
                    } else if (agentError) {
                        console.error('Error creating agent:', agentName, agentError.message);
                    }
                }
            }
            
            // Find package
            let packageId = null;
            if (row.package_name) {
                packageId = await findPackageByName(row.package_name);
            }
            
            // Build full name
            let fullName = row.full_name || '';
            if (!fullName && (row.first_name || row.last_name)) {
                fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
            }
            
            // Parse dates safely
            const parseDate = (dateStr) => {
                if (!dateStr) return null;
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? null : d.toISOString();
            };
            
            // Build lead data with all available fields
            const leadData = {
                status: 'new'
            };
            
            // Add text fields
            if (row.lead_id) leadData.lead_id = row.lead_id;
            if (fullName) leadData.full_name = fullName;
            if (row.first_name) leadData.first_name = row.first_name;
            if (row.last_name) leadData.last_name = row.last_name;
            if (row.email) leadData.email = row.email;
            if (row.phone) leadData.phone = row.phone;
            if (row.address) leadData.address = row.address;
            if (row.notes) leadData.notes = row.notes;
            
            // Add foreign keys if found
            if (packageId) leadData.package_id = packageId;
            if (agentId) leadData.agent_id = agentId;
            if (dealerId) leadData.dealer_id = dealerId;
            
            console.log('Inserting lead:', leadData);
            
            // Try insert with minimal fields
            let insertResult = await window.supabaseClient
                .from('leads')
                .insert(leadData)
                .select();
            
            if (insertResult.error) {
                // Log full error details
                console.error('Insert error for row', i, ':', JSON.stringify(insertResult.error));
                throw insertResult.error;
            }
            
            console.log('Successfully inserted lead ID:', insertResult.data?.[0]?.id);
            importStats.imported++;
        } catch (error) {
            console.error('Error importing row', i, ':', error.message || error);
            importStats.errors++;
            importStats.errorDetails.push({ row: i, error: error.message || String(error) });
        }
    }
    
    // Show results
    console.log('Import complete:', importStats);
    if (importStats.errorDetails.length > 0) {
        console.log('Error details:', importStats.errorDetails);
    }
    
    let message = `Import Complete!\n\n`;
    message += `✓ Imported: ${importStats.imported}\n`;
    message += `○ Duplicates skipped: ${importStats.duplicates}\n`;
    message += `✗ Errors: ${importStats.errors}`;
    
    if (importStats.errors > 0 && importStats.errorDetails.length > 0) {
        message += `\n\n⚠️ First error: ${importStats.errorDetails[0].error}`;
        message += `\n(Check browser console for details)`;
    }
    if (importStats.newDealers && importStats.newDealers.length > 0) {
        message += `\n\n🏢 New dealers created: ${importStats.newDealers.length}`;
        message += `\n   ${importStats.newDealers.slice(0, 5).join(', ')}${importStats.newDealers.length > 5 ? '...' : ''}`;
    }
    if (importStats.newAgents.length > 0) {
        message += `\n\n👤 New agents pending approval: ${importStats.newAgents.length}`;
        message += `\n   ${importStats.newAgents.slice(0, 5).join(', ')}${importStats.newAgents.length > 5 ? '...' : ''}`;
    }
    
    alert(message);
    cancelImport();
    await Promise.all([loadLeads(), loadPendingAgents(), loadDealers()]);
}

async function findPackageByName(name) {
    if (!name) return null;
    
    // Try exact match
    const { data: exact } = await window.supabaseClient
        .from('packages')
        .select('id')
        .ilike('name', name)
        .limit(1);
    
    if (exact && exact.length > 0) return exact[0].id;
    
    // Try alias match
    const { data: alias } = await window.supabaseClient
        .from('package_aliases')
        .select('package_id')
        .ilike('alias', name)
        .limit(1);
    
    if (alias && alias.length > 0) return alias[0].package_id;
    
    // Try speed matching (e.g., "20/10Mbps" -> find package with speed 20)
    const speedMatch = name.match(/(\d+)\/?/);
    if (speedMatch) {
        const speed = parseInt(speedMatch[1]);
        const { data: speedData } = await window.supabaseClient
            .from('packages')
            .select('id')
            .eq('speed', speed)
            .limit(1);
        
        if (speedData && speedData.length > 0) return speedData[0].id;
    }
    
    return null;
}

function cancelImport() {
    importData = [];
    document.getElementById('importPreview').classList.add('hidden');
    document.getElementById('importProgress').classList.add('hidden');
    document.getElementById('csvFileInput').value = '';
}

function downloadTemplate() {
    const headers = 'LEAD ID,AGENT,DEALER,DEAL,ISP,LEAD TYPE,STATUS,REGION,PRIMARY CONTACT NAME,PRIMARY CONTACT NUMBER,PRIMARY CONTACT EMAIL,SECONDARY CONTACT NAME,SECONDARY CONTACT NUMBER,SECONDARY CONTACT SECONDARY,SECONDARY CONTACT EMAIL,ORDER NUMBER,ORDER STATUS,ORDER DATE,DATE CAPTURED,LAST UPDATED,CAPTURED BY,SECONDARY CONTACT';
    const row1 = 'L12345,John Smith,Mailstech,20/10Mbps Uncapped Fibre,Openserve,New,new,Gauteng,Jane Doe,0821234567,jane@example.com,Bob Smith,0829876543,,bob@example.com,ORD001,pending,2024-01-15,2024-01-14,2024-01-15,agent@example.com,';
    const row2 = 'L12346,Sarah Jones,Betty Holdings,50/25 Mbps Uncapped Fibre,Openserve,Upgrade,contacted,Limpopo,Mike Wilson,0831112222,mike@example.com,,,,,,,2024-01-16,2024-01-16,sales@dealer.com,';
    const template = `${headers}\n${row1}\n${row2}`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}
