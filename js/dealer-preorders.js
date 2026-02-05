// Dealer Preorders Management Functions
let dealerPreorders = [];

// Load dealer's preorders (from all their agents)
async function loadDealerPreorders() {
    try {
        const agentIds = agents.map(a => a.id);
        
        const { data, error } = await window.supabaseClient
            .from('leads')
            .select(`
                *,
                agent:profiles!leads_agent_id_fkey(id, full_name),
                package:packages(id, name, price)
            `)
            .eq('is_preorder', true)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Filter for this dealer's leads (by dealer_id or agent_id)
        dealerPreorders = (data || []).filter(l => {
            const matchesDealer = l.dealer_id === currentUser.dealer_id;
            const matchesAgent = agentIds.includes(l.agent_id);
            return matchesDealer || matchesAgent;
        });
        
        // Update badge
        const badge = document.getElementById('dealerPreordersBadge');
        if (badge) {
            if (dealerPreorders.length > 0) {
                badge.textContent = dealerPreorders.length;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
        
        renderDealerPreordersTable();
        console.log(`Loaded ${dealerPreorders.length} preorders for dealer`);
    } catch (error) {
        console.error('Error loading dealer preorders:', error);
        alert('Error loading preorders: ' + error.message);
    }
}

// Render dealer preorders table
function renderDealerPreordersTable(filteredPreorders = null) {
    const table = document.getElementById('dealerPreordersTable');
    if (!table) return;
    
    const displayPreorders = filteredPreorders || dealerPreorders;
    
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
            <tr class="table-row border-b hover:bg-gray-50">
                <td class="py-3 px-4">
                    <div class="text-sm font-medium text-gray-800">${clientName}</div>
                    ${lead.lead_id ? `<div class="text-xs text-gray-400">Lead ID: ${lead.lead_id}</div>` : ''}
                </td>
                <td class="py-3 px-4 text-sm text-gray-600">${contact}</td>
                <td class="py-3 px-4 text-sm text-gray-600">${lead.package?.name || '-'}</td>
                <td class="py-3 px-4 text-sm text-gray-600">${lead.agent?.full_name || '-'}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[lead.status] || 'bg-gray-100'}">${lead.status}</span>
                </td>
                <td class="py-3 px-4 text-sm text-gray-500">${lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '-'}</td>
            </tr>
        `;
    }).join('');
}

// Filter dealer preorders
function filterDealerPreorders() {
    const statusFilter = document.getElementById('dealerPreorderStatusFilter')?.value || '';
    
    let filtered = dealerPreorders;
    
    if (statusFilter) {
        filtered = filtered.filter(p => p.status === statusFilter);
    }
    
    renderDealerPreordersTable(filtered);
}

// Make functions available globally
window.loadDealerPreorders = loadDealerPreorders;
window.filterDealerPreorders = filterDealerPreorders;
