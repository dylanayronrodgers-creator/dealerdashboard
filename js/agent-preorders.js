// Agent Preorders Management Functions
let agentPreorders = [];

// Load agent's preorders
async function loadAgentPreorders() {
    try {
        const { data, error } = await window.supabaseClient
            .from('leads')
            .select(`
                *,
                package:packages(id, name, price)
            `)
            .eq('agent_id', currentUser.id)
            .eq('is_preorder', true)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        agentPreorders = data || [];
        
        // Update badge
        const badge = document.getElementById('agentPreordersBadge');
        if (badge) {
            if (agentPreorders.length > 0) {
                badge.textContent = agentPreorders.length;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
        
        renderAgentPreordersTable();
        console.log(`Loaded ${agentPreorders.length} preorders for agent`);
    } catch (error) {
        console.error('Error loading agent preorders:', error);
        alert('Error loading preorders: ' + error.message);
    }
}

// Render agent preorders table
function renderAgentPreordersTable(filteredPreorders = null) {
    const table = document.getElementById('agentPreordersTable');
    if (!table) return;
    
    const displayPreorders = filteredPreorders || agentPreorders;
    
    if (displayPreorders.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-gray-500">No preorders found</td></tr>';
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
            <tr class="table-row border-b hover:bg-gray-50 cursor-pointer" onclick="viewLead('${lead.id}')">
                <td class="py-3 px-4">
                    <div class="text-sm font-medium text-gray-800">${clientName}</div>
                    ${lead.lead_id ? `<div class="text-xs text-gray-400">Lead ID: ${lead.lead_id}</div>` : ''}
                </td>
                <td class="py-3 px-4 text-sm text-gray-600">${contact}</td>
                <td class="py-3 px-4 text-sm text-gray-600">${lead.package?.name || '-'}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[lead.status] || 'bg-gray-100'}">${lead.status}</span>
                </td>
                <td class="py-3 px-4 text-sm text-gray-500">${lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '-'}</td>
                <td class="py-3 px-4">
                    <button onclick="event.stopPropagation(); removeAgentPreorder('${lead.id}')" class="text-red-600 hover:text-red-800 text-sm">
                        Remove
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter agent preorders
function filterAgentPreorders() {
    const statusFilter = document.getElementById('agentPreorderStatusFilter')?.value || '';
    
    let filtered = agentPreorders;
    
    if (statusFilter) {
        filtered = filtered.filter(p => p.status === statusFilter);
    }
    
    renderAgentPreordersTable(filtered);
}

// Remove preorder flag from agent's lead
async function removeAgentPreorder(leadId) {
    if (!confirm('Remove preorder flag from this lead?')) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update({ is_preorder: false })
            .eq('id', leadId);
        
        if (error) throw error;
        
        await loadAgentPreorders();
        await loadMyLeads(); // Refresh main leads list
        alert('Preorder flag removed successfully');
    } catch (error) {
        console.error('Error removing preorder:', error);
        alert('Error removing preorder: ' + error.message);
    }
}

// Make functions available globally
window.loadAgentPreorders = loadAgentPreorders;
window.filterAgentPreorders = filterAgentPreorders;
window.removeAgentPreorder = removeAgentPreorder;
