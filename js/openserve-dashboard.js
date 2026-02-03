// Openserve Dashboard JavaScript
let currentUser = null;
let orders = [];
let returnedItems = [];

document.addEventListener('DOMContentLoaded', async () => {
    await initSupabase();
    await checkAuth();
    await loadDashboardData();
    setupEventListeners();
});

async function checkAuth() {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    if (!profile || profile.role !== 'openserve') {
        alert('Access denied. Openserve users only.');
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = { ...user, ...profile };
    updateUserDisplay();
}

function updateUserDisplay() {
    const nameEl = document.getElementById('userName');
    const initialsEl = document.getElementById('userInitials');
    
    if (nameEl && currentUser.full_name) {
        nameEl.textContent = currentUser.full_name;
    }
    
    if (initialsEl && currentUser.full_name) {
        const names = currentUser.full_name.split(' ');
        initialsEl.textContent = names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
}

async function loadDashboardData() {
    try {
        // Load orders with converted status (ready for installation)
        const { data: ordersData, error: ordersError } = await window.supabaseClient
            .from('leads')
            .select(`
                *,
                agent:profiles!leads_agent_id_fkey(id, full_name),
                dealer:dealers(id, name),
                package:packages(id, name, price)
            `)
            .in('status', ['converted'])
            .order('created_at', { ascending: false })
            .range(0, 9999);
        
        if (ordersError) throw ordersError;
        orders = ordersData || [];
        
        // Load returned items
        const { data: returnedData } = await window.supabaseClient
            .from('leads')
            .select(`
                *,
                agent:profiles!leads_agent_id_fkey(id, full_name),
                package:packages(id, name)
            `)
            .eq('order_status', 'returned')
            .order('updated_at', { ascending: false })
            .range(0, 9999);
        
        returnedItems = returnedData || [];
        
        updateStats();
        renderRecentOrders();
        renderOrdersTable();
        renderReturnedTable();
        renderScheduleTable();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateStats() {
    const pending = orders.filter(o => o.order_status === 'pending' || !o.order_status).length;
    const scheduled = orders.filter(o => o.order_status === 'scheduled').length;
    const completed = orders.filter(o => o.order_status === 'completed').length;
    
    document.getElementById('totalOrders').textContent = orders.length;
    document.getElementById('pendingOrders').textContent = pending;
    document.getElementById('scheduledOrders').textContent = scheduled;
    document.getElementById('completedOrders').textContent = completed;
    
    // Update returned badge
    const badge = document.getElementById('returnedBadge');
    if (returnedItems.length > 0) {
        badge.textContent = returnedItems.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function renderRecentOrders() {
    const table = document.getElementById('recentOrdersTable');
    const recent = orders.slice(0, 10);
    
    if (recent.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-gray-500">No orders found</td></tr>';
        return;
    }
    
    table.innerHTML = recent.map(order => {
        const clientName = order.full_name || `${order.first_name || ''} ${order.last_name || ''}`.trim() || '-';
        const status = order.order_status || 'pending';
        return `
            <tr class="table-row border-b">
                <td class="py-3 px-6 text-sm font-medium text-gray-800">#${order.id?.slice(-8) || '-'}</td>
                <td class="py-3 px-6 text-sm text-gray-600">${clientName}</td>
                <td class="py-3 px-6 text-sm text-gray-600">${order.address || '-'}</td>
                <td class="py-3 px-6 text-sm text-gray-600">${order.package?.name || '-'}</td>
                <td class="py-3 px-6"><span class="px-2 py-1 rounded-full text-xs font-medium status-${status}">${status}</span></td>
                <td class="py-3 px-6">
                    <button onclick="openUpdateModal('${order.id}')" class="text-sm text-emerald-600 hover:text-emerald-800">Update</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderOrdersTable(filteredOrders = null) {
    const table = document.getElementById('ordersTable');
    const displayOrders = filteredOrders || orders;
    
    document.getElementById('orderCount').textContent = `Showing ${displayOrders.length} orders`;
    
    if (displayOrders.length === 0) {
        table.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-gray-500">No orders found</td></tr>';
        return;
    }
    
    table.innerHTML = displayOrders.map(order => {
        const clientName = order.full_name || `${order.first_name || ''} ${order.last_name || ''}`.trim() || '-';
        const status = order.order_status || 'pending';
        return `
            <tr class="table-row border-b">
                <td class="py-3 px-6">
                    <div class="text-sm font-medium text-gray-800">${order.order_number || '-'}</div>
                    <div class="text-xs text-gray-400">Service: ${order.service_id || '-'}</div>
                    <div class="text-xs text-gray-400">Lead: ${order.id?.slice(0, 8) || '-'}</div>
                </td>
                <td class="py-3 px-6 text-sm text-gray-600">${clientName}</td>
                <td class="py-3 px-6 text-sm text-gray-600">${order.phone || order.email || '-'}</td>
                <td class="py-3 px-6 text-sm text-gray-600 max-w-xs truncate">${order.address || '-'}</td>
                <td class="py-3 px-6 text-sm text-gray-600">${order.package?.name || '-'}</td>
                <td class="py-3 px-6"><span class="px-2 py-1 rounded-full text-xs font-medium status-${status}">${status}</span></td>
                <td class="py-3 px-6 text-sm text-gray-500">${order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}</td>
                <td class="py-3 px-6">
                    <div class="flex flex-wrap gap-1">
                        <button onclick="openUpdateModal('${order.id}')" class="text-xs text-emerald-600 hover:text-emerald-800">Update</button>
                        <button onclick="returnToAdmin('${order.id}')" class="text-xs text-orange-600 hover:text-orange-800">→Admin</button>
                        <button onclick="returnToAgent('${order.id}')" class="text-xs text-purple-600 hover:text-purple-800">→Agent</button>
                        <button onclick="viewOrderDetails('${order.id}')" class="text-xs text-blue-600 hover:text-blue-800">View</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderReturnedTable() {
    const table = document.getElementById('returnedTable');
    
    if (returnedItems.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-gray-500">No returned items</td></tr>';
        return;
    }
    
    table.innerHTML = returnedItems.map(item => {
        const clientName = item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || '-';
        return `
            <tr class="table-row border-b">
                <td class="py-3 px-6">
                    <div class="text-sm font-medium text-gray-800">${item.order_number || '-'}</div>
                    <div class="text-xs text-gray-400">Service: ${item.service_id || '-'}</div>
                </td>
                <td class="py-3 px-6 text-sm text-gray-600">${clientName}</td>
                <td class="py-3 px-6 text-sm text-gray-600">${item.return_reason || '-'}</td>
                <td class="py-3 px-6 text-sm text-gray-600">${item.agent?.full_name || '-'}</td>
                <td class="py-3 px-6 text-sm text-gray-500">${item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '-'}</td>
                <td class="py-3 px-6">
                    <button onclick="openUpdateModal('${item.id}')" class="text-sm text-emerald-600 hover:text-emerald-800">Reschedule</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderScheduleTable() {
    const table = document.getElementById('scheduleTable');
    const scheduled = orders.filter(o => o.order_status === 'scheduled' && o.scheduled_date);
    
    if (scheduled.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-gray-500">No scheduled installations</td></tr>';
        return;
    }
    
    // Sort by scheduled date
    scheduled.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
    
    table.innerHTML = scheduled.map(order => {
        const clientName = order.full_name || `${order.first_name || ''} ${order.last_name || ''}`.trim() || '-';
        const schedDate = new Date(order.scheduled_date);
        return `
            <tr class="table-row border-b">
                <td class="py-3 px-6 text-sm text-gray-600">${schedDate.toLocaleDateString()}</td>
                <td class="py-3 px-6 text-sm text-gray-600">${schedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td class="py-3 px-6 text-sm font-medium text-gray-800">#${order.id?.slice(-8) || '-'}</td>
                <td class="py-3 px-6 text-sm text-gray-600">${clientName}</td>
                <td class="py-3 px-6 text-sm text-gray-600 max-w-xs truncate">${order.address || '-'}</td>
                <td class="py-3 px-6">
                    <button onclick="openUpdateModal('${order.id}')" class="text-sm text-emerald-600 hover:text-emerald-800 mr-2">Update</button>
                    <button onclick="markInProgress('${order.id}')" class="text-sm text-blue-600 hover:text-blue-800">Start</button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterOrders() {
    const status = document.getElementById('orderStatusFilter').value;
    if (!status) {
        renderOrdersTable();
        return;
    }
    const filtered = orders.filter(o => (o.order_status || 'pending') === status);
    renderOrdersTable(filtered);
}

function openUpdateModal(orderId) {
    document.getElementById('updateOrderId').value = orderId;
    document.getElementById('newOrderStatus').value = 'pending';
    document.getElementById('returnReason').value = '';
    document.getElementById('scheduleDate').value = '';
    document.getElementById('statusNotes').value = '';
    document.getElementById('returnReasonDiv').classList.add('hidden');
    document.getElementById('scheduleDateDiv').classList.add('hidden');
    document.getElementById('updateStatusModal').classList.add('active');
}

function setupEventListeners() {
    // Show/hide return reason and schedule date based on status
    document.getElementById('newOrderStatus').addEventListener('change', function() {
        const returnDiv = document.getElementById('returnReasonDiv');
        const scheduleDiv = document.getElementById('scheduleDateDiv');
        
        if (this.value === 'returned') {
            returnDiv.classList.remove('hidden');
            scheduleDiv.classList.add('hidden');
        } else if (this.value === 'scheduled') {
            scheduleDiv.classList.remove('hidden');
            returnDiv.classList.add('hidden');
        } else {
            returnDiv.classList.add('hidden');
            scheduleDiv.classList.add('hidden');
        }
    });
}

async function saveStatusUpdate() {
    const orderId = document.getElementById('updateOrderId').value;
    const newStatus = document.getElementById('newOrderStatus').value;
    const returnReason = document.getElementById('returnReason').value;
    const scheduleDate = document.getElementById('scheduleDate').value;
    const notes = document.getElementById('statusNotes').value;
    
    try {
        const updateData = {
            order_status: newStatus,
            updated_at: new Date().toISOString()
        };
        
        if (newStatus === 'returned' && returnReason) {
            updateData.return_reason = returnReason;
            updateData.return_direction = 'to_admin';
            updateData.returned_by = currentUser.id;
            updateData.returned_at = new Date().toISOString();
            updateData.return_resolved = null;
        }
        
        if (newStatus === 'scheduled' && scheduleDate) {
            updateData.scheduled_date = scheduleDate;
        }
        
        if (notes) {
            updateData.openserve_notes = notes;
        }
        
        const { error } = await window.supabaseClient
            .from('leads')
            .update(updateData)
            .eq('id', orderId);
        
        if (error) throw error;
        
        closeModal('updateStatusModal');
        await loadDashboardData();
        
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status: ' + error.message);
    }
}

async function markInProgress(orderId) {
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update({
                order_status: 'in_progress',
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);
        
        if (error) throw error;
        await loadDashboardData();
        
    } catch (error) {
        console.error('Error marking in progress:', error);
        alert('Failed to update: ' + error.message);
    }
}

function viewOrderDetails(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    const clientName = order.full_name || `${order.first_name || ''} ${order.last_name || ''}`.trim();
    alert(`Order Details:\n\nClient: ${clientName}\nPhone: ${order.phone || '-'}\nEmail: ${order.email || '-'}\nAddress: ${order.address || '-'}\nPackage: ${order.package?.name || '-'}\nStatus: ${order.order_status || 'pending'}\nAgent: ${order.agent?.full_name || '-'}`);
}

function exportOrders() {
    const headers = ['Order ID', 'Client Name', 'Phone', 'Email', 'Address', 'Package', 'Status', 'Date'];
    const rows = orders.map(o => [
        o.id?.slice(-8) || '',
        o.full_name || `${o.first_name || ''} ${o.last_name || ''}`.trim(),
        o.phone || '',
        o.email || '',
        o.address || '',
        o.package?.name || '',
        o.order_status || 'pending',
        o.created_at ? new Date(o.created_at).toLocaleDateString() : ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openserve-orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function showSection(section) {
    // Hide all sections
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden'));
    // Show selected section
    document.getElementById(`section-${section}`).classList.remove('hidden');
    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
        n.classList.remove('text-white');
        n.classList.add('text-white/70');
    });
    event.currentTarget.classList.add('active');
    event.currentTarget.classList.add('text-white');
    event.currentTarget.classList.remove('text-white/70');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Return to Agent - Openserve sends item back to agent for fixes
async function returnToAgent(leadId) {
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
        
        alert('Item returned to agent');
        await loadDashboardData();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Return to Admin - Openserve sends item to admin for review
async function returnToAdmin(leadId) {
    const reason = prompt('Enter reason for returning to admin:');
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
        
        alert('Item returned to admin');
        await loadDashboardData();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

async function logout() {
    await window.supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}
