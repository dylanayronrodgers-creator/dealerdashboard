// Agent Dashboard JavaScript
let currentUser = null;
let packages = [];
let myLeads = [];
let myOrders = [];
let returnedItems = [];
let importData = [];

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const auth = await requireAuth('agent');
    if (!auth) return;
    
    currentUser = auth.profile;
    
    // Update UI with user info
    document.getElementById('userName').textContent = currentUser.full_name;
    document.getElementById('userInitials').textContent = getInitials(currentUser.full_name);
    
    // Load initial data
    await Promise.all([
        loadPackages(),
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
        'returned': { title: 'Returned Items', subtitle: 'Items returned by admin for review' },
        'import': { title: 'Import Leads', subtitle: 'Mass import leads from CSV' }
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
            <td class="py-4">
                <span class="status-${lead.status} px-3 py-1 rounded-full text-xs font-medium">${lead.status}</span>
            </td>
            <td class="py-4">
                <div class="flex gap-2">
                    <button onclick="updateLeadStatus('${lead.id}')" class="text-blue-600 hover:text-blue-800 text-sm">Update</button>
                    ${lead.status !== 'converted' ? `<button onclick="openConvertModal('${lead.id}')" class="text-green-600 hover:text-green-800 text-sm">Convert</button>` : ''}
                    <button onclick="sendToAdmin('${lead.id}', 'lead')" class="text-purple-600 hover:text-purple-800 text-sm">Send to Admin</button>
                </div>
            </td>
        </tr>
    `).join('');
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
    
    table.innerHTML = recentLeads.map(lead => `
        <tr class="table-row border-b">
            <td class="py-4">
                <div class="font-medium text-gray-800">${lead.first_name} ${lead.last_name}</div>
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
    `).join('');
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

// View Order
function viewOrder(orderId) {
    const order = myOrders.find(o => o.id === orderId);
    if (order) {
        alert(`Order Details:\n\nOrder ID: #${order.id.slice(0, 8)}\nClient: ${order.lead?.first_name} ${order.lead?.last_name}\nPackage: ${order.package?.name}\nStatus: ${order.status}\nCreated: ${new Date(order.created_at).toLocaleString()}`);
    }
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
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const requiredHeaders = ['first_name', 'last_name', 'email', 'phone', 'address'];
        
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
            alert('Missing required columns: ' + missingHeaders.join(', '));
            return;
        }
        
        importData = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length >= headers.length) {
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
    
    for (let i = 0; i < importData.length; i++) {
        const row = importData[i];
        
        try {
            // Find package by name if provided
            let packageId = null;
            if (row.package_name) {
                const pkg = packages.find(p => p.name.toLowerCase() === row.package_name.toLowerCase());
                if (pkg) packageId = pkg.id;
            }
            
            const { error } = await window.supabaseClient.from('leads').insert({
                first_name: row.first_name,
                last_name: row.last_name,
                email: row.email,
                phone: row.phone,
                address: row.address,
                package_id: packageId,
                agent_id: currentUser.id,
                notes: row.notes || '',
                status: 'new'
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
    
    progress.classList.add('hidden');
    importData = [];
    document.getElementById('csvFileInput').value = '';
    
    await loadMyLeads();
    alert(`Import complete!\n\nSuccessfully imported: ${imported}\nFailed: ${failed}`);
}

function cancelImport() {
    importData = [];
    document.getElementById('importPreview').classList.add('hidden');
    document.getElementById('csvFileInput').value = '';
}

function downloadTemplate() {
    const template = 'first_name,last_name,email,phone,address,package_name,notes\nJohn,Doe,john@example.com,0821234567,123 Main St,Fibre 50Mbps,Interested in fast internet\nJane,Smith,jane@example.com,0829876543,456 Oak Ave,Fibre 100Mbps,Referred by friend';
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}
