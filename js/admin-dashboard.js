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
    
    // Load Supabase settings for Settings page
    loadSupabaseSettings();
});

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

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
                package:packages(id, name, price)
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
    
    table.innerHTML = displayLeads.map(lead => `
        <tr class="table-row border-b">
            <td class="py-4">
                <div class="font-medium text-gray-800">${lead.first_name} ${lead.last_name}</div>
            </td>
            <td class="py-4">
                <div class="text-sm text-gray-600">${lead.email}</div>
                <div class="text-sm text-gray-500">${lead.phone}</div>
            </td>
            <td class="py-4 text-sm text-gray-600">${lead.address || '-'}</td>
            <td class="py-4 text-sm text-gray-600">${lead.package?.name || '-'}</td>
            <td class="py-4 text-sm text-gray-600">${lead.agent?.full_name || 'Unassigned'}</td>
            <td class="py-4">
                <span class="status-${lead.status} px-3 py-1 rounded-full text-xs font-medium">${lead.status}</span>
            </td>
            <td class="py-4">
                <div class="flex gap-2">
                    <button onclick="viewLead('${lead.id}')" class="text-blue-600 hover:text-blue-800 text-sm">View</button>
                    <button onclick="returnToAgent('${lead.id}', 'lead')" class="text-yellow-600 hover:text-yellow-800 text-sm">Return</button>
                </div>
            </td>
        </tr>
    `).join('');
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
            <td class="py-4 font-medium text-gray-800">#${order.id.slice(0, 8)}</td>
            <td class="py-4">
                <div class="font-medium text-gray-800">${order.lead?.first_name || ''} ${order.lead?.last_name || ''}</div>
                <div class="text-sm text-gray-500">${order.lead?.email || ''}</div>
            </td>
            <td class="py-4 text-sm text-gray-600">${order.package?.name || '-'}</td>
            <td class="py-4 text-sm text-gray-600">${order.agent?.full_name || 'Unassigned'}</td>
            <td class="py-4">
                <span class="status-${order.status} px-3 py-1 rounded-full text-xs font-medium">${order.status}</span>
            </td>
            <td class="py-4 text-sm text-gray-500">${new Date(order.created_at).toLocaleDateString()}</td>
            <td class="py-4">
                <div class="flex gap-2">
                    <button onclick="viewOrder('${order.id}')" class="text-blue-600 hover:text-blue-800 text-sm">View</button>
                    <button onclick="updateOrderStatus('${order.id}')" class="text-green-600 hover:text-green-800 text-sm">Update</button>
                    <button onclick="returnToAgent('${order.id}', 'order')" class="text-yellow-600 hover:text-yellow-800 text-sm">Return</button>
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

// Dashboard Stats
async function loadDashboardStats() {
    try {
        // Calculate conversion rate
        const convertedLeads = leads.filter(l => l.status === 'converted').length;
        const totalLeads = leads.length;
        const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
        
        document.getElementById('conversionRate').textContent = `${conversionRate}%`;
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
            const { error } = await window.supabaseClient.from('leads').insert({
                first_name: formData.get('first_name'),
                last_name: formData.get('last_name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
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
            
            // Create profile with dealer assignment
            const { error: profileError } = await window.supabaseClient.from('profiles').insert({
                id: authData.user.id,
                email: formData.get('email'),
                full_name: formData.get('full_name'),
                phone: formData.get('phone') || null,
                dealer_id: formData.get('dealer_id') || null,
                role: 'agent',
                is_approved: true
            });
            
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
            alert('Error approving agent: ' + error.message);
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
                <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
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
