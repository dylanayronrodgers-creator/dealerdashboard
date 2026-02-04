// Admin Dashboard Statistics Enhancement
// Beautiful statistics display matching TV dashboard style

// Update dashboard statistics with enhanced visuals
async function updateDashboardStats() {
    try {
        // Update basic stats
        document.getElementById('totalLeads').textContent = leads.length;
        document.getElementById('totalOrders').textContent = orders.length;
        document.getElementById('totalAgents').textContent = agents.filter(a => a.role === 'agent').length;
        document.getElementById('totalDealers').textContent = dealers.length;
        
        // Calculate conversion rate
        const convertedLeads = leads.filter(l => l.status === 'converted').length;
        const conversionRate = leads.length > 0 ? ((convertedLeads / leads.length) * 100).toFixed(1) : 0;
        document.getElementById('conversionRate').textContent = `${conversionRate}%`;
        
        // Calculate total commission
        const totalCommission = leads
            .filter(l => l.status === 'converted')
            .reduce((sum, l) => sum + (l.commission_amount || 200), 0);
        document.getElementById('totalCommission').textContent = `R${totalCommission.toLocaleString()}`;
        
        // Update enhanced sections
        updateLeadStatusBreakdown();
        updateTopAgents();
        updateRecentActivity();
        
    } catch (error) {
        console.error('Error updating dashboard stats:', error);
    }
}

// Lead Status Breakdown with progress bars
function updateLeadStatusBreakdown() {
    const statusBreakdown = document.getElementById('leadStatusBreakdown');
    if (!statusBreakdown) return;
    
    const statusCounts = {
        'new': { count: 0, color: 'blue', label: 'New' },
        'contacted': { count: 0, color: 'indigo', label: 'Contacted' },
        'qualified': { count: 0, color: 'purple', label: 'Qualified' },
        'converted': { count: 0, color: 'green', label: 'Converted' },
        'lost': { count: 0, color: 'gray', label: 'Lost' }
    };
    
    leads.forEach(lead => {
        if (statusCounts[lead.status]) {
            statusCounts[lead.status].count++;
        }
    });
    
    const total = leads.length || 1;
    
    statusBreakdown.innerHTML = Object.entries(statusCounts).map(([status, data]) => {
        const percentage = ((data.count / total) * 100).toFixed(0);
        return `
            <div>
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-gray-700">${data.label}</span>
                    <span class="text-sm font-bold text-gray-800">${data.count}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-gradient-to-r from-${data.color}-400 to-${data.color}-600 h-2 rounded-full transition-all duration-500" 
                         style="width: ${percentage}%"></div>
                </div>
                <p class="text-xs text-gray-500 mt-1">${percentage}% of total</p>
            </div>
        `;
    }).join('');
}

// Top Performing Agents
function updateTopAgents() {
    const topAgentsEl = document.getElementById('topAgents');
    if (!topAgentsEl) return;
    
    // Calculate agent performance
    const agentStats = agents
        .filter(a => a.role === 'agent')
        .map(agent => {
            const agentLeads = leads.filter(l => l.agent_id === agent.id);
            const converted = agentLeads.filter(l => l.status === 'converted').length;
            const conversionRate = agentLeads.length > 0 ? ((converted / agentLeads.length) * 100).toFixed(0) : 0;
            
            return {
                name: agent.full_name,
                leads: agentLeads.length,
                converted: converted,
                conversionRate: conversionRate
            };
        })
        .sort((a, b) => b.converted - a.converted)
        .slice(0, 5);
    
    if (agentStats.length === 0) {
        topAgentsEl.innerHTML = '<p class="text-gray-500 text-sm text-center">No agents yet</p>';
        return;
    }
    
    topAgentsEl.innerHTML = agentStats.map((agent, index) => {
        const medals = ['🥇', '🥈', '🥉'];
        const medal = index < 3 ? medals[index] : `#${index + 1}`;
        
        return `
            <div class="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-100 hover:shadow-md transition-all">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">${medal}</span>
                    <div>
                        <p class="font-semibold text-gray-800">${agent.name}</p>
                        <p class="text-xs text-gray-500">${agent.leads} leads • ${agent.converted} converted</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-lg font-bold text-emerald-600">${agent.conversionRate}%</p>
                    <p class="text-xs text-gray-500">conversion</p>
                </div>
            </div>
        `;
    }).join('');
}

// Recent Activity Feed
function updateRecentActivity() {
    const activityEl = document.getElementById('recentActivity');
    if (!activityEl) return;
    
    // Combine recent leads and orders
    const recentLeads = leads
        .filter(l => l.created_at)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(l => ({
            type: 'lead',
            status: l.status,
            name: l.full_name || `${l.first_name} ${l.last_name}`,
            time: l.created_at,
            icon: '👤',
            color: 'blue'
        }));
    
    const recentOrders = orders
        .filter(o => o.created_at)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(o => ({
            type: 'order',
            status: o.status,
            name: o.lead?.full_name || 'Unknown',
            time: o.created_at,
            icon: '📦',
            color: 'green'
        }));
    
    const activities = [...recentLeads, ...recentOrders]
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 8);
    
    if (activities.length === 0) {
        activityEl.innerHTML = '<p class="text-gray-500 text-sm text-center">No recent activity</p>';
        return;
    }
    
    activityEl.innerHTML = activities.map(activity => {
        const timeAgo = getTimeAgo(activity.time);
        return `
            <div class="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition-all">
                <span class="text-xl">${activity.icon}</span>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800 truncate">${activity.name}</p>
                    <p class="text-xs text-gray-500">${activity.type === 'lead' ? 'New lead' : 'Order'} • ${timeAgo}</p>
                </div>
                <span class="px-2 py-1 text-xs rounded-full bg-${activity.color}-100 text-${activity.color}-700 whitespace-nowrap">
                    ${activity.status}
                </span>
            </div>
        `;
    }).join('');
}

// Helper function to calculate time ago
function getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000); // seconds
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return time.toLocaleDateString();
}

// Export functions for use in main dashboard
window.updateDashboardStats = updateDashboardStats;
window.updateLeadStatusBreakdown = updateLeadStatusBreakdown;
window.updateTopAgents = updateTopAgents;
window.updateRecentActivity = updateRecentActivity;
