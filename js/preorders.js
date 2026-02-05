// Preorders Management Functions
let preorders = [];

// Load preorders
async function loadPreorders() {
    try {
        const { data, error } = await window.supabaseClient
            .from('leads')
            .select(`
                *,
                agent:profiles!leads_agent_id_fkey(id, full_name),
                dealer:dealers(id, name),
                package:packages(id, name, price)
            `)
            .eq('is_preorder', true)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        preorders = data || [];
        
        // Update badge
        const badge = document.getElementById('preordersBadge');
        if (badge) {
            if (preorders.length > 0) {
                badge.textContent = preorders.length;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
        
        renderPreordersTable();
        console.log(`Loaded ${preorders.length} preorders`);
    } catch (error) {
        console.error('Error loading preorders:', error);
        alert('Error loading preorders: ' + error.message);
    }
}

// Render preorders table
function renderPreordersTable(filteredPreorders = null) {
    const table = document.getElementById('preordersTable');
    if (!table) return;
    
    const displayPreorders = filteredPreorders || preorders;
    
    if (displayPreorders.length === 0) {
        table.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-gray-500">No preorders found</td></tr>';
        return;
    }
    
    const statusColors = {
        'new': 'bg-blue-100 text-blue-700',
        'contacted': 'bg-purple-100 text-purple-700',
        'qualified': 'bg-yellow-100 text-yellow-700',
        'converted': 'bg-emerald-100 text-emerald-700',
        'lost': 'bg-red-100 text-red-700'
    };
    
    table.innerHTML = displayPreorders.map(lead => {
        const clientName = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '-';
        const contact = lead.email || lead.phone || '-';
        
        return `
            <tr class="table-row border-b hover:bg-gray-50 cursor-pointer" onclick="viewLeadDetails('${lead.id}')">
                <td class="py-3 px-4">
                    <div class="text-sm font-medium text-gray-800">${clientName}</div>
                    ${lead.lead_id ? `<div class="text-xs text-gray-400">Lead ID: ${lead.lead_id}</div>` : ''}
                </td>
                <td class="py-3 px-4 text-sm text-gray-600">${contact}</td>
                <td class="py-3 px-4 text-sm text-gray-600">${lead.package?.name || '-'}</td>
                <td class="py-3 px-4 text-sm text-gray-600">${lead.agent?.full_name || '-'}</td>
                <td class="py-3 px-4 text-sm text-gray-600">${lead.dealer?.name || '-'}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[lead.status] || 'bg-gray-100'}">${lead.status}</span>
                </td>
                <td class="py-3 px-4 text-sm text-gray-500">${lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '-'}</td>
                <td class="py-3 px-4">
                    <button onclick="event.stopPropagation(); removePreorder('${lead.id}')" class="text-red-600 hover:text-red-800 text-sm">
                        Remove
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter preorders
function filterPreorders() {
    const statusFilter = document.getElementById('preorderStatusFilter')?.value || '';
    
    let filtered = preorders;
    
    if (statusFilter) {
        filtered = filtered.filter(p => p.status === statusFilter);
    }
    
    renderPreordersTable(filtered);
}

// Remove preorder flag
async function removePreorder(leadId) {
    if (!confirm('Remove preorder flag from this lead?')) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update({ is_preorder: false })
            .eq('id', leadId);
        
        if (error) throw error;
        
        await loadPreorders();
        await loadLeads(); // Refresh main leads list
        alert('Preorder flag removed successfully');
    } catch (error) {
        console.error('Error removing preorder:', error);
        alert('Error removing preorder: ' + error.message);
    }
}

// Export preorders to CSV
function exportPreorders() {
    if (preorders.length === 0) {
        alert('No preorders to export');
        return;
    }
    
    const headers = ['Lead ID', 'Client Name', 'Email', 'Phone', 'Package', 'Agent', 'Dealer', 'Status', 'Created Date'];
    const rows = preorders.map(p => [
        p.lead_id || '',
        p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        p.email || '',
        p.phone || '',
        p.package?.name || '',
        p.agent?.full_name || '',
        p.dealer?.name || '',
        p.status || '',
        p.created_at ? new Date(p.created_at).toLocaleDateString() : ''
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preorders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert('Preorders exported successfully');
}

// Make functions available globally
window.loadPreorders = loadPreorders;
window.filterPreorders = filterPreorders;
window.removePreorder = removePreorder;
window.exportPreorders = exportPreorders;
