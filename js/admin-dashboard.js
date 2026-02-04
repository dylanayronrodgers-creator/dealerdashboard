// Admin Dashboard JavaScript
let currentUser = null;
let agents = [];
let packages = [];
let leads = [];
let orders = [];
let dealers = [];
let pendingAgents = [];
let systemSettings = {};

// South African ID Number Validation
function validateSAID(idNumber) {
    if (!idNumber) return { valid: true, message: '' }; // Allow empty
    
    // Remove any spaces or dashes
    idNumber = idNumber.replace(/[\s-]/g, '');
    
    // Must be exactly 13 digits
    if (!/^\d{13}$/.test(idNumber)) {
        return { valid: false, message: 'ID must be exactly 13 digits' };
    }
    
    // Extract date parts
    const year = parseInt(idNumber.substring(0, 2));
    const month = parseInt(idNumber.substring(2, 4));
    const day = parseInt(idNumber.substring(4, 6));
    
    // Validate month (01-12)
    if (month < 1 || month > 12) {
        return { valid: false, message: 'Invalid month in ID number' };
    }
    
    // Validate day (01-31)
    if (day < 1 || day > 31) {
        return { valid: false, message: 'Invalid day in ID number' };
    }
    
    // Luhn algorithm checksum validation
    let sum = 0;
    for (let i = 0; i < 13; i++) {
        let digit = parseInt(idNumber[i]);
        if (i % 2 === 1) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
    }
    
    if (sum % 10 !== 0) {
        return { valid: false, message: 'Invalid ID number checksum' };
    }
    
    return { valid: true, message: '' };
}

function setupIDValidation(inputElement, errorElementId) {
    if (!inputElement) return;
    
    inputElement.addEventListener('blur', function() {
        const result = validateSAID(this.value);
        const errorEl = document.getElementById(errorElementId);
        
        if (!result.valid) {
            this.classList.add('border-red-500');
            this.classList.remove('border-gray-300');
            if (errorEl) {
                errorEl.textContent = result.message;
                errorEl.classList.remove('hidden');
            }
        } else {
            this.classList.remove('border-red-500');
            this.classList.add('border-gray-300');
            if (errorEl) {
                errorEl.classList.add('hidden');
            }
        }
    });
}

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
    
    // Setup ID validation on ID number fields
    setupIDValidation(document.getElementById('newLeadIdNumber'), 'newLeadIdError');
    setupIDValidation(document.getElementById('editOrderIdNumber'), 'editOrderIdError');
    
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

function getAgentAvatar(agent) {
    // Use custom avatar if set, otherwise generate unique avatar using DiceBear
    if (agent.avatar_url) return agent.avatar_url;
    
    // Use agent's avatar_seed if set, otherwise use their id for consistency
    const seed = agent.avatar_seed || agent.id || agent.email || agent.full_name;
    
    // DiceBear avatars - using 'avataaars' style for professional look
    // Other styles: lorelei, adventurer, big-smile, micah, miniavs, open-peeps, personas, pixel-art
    const styles = ['avataaars', 'lorelei', 'adventurer', 'big-smile', 'micah'];
    const styleIndex = Math.abs(hashCode(seed)) % styles.length;
    const style = styles[styleIndex];
    
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash;
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
    
    // Trigger section-specific data loading
    if (section === 'reports') {
        renderReportsCharts();
    } else if (section === 'returned') {
        loadReturnedItems();
    } else if (section === 'settings') {
        loadPrivilegesTable();
    } else if (section === 'leads') {
        renderLeadsTable(leads);
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
    
    grid.innerHTML = agents.map(agent => {
        const avatarUrl = getAgentAvatar(agent);
        return `
        <div class="card p-6">
            <div class="flex items-center gap-4 mb-4">
                <img src="${avatarUrl}" alt="${agent.full_name}" class="w-12 h-12 rounded-full object-cover border-2 border-blue-200">
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
    `}).join('');
    
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
    console.log('viewAgentDetails called with:', agentId);
    const agent = agents.find(a => a.id === agentId);
    if (!agent) {
        console.error('Agent not found:', agentId);
        return;
    }
    console.log('Found agent:', agent);
    
    const idField = document.getElementById('editAgentId');
    const nameField = document.getElementById('editAgentName');
    const emailField = document.getElementById('editAgentEmail');
    const phoneField = document.getElementById('editAgentPhone');
    const approvedField = document.getElementById('editAgentApproved');
    const dealerSelect = document.getElementById('editAgentDealer');
    
    if (!idField || !nameField || !emailField || !phoneField || !approvedField || !dealerSelect) {
        console.error('Missing form fields for edit agent modal');
        return;
    }
    
    idField.value = agentId;
    nameField.value = agent.full_name || '';
    emailField.value = agent.email || '';
    phoneField.value = agent.phone || '';
    approvedField.value = agent.is_approved ? 'true' : 'false';
    
    // Populate dealer select
    dealerSelect.innerHTML = '<option value="">No dealer assigned</option>';
    dealers.forEach(d => {
        dealerSelect.innerHTML += `<option value="${d.id}" ${agent.dealer_id === d.id ? 'selected' : ''}>${d.name}</option>`;
    });
    
    console.log('Opening edit agent modal');
    openModal('editAgentModal');
}

// View/Edit Dealer Details
async function viewDealerDetails(dealerId) {
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
    
    // Check for existing dealer login
    document.getElementById('editDealerLoginEmail').value = '';
    document.getElementById('editDealerLoginPassword').value = '';
    const loginStatus = document.getElementById('dealerLoginStatus');
    
    try {
        const { data: dealerProfile } = await window.supabaseClient
            .from('profiles')
            .select('id, email, full_name')
            .eq('dealer_id', dealerId)
            .eq('role', 'dealer')
            .limit(1);
        
        if (dealerProfile && dealerProfile.length > 0) {
            document.getElementById('editDealerLoginEmail').value = dealerProfile[0].email || '';
            loginStatus.innerHTML = '<span class="text-emerald-600">✓ Dealer login exists</span>';
        } else {
            loginStatus.innerHTML = '<span class="text-gray-400">No login configured yet</span>';
        }
    } catch (error) {
        console.error('Error checking dealer login:', error);
        loginStatus.innerHTML = '';
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
        // Load last 500 leads for performance - exclude converted leads
        const { data, error } = await window.supabaseClient
            .from('leads')
            .select(`
                *,
                agent:profiles!leads_agent_id_fkey(id, full_name),
                package:packages(id, name, price),
                dealer:dealers(id, name)
            `)
            .neq('status', 'converted')
            .order('created_at', { ascending: false })
            .limit(500);
        
        if (error) throw error;
        
        leads = data || [];
        console.log('Loaded', leads.length, 'leads (limited to 500, excluding converted)');
        
        renderLeadsTable();
        renderRecentOrders();
        
        // Get total count for display (excluding converted)
        const { count } = await window.supabaseClient
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .neq('status', 'converted');
        
        document.getElementById('totalLeads').textContent = count || leads.length;
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
                <div class="text-xs text-gray-400">${lead.order_number ? 'Order: ' + lead.order_number : ''}</div>
                <div class="text-xs text-gray-400">${lead.service_id ? 'Service: ' + lead.service_id : ''}</div>
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
                <div class="flex gap-2 items-center">
                    <button onclick="viewLeadDetails('${lead.id}')" class="inline-flex items-center gap-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:shadow-md hover:from-blue-600 hover:to-blue-700 transition-all duration-200">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        View
                    </button>
                    <button onclick="editLead('${lead.id}')" class="inline-flex items-center gap-1 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:shadow-md hover:from-violet-600 hover:to-purple-700 transition-all duration-200">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        Edit
                    </button>
                    <button onclick="openConvertModal('${lead.id}')" class="inline-flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:shadow-md hover:from-emerald-600 hover:to-green-700 transition-all duration-200">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        Convert
                    </button>
                    <button onclick="deleteLead('${lead.id}')" class="inline-flex items-center gap-1 bg-gradient-to-r from-red-500 to-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:shadow-md hover:from-red-600 hover:to-rose-700 transition-all duration-200">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        Delete
                    </button>
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
                lead:leads(id, first_name, last_name, full_name, email, phone, address, order_number, service_id)
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
                <div class="font-medium text-gray-800">${order.lead?.order_number || order.order_number || '-'}</div>
                <div class="text-xs text-gray-400">Service ID: ${order.lead?.service_id || '-'}</div>
                <div class="text-xs text-gray-400">Lead ID: ${order.lead?.id?.slice(0, 8) || '-'}</div>
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
                <div class="flex gap-2 items-center">
                    <button onclick="viewOrder('${order.id}')" class="inline-flex items-center gap-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:shadow-md hover:from-blue-600 hover:to-blue-700 transition-all duration-200">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        View
                    </button>
                    <button onclick="returnToAgent('${order.id}', 'order')" class="inline-flex items-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:shadow-md hover:from-amber-600 hover:to-orange-600 transition-all duration-200">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                        Return
                    </button>
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
            
            // Check both commission_status and order_status for completed sales
            const isConfirmed = lead.commission_status === 'confirmed' || 
                               lead.commission_status === 'paid' || 
                               lead.order_status === 'completed';
            
            if (isConfirmed) {
                confirmedRevenue += commission;
                confirmedCount++;
            } else if (lead.commission_status === 'rejected' || lead.order_status === 'cancelled') {
                rejectedRevenue += commission;
                rejectedCount++;
            } else if (lead.status === 'converted') {
                // Converted but not yet completed
                pendingRevenue += commission;
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
let ordersChart = null;
let leadsChart = null;

function initCharts() {
    updateChartsWithData();
}

function updateChartsWithData() {
    // Calculate leads by month for the last 6 months
    const now = new Date();
    const monthLabels = [];
    const leadsPerMonth = [];
    const ordersPerMonth = [];
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthLabels.push(d.toLocaleDateString('en-US', { month: 'short' }));
        
        const monthLeads = leads.filter(l => {
            const created = new Date(l.created_at);
            return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
        }).length;
        leadsPerMonth.push(monthLeads);
        
        const monthOrders = orders.filter(o => {
            const created = new Date(o.created_at);
            return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
        }).length;
        ordersPerMonth.push(monthOrders);
    }
    
    // Orders/Leads Trend Chart
    const ordersCtx = document.getElementById('ordersChart');
    if (ordersCtx) {
        if (ordersChart) ordersChart.destroy();
        ordersChart = new Chart(ordersCtx, {
            type: 'line',
            data: {
                labels: monthLabels,
                datasets: [
                    {
                        label: 'Leads',
                        data: leadsPerMonth,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Orders',
                        data: ordersPerMonth,
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        fill: true,
                        tension: 0.4
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
    
    // Leads by Status Chart
    const statusCounts = {
        'new': leads.filter(l => l.status === 'new').length,
        'contacted': leads.filter(l => l.status === 'contacted').length,
        'qualified': leads.filter(l => l.status === 'qualified').length,
        'converted': leads.filter(l => l.status === 'converted').length,
        'lost': leads.filter(l => l.status === 'lost').length
    };
    
    const leadsCtx = document.getElementById('leadsChart');
    if (leadsCtx) {
        if (leadsChart) leadsChart.destroy();
        leadsChart = new Chart(leadsCtx, {
            type: 'doughnut',
            data: {
                labels: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'],
                datasets: [{
                    data: [statusCounts.new, statusCounts.contacted, statusCounts.qualified, statusCounts.converted, statusCounts.lost],
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444']
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
    
    // Reports Section Charts
    renderReportsCharts();
}

// Render Reports Section Charts
function renderReportsCharts() {
    // Agent Performance Chart - Top 10 agents by conversions
    const agentPerformanceCtx = document.getElementById('agentPerformanceChart');
    if (agentPerformanceCtx) {
        const agentStats = agents.map(agent => {
            const agentLeads = leads.filter(l => l.agent_id === agent.id);
            const converted = agentLeads.filter(l => l.status === 'converted').length;
            return { name: agent.full_name || 'Unknown', converted, total: agentLeads.length };
        }).sort((a, b) => b.converted - a.converted).slice(0, 10);
        
        // Destroy existing chart if exists
        const existingChart = Chart.getChart(agentPerformanceCtx);
        if (existingChart) existingChart.destroy();
        
        new Chart(agentPerformanceCtx, {
            type: 'bar',
            data: {
                labels: agentStats.map(a => a.name.split(' ')[0]),
                datasets: [
                    {
                        label: 'Converted',
                        data: agentStats.map(a => a.converted),
                        backgroundColor: '#22c55e'
                    },
                    {
                        label: 'Total Leads',
                        data: agentStats.map(a => a.total),
                        backgroundColor: '#3b82f6'
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
    
    // Monthly Conversions Chart - Last 12 months
    const monthlyConversionsCtx = document.getElementById('monthlyConversionsChart');
    if (monthlyConversionsCtx) {
        const monthLabels = [];
        const conversionsPerMonth = [];
        const revenuePerMonth = [];
        
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            monthLabels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
            
            const monthConversions = leads.filter(l => {
                if (l.status !== 'converted') return false;
                const created = new Date(l.converted_at || l.updated_at || l.created_at);
                return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
            });
            
            conversionsPerMonth.push(monthConversions.length);
            revenuePerMonth.push(monthConversions.reduce((sum, l) => sum + (l.commission_amount || 0), 0));
        }
        
        // Destroy existing chart if exists
        const existingChart = Chart.getChart(monthlyConversionsCtx);
        if (existingChart) existingChart.destroy();
        
        new Chart(monthlyConversionsCtx, {
            type: 'line',
            data: {
                labels: monthLabels,
                datasets: [
                    {
                        label: 'Conversions',
                        data: conversionsPerMonth,
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Revenue (R)',
                        data: revenuePerMonth,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'top' } },
                scales: {
                    y: { type: 'linear', position: 'left', beginAtZero: true },
                    y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } }
                }
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
        
        // Validate SA ID number
        const idNumber = formData.get('id_number');
        const idValidation = validateSAID(idNumber);
        if (!idValidation.valid) {
            alert('Invalid ID Number: ' + idValidation.message);
            return;
        }
        
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
                passport_number: formData.get('passport_number') || null,
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
        const dealerName = formData.get('name');
        const loginEmail = formData.get('login_email');
        const loginPassword = formData.get('login_password');
        
        try {
            // Update dealer info
            const { error } = await window.supabaseClient
                .from('dealers')
                .update({
                    name: dealerName,
                    code: formData.get('code') || null,
                    contact_email: formData.get('contact_email') || null,
                    contact_phone: formData.get('contact_phone') || null,
                    logo_url: formData.get('logo_url') || null,
                    is_active: formData.get('is_active') === 'true'
                })
                .eq('id', dealerId);
            
            if (error) throw error;
            
            // Handle dealer login credentials
            if (loginEmail && loginPassword) {
                // Check if dealer profile already exists
                const { data: existingProfile } = await window.supabaseClient
                    .from('profiles')
                    .select('id, email')
                    .eq('dealer_id', dealerId)
                    .eq('role', 'dealer')
                    .limit(1);
                
                if (existingProfile && existingProfile.length > 0) {
                    // Update existing user password (requires admin API, show message instead)
                    alert('Dealer login exists. To reset password, use the Supabase dashboard or password reset flow.');
                } else {
                    // Create new auth user for dealer using admin invite approach
                    // First try signUp - if it fails with database error, we need admin setup
                    try {
                        const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
                            email: loginEmail,
                            password: loginPassword,
                            options: {
                                data: { full_name: dealerName, role: 'dealer' },
                                emailRedirectTo: window.location.origin + '/dealer-dashboard.html'
                            }
                        });
                        
                        if (authError) {
                            if (authError.message.includes('already registered')) {
                                alert('This email is already registered. Use a different email.');
                            } else if (authError.message.includes('Database error')) {
                                // Database trigger might be failing - try alternative approach
                                alert('Note: Email confirmation may be required. The dealer should check their email to confirm registration, then they can log in.');
                            } else {
                                console.error('Auth error:', authError);
                                alert('Could not create login: ' + authError.message);
                            }
                        } else if (authData.user) {
                            // Auth user created, now create/update profile
                            const { error: profileError } = await window.supabaseClient
                                .from('profiles')
                                .upsert({
                                    id: authData.user.id,
                                    email: loginEmail,
                                    full_name: dealerName,
                                    role: 'dealer',
                                    dealer_id: dealerId,
                                    is_approved: true
                                }, { onConflict: 'id' });
                            
                            if (profileError) {
                                console.error('Profile creation error:', profileError);
                                // Profile might be created by trigger, that's okay
                                alert('Dealer login created! The dealer may need to confirm their email before logging in.');
                            } else {
                                alert('Dealer updated and login created successfully!');
                            }
                            closeModal('editDealerModal');
                            await loadDealers();
                            return;
                        } else {
                            // User created but needs email confirmation
                            alert('Dealer login created! The dealer needs to confirm their email before logging in.');
                        }
                    } catch (signupError) {
                        console.error('Signup error:', signupError);
                        alert('Could not create dealer login. Please try again or contact support.');
                    }
                }
            }
            
            alert('Dealer updated successfully!');
            closeModal('editDealerModal');
            await loadDealers();
        } catch (error) {
            console.error('Error updating dealer:', error);
            alert('Error updating dealer: ' + error.message);
        }
    });
    
    // Edit Order Form
    document.getElementById('editOrderForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const leadId = document.getElementById('editOrderLeadId').value;
        
        // Validate SA ID number
        const idNumber = document.getElementById('editOrderIdNumber').value;
        const idValidation = validateSAID(idNumber);
        if (!idValidation.valid) {
            alert('Invalid ID Number: ' + idValidation.message);
            return;
        }
        
        try {
            // Update lead with order info
            const { error: leadError } = await window.supabaseClient
                .from('leads')
                .update({
                    order_number: document.getElementById('editOrderNumber').value,
                    order_status: document.getElementById('editOrderStatus').value,
                    full_name: document.getElementById('editOrderClientName').value,
                    id_number: document.getElementById('editOrderIdNumber').value,
                    passport_number: document.getElementById('editOrderPassport').value || null,
                    email: document.getElementById('editOrderEmail').value,
                    phone: document.getElementById('editOrderPhone').value,
                    address: document.getElementById('editOrderAddress').value,
                    agent_id: document.getElementById('editOrderAgent').value || null,
                    dealer_id: document.getElementById('editOrderDealer').value || null,
                    commission_amount: parseFloat(document.getElementById('editOrderCommission').value) || 200,
                    commission_status: document.getElementById('editOrderCommissionStatus').value,
                    updated_at: new Date().toISOString()
                })
                .eq('id', leadId);
            
            if (leadError) throw leadError;
            
            alert('Order updated successfully!');
            closeModal('viewOrderModal');
            await loadLeads();
            await loadOrders();
        } catch (error) {
            console.error('Error updating order:', error);
            alert('Error updating order: ' + error.message);
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
    document.getElementById('leadDealerFilter')?.addEventListener('change', filterLeads);
    document.getElementById('orderStatusFilter')?.addEventListener('change', filterOrders);
    document.getElementById('orderAgentFilter')?.addEventListener('change', filterOrders);
    
    // Populate dealer filter
    populateDealerFilters();
}

function populateDealerFilters() {
    const dealerFilter = document.getElementById('leadDealerFilter');
    if (dealerFilter && dealers.length > 0) {
        dealerFilter.innerHTML = '<option value="">All Dealers</option>';
        dealers.forEach(d => {
            dealerFilter.innerHTML += `<option value="${d.id}">${d.name}</option>`;
        });
    }
}

function filterLeads() {
    const search = (document.getElementById('leadSearchFilter')?.value || '').toLowerCase().trim();
    const status = document.getElementById('leadStatusFilter')?.value || '';
    const agentId = document.getElementById('leadAgentFilter')?.value || '';
    const dealerId = document.getElementById('leadDealerFilter')?.value || '';
    
    let filtered = leads;
    
    // Text search
    if (search) {
        filtered = filtered.filter(l => {
            const name = (l.full_name || `${l.first_name || ''} ${l.last_name || ''}`).toLowerCase();
            const email = (l.email || '').toLowerCase();
            const phone = (l.phone || '').toLowerCase();
            const leadId = (l.lead_id || '').toLowerCase();
            return name.includes(search) || email.includes(search) || phone.includes(search) || leadId.includes(search);
        });
    }
    
    // Status filter
    if (status) {
        filtered = filtered.filter(l => l.status === status);
    }
    
    // Agent filter
    if (agentId) {
        filtered = filtered.filter(l => l.agent_id === agentId);
    }
    
    // Dealer filter
    if (dealerId) {
        filtered = filtered.filter(l => l.dealer_id === dealerId);
    }
    
    // Update filter count display
    const countEl = document.getElementById('leadFilterCount');
    if (countEl) {
        if (search || status || agentId || dealerId) {
            countEl.textContent = `Showing ${filtered.length} of ${leads.length} leads`;
        } else {
            countEl.textContent = `Showing ${leads.length} leads (last 500)`;
        }
    }
    
    renderLeadsTable(filtered);
}

function clearLeadFilters() {
    const searchEl = document.getElementById('leadSearchFilter');
    const statusEl = document.getElementById('leadStatusFilter');
    const agentEl = document.getElementById('leadAgentFilter');
    const dealerEl = document.getElementById('leadDealerFilter');
    
    if (searchEl) searchEl.value = '';
    if (statusEl) statusEl.value = '';
    if (agentEl) agentEl.value = '';
    if (dealerEl) dealerEl.value = '';
    
    filterLeads();
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
    if (!order) return;
    
    // Get the lead data for this order
    const lead = leads.find(l => l.id === order.lead_id) || order.lead || {};
    
    document.getElementById('editOrderLeadId').value = lead.id || '';
    document.getElementById('editOrderNumber').value = lead.order_number || order.order_number || '';
    document.getElementById('editOrderStatus').value = lead.order_status || order.status || 'pending';
    document.getElementById('editOrderClientName').value = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '';
    document.getElementById('editOrderIdNumber').value = lead.id_number || '';
    document.getElementById('editOrderPassport').value = lead.passport_number || '';
    document.getElementById('editOrderEmail').value = lead.email || '';
    document.getElementById('editOrderPhone').value = lead.phone || lead.cell_number || '';
    document.getElementById('editOrderAddress').value = lead.address || '';
    document.getElementById('editOrderCommission').value = lead.commission_amount || order.commission_amount || 200;
    document.getElementById('editOrderCommissionStatus').value = lead.commission_status || order.commission_status || 'pending';
    document.getElementById('editOrderNotes').value = order.notes || '';
    
    // Populate agent select
    const agentSelect = document.getElementById('editOrderAgent');
    agentSelect.innerHTML = '<option value="">Select Agent</option>';
    agents.forEach(a => {
        agentSelect.innerHTML += `<option value="${a.id}" ${(lead.agent_id || order.agent_id) === a.id ? 'selected' : ''}>${a.full_name}</option>`;
    });
    
    // Populate dealer select
    const dealerSelect = document.getElementById('editOrderDealer');
    dealerSelect.innerHTML = '<option value="">Select Dealer</option>';
    dealers.forEach(d => {
        dealerSelect.innerHTML += `<option value="${d.id}" ${lead.dealer_id === d.id ? 'selected' : ''}>${d.name}</option>`;
    });
    
    openModal('viewOrderModal');
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
    if (!pkg) return;
    
    // Populate edit form
    document.getElementById('editPackageId').value = pkg.id;
    document.getElementById('editPackageName').value = pkg.name || '';
    document.getElementById('editPackageSpeed').value = pkg.speed || '';
    document.getElementById('editPackagePrice').value = pkg.price || '';
    document.getElementById('editPackageDescription').value = pkg.description || '';
    document.getElementById('editPackageDataCap').value = pkg.data_cap || '';
    document.getElementById('editPackageCommission').value = pkg.commission_amount || 200;
    
    openModal('editPackageModal');
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
        if (lead) {
            lead.status = newStatus;
            if (newStatus === 'converted') {
                lead.commission_status = 'pending';
            }
        }
        
        // Re-render the current filtered view without resetting filters
        filterLeads();
        
    } catch (error) {
        console.error('Error updating lead status:', error);
        alert('Error updating status: ' + error.message);
    }
}

// Edit Lead (opens view modal which allows editing)
function editLead(leadId) {
    viewLeadDetails(leadId);
}

// Delete Lead
async function deleteLead(leadId) {
    if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .delete()
            .eq('id', leadId);
        
        if (error) throw error;
        
        await loadLeads();
        alert('Lead deleted successfully.');
    } catch (error) {
        console.error('Error deleting lead:', error);
        alert('Error deleting lead: ' + error.message);
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
                    <label class="${labelClass}">Service ID</label>
                    <input type="text" name="service_id" value="${lead.service_id || ''}" class="${inputClass}">
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
                        <input type="text" name="id_number" maxlength="13" value="${lead.id_number || ''}" class="${inputClass}" placeholder="13-digit SA ID">
                    </div>
                    <div>
                        <label class="${labelClass}">Passport Number</label>
                        <input type="text" name="passport_number" value="${lead.passport_number || ''}" class="${inputClass}" placeholder="Passport">
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
                            <label class="${labelClass}">Account Number</label>
                            <input type="text" name="account_number" value="${lead.account_number || ''}" class="${inputClass}">
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
    
    // Validate SA ID number
    const idNumber = formData.get('id_number');
    const idValidation = validateSAID(idNumber);
    if (!idValidation.valid) {
        alert('Invalid ID Number: ' + idValidation.message);
        return;
    }
    
    // Helper to convert empty strings to null (important for UUID fields)
    const toNull = (val) => val && val.trim() !== '' ? val : null;
    const toUUID = (val) => val && val.trim() !== '' && val.length > 30 ? val : null; // UUID is 36 chars
    
    const updateData = {
        lead_id: toNull(formData.get('lead_id')),
        status: formData.get('status'),
        service_id: toNull(formData.get('service_id')),
        full_name: toNull(formData.get('full_name')),
        first_name: toNull(formData.get('first_name')),
        last_name: toNull(formData.get('last_name')),
        id_number: toNull(formData.get('id_number')),
        passport_number: toNull(formData.get('passport_number')),
        email: toNull(formData.get('email')),
        phone: toNull(formData.get('phone')),
        address: toNull(formData.get('address')),
        secondary_contact_name: toNull(formData.get('secondary_contact_name')),
        secondary_contact_number: toNull(formData.get('secondary_contact_number')),
        secondary_contact_email: toNull(formData.get('secondary_contact_email')),
        agent_id: toUUID(formData.get('agent_id')),
        dealer_id: toUUID(formData.get('dealer_id')),
        package_id: toUUID(formData.get('package_id')),
        account_number: toNull(formData.get('account_number')),
        order_number: toNull(formData.get('order_number')),
        order_status: toNull(formData.get('order_status')),
        order_date: toNull(formData.get('order_date')),
        notes: toNull(formData.get('notes'))
    };
    
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update(updateData)
            .eq('id', editingLeadId);
        
        if (error) throw error;
        
        alert('Lead updated successfully!');
        closeModal('viewLeadModal');
        
        // Update the lead in the local array instead of reloading everything
        const leadIndex = leads.findIndex(l => l.id === editingLeadId);
        if (leadIndex !== -1) {
            leads[leadIndex] = { ...leads[leadIndex], ...updateData };
        }
        
        // Re-render the current filtered view without resetting filters
        filterLeads();
        
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
        // Get all converted leads for revenue calculation
        const { data: allLeads } = await window.supabaseClient
            .from('leads')
            .select('commission_amount, commission_status, order_status, status')
            .eq('status', 'converted');
        
        const FIBRE_COMMISSION = 200;
        let confirmedRevenue = 0, pendingRevenue = 0, rejectedRevenue = 0;
        let confirmedCount = 0, pendingCount = 0, rejectedCount = 0;
        
        (allLeads || []).forEach(lead => {
            const commission = lead.commission_amount || FIBRE_COMMISSION;
            const isConfirmed = lead.commission_status === 'confirmed' || 
                               lead.commission_status === 'paid' || 
                               lead.order_status === 'completed';
            
            if (isConfirmed) {
                confirmedRevenue += commission;
                confirmedCount++;
            } else if (lead.commission_status === 'rejected' || lead.order_status === 'cancelled') {
                rejectedRevenue += commission;
                rejectedCount++;
            } else {
                pendingRevenue += commission;
                pendingCount++;
            }
        });
        
        document.getElementById('confirmedRevenue').textContent = `R${confirmedRevenue.toLocaleString()}`;
        document.getElementById('pendingRevenue').textContent = `R${pendingRevenue.toLocaleString()}`;
        document.getElementById('confirmedCount').textContent = confirmedCount;
        document.getElementById('pendingCount').textContent = pendingCount;
        
        const rejectedEl = document.getElementById('rejectedRevenue');
        if (rejectedEl) rejectedEl.textContent = `R${rejectedRevenue.toLocaleString()}`;
        const rejectedCountEl = document.getElementById('rejectedCount');
        if (rejectedCountEl) rejectedCountEl.textContent = rejectedCount;
        
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
    
    grid.innerHTML = dealers.map(dealer => {
        // Get agents assigned to this dealer
        const dealerAgents = agents.filter(a => a.dealer_id === dealer.id);
        const agentCount = dealerAgents.length;
        const agentNames = dealerAgents.slice(0, 3).map(a => a.full_name).join(', ');
        const moreAgents = agentCount > 3 ? ` +${agentCount - 3} more` : '';
        
        return `
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
            <div class="mt-3 p-2 bg-blue-50 rounded-lg">
                <p class="text-xs text-blue-600 font-medium mb-1">Agents (${agentCount})</p>
                <p class="text-xs text-gray-600">${agentNames || 'No agents assigned'}${moreAgents}</p>
            </div>
            <div class="mt-4 pt-4 border-t flex gap-2">
                <button onclick="viewDealerDetails('${dealer.id}')" class="text-sm text-blue-600 hover:text-blue-800">Edit</button>
                <button onclick="toggleDealerStatus('${dealer.id}', ${!dealer.is_active})" class="text-sm ${dealer.is_active ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'}">
                    ${dealer.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onclick="deleteDealer('${dealer.id}')" class="text-sm text-red-600 hover:text-red-800">Delete</button>
            </div>
        </div>
    `}).join('');
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
        'service id': 'service_id',
        'service_id': 'service_id',
        'account number': 'account_number',
        'account_number': 'account_number',
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
    
    // Cache for agents and dealers to avoid repeated lookups
    const agentCache = {};
    const pendingAgentCache = {};
    const dealerCache = {};
    
    for (let i = 0; i < importData.length; i++) {
        const row = importData[i];
        const progress = Math.round(((i + 1) / importData.length) * 100);
        progressBar.style.width = progress + '%';
        progressText.textContent = progress + '%';
        
        try {
            // Log row data for debugging
            console.log('Processing row', i, '- dealer_name:', row.dealer_name, 'agent_name:', row.agent_name);
            
            // Find or CREATE dealer (with caching)
            let dealerId = null;
            if (row.dealer_name) {
                const dealerKey = row.dealer_name.toLowerCase().trim();
                
                if (dealerCache[dealerKey]) {
                    dealerId = dealerCache[dealerKey];
                } else {
                    const { data: dealerData } = await window.supabaseClient
                        .from('dealers')
                        .select('id')
                        .ilike('name', row.dealer_name)
                        .limit(1);
                    
                    if (dealerData && dealerData.length > 0) {
                        dealerId = dealerData[0].id;
                        dealerCache[dealerKey] = dealerId;
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
                            dealerCache[dealerKey] = dealerId;
                            importStats.newDealers.push(row.dealer_name);
                        }
                    }
                }
            }
            
            // Find agent by name, or add to pending_agents
            let agentId = null;
            const agentName = row.agent_name || '';
            
            if (agentName) {
                // Check cache first
                const cacheKey = agentName.toLowerCase().trim();
                if (agentCache[cacheKey]) {
                    agentId = agentCache[cacheKey];
                } else {
                    // Try to find existing agent by name
                    const { data: agentData } = await window.supabaseClient
                        .from('profiles')
                        .select('id, full_name')
                        .ilike('full_name', agentName)
                        .limit(1);
                    
                    if (agentData && agentData.length > 0) {
                        agentId = agentData[0].id;
                        agentCache[cacheKey] = agentId;
                        console.log('Found existing agent:', agentName, '-> ID:', agentId);
                    } else if (!pendingAgentCache[cacheKey]) {
                        // Add to pending_agents (not profiles - profiles requires auth.users FK)
                        const agentEmail = `${agentName.toLowerCase().replace(/\s+/g, '.')}@pending.dealer`;
                        
                        const { error: pendingError } = await window.supabaseClient
                            .from('pending_agents')
                            .insert({
                                email: agentEmail,
                                full_name: agentName,
                                dealer_id: dealerId,
                                status: 'pending'
                            });
                        
                        if (!pendingError) {
                            pendingAgentCache[cacheKey] = true;
                            importStats.newAgents.push(agentName);
                            console.log('Added pending agent:', agentName, 'for dealer:', dealerId);
                        }
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
            
            console.log('Checking for duplicate lead:', leadData);
            
            // Check for existing lead by lead_id to prevent duplicates
            if (row.lead_id) {
                const { data: existingLead } = await window.supabaseClient
                    .from('leads')
                    .select('id, status')
                    .eq('lead_id', row.lead_id)
                    .limit(1);
                
                if (existingLead && existingLead.length > 0) {
                    console.log('Skipping duplicate lead_id:', row.lead_id, 'status:', existingLead[0].status);
                    importStats.duplicates++;
                    continue;
                }
            }
            
            // Also check by email + phone combination if no lead_id
            if (!row.lead_id && (row.email || row.phone)) {
                let duplicateQuery = window.supabaseClient
                    .from('leads')
                    .select('id, status');
                
                if (row.email) {
                    duplicateQuery = duplicateQuery.eq('email', row.email);
                }
                if (row.phone) {
                    duplicateQuery = duplicateQuery.eq('phone', row.phone);
                }
                
                const { data: existingByContact } = await duplicateQuery.limit(1);
                
                if (existingByContact && existingByContact.length > 0) {
                    console.log('Skipping duplicate by contact - email:', row.email, 'phone:', row.phone);
                    importStats.duplicates++;
                    continue;
                }
            }
            
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
    const headers = 'LEAD ID,AGENT,DEALER,DEAL,SERVICE ID,ACCOUNT NUMBER,STATUS,REGION,PRIMARY CONTACT NAME,PRIMARY CONTACT NUMBER,PRIMARY CONTACT EMAIL,SECONDARY CONTACT NAME,SECONDARY CONTACT NUMBER,SECONDARY CONTACT SECONDARY,SECONDARY CONTACT EMAIL,ORDER NUMBER,ORDER STATUS,ORDER DATE,DATE CAPTURED,LAST UPDATED,CAPTURED BY,SECONDARY CONTACT';
    const row1 = 'L12345,John Smith,Mailstech,20/10Mbps Uncapped Fibre,SVC001,ACC12345,new,Gauteng,Jane Doe,0821234567,jane@example.com,Bob Smith,0829876543,,bob@example.com,ORD001,pending,2024-01-15,2024-01-14,2024-01-15,agent@example.com,';
    const row2 = 'L12346,Sarah Jones,Betty Holdings,50/25 Mbps Uncapped Fibre,SVC002,ACC67890,contacted,Limpopo,Mike Wilson,0831112222,mike@example.com,,,,,,,2024-01-16,2024-01-16,sales@dealer.com,';
    const template = `${headers}\n${row1}\n${row2}`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

// ==========================================
// Admin Settings & Privileges Functions
// ==========================================

async function loadPrivilegesTable() {
    const table = document.getElementById('privilegesTable');
    if (!table) return;
    
    const allUsers = [...agents];
    
    // Add admins from profiles if not already in agents
    try {
        const { data: admins } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .in('role', ['admin', 'openserve', 'dealer'])
            .range(0, 100);
        
        if (admins) {
            admins.forEach(admin => {
                if (!allUsers.find(u => u.id === admin.id)) {
                    allUsers.push(admin);
                }
            });
        }
    } catch (e) {
        console.error('Error loading admins:', e);
    }
    
    if (allUsers.length === 0) {
        table.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-500">No users found</td></tr>';
        return;
    }
    
    const roleColors = {
        'admin': 'bg-purple-100 text-purple-700',
        'agent': 'bg-blue-100 text-blue-700',
        'dealer': 'bg-emerald-100 text-emerald-700',
        'openserve': 'bg-green-100 text-green-700',
        'external_agent': 'bg-orange-100 text-orange-700'
    };
    
    const rolePrivileges = {
        'admin': ['All Access', 'Manage Users', 'Edit Settings', 'View Reports', 'Export Data'],
        'agent': ['View Leads', 'Edit Own Leads', 'Convert Clients'],
        'dealer': ['View Team Leads', 'View Reports'],
        'openserve': ['View Orders', 'Update Status', 'Return Items'],
        'external_agent': ['View Assigned', 'Update Status']
    };
    
    table.innerHTML = allUsers.slice(0, 20).map(user => {
        const role = user.role || 'agent';
        const privileges = rolePrivileges[role] || [];
        const avatarUrl = getAgentAvatar(user);
        
        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="py-3 px-4">
                    <div class="flex items-center gap-3">
                        <img src="${avatarUrl}" class="w-8 h-8 rounded-full">
                        <div>
                            <p class="font-medium text-gray-800">${user.full_name || 'Unknown'}</p>
                            <p class="text-xs text-gray-500">${user.email || ''}</p>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${roleColors[role] || 'bg-gray-100'}">${role}</span>
                </td>
                <td class="py-3 px-4">
                    <div class="flex flex-wrap gap-1">
                        ${privileges.slice(0, 3).map(p => `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">${p}</span>`).join('')}
                        ${privileges.length > 3 ? `<span class="text-xs text-gray-400">+${privileges.length - 3}</span>` : ''}
                    </div>
                </td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${user.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                        ${user.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <button onclick="editUserPrivileges('${user.id}')" class="text-blue-600 hover:text-blue-800 text-sm mr-2">Edit</button>
                    <button onclick="toggleUserActive('${user.id}', ${user.is_active === false})" class="text-orange-600 hover:text-orange-800 text-sm">
                        ${user.is_active !== false ? 'Disable' : 'Enable'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function editUserPrivileges(userId) {
    const user = agents.find(a => a.id === userId);
    if (!user) {
        alert('User not found');
        return;
    }
    
    const newRole = prompt(`Edit role for ${user.full_name}\n\nCurrent role: ${user.role}\n\nAvailable roles:\n- admin\n- agent\n- dealer\n- openserve\n- external_agent\n\nEnter new role:`, user.role);
    
    if (newRole && ['admin', 'agent', 'dealer', 'openserve', 'external_agent'].includes(newRole)) {
        try {
            const { error } = await window.supabaseClient
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);
            
            if (error) throw error;
            alert('Role updated successfully');
            await loadAgents();
            loadPrivilegesTable();
        } catch (error) {
            alert('Error updating role: ' + error.message);
        }
    } else if (newRole) {
        alert('Invalid role. Please enter one of: admin, agent, dealer, openserve, external_agent');
    }
}

async function toggleUserActive(userId, activate) {
    try {
        const { error } = await window.supabaseClient
            .from('profiles')
            .update({ is_active: activate })
            .eq('id', userId);
        
        if (error) throw error;
        alert(activate ? 'User activated' : 'User deactivated');
        await loadAgents();
        loadPrivilegesTable();
    } catch (error) {
        alert('Error updating user: ' + error.message);
    }
}

// Data Export Functions
async function exportData(type) {
    try {
        let data, filename, headers;
        
        switch (type) {
            case 'leads':
                data = leads;
                filename = 'leads_export';
                headers = ['ID', 'Name', 'Email', 'Phone', 'Status', 'Order Status', 'Agent', 'Dealer', 'Package', 'Commission', 'Created'];
                break;
            case 'agents':
                data = agents;
                filename = 'agents_export';
                headers = ['ID', 'Name', 'Email', 'Phone', 'Role', 'Dealer', 'Active', 'Created'];
                break;
            case 'dealers':
                data = dealers;
                filename = 'dealers_export';
                headers = ['ID', 'Name', 'Code', 'Email', 'Phone', 'Active', 'Created'];
                break;
            case 'all':
                await exportCompleteBackup();
                return;
        }
        
        const rows = data.map(item => {
            switch (type) {
                case 'leads':
                    return [
                        item.id,
                        item.full_name || `${item.first_name || ''} ${item.last_name || ''}`,
                        item.email || '',
                        item.phone || '',
                        item.status || '',
                        item.order_status || '',
                        item.agent?.full_name || '',
                        item.dealer?.name || '',
                        item.package?.name || '',
                        item.commission_amount || 0,
                        item.created_at ? new Date(item.created_at).toLocaleDateString() : ''
                    ];
                case 'agents':
                    return [
                        item.id,
                        item.full_name || '',
                        item.email || '',
                        item.phone || '',
                        item.role || 'agent',
                        dealers.find(d => d.id === item.dealer_id)?.name || '',
                        item.is_active !== false ? 'Yes' : 'No',
                        item.created_at ? new Date(item.created_at).toLocaleDateString() : ''
                    ];
                case 'dealers':
                    return [
                        item.id,
                        item.name || '',
                        item.code || '',
                        item.contact_email || '',
                        item.contact_phone || '',
                        item.is_active ? 'Yes' : 'No',
                        item.created_at ? new Date(item.created_at).toLocaleDateString() : ''
                    ];
            }
        });
        
        downloadCSV(headers, rows, filename);
        
    } catch (error) {
        console.error('Export error:', error);
        alert('Export failed: ' + error.message);
    }
}

async function exportCompleteBackup() {
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Export leads
    const leadsHeaders = ['ID', 'Name', 'Email', 'Phone', 'Address', 'Status', 'Order Status', 'Commission Status', 'Commission Amount', 'Agent ID', 'Dealer ID', 'Package ID', 'Created'];
    const leadsRows = leads.map(l => [
        l.id, l.full_name || '', l.email || '', l.phone || '', l.address || '',
        l.status || '', l.order_status || '', l.commission_status || '', l.commission_amount || 0,
        l.agent_id || '', l.dealer_id || '', l.package_id || '', l.created_at || ''
    ]);
    downloadCSV(leadsHeaders, leadsRows, `backup_leads_${timestamp}`);
    
    // Export agents
    const agentsHeaders = ['ID', 'Name', 'Email', 'Phone', 'Role', 'Dealer ID', 'Active', 'Approved', 'Created'];
    const agentsRows = agents.map(a => [
        a.id, a.full_name || '', a.email || '', a.phone || '', a.role || '',
        a.dealer_id || '', a.is_active !== false, a.is_approved !== false, a.created_at || ''
    ]);
    downloadCSV(agentsHeaders, agentsRows, `backup_agents_${timestamp}`);
    
    // Export dealers
    const dealersHeaders = ['ID', 'Name', 'Code', 'Email', 'Phone', 'Active', 'Created'];
    const dealersRows = dealers.map(d => [
        d.id, d.name || '', d.code || '', d.contact_email || '', d.contact_phone || '',
        d.is_active, d.created_at || ''
    ]);
    downloadCSV(dealersHeaders, dealersRows, `backup_dealers_${timestamp}`);
    
    alert('Complete backup exported! Check your downloads folder for 3 CSV files.');
}

function downloadCSV(headers, rows, filename) {
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function confirmResetStats() {
    if (confirm('Are you sure you want to reset dashboard statistics? This action cannot be undone.')) {
        alert('Statistics reset functionality would clear cached stats. Database records remain intact.');
    }
}

function confirmClearNotifications() {
    if (confirm('Are you sure you want to clear all notifications? This action cannot be undone.')) {
        notifications = [];
        updateNotifications();
        alert('All notifications cleared.');
    }
}

// Load privileges table when settings section is shown
document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver(() => {
        const settingsSection = document.getElementById('section-settings');
        if (settingsSection && !settingsSection.classList.contains('hidden')) {
            loadPrivilegesTable();
        }
        const returnedSection = document.getElementById('section-returned');
        if (returnedSection && !returnedSection.classList.contains('hidden')) {
            loadReturnedItems();
        }
    });
    
    const main = document.querySelector('main');
    if (main) {
        observer.observe(main, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
});

// ==========================================
// Returned Items Functions
// ==========================================

let returnedItems = [];

async function loadReturnedItems() {
    try {
        const { data, error } = await window.supabaseClient
            .from('leads')
            .select(`
                *,
                agent:profiles!leads_agent_id_fkey(id, full_name),
                dealer:dealers(id, name),
                package:packages(id, name)
            `)
            .eq('order_status', 'returned')
            .order('updated_at', { ascending: false })
            .range(0, 500);
        
        if (error) throw error;
        returnedItems = data || [];
        
        updateReturnedStats();
        renderReturnedItemsTable();
        updateReturnedBadge();
        
    } catch (error) {
        console.error('Error loading returned items:', error);
    }
}

function updateReturnedStats() {
    const total = returnedItems.length;
    const pending = returnedItems.filter(r => !r.return_resolved).length;
    const resolved = returnedItems.filter(r => r.return_resolved === 'resolved').length;
    const rejected = returnedItems.filter(r => r.return_resolved === 'rejected').length;
    
    document.getElementById('totalReturned').textContent = total;
    document.getElementById('pendingReturned').textContent = pending;
    document.getElementById('resolvedReturned').textContent = resolved;
    document.getElementById('rejectedReturned').textContent = rejected;
}

function updateReturnedBadge() {
    const badge = document.getElementById('returnedItemsBadge');
    const pending = returnedItems.filter(r => !r.return_resolved).length;
    
    if (pending > 0) {
        badge.textContent = pending;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function renderReturnedItemsTable(filtered = null) {
    const table = document.getElementById('returnedItemsTable');
    if (!table) return;
    
    const items = filtered || returnedItems;
    
    if (items.length === 0) {
        table.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-gray-500">No returned items found</td></tr>';
        return;
    }
    
    const statusColors = {
        'pending': 'bg-yellow-100 text-yellow-700',
        'acknowledged': 'bg-blue-100 text-blue-700',
        'resolved': 'bg-green-100 text-green-700',
        'rejected': 'bg-red-100 text-red-700'
    };
    
    table.innerHTML = items.map(item => {
        const clientName = item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || '-';
        const status = item.return_resolved || 'pending';
        const direction = item.return_direction || 'to_admin';
        const directionLabel = direction === 'to_openserve' ? '→ Openserve' : direction === 'to_agent' ? '→ Agent' : '→ Admin';
        const directionColor = direction === 'to_openserve' ? 'text-purple-600' : direction === 'to_agent' ? 'text-orange-600' : 'text-blue-600';
        
        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="py-3 px-4">
                    <div class="text-sm font-medium text-gray-800">${item.order_number || '#' + (item.id?.slice(-8) || '-')}</div>
                    <div class="text-xs text-gray-400">Service: ${item.service_id || '-'}</div>
                </td>
                <td class="py-3 px-4 text-sm text-gray-600">${clientName}</td>
                <td class="py-3 px-4 text-sm text-gray-600">${item.agent?.full_name || 'Openserve'}</td>
                <td class="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">${item.return_reason || '-'}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}">${status}</span>
                    <span class="text-xs ${directionColor} ml-1">${directionLabel}</span>
                </td>
                <td class="py-3 px-4 text-sm text-gray-500">${item.returned_at ? new Date(item.returned_at).toLocaleDateString() : new Date(item.updated_at).toLocaleDateString()}</td>
                <td class="py-3 px-4">
                    <div class="flex flex-wrap gap-1">
                        <button onclick="resolveReturnedItem('${item.id}')" class="text-green-600 hover:text-green-800 text-xs">Resolve</button>
                        <button onclick="returnToAgent('${item.id}')" class="text-orange-600 hover:text-orange-800 text-xs">→Agent</button>
                        <button onclick="forwardToOpenserve('${item.id}')" class="text-purple-600 hover:text-purple-800 text-xs">→Openserve</button>
                        <button onclick="viewReturnedDetails('${item.id}')" class="text-blue-600 hover:text-blue-800 text-xs">View</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterReturnedItems() {
    const status = document.getElementById('returnedStatusFilter').value;
    
    if (!status) {
        renderReturnedItemsTable();
        return;
    }
    
    const filtered = returnedItems.filter(item => {
        const itemStatus = item.return_resolved || 'pending';
        return itemStatus === status;
    });
    
    renderReturnedItemsTable(filtered);
}

async function resolveReturnedItem(itemId) {
    const notes = prompt('Enter resolution notes:');
    if (notes === null) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update({
                return_resolved: 'resolved',
                resolution_notes: notes,
                order_status: 'pending',
                updated_at: new Date().toISOString()
            })
            .eq('id', itemId);
        
        if (error) throw error;
        alert('Item resolved successfully');
        await loadReturnedItems();
        
    } catch (error) {
        alert('Error resolving item: ' + error.message);
    }
}

async function rejectReturnedItem(itemId) {
    const notes = prompt('Enter rejection reason:');
    if (notes === null) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update({
                return_resolved: 'rejected',
                resolution_notes: notes,
                order_status: 'cancelled',
                updated_at: new Date().toISOString()
            })
            .eq('id', itemId);
        
        if (error) throw error;
        alert('Item rejected');
        await loadReturnedItems();
        
    } catch (error) {
        alert('Error rejecting item: ' + error.message);
    }
}

function viewReturnedDetails(itemId) {
    const item = returnedItems.find(r => r.id === itemId);
    if (!item) return;
    
    const clientName = item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim();
    alert(`Returned Item Details:
    
Order ID: #${item.id?.slice(-8)}
Client: ${clientName}
Phone: ${item.phone || '-'}
Email: ${item.email || '-'}
Package: ${item.package?.name || '-'}
Agent: ${item.agent?.full_name || '-'}

Return Reason: ${item.return_reason || 'Not specified'}
Returned: ${item.returned_at ? new Date(item.returned_at).toLocaleString() : '-'}
Status: ${item.return_resolved || 'pending'}
Resolution Notes: ${item.resolution_notes || '-'}`);
}

function exportReturnedItems() {
    const headers = ['Order ID', 'Client', 'Phone', 'Email', 'Agent', 'Return Reason', 'Status', 'Returned Date', 'Resolution Notes'];
    const rows = returnedItems.map(item => [
        item.id?.slice(-8) || '',
        item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
        item.phone || '',
        item.email || '',
        item.agent?.full_name || '',
        item.return_reason || '',
        item.return_resolved || 'pending',
        item.returned_at ? new Date(item.returned_at).toLocaleDateString() : '',
        item.resolution_notes || ''
    ]);
    
    downloadCSV(headers, rows, 'returned_items_export');
}

// Return to Openserve - Admin sends item to Openserve for completion
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
        
        alert('Item returned to Openserve successfully');
        await Promise.all([loadLeads(), loadOrders(), loadReturnedItems()]);
    } catch (error) {
        alert('Error returning to Openserve: ' + error.message);
    }
}

// Return to Agent - Admin sends item back to agent for fixes
async function returnToAgent(leadId, type = 'lead') {
    const reason = prompt('Enter reason for returning to agent:');
    if (!reason) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update({
                order_status: 'returned',
                return_reason: reason,
                return_direction: 'to_agent',
                returned_by: currentUser.id,
                returned_at: new Date().toISOString(),
                return_resolved: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', leadId);
        
        if (error) throw error;
        
        alert('Item returned to agent successfully');
        await Promise.all([loadLeads(), loadOrders(), loadReturnedItems()]);
    } catch (error) {
        alert('Error returning to agent: ' + error.message);
    }
}

// Forward to Openserve - Escalate from admin to Openserve
async function forwardToOpenserve(leadId) {
    const notes = prompt('Enter notes for Openserve:');
    if (notes === null) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update({
                order_status: 'processing',
                return_direction: 'to_openserve',
                resolution_notes: notes,
                return_resolved: 'forwarded',
                updated_at: new Date().toISOString()
            })
            .eq('id', leadId);
        
        if (error) throw error;
        
        alert('Item forwarded to Openserve');
        await loadReturnedItems();
    } catch (error) {
        alert('Error forwarding: ' + error.message);
    }
}
