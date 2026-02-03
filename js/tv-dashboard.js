// TV Dashboard - Public view with no authentication required
let leads = [];
let orders = [];
let agents = [];
let dealers = [];

// Wait for Supabase to be ready
function waitForSupabase() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
            attempts++;
            if (window.supabaseClient) {
                resolve(window.supabaseClient);
            } else if (attempts < 20) {
                // Try to initialize if config exists
                if (window.initSupabase) {
                    window.supabaseClient = window.initSupabase();
                }
                setTimeout(check, 250);
            } else {
                reject(new Error('Supabase not configured. Please login first to set up credentials, then return to this page.'));
            }
        };
        check();
    });
}

// Update time display
function updateTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('en-ZA', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
}
setInterval(updateTime, 1000);
updateTime();

// Load all data
async function loadData() {
    try {
        console.log('Loading TV dashboard data...');
        
        // Wait for Supabase client to be ready
        const client = await waitForSupabase();
        
        const leadsRes = await client.from('leads').select('*').order('created_at', { ascending: false });
        if (leadsRes.error) {
            console.error('Leads error:', leadsRes.error);
            showError('Leads: ' + leadsRes.error.message);
        }
        leads = leadsRes.data || [];
        console.log('Leads loaded:', leads.length);
        
        const ordersRes = await client.from('orders').select('*, lead:leads(*), package:packages(*), agent:profiles(*)');
        if (ordersRes.error) console.error('Orders error:', ordersRes.error);
        orders = ordersRes.data || [];
        
        const agentsRes = await client.from('profiles').select('*').eq('role', 'agent');
        if (agentsRes.error) console.error('Agents error:', agentsRes.error);
        agents = agentsRes.data || [];
        
        const dealersRes = await client.from('dealers').select('*');
        if (dealersRes.error) console.error('Dealers error:', dealersRes.error);
        dealers = dealersRes.data || [];

        console.log('Data loaded - Leads:', leads.length, 'Orders:', orders.length, 'Agents:', agents.length, 'Dealers:', dealers.length);

        updateStats();
        updateLeadStatusBreakdown();
        updateTopAgents();
        updateRecentActivity();
        updateDealerPerformance();
    } catch (error) {
        console.error('Error loading data:', error);
        showError(error.message);
    }
}

function showError(message) {
    const container = document.getElementById('recentActivity');
    if (container) {
        container.innerHTML = `<p class="text-red-400 text-sm">Error: ${message}</p><p class="text-gray-500 text-xs mt-2">Run the migration: migrations/allow_public_read_for_tv_dashboard.sql</p>`;
    }
}

function updateStats() {
    // Total leads
    document.getElementById('totalLeads').textContent = leads.length.toLocaleString();
    
    // Total orders (converted leads)
    const convertedLeads = leads.filter(l => l.status === 'converted');
    document.getElementById('totalOrders').textContent = convertedLeads.length.toLocaleString();
    
    // Active agents
    document.getElementById('totalAgents').textContent = agents.length.toLocaleString();
    
    // Dealers
    document.getElementById('totalDealers').textContent = dealers.length.toLocaleString();
    
    // Conversion rate
    const conversionRate = leads.length > 0 ? ((convertedLeads.length / leads.length) * 100).toFixed(1) : 0;
    document.getElementById('conversionRate').textContent = conversionRate + '%';
    
    // Total commission
    const totalCommission = leads.reduce((sum, l) => sum + (l.commission_amount || 0), 0);
    document.getElementById('totalCommission').textContent = 'R' + totalCommission.toLocaleString();
}

function updateLeadStatusBreakdown() {
    const statusCounts = {
        new: { count: 0, color: 'bg-blue-500', label: 'New' },
        contacted: { count: 0, color: 'bg-yellow-500', label: 'Contacted' },
        qualified: { count: 0, color: 'bg-purple-500', label: 'Qualified' },
        converted: { count: 0, color: 'bg-emerald-500', label: 'Converted' },
        lost: { count: 0, color: 'bg-red-500', label: 'Lost' }
    };

    leads.forEach(lead => {
        if (statusCounts[lead.status]) {
            statusCounts[lead.status].count++;
        }
    });

    const container = document.getElementById('leadStatusBreakdown');
    container.innerHTML = Object.entries(statusCounts).map(([status, data]) => {
        const percentage = leads.length > 0 ? ((data.count / leads.length) * 100).toFixed(0) : 0;
        return `
            <div class="space-y-2">
                <div class="flex justify-between text-sm">
                    <span class="text-gray-400">${data.label}</span>
                    <span class="font-semibold">${data.count}</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2">
                    <div class="${data.color} h-2 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function updateTopAgents() {
    // Count leads per agent
    const agentLeadCounts = {};
    const agentOrderCounts = {};
    
    leads.forEach(lead => {
        if (lead.agent_id) {
            agentLeadCounts[lead.agent_id] = (agentLeadCounts[lead.agent_id] || 0) + 1;
            if (lead.status === 'converted') {
                agentOrderCounts[lead.agent_id] = (agentOrderCounts[lead.agent_id] || 0) + 1;
            }
        }
    });

    // Sort agents by order count
    const sortedAgents = agents
        .map(a => ({
            ...a,
            leads: agentLeadCounts[a.id] || 0,
            orders: agentOrderCounts[a.id] || 0
        }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5);

    const container = document.getElementById('topAgents');
    if (sortedAgents.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No agents yet</p>';
        return;
    }

    container.innerHTML = sortedAgents.map((agent, index) => `
        <div class="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold">
                ${index + 1}
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-medium truncate">${agent.full_name || 'Unknown'}</p>
                <p class="text-xs text-gray-400">${agent.orders} orders • ${agent.leads} leads</p>
            </div>
            <div class="text-emerald-400 font-semibold text-sm">
                ${agent.leads > 0 ? ((agent.orders / agent.leads) * 100).toFixed(0) : 0}%
            </div>
        </div>
    `).join('');
}

function updateRecentActivity() {
    const recentLeads = leads.slice(0, 8);
    const container = document.getElementById('recentActivity');

    if (recentLeads.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No recent activity</p>';
        return;
    }

    container.innerHTML = recentLeads.map(lead => {
        const statusColors = {
            new: 'text-blue-400',
            contacted: 'text-yellow-400',
            qualified: 'text-purple-400',
            converted: 'text-emerald-400',
            lost: 'text-red-400'
        };
        const statusIcons = {
            new: '🆕',
            contacted: '📞',
            qualified: '✅',
            converted: '🎉',
            lost: '❌'
        };
        const timeAgo = getTimeAgo(new Date(lead.created_at));
        
        return `
            <div class="activity-item flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                <span class="text-lg">${statusIcons[lead.status] || '📋'}</span>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">${lead.full_name || lead.first_name || 'New Lead'}</p>
                    <p class="text-xs ${statusColors[lead.status] || 'text-gray-400'}">${lead.status}</p>
                </div>
                <span class="text-xs text-gray-500">${timeAgo}</span>
            </div>
        `;
    }).join('');
}

function updateDealerPerformance() {
    // Count leads and orders per dealer
    const dealerStats = {};
    
    leads.forEach(lead => {
        if (lead.dealer_id) {
            if (!dealerStats[lead.dealer_id]) {
                dealerStats[lead.dealer_id] = { leads: 0, orders: 0, commission: 0 };
            }
            dealerStats[lead.dealer_id].leads++;
            if (lead.status === 'converted') {
                dealerStats[lead.dealer_id].orders++;
                dealerStats[lead.dealer_id].commission += lead.commission_amount || 0;
            }
        }
    });

    const container = document.getElementById('dealerPerformance');
    
    if (dealers.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm col-span-full">No dealers yet</p>';
        return;
    }

    container.innerHTML = dealers.map(dealer => {
        const stats = dealerStats[dealer.id] || { leads: 0, orders: 0, commission: 0 };
        return `
            <div class="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-colors">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center font-bold">
                        ${(dealer.name || 'D').charAt(0).toUpperCase()}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-medium truncate text-sm">${dealer.name || 'Unknown'}</p>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                        <p class="text-gray-400">Leads</p>
                        <p class="font-semibold text-blue-400">${stats.leads}</p>
                    </div>
                    <div>
                        <p class="text-gray-400">Orders</p>
                        <p class="font-semibold text-emerald-400">${stats.orders}</p>
                    </div>
                    <div>
                        <p class="text-gray-400">Comm.</p>
                        <p class="font-semibold text-cyan-400">R${stats.commission.toLocaleString()}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return date.toLocaleDateString();
}

// Initial load
loadData();

// Auto-refresh every 30 seconds
setInterval(loadData, 30000);
