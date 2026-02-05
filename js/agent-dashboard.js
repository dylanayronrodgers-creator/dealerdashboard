// Agent Dashboard JavaScript
let currentUser = null;
let packages = [];
let packageAliases = [];
let dealers = [];
let myLeads = [];
let myOrders = [];
let returnedItems = [];
let importData = [];
let importStats = { duplicates: 0, newAgents: [] };

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication - allow both agent and external_agent roles
    const auth = await requireAuth(['agent', 'external_agent']);
    if (!auth) return;
    
    currentUser = auth.profile;
    
    // Apply role-based permissions
    applyRolePermissions();
    
    // Update UI with user info
    document.getElementById('userName').textContent = currentUser.full_name;
    document.getElementById('userInitials').textContent = getInitials(currentUser.full_name);
    
    // Load dealer info if agent has one assigned
    await loadAgentDealerInfo();
    
    // Load initial data
    await Promise.all([
        loadPackages(),
        loadDealers(),
        loadMyLeads(),
        loadMyOrders(),
        loadReturnedItems()
    ]);
    
    // Setup form handlers
    setupFormHandlers();
    
    // Setup filters
    setupFilters();
    
    // Setup drag and drop
    setupDragAndDrop();
});

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Check if user is an internal agent (full permissions) or external agent (limited)
function isInternalAgent() {
    return currentUser && currentUser.role === 'agent' && currentUser.team_type === 'internal';
}

function isExternalAgent() {
    return currentUser && (currentUser.role === 'external_agent' || 
           (currentUser.role === 'agent' && currentUser.team_type !== 'internal'));
}

// Apply role-based permissions to UI
function applyRolePermissions() {
    const isExternal = isExternalAgent();
    
    // Hide "Add Lead" button for external agents
    const addLeadBtn = document.getElementById('addLeadBtn');
    if (addLeadBtn && isExternal) {
        addLeadBtn.style.display = 'none';
    }
    
    // Hide import section for external agents
    const importNav = document.querySelector('[href="#import"]');
    if (importNav && isExternal) {
        importNav.style.display = 'none';
    }
    
    // Show role badge
    const roleBadge = document.getElementById('userRoleBadge');
    if (roleBadge) {
        if (isExternal) {
            roleBadge.textContent = 'External Agent';
            roleBadge.className = 'text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full';
        } else {
            roleBadge.textContent = 'Internal Agent';
            roleBadge.className = 'text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full';
        }
    }
    
    console.log(`Agent type: ${isExternal ? 'External' : 'Internal'}, Role: ${currentUser.role}`);
}

// Load agent's dealer info and display logo
let agentDealer = null;

async function loadAgentDealerInfo() {
    if (!currentUser.dealer_id) {
        // No dealer assigned
        const dealerInfo = document.getElementById('agentDealerInfo');
        if (dealerInfo) {
            dealerInfo.innerHTML = '<p class="text-sm text-gray-400">No dealer assigned</p>';
        }
        return;
    }
    
    try {
        const { data, error } = await window.supabaseClient
            .from('dealers')
            .select('*')
            .eq('id', currentUser.dealer_id)
            .single();
        
        if (error) throw error;
        agentDealer = data;
        
        // Update dealer display in sidebar
        const dealerInfo = document.getElementById('agentDealerInfo');
        if (dealerInfo && agentDealer) {
            dealerInfo.innerHTML = `
                <div class="flex items-center gap-3 p-3 bg-white/10 rounded-xl">
                    ${agentDealer.logo_url 
                        ? `<img src="${agentDealer.logo_url}" alt="${agentDealer.name}" class="w-10 h-10 rounded-lg object-contain bg-white">`
                        : `<div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>`
                    }
                    <div>
                        <p class="text-white font-medium text-sm">${agentDealer.name}</p>
                        <p class="text-white/60 text-xs">Your Dealer</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading dealer info:', error);
    }
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
        'dashboard': { title: 'Dashboard', subtitle: 'Your sales overview' },
        'my-leads': { title: 'My Leads', subtitle: 'Manage your leads' },
        'my-orders': { title: 'My Orders', subtitle: 'Track your orders' },
        'preorders': { title: 'My Preorders', subtitle: 'Track your preorder leads' },
        'returned': { title: 'Returned Items', subtitle: 'Items returned by admin for review' },
        'commissions': { title: 'Commissions', subtitle: 'Track your earnings' },
        'reports': { title: 'Reports', subtitle: 'Your performance analytics' }
    };
    
    if (titles[section]) {
        document.getElementById('pageTitle').textContent = titles[section].title;
        document.getElementById('pageSubtitle').textContent = titles[section].subtitle;
    }
    
    // Load section-specific data
    if (section === 'commissions') {
        loadCommissions();
    } else if (section === 'reports') {
        loadReports();
    } else if (section === 'preorders') {
        if (typeof loadAgentPreorders === 'function') loadAgentPreorders();
    }
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
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
        
        populatePackageSelects();
    } catch (error) {
        console.error('Error loading packages:', error);
    }
}

function populatePackageSelects() {
    const selects = ['agentPackageSelect', 'convertPackageSelect'];
    
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

// Load Dealers
async function loadDealers() {
    try {
        const { data, error } = await window.supabaseClient
            .from('dealers')
            .select('*')
            .eq('is_active', true)
            .order('name');
        
        if (error) throw error;
        dealers = data || [];
    } catch (error) {
        console.error('Error loading dealers:', error);
        dealers = [];
    }
}

// Load My Leads
async function loadMyLeads() {
    try {
        const { data, error } = await window.supabaseClient
            .from('leads')
            .select(`
                *,
                package:packages(id, name, price)
            `)
            .eq('agent_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        myLeads = data || [];
        
        renderMyLeadsTable();
        renderRecentLeads();
        updateDashboardStats();
        
        // Update badge
        const badge = document.getElementById('leadsCount');
        if (badge && myLeads.length > 0) {
            badge.textContent = myLeads.length;
            badge.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading leads:', error);
    }
}

function renderMyLeadsTable(filteredLeads = null) {
    const table = document.getElementById('myLeadsTable');
    const displayLeads = filteredLeads || myLeads;
    
    if (displayLeads.length === 0) {
        table.innerHTML = `
            <tr class="table-row border-b">
                <td class="py-4" colspan="6">
                    <p class="text-gray-500 text-center">No leads found. Add your first lead!</p>
                </td>
            </tr>
        `;
        return;
    }
    
    table.innerHTML = displayLeads.map(lead => {
        const displayName = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown';
        return `
        <tr class="table-row border-b">
            <td class="py-4">
                <div class="font-medium text-gray-800">${displayName}</div>
                ${lead.order_number ? `<div class="text-xs text-gray-400">Order: ${lead.order_number}</div>` : ''}
                ${lead.service_id ? `<div class="text-xs text-gray-400">Service: ${lead.service_id}</div>` : ''}
            </td>
            <td class="py-4">
                <div class="text-sm text-gray-600">${lead.email}</div>
                <div class="text-sm text-gray-500">${lead.phone}</div>
            </td>
            <td class="py-4 text-sm text-gray-600">${lead.address || '-'}</td>
            <td class="py-4 text-sm text-gray-600">${lead.package?.name || '-'}</td>
            <td class="py-4">
                <span class="status-${lead.status} px-3 py-1 rounded-full text-xs font-medium">${lead.status}</span>
            </td>
            <td class="py-4">
                <div class="flex gap-2">
                    <button onclick="updateLeadStatus('${lead.id}')" class="text-blue-600 hover:text-blue-800 text-sm">Update</button>
                    ${!isExternalAgent() && lead.status !== 'converted' ? `<button onclick="openConvertModal('${lead.id}')" class="text-green-600 hover:text-green-800 text-sm">Convert</button>` : ''}
                    <button onclick="sendToAdmin('${lead.id}', 'lead')" class="text-purple-600 hover:text-purple-800 text-sm">${isExternalAgent() ? 'Return' : 'Send to Admin'}</button>
                </div>
            </td>
        </tr>
    `}).join('');
}

function renderRecentLeads() {
    const table = document.getElementById('recentLeadsTable');
    const recentLeads = myLeads.slice(0, 5);
    
    if (recentLeads.length === 0) {
        table.innerHTML = `
            <tr class="table-row border-b">
                <td class="py-4" colspan="5">
                    <p class="text-gray-500 text-center">No leads yet. Add your first lead!</p>
                </td>
            </tr>
        `;
        return;
    }
    
    table.innerHTML = recentLeads.map(lead => {
        const displayName = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown';
        return `
        <tr class="table-row border-b">
            <td class="py-4">
                <div class="font-medium text-gray-800">${displayName}</div>
            </td>
            <td class="py-4 text-sm text-gray-600">${lead.package?.name || '-'}</td>
            <td class="py-4">
                <span class="status-${lead.status} px-3 py-1 rounded-full text-xs font-medium">${lead.status}</span>
            </td>
            <td class="py-4 text-sm text-gray-500">${new Date(lead.created_at).toLocaleDateString()}</td>
            <td class="py-4">
                <button onclick="updateLeadStatus('${lead.id}')" class="text-blue-600 hover:text-blue-800 text-sm">Update</button>
            </td>
        </tr>
    `}).join('');
}

// Load My Orders
async function loadMyOrders() {
    try {
        const { data, error } = await window.supabaseClient
            .from('orders')
            .select(`
                *,
                package:packages(id, name, price),
                lead:leads(id, first_name, last_name, email, phone, address)
            `)
            .eq('agent_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        myOrders = data || [];
        
        renderMyOrdersTable();
        updateDashboardStats();
        
        // Update badge
        const badge = document.getElementById('ordersCount');
        const activeOrders = myOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
        if (badge && activeOrders.length > 0) {
            badge.textContent = activeOrders.length;
            badge.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function renderMyOrdersTable(filteredOrders = null) {
    const table = document.getElementById('myOrdersTable');
    const displayOrders = filteredOrders || myOrders;
    
    if (displayOrders.length === 0) {
        table.innerHTML = `
            <tr class="table-row border-b">
                <td class="py-4" colspan="6">
                    <p class="text-gray-500 text-center">No orders yet. Convert a lead to create an order!</p>
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
            <td class="py-4">
                <span class="status-${order.status} px-3 py-1 rounded-full text-xs font-medium">${order.status}</span>
            </td>
            <td class="py-4 text-sm text-gray-500">${new Date(order.created_at).toLocaleDateString()}</td>
            <td class="py-4">
                <div class="flex gap-2">
                    <button onclick="viewOrder('${order.id}')" class="text-blue-600 hover:text-blue-800 text-sm">View</button>
                    <button onclick="sendToAdmin('${order.id}', 'order')" class="text-purple-600 hover:text-purple-800 text-sm">Send to Admin</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Load Returned Items
async function loadReturnedItems() {
    try {
        // Load returned leads
        const { data: returnedLeads, error: leadsError } = await window.supabaseClient
            .from('leads')
            .select('*')
            .eq('agent_id', currentUser.id)
            .eq('status', 'returned')
            .order('returned_at', { ascending: false });
        
        if (leadsError) throw leadsError;
        
        // Load returned orders
        const { data: returnedOrders, error: ordersError } = await window.supabaseClient
            .from('orders')
            .select(`
                *,
                lead:leads(first_name, last_name)
            `)
            .eq('agent_id', currentUser.id)
            .eq('status', 'returned')
            .order('returned_at', { ascending: false });
        
        if (ordersError) throw ordersError;
        
        returnedItems = [
            ...(returnedLeads || []).map(l => ({ ...l, type: 'lead' })),
            ...(returnedOrders || []).map(o => ({ ...o, type: 'order' }))
        ].sort((a, b) => new Date(b.returned_at) - new Date(a.returned_at));
        
        renderReturnedTable();
        renderReturnedPreview();
        
        // Update badge
        const badge = document.getElementById('returnedCount');
        if (badge && returnedItems.length > 0) {
            badge.textContent = returnedItems.length;
            badge.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading returned items:', error);
    }
}

function renderReturnedTable() {
    const table = document.getElementById('returnedTable');
    
    if (returnedItems.length === 0) {
        table.innerHTML = `
            <tr class="table-row border-b">
                <td class="py-4" colspan="5">
                    <p class="text-gray-500 text-center">No returned items</p>
                </td>
            </tr>
        `;
        return;
    }
    
    table.innerHTML = returnedItems.map(item => `
        <tr class="table-row border-b">
            <td class="py-4">
                <span class="px-2 py-1 rounded text-xs font-medium ${item.type === 'lead' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">
                    ${item.type === 'lead' ? 'Lead' : 'Order'}
                </span>
            </td>
            <td class="py-4 font-medium text-gray-800">
                ${item.type === 'lead' ? `${item.first_name} ${item.last_name}` : `${item.lead?.first_name || ''} ${item.lead?.last_name || ''}`}
            </td>
            <td class="py-4 text-sm text-gray-600">${item.return_reason || 'No reason provided'}</td>
            <td class="py-4 text-sm text-gray-500">${item.returned_at ? new Date(item.returned_at).toLocaleDateString() : '-'}</td>
            <td class="py-4">
                <button onclick="handleReturnedItem('${item.id}', '${item.type}')" class="text-blue-600 hover:text-blue-800 text-sm">Review & Update</button>
            </td>
        </tr>
    `).join('');
}

function renderReturnedPreview() {
    const preview = document.getElementById('returnedPreview');
    
    if (returnedItems.length === 0) {
        preview.innerHTML = '<p class="text-gray-500">No returned items</p>';
        return;
    }
    
    preview.innerHTML = `
        <div class="space-y-2">
            ${returnedItems.slice(0, 3).map(item => `
                <div class="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
                    <span class="text-sm font-medium">${item.type === 'lead' ? `${item.first_name} ${item.last_name}` : `Order #${item.id.slice(0, 8)}`}</span>
                    <span class="text-xs text-yellow-600">Needs attention</span>
                </div>
            `).join('')}
            ${returnedItems.length > 3 ? `<p class="text-sm text-gray-500">+${returnedItems.length - 3} more</p>` : ''}
        </div>
    `;
}

// Dashboard Stats
function updateDashboardStats() {
    document.getElementById('myLeadsCount').textContent = myLeads.length;
    document.getElementById('myOrdersCount').textContent = myOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;
    document.getElementById('completedCount').textContent = myOrders.filter(o => o.status === 'completed').length;
    
    // Calculate conversion rate
    const convertedLeads = myLeads.filter(l => l.status === 'converted').length;
    const totalLeads = myLeads.length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
    document.getElementById('myConversionRate').textContent = `${conversionRate}%`;
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
                agent_id: currentUser.id,
                notes: formData.get('notes'),
                status: 'new'
            });
            
            if (error) throw error;
            
            closeModal('addLeadModal');
            e.target.reset();
            await loadMyLeads();
            alert('Lead added successfully!');
        } catch (error) {
            console.error('Error adding lead:', error);
            alert('Error adding lead: ' + error.message);
        }
    });
    
    // Convert to Order Form
    document.getElementById('convertOrderForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const leadId = formData.get('lead_id');
        const packageId = formData.get('package_id');
        
        try {
            // Create order
            const { error: orderError } = await window.supabaseClient.from('orders').insert({
                lead_id: leadId,
                package_id: packageId,
                agent_id: currentUser.id,
                status: 'pending',
                notes: formData.get('notes')
            });
            
            if (orderError) throw orderError;
            
            // Update lead status
            const { error: leadError } = await window.supabaseClient
                .from('leads')
                .update({ status: 'converted', package_id: packageId })
                .eq('id', leadId);
            
            if (leadError) throw leadError;
            
            closeModal('convertOrderModal');
            e.target.reset();
            await Promise.all([loadMyLeads(), loadMyOrders()]);
            alert('Lead converted to order successfully!');
        } catch (error) {
            console.error('Error converting lead:', error);
            alert('Error converting lead: ' + error.message);
        }
    });
    
    // Send to Admin Form
    document.getElementById('sendToAdminForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const itemId = formData.get('item_id');
        const itemType = formData.get('item_type');
        const message = formData.get('message');
        
        try {
            const table = itemType === 'lead' ? 'leads' : 'orders';
            
            const { error } = await window.supabaseClient
                .from(table)
                .update({
                    admin_message: message,
                    sent_to_admin_at: new Date().toISOString()
                })
                .eq('id', itemId);
            
            if (error) throw error;
            
            closeModal('sendToAdminModal');
            e.target.reset();
            alert('Sent to admin successfully!');
        } catch (error) {
            console.error('Error sending to admin:', error);
            alert('Error sending to admin: ' + error.message);
        }
    });
}

// Convert Lead to Order
function openConvertModal(leadId) {
    const lead = myLeads.find(l => l.id === leadId);
    if (!lead) return;
    
    document.getElementById('convertLeadId').value = leadId;
    document.getElementById('convertLeadInfo').innerHTML = `
        <p class="font-medium text-gray-800">${lead.first_name} ${lead.last_name}</p>
        <p class="text-sm text-gray-600">${lead.email} | ${lead.phone}</p>
        <p class="text-sm text-gray-500">${lead.address}</p>
    `;
    
    // Pre-select package if lead has one
    if (lead.package_id) {
        document.getElementById('convertPackageSelect').value = lead.package_id;
    }
    
    openModal('convertOrderModal');
}

// Send to Admin
function sendToAdmin(itemId, itemType) {
    document.getElementById('sendItemId').value = itemId;
    document.getElementById('sendItemType').value = itemType;
    openModal('sendToAdminModal');
}

// Update Lead Status
async function updateLeadStatus(leadId) {
    const newStatus = prompt('Enter new status (new, contacted, qualified, converted, lost):');
    if (!newStatus) return;
    
    const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
    if (!validStatuses.includes(newStatus.toLowerCase())) {
        alert('Invalid status. Please use: ' + validStatuses.join(', '));
        return;
    }
    
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update({ status: newStatus.toLowerCase() })
            .eq('id', leadId);
        
        if (error) throw error;
        
        await loadMyLeads();
        alert('Lead status updated!');
    } catch (error) {
        console.error('Error updating lead:', error);
        alert('Error updating lead: ' + error.message);
    }
}

// Handle Returned Item
async function handleReturnedItem(itemId, itemType) {
    const newStatus = prompt(`This item was returned by admin. Enter new status to resubmit:\n\n${itemType === 'lead' ? 'Options: new, contacted, qualified' : 'Options: pending, processing'}`);
    if (!newStatus) return;
    
    try {
        const table = itemType === 'lead' ? 'leads' : 'orders';
        
        const { error } = await window.supabaseClient
            .from(table)
            .update({
                status: newStatus.toLowerCase(),
                return_reason: null,
                returned_at: null
            })
            .eq('id', itemId);
        
        if (error) throw error;
        
        await Promise.all([loadMyLeads(), loadMyOrders(), loadReturnedItems()]);
        alert('Item updated and resubmitted!');
    } catch (error) {
        console.error('Error updating item:', error);
        alert('Error updating item: ' + error.message);
    }
}

// Helper to validate UUID format
function isValidUUID(str) {
    if (!str || typeof str !== 'string') return false;
    return str.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Send to Admin - Agent returns item to admin for review
async function sendToAdmin(leadId, type = 'lead') {
    if (!isValidUUID(leadId)) {
        alert('Invalid lead ID');
        return;
    }
    
    const reason = prompt('Enter reason for sending to admin:');
    if (!reason) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update({
                order_status: 'returned',
                return_reason: reason,
                return_direction: 'to_admin',
                returned_by: currentUser.id,
                returned_at: new Date().toISOString(),
                return_resolved: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', leadId);
        
        if (error) throw error;
        
        alert('Item sent to admin for review');
        await Promise.all([loadMyLeads(), loadMyOrders(), loadReturnedItems()]);
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Return to Openserve - Agent sends directly to Openserve
async function returnToOpenserve(leadId) {
    const reason = prompt('Enter reason for returning to Openserve:');
    if (!reason) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update({
                order_status: 'returned',
                return_reason: reason,
                return_direction: 'to_openserve',
                returned_by: currentUser.id,
                returned_at: new Date().toISOString(),
                return_resolved: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', leadId);
        
        if (error) throw error;
        
        alert('Item returned to Openserve');
        await Promise.all([loadMyLeads(), loadMyOrders(), loadReturnedItems()]);
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// View Order
function viewOrder(orderId) {
    const order = myOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const lead = myLeads.find(l => l.id === order.lead_id) || order.lead || {};
    
    document.getElementById('viewOrderNumber').textContent = lead.order_number || order.order_number || '-';
    
    const status = lead.order_status || order.status || 'pending';
    const statusEl = document.getElementById('viewOrderStatus');
    statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    statusEl.className = `px-3 py-1 rounded-full text-sm font-medium ${getOrderStatusColor(status)}`;
    
    document.getElementById('viewOrderClientName').textContent = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '-';
    document.getElementById('viewOrderIdNumber').textContent = lead.id_number || '-';
    document.getElementById('viewOrderEmail').textContent = lead.email || '-';
    document.getElementById('viewOrderPhone').textContent = lead.phone || lead.cell_number || '-';
    document.getElementById('viewOrderAddress').textContent = lead.address || '-';
    document.getElementById('viewOrderCommission').textContent = `R${lead.commission_amount || order.commission_amount || 200}`;
    
    const commStatus = lead.commission_status || order.commission_status || 'pending';
    const commStatusEl = document.getElementById('viewOrderCommissionStatus');
    commStatusEl.textContent = commStatus.charAt(0).toUpperCase() + commStatus.slice(1);
    commStatusEl.className = `px-3 py-1 rounded-full text-sm font-medium ${commStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`;
    
    openModal('viewOrderModal');
}

function getOrderStatusColor(status) {
    const colors = {
        pending: 'bg-yellow-100 text-yellow-800',
        processing: 'bg-blue-100 text-blue-800',
        scheduled: 'bg-purple-100 text-purple-800',
        completed: 'bg-emerald-100 text-emerald-800',
        cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

// Filters
function setupFilters() {
    document.getElementById('myLeadStatusFilter')?.addEventListener('change', filterMyLeads);
    document.getElementById('myOrderStatusFilter')?.addEventListener('change', filterMyOrders);
}

function filterMyLeads() {
    const status = document.getElementById('myLeadStatusFilter').value;
    
    let filtered = myLeads;
    if (status) {
        filtered = filtered.filter(l => l.status === status);
    }
    
    renderMyLeadsTable(filtered);
}

function filterMyOrders() {
    const status = document.getElementById('myOrderStatusFilter').value;
    
    let filtered = myOrders;
    if (status) {
        filtered = filtered.filter(o => o.status === status);
    }
    
    renderMyOrdersTable(filtered);
}

// CSV Import Functions
function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-red-500', 'bg-red-50');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-red-500', 'bg-red-50');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-red-500', 'bg-red-50');
        
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            processCSVFile(file);
        } else {
            alert('Please upload a CSV file');
        }
    });
}

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
            alert('CSV file must have a header row and at least one data row');
            return;
        }
        
        // Parse headers - normalize to lowercase and handle variations
        const rawHeaders = parseCSVLine(lines[0]);
        const headers = rawHeaders.map(h => normalizeHeader(h.trim()));
        
        // Check for minimum required fields (flexible - either full_name or first_name)
        const hasName = headers.includes('full_name') || headers.includes('first_name') || headers.includes('address');
        if (!hasName) {
            alert('CSV must have at least a name or address column');
            return;
        }
        
        importData = [];
        importStats = { duplicates: 0, newAgents: [] };
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length > 0) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index]?.trim() || '';
                });
                importData.push(row);
            }
        }
        
        showImportPreview();
    };
    
    reader.readAsText(file);
}

// Normalize CSV headers to standard field names
function normalizeHeader(header) {
    const h = header.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const mappings = {
        'lead_id': 'lead_id',
        'leadid': 'lead_id',
        'agent': 'agent_name',
        'captured_by': 'captured_by_email',
        'capturedby': 'captured_by_email',
        'package_name': 'package_name',
        'packagename': 'package_name',
        'package': 'package_name',
        'isp': 'isp',
        'lead_type': 'lead_type',
        'leadtype': 'lead_type',
        'status': 'csv_status',
        'address': 'address',
        'first_name': 'first_name',
        'firstname': 'first_name',
        'last_name': 'last_name',
        'lastname': 'last_name',
        'full_name': 'full_name',
        'fullname': 'full_name',
        'name': 'full_name',
        'email': 'email',
        'phone': 'phone',
        'notes': 'notes',
        'order_number': 'order_number',
        'ordernumber': 'order_number',
        'order_status': 'order_status',
        'orderstatus': 'order_status',
        'order_date': 'order_date',
        'orderdate': 'order_date',
        'date_captured': 'date_captured',
        'datecaptured': 'date_captured',
        'last_updated': 'last_updated',
        'lastupdated': 'last_updated',
        'secondary_contact_name': 'secondary_contact_name',
        'secondary_contact_number': 'secondary_contact_number',
        'secondary_contact_email': 'secondary_contact_email',
        'dealer': 'dealer_name'
    };
    return mappings[h] || h;
}

// Intelligent package matching
function findPackageByName(packageName) {
    if (!packageName) return null;
    const name = packageName.toLowerCase().trim();
    
    // Direct match
    let pkg = packages.find(p => p.name.toLowerCase() === name);
    if (pkg) return pkg.id;
    
    // Partial match
    pkg = packages.find(p => p.name.toLowerCase().includes(name) || name.includes(p.name.toLowerCase()));
    if (pkg) return pkg.id;
    
    // Extract speed pattern (e.g., "20/10Mbps" or "50Mbps")
    const speedMatch = name.match(/(\d+)(?:\/\d+)?\s*mbps/i);
    if (speedMatch) {
        const speed = parseInt(speedMatch[1]);
        // Find package with matching speed
        pkg = packages.find(p => p.speed === speed);
        if (pkg) return pkg.id;
        
        // Find closest speed
        pkg = packages.find(p => Math.abs(p.speed - speed) <= 10);
        if (pkg) return pkg.id;
    }
    
    // Check for "Uncapped" keyword and try to match
    if (name.includes('uncapped')) {
        const speedMatch = name.match(/(\d+)/);
        if (speedMatch) {
            const speed = parseInt(speedMatch[1]);
            pkg = packages.find(p => p.speed === speed || p.name.toLowerCase().includes('webconnect'));
            if (pkg) return pkg.id;
        }
    }
    
    return null;
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

function showImportPreview() {
    const preview = document.getElementById('importPreview');
    const table = document.getElementById('previewTable');
    const countSpan = document.getElementById('importCount');
    
    if (importData.length === 0) {
        alert('No valid data found in CSV');
        return;
    }
    
    countSpan.textContent = importData.length;
    
    const headers = Object.keys(importData[0]);
    const previewRows = importData.slice(0, 5);
    
    table.innerHTML = `
        <thead>
            <tr class="text-left text-gray-500 border-b">
                ${headers.map(h => `<th class="pb-2 pr-4 font-medium">${h}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${previewRows.map(row => `
                <tr class="border-b">
                    ${headers.map(h => `<td class="py-2 pr-4 text-gray-600">${row[h] || '-'}</td>`).join('')}
                </tr>
            `).join('')}
        </tbody>
    `;
    
    preview.classList.remove('hidden');
}

async function confirmImport() {
    if (importData.length === 0) return;
    
    const progress = document.getElementById('importProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    progress.classList.remove('hidden');
    document.getElementById('importPreview').classList.add('hidden');
    
    let imported = 0;
    let failed = 0;
    let duplicates = 0;
    const newAgents = new Set();
    
    for (let i = 0; i < importData.length; i++) {
        const row = importData[i];
        
        try {
            // Check for duplicate by lead_id
            if (row.lead_id) {
                const { data: existing } = await window.supabaseClient
                    .from('leads')
                    .select('id')
                    .eq('lead_id', row.lead_id)
                    .single();
                
                if (existing) {
                    duplicates++;
                    continue;
                }
            }
            
            // Find package using intelligent matching
            const packageId = findPackageByName(row.package_name);
            
            // Build full_name from first_name/last_name if not provided
            let fullName = row.full_name;
            if (!fullName && (row.first_name || row.last_name)) {
                fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
            }
            
            // Track new agents from captured_by_email
            if (row.captured_by_email && row.captured_by_email.includes('@')) {
                newAgents.add(JSON.stringify({
                    email: row.captured_by_email,
                    name: row.agent_name || row.captured_by_email.split('@')[0]
                }));
            }
            
            // Find dealer if specified
            let dealerId = null;
            if (row.dealer_name) {
                const dealer = dealers.find(d => 
                    d.name.toLowerCase() === row.dealer_name.toLowerCase() ||
                    d.code?.toLowerCase() === row.dealer_name.toLowerCase()
                );
                if (dealer) dealerId = dealer.id;
            }
            
            // Parse dates
            const parseDate = (dateStr) => {
                if (!dateStr) return null;
                try {
                    return new Date(dateStr).toISOString();
                } catch {
                    return null;
                }
            };
            
            const { error } = await window.supabaseClient.from('leads').insert({
                lead_id: row.lead_id || null,
                full_name: fullName,
                first_name: row.first_name || null,
                last_name: row.last_name || null,
                email: row.email || '',
                phone: row.phone || '',
                address: row.address || '',
                package_id: packageId,
                agent_id: currentUser.id,
                dealer_id: dealerId,
                notes: row.notes || '',
                status: 'new',
                lead_type: row.lead_type || null,
                isp: row.isp || null,
                captured_by_email: row.captured_by_email || null,
                order_number: row.order_number || null,
                order_status: row.order_status || null,
                order_date: parseDate(row.order_date),
                date_captured: parseDate(row.date_captured),
                last_updated: parseDate(row.last_updated),
                secondary_contact_name: row.secondary_contact_name || null,
                secondary_contact_number: row.secondary_contact_number || null,
                secondary_contact_email: row.secondary_contact_email || null
            });
            
            if (error) throw error;
            imported++;
        } catch (error) {
            console.error('Error importing row:', error);
            failed++;
        }
        
        const percent = Math.round(((i + 1) / importData.length) * 100);
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${percent}%`;
    }
    
    // Create pending agents for admin approval
    const agentsList = Array.from(newAgents).map(a => JSON.parse(a));
    for (const agent of agentsList) {
        try {
            await window.supabaseClient.from('pending_agents').upsert({
                email: agent.email,
                full_name: agent.name,
                status: 'pending'
            }, { onConflict: 'email' });
        } catch (e) {
            console.log('Agent already exists or error:', e);
        }
    }
    
    progress.classList.add('hidden');
    importData = [];
    document.getElementById('csvFileInput').value = '';
    
    await loadMyLeads();
    
    let message = `Import complete!\n\nSuccessfully imported: ${imported}`;
    if (duplicates > 0) message += `\nDuplicates skipped: ${duplicates}`;
    if (failed > 0) message += `\nFailed: ${failed}`;
    if (agentsList.length > 0) message += `\n\nNew agents detected: ${agentsList.length}\nThey will need admin approval.`;
    
    alert(message);
}

function cancelImport() {
    importData = [];
    document.getElementById('importPreview').classList.add('hidden');
    document.getElementById('csvFileInput').value = '';
}

function downloadTemplate() {
    const template = 'LEAD ID,AGENT,full_name,email,phone,address,package_name,notes,CAPTURED BY,dealer\nL12345,Tumi Maila,John Doe,john@example.com,0821234567,123 Main St Gauteng,20/10Mbps Uncapped Fibre,Interested in fibre,agent@example.com,Mailstech\nL12346,Betty Holdings,Jane Smith,jane@example.com,0829876543,456 Oak Ave Limpopo,50/25 Mbps Uncapped Fibre,Referred by friend,sales@dealer.com,Betty Holdings';
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

// Commission Functions
function loadCommissions() {
    const convertedLeads = myLeads.filter(l => l.status === 'converted');
    
    let totalEarned = 0;
    let pending = 0;
    let paid = 0;
    
    convertedLeads.forEach(lead => {
        const amount = lead.commission_amount || 0;
        if (lead.commission_status === 'paid') {
            paid += amount;
            totalEarned += amount;
        } else {
            pending += amount;
            totalEarned += amount;
        }
    });
    
    document.getElementById('totalCommissionEarned').textContent = `R${totalEarned.toLocaleString()}`;
    document.getElementById('pendingCommission').textContent = `R${pending.toLocaleString()}`;
    document.getElementById('paidCommission').textContent = `R${paid.toLocaleString()}`;
    
    renderCommissionTable(convertedLeads);
}

function renderCommissionTable(convertedLeads) {
    const table = document.getElementById('commissionTable');
    if (!table) return;
    
    if (convertedLeads.length === 0) {
        table.innerHTML = `<tr class="table-row border-b"><td class="py-4" colspan="6"><p class="text-gray-500 text-center">No commissions yet</p></td></tr>`;
        return;
    }
    
    table.innerHTML = convertedLeads.map(lead => {
        const clientName = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown';
        const packageName = lead.package?.name || '-';
        const amount = lead.commission_amount || 0;
        const status = lead.commission_status || 'pending';
        const statusClass = status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700';
        const date = lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : '-';
        
        return `
            <tr class="table-row border-b hover:bg-gray-50">
                <td class="py-3 text-sm font-medium text-gray-800">${lead.order_number || '-'}</td>
                <td class="py-3 text-sm text-gray-600">${clientName}</td>
                <td class="py-3 text-sm text-gray-600">${packageName}</td>
                <td class="py-3 text-sm font-semibold text-emerald-600">R${amount}</td>
                <td class="py-3"><span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">${status}</span></td>
                <td class="py-3 text-sm text-gray-500">${date}</td>
            </tr>
        `;
    }).join('');
}

// Report Functions
function loadReports() {
    const totalLeads = myLeads.length;
    const convertedLeads = myLeads.filter(l => l.status === 'converted').length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
    const totalCommission = myLeads.filter(l => l.status === 'converted').reduce((sum, l) => sum + (l.commission_amount || 0), 0);
    
    document.getElementById('reportTotalLeads').textContent = totalLeads;
    document.getElementById('reportConvertedLeads').textContent = convertedLeads;
    document.getElementById('reportConversionRate').textContent = `${conversionRate}%`;
    document.getElementById('reportTotalCommission').textContent = `R${totalCommission.toLocaleString()}`;
    
    // Status breakdown
    document.getElementById('reportStatusNew').textContent = myLeads.filter(l => l.status === 'new').length;
    document.getElementById('reportStatusContacted').textContent = myLeads.filter(l => l.status === 'contacted').length;
    document.getElementById('reportStatusQualified').textContent = myLeads.filter(l => l.status === 'qualified').length;
    document.getElementById('reportStatusConverted').textContent = myLeads.filter(l => l.status === 'converted').length;
    document.getElementById('reportStatusLost').textContent = myLeads.filter(l => l.status === 'lost').length;
    
    // Performance chart
    initAgentPerformanceChart();
}

function initAgentPerformanceChart() {
    const ctx = document.getElementById('agentPerformanceChart');
    if (!ctx) return;
    
    const now = new Date();
    const monthLabels = [];
    const leadsPerMonth = [];
    const conversionsPerMonth = [];
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthLabels.push(d.toLocaleDateString('en-US', { month: 'short' }));
        
        const monthLeads = myLeads.filter(l => {
            const created = new Date(l.created_at);
            return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
        }).length;
        leadsPerMonth.push(monthLeads);
        
        const monthConversions = myLeads.filter(l => {
            if (l.status !== 'converted') return false;
            const updated = new Date(l.updated_at);
            return updated.getMonth() === d.getMonth() && updated.getFullYear() === d.getFullYear();
        }).length;
        conversionsPerMonth.push(monthConversions);
    }
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [
                {
                    label: 'Leads Assigned',
                    data: leadsPerMonth,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                },
                {
                    label: 'Converted',
                    data: conversionsPerMonth,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}
