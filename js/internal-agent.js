// ═══════════════════════════════════════════════════════════
// INTERNAL AGENT DASHBOARD — js/internal-agent.js
// Primary landing: Axxess Sales with Add Sale as default tab
// Sidebar: My Leads, Orders, Preorders, Shipping, Returned, Settings
// ═══════════════════════════════════════════════════════════

let currentUser = null;
let myLeads = [];
let myOrders = [];
let myPreorders = [];
let myShipping = [];
let myReturned = [];
let allPackages = [];
let currentSection = 'dashboard';

// ─── Initialization ───
document.addEventListener('DOMContentLoaded', async () => {
    // Allow both internal_agent and super_admin to access this dashboard
    const auth = await requireAuth(['internal_agent', 'super_admin']);
    if (!auth) return;

    currentUser = auth.profile;

    // Set user info in sidebar + header
    const name = currentUser.full_name || 'Agent';
    document.getElementById('userName').textContent = name;
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('userInitials').textContent = initials;
    if (document.getElementById('settingPreviewInitials')) {
        document.getElementById('settingPreviewInitials').textContent = initials;
    }
    if (document.getElementById('headerEmail')) {
        document.getElementById('headerEmail').textContent = currentUser.email || '';
    }
    if (document.getElementById('userRoleLabel')) {
        document.getElementById('userRoleLabel').textContent = currentUser.role === 'super_admin' ? 'Super Admin' : 'Internal Agent';
    }

    // Apply saved color scheme
    if (currentUser.color_scheme && currentUser.color_scheme !== 'default') {
        document.body.classList.add('theme-' + currentUser.color_scheme);
    }

    // Apply profile picture
    if (currentUser.profile_picture) {
        applyProfilePicture(currentUser.profile_picture);
    }

    // Set default Axxess tab to Add Sale (axxess-sales.js reads this)
    if (typeof axxessCurrentTab !== 'undefined') {
        axxessCurrentTab = 'ax-add-sale';
    }

    // Load Axxess Sales data immediately (this is the landing page)
    if (typeof loadAxxessSalesData === 'function') {
        await loadAxxessSalesData();
    }

    // Load sidebar data (leads, orders, etc.)
    await loadSidebarData();

    // Setup form handlers
    setupFormHandlers();

    // Populate settings
    populateSettings();
});

// ─── Sidebar Data Loading (leads, orders, preorders, shipping, returned) ───
async function loadSidebarData() {
    try {
        const userId = currentUser.id;

        const [leadsRes, ordersRes, packagesRes, preordersRes] = await Promise.all([
            window.supabaseClient
                .from('leads')
                .select('*, package:packages(id, name, price)')
                .or(`agent_id.eq.${userId},assigned_to.eq.${userId}`)
                .neq('status', 'converted')
                .order('created_at', { ascending: false }),
            window.supabaseClient
                .from('orders')
                .select('*, lead:leads(id, first_name, last_name, full_name, email, phone, address, order_number, service_id), package:packages(id, name, price)')
                .eq('agent_id', userId)
                .order('created_at', { ascending: false }),
            window.supabaseClient
                .from('packages')
                .select('*')
                .eq('is_active', true)
                .order('name'),
            window.supabaseClient
                .from('leads')
                .select('*, package:packages(id, name, price)')
                .eq('is_preorder', true)
                .or(`agent_id.eq.${userId},assigned_to.eq.${userId}`)
                .order('created_at', { ascending: false })
        ]);

        myLeads = leadsRes.data || [];
        myOrders = ordersRes.data || [];
        allPackages = packagesRes.data || [];
        myPreorders = preordersRes.data || [];

        // Shipping: orders with shipping status
        myShipping = myOrders.filter(o => o.shipping_status || o.tracking_number);

        // Returned items: leads or orders with status 'returned'
        const returnedLeads = (leadsRes.data || []).filter(l => l.status === 'returned').map(l => ({ ...l, _type: 'lead' }));
        const returnedOrders = myOrders.filter(o => o.status === 'returned').map(o => ({ ...o, _type: 'order' }));
        myReturned = [...returnedLeads, ...returnedOrders];

        // Render sidebar sections
        renderMyLeads();
        renderMyOrders();
        renderPreorders();
        renderShipping();
        renderReturned();
        updateBadges();

        console.log(`Internal agent data loaded: ${myLeads.length} leads, ${myOrders.length} orders`);
    } catch (error) {
        console.error('Error loading sidebar data:', error);
    }
}

// ─── Lead state ───
let editingLeadId = null;
let convertingLeadId = null;

// ─── My Leads ───
function renderMyLeads(filtered = null) {
    const display = filtered || myLeads;
    const tbody = document.getElementById('myLeadsTable');
    if (!tbody) return;
    document.getElementById('myLeadsCount').textContent = display.length;

    if (display.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No leads found</td></tr>';
        return;
    }

    tbody.innerHTML = display.map(lead => {
        const name = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '-';
        const contact = lead.email || lead.phone || '-';
        const address = lead.address || '-';
        const pkg = lead.package?.name || lead.package_name || '-';

        return `<tr class="table-row border-b">
            <td class="px-4 py-3">
                <div class="font-medium text-gray-800 text-sm">${name}</div>
                <div class="text-xs text-gray-400">${lead.order_number ? 'Order: ' + lead.order_number : ''} ${lead.service_id ? 'SID: ' + lead.service_id : ''}</div>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">${contact}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${address}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${pkg}</td>
            <td class="px-4 py-3">
                <select onchange="updateMyLeadStatus('${lead.id}', this.value)" class="text-xs border rounded px-2 py-1 status-${lead.status}">
                    <option value="new" ${lead.status === 'new' ? 'selected' : ''}>New</option>
                    <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                    <option value="qualified" ${lead.status === 'qualified' ? 'selected' : ''}>Qualified</option>
                    <option value="converted" ${lead.status === 'converted' ? 'selected' : ''}>Converted</option>
                    <option value="lost" ${lead.status === 'lost' ? 'selected' : ''}>Lost</option>
                </select>
            </td>
            <td class="px-4 py-3">
                <div class="flex gap-1">
                    <button onclick="viewLeadDetail('${lead.id}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition">Edit</button>
                    <button onclick="openConvertModal('${lead.id}')" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition">Convert</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function filterMyLeads() {
    const status = document.getElementById('leadStatusFilter').value;
    if (!status) {
        renderMyLeads();
    } else {
        renderMyLeads(myLeads.filter(l => l.status === status));
    }
}

async function updateMyLeadStatus(leadId, newStatus) {
    try {
        const lead = myLeads.find(l => l.id === leadId);
        const oldStatus = lead ? lead.status : null;

        const { error } = await window.supabaseClient
            .from('leads')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', leadId);
        if (error) throw error;

        if (lead) lead.status = newStatus;

        // If status changed to qualified, the DB trigger auto-creates a sale in sales_log
        if (newStatus === 'qualified' && oldStatus !== 'qualified') {
            console.log('Lead qualified — DB trigger will auto-create sale in sales_log');
        }

        // If status changed to converted, prompt to create order
        if (newStatus === 'converted' && oldStatus !== 'converted') {
            if (confirm('Lead marked as converted. Would you like to create an order now?')) {
                openConvertModal(leadId);
                return;
            }
        }

        filterMyLeads();
    } catch (error) {
        console.error('Error updating lead status:', error);
        alert('Error updating status: ' + error.message);
    }
}

// ─── Full Lead Edit Modal ───
function viewLeadDetail(leadId) {
    const lead = myLeads.find(l => l.id === leadId);
    if (!lead) return;

    editingLeadId = leadId;
    const content = document.getElementById('leadDetailContent');
    const ic = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
    const lc = "text-xs text-gray-500 block mb-1";

    // Build package options
    const packageOptions = allPackages.map(p =>
        `<option value="${p.id}" ${lead.package_id === p.id ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    content.innerHTML = `
        <form id="editLeadForm" class="space-y-4">
            <div class="grid grid-cols-3 gap-3">
                <div>
                    <label class="${lc}">Lead ID</label>
                    <input type="text" name="lead_id" value="${lead.lead_id || ''}" class="${ic}">
                </div>
                <div>
                    <label class="${lc}">Status</label>
                    <select name="status" class="${ic}">
                        <option value="new" ${lead.status === 'new' ? 'selected' : ''}>New</option>
                        <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                        <option value="qualified" ${lead.status === 'qualified' ? 'selected' : ''}>Qualified</option>
                        <option value="converted" ${lead.status === 'converted' ? 'selected' : ''}>Converted</option>
                        <option value="lost" ${lead.status === 'lost' ? 'selected' : ''}>Lost</option>
                    </select>
                </div>
                <div>
                    <label class="${lc}">Service ID</label>
                    <input type="text" name="service_id" value="${lead.service_id || ''}" class="${ic}">
                </div>
            </div>

            <div class="bg-gray-50 rounded-xl p-4">
                <h4 class="font-semibold text-gray-700 mb-3">Client Details</h4>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="${lc}">Full Name</label>
                        <input type="text" name="full_name" value="${lead.full_name || ''}" class="${ic}">
                    </div>
                    <div>
                        <label class="${lc}">ID Number</label>
                        <input type="text" name="id_number" maxlength="13" value="${lead.id_number || ''}" class="${ic}" placeholder="13-digit SA ID">
                    </div>
                    <div>
                        <label class="${lc}">First Name</label>
                        <input type="text" name="first_name" value="${lead.first_name || ''}" class="${ic}">
                    </div>
                    <div>
                        <label class="${lc}">Last Name</label>
                        <input type="text" name="last_name" value="${lead.last_name || ''}" class="${ic}">
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-50 rounded-xl p-4">
                    <h4 class="font-semibold text-gray-700 mb-3">Contact Info</h4>
                    <div class="space-y-2">
                        <div>
                            <label class="${lc}">Email</label>
                            <input type="email" name="email" value="${lead.email || ''}" class="${ic}">
                        </div>
                        <div>
                            <label class="${lc}">Phone</label>
                            <input type="text" name="phone" value="${lead.phone || ''}" class="${ic}">
                        </div>
                        <div>
                            <label class="${lc}">Address</label>
                            <input type="text" name="address" value="${lead.address || ''}" class="${ic}">
                        </div>
                    </div>
                </div>

                <div class="bg-gray-50 rounded-xl p-4">
                    <h4 class="font-semibold text-gray-700 mb-3">Secondary Contact</h4>
                    <div class="space-y-2">
                        <div>
                            <label class="${lc}">Name</label>
                            <input type="text" name="secondary_contact_name" value="${lead.secondary_contact_name || ''}" class="${ic}">
                        </div>
                        <div>
                            <label class="${lc}">Number</label>
                            <input type="text" name="secondary_contact_number" value="${lead.secondary_contact_number || ''}" class="${ic}">
                        </div>
                        <div>
                            <label class="${lc}">Email</label>
                            <input type="email" name="secondary_contact_email" value="${lead.secondary_contact_email || ''}" class="${ic}">
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-50 rounded-xl p-4">
                    <h4 class="font-semibold text-gray-700 mb-3">Package & Order</h4>
                    <div class="space-y-2">
                        <div>
                            <label class="${lc}">Package</label>
                            <select name="package_id" class="${ic}">
                                <option value="">Select Package</option>
                                ${packageOptions}
                            </select>
                        </div>
                        <div>
                            <label class="${lc}">Order Number</label>
                            <input type="text" name="order_number" value="${lead.order_number || ''}" class="${ic}">
                        </div>
                        <div>
                            <label class="${lc}">Account Number</label>
                            <input type="text" name="account_number" value="${lead.account_number || ''}" class="${ic}">
                        </div>
                    </div>
                </div>

                <div class="bg-gray-50 rounded-xl p-4">
                    <h4 class="font-semibold text-gray-700 mb-3">Order Info</h4>
                    <div class="space-y-2">
                        <div>
                            <label class="${lc}">Order Status</label>
                            <input type="text" name="order_status" value="${lead.order_status || ''}" class="${ic}">
                        </div>
                        <div>
                            <label class="${lc}">Order Date</label>
                            <input type="date" name="order_date" value="${lead.order_date ? lead.order_date.split('T')[0] : ''}" class="${ic}">
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-yellow-50 rounded-xl p-4">
                <label class="${lc}">Notes</label>
                <textarea name="notes" rows="3" class="${ic}">${lead.notes || ''}</textarea>
            </div>

            <div class="bg-purple-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <label class="font-semibold text-gray-700">Preorder</label>
                    <p class="text-xs text-gray-500">Mark this lead as a preorder for tracking</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="is_preorder" ${lead.is_preorder ? 'checked' : ''} class="sr-only peer">
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
            </div>

            <div class="flex justify-between pt-2 border-t">
                <button type="button" onclick="closeModal('leadDetailModal'); openConvertModal('${leadId}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-medium text-sm">
                    Convert to Order
                </button>
                <div class="flex gap-3">
                    <button type="button" onclick="closeModal('leadDetailModal')" class="px-4 py-2 border rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
                    <button type="submit" class="btn-primary text-white px-6 py-2 rounded-xl font-medium text-sm">Save Changes</button>
                </div>
            </div>
        </form>
    `;

    // Attach form submit handler
    document.getElementById('editLeadForm').addEventListener('submit', saveLeadChanges);
    document.getElementById('leadDetailModal').classList.add('active');
}

// ─── Save Lead Changes ───
async function saveLeadChanges(e) {
    e.preventDefault();
    if (!editingLeadId) return;

    const form = e.target;
    const fd = new FormData(form);

    const toNull = (val) => val && val.trim() !== '' ? val : null;
    const toUUID = (val) => val && val.trim() !== '' && val.length > 30 ? val : null;

    const lead = myLeads.find(l => l.id === editingLeadId);
    const oldStatus = lead ? lead.status : null;
    const newStatus = fd.get('status');

    const updateData = {
        lead_id: toNull(fd.get('lead_id')),
        status: newStatus,
        service_id: toNull(fd.get('service_id')),
        full_name: toNull(fd.get('full_name')),
        first_name: toNull(fd.get('first_name')),
        last_name: toNull(fd.get('last_name')),
        id_number: toNull(fd.get('id_number')),
        email: toNull(fd.get('email')),
        phone: toNull(fd.get('phone')),
        address: toNull(fd.get('address')),
        secondary_contact_name: toNull(fd.get('secondary_contact_name')),
        secondary_contact_number: toNull(fd.get('secondary_contact_number')),
        secondary_contact_email: toNull(fd.get('secondary_contact_email')),
        package_id: toUUID(fd.get('package_id')),
        account_number: toNull(fd.get('account_number')),
        order_number: toNull(fd.get('order_number')),
        order_status: toNull(fd.get('order_status')),
        order_date: toNull(fd.get('order_date')),
        notes: toNull(fd.get('notes')),
        is_preorder: fd.get('is_preorder') === 'on',
        updated_at: new Date().toISOString()
    };

    try {
        const { error } = await window.supabaseClient
            .from('leads')
            .update(updateData)
            .eq('id', editingLeadId);

        if (error) throw error;

        // If status changed to qualified, the DB trigger auto-creates a sale
        if (newStatus === 'qualified' && oldStatus !== 'qualified') {
            console.log('Lead qualified via edit — DB trigger will auto-create sale in sales_log');
        }

        // If status changed to converted and has order number, create order
        if (newStatus === 'converted' && oldStatus !== 'converted' && updateData.order_number) {
            const { data: existingOrders } = await window.supabaseClient
                .from('orders')
                .select('id')
                .eq('lead_id', editingLeadId);

            if (!existingOrders || existingOrders.length === 0) {
                const { error: orderError } = await window.supabaseClient
                    .from('orders')
                    .insert({
                        lead_id: editingLeadId,
                        package_id: updateData.package_id,
                        agent_id: currentUser.id,
                        order_number: updateData.order_number,
                        status: updateData.order_status || 'pending',
                        notes: 'Order created from lead edit by ' + (currentUser.full_name || 'agent')
                    });

                if (orderError) {
                    console.error('Failed to create order:', orderError);
                    alert('Lead saved but failed to create order: ' + orderError.message);
                } else {
                    // Also create sale in sales_log for this conversion
                    await createSaleFromLead(editingLeadId, updateData);
                    alert('Lead updated, order created, and sale tracked!');
                    closeModal('leadDetailModal');
                    await loadSidebarData();
                    return;
                }
            }
        }

        // Update local data
        const leadIndex = myLeads.findIndex(l => l.id === editingLeadId);
        if (leadIndex !== -1) {
            myLeads[leadIndex] = { ...myLeads[leadIndex], ...updateData };
        }

        alert('Lead updated successfully!');
        closeModal('leadDetailModal');
        filterMyLeads();

    } catch (error) {
        console.error('Error saving lead:', error);
        alert('Error saving lead: ' + error.message);
    }
}

// ─── Convert to Order Modal ───
function openConvertModal(leadId) {
    convertingLeadId = leadId;
    const lead = myLeads.find(l => l.id === leadId);
    if (!lead) return;

    const name = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown';
    document.getElementById('convertLeadName').textContent = name;
    document.getElementById('convertOrderNumber').value = lead.order_number || '';
    document.getElementById('convertNotes').value = '';
    document.getElementById('convertToOrderModal').classList.add('active');
}

async function convertLeadToOrder() {
    if (!convertingLeadId) return;

    const orderNumber = document.getElementById('convertOrderNumber').value.trim();
    const productType = document.getElementById('convertProductType').value;
    const notes = document.getElementById('convertNotes').value.trim();

    if (!orderNumber) {
        alert('Please enter an order number');
        return;
    }

    try {
        // Fetch latest lead data
        const { data: lead, error: fetchError } = await window.supabaseClient
            .from('leads')
            .select('*, package:packages(id, name, price)')
            .eq('id', convertingLeadId)
            .single();

        if (fetchError || !lead) throw new Error('Lead not found');

        const commissionAmount = productType === 'prepaid' ? 100 : 200;

        // 1. Update lead to converted
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

        // 2. Create order record
        const { error: orderError } = await window.supabaseClient
            .from('orders')
            .insert({
                lead_id: convertingLeadId,
                package_id: lead.package_id,
                agent_id: currentUser.id,
                order_number: orderNumber,
                status: 'pending',
                notes: `${productType === 'prepaid' ? 'Prepaid' : 'Postpaid'} - Commission: R${commissionAmount}${notes ? ' | ' + notes : ''}`
            });

        if (orderError) {
            console.error('Order creation error:', orderError);
            throw orderError;
        }

        // 3. Create sale in sales_log (bridges to Axxess sales tracking)
        await createSaleFromLead(convertingLeadId, {
            full_name: lead.full_name,
            account_number: lead.account_number,
            service_id: lead.service_id,
            order_number: orderNumber,
            package_id: lead.package_id,
            notes: notes
        }, lead.package);

        closeModal('convertToOrderModal');
        convertingLeadId = null;

        // Reload all data
        await loadSidebarData();

        // Refresh Axxess sales data so the new sale appears
        if (typeof loadAxxessSalesData === 'function') {
            await loadAxxessSalesData();
        }

        alert(`Lead converted! Order #${orderNumber} created.\nCommission: R${commissionAmount} (${productType === 'prepaid' ? 'Prepaid' : 'Postpaid'})\nSale added to Axxess tracking.`);

    } catch (error) {
        console.error('Error converting lead:', error);
        alert('Error converting lead: ' + error.message);
    }
}

// ─── Create Sale in sales_log (bridges dealer dashboard → Axxess sales tracking) ───
async function createSaleFromLead(leadId, leadData, packageData) {
    try {
        // Find the agent's agent_table_id for the sales_log
        const agentTableId = currentUser.agent_table_id;
        if (!agentTableId) {
            console.warn('No agent_table_id linked to profile — sale will not appear in Axxess sales tracking until linked');
            return;
        }

        // Get package info if not provided
        let pkgName = packageData?.name || 'Unknown Package';
        let pkgPrice = packageData?.price || 0;
        if (!packageData && leadData.package_id) {
            const { data: pkg } = await window.supabaseClient
                .from('packages')
                .select('name, price')
                .eq('id', leadData.package_id)
                .single();
            if (pkg) { pkgName = pkg.name; pkgPrice = pkg.price; }
        }

        // Check if sale already exists for this lead (avoid duplicates from DB trigger)
        const { data: existingSales } = await window.supabaseClient
            .from('sales_log')
            .select('id')
            .eq('lead_id', leadId);

        if (existingSales && existingSales.length > 0) {
            console.log('Sale already exists for this lead (likely from DB trigger), skipping duplicate');
            return;
        }

        const { error } = await window.supabaseClient
            .from('sales_log')
            .insert({
                agent_id: agentTableId,
                lead_id: leadId,
                account_number: leadData.account_number || leadData.order_number || ('LEAD-' + leadId),
                service_id: leadData.service_id || null,
                package_name: pkgName,
                category: 'Fibre',
                provider: 'Openserve',
                total_sale: pkgPrice,
                sale_status: 'Pending',
                status_reason: 'Awaiting Provider Completion',
                sale_origin: 'Incoming Sales Leads',
                notes: 'Converted from lead - ' + (leadData.full_name || '') + (leadData.notes ? ' | ' + leadData.notes : ''),
                commission_status: 'Does Not Count',
                import_source: 'INTERNAL_AGENT',
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error creating sale from lead:', error);
        } else {
            console.log('Sale created in sales_log from lead conversion');
        }
    } catch (error) {
        console.error('Error in createSaleFromLead:', error);
    }
}

// ─── My Orders ───
function renderMyOrders(filtered = null) {
    const display = filtered || myOrders;
    const tbody = document.getElementById('myOrdersTable');
    if (!tbody) return;
    document.getElementById('myOrdersCount').textContent = display.length;

    if (display.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = display.map(order => {
        const clientName = order.lead?.full_name || `${order.lead?.first_name || ''} ${order.lead?.last_name || ''}`.trim() || '-';
        const pkg = order.package?.name || '-';
        const date = order.created_at ? new Date(order.created_at).toLocaleDateString() : '-';

        return `<tr class="table-row border-b">
            <td class="px-4 py-3 text-sm font-mono">${order.order_number || '-'}</td>
            <td class="px-4 py-3 text-sm font-medium text-gray-800">${clientName}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${pkg}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs status-${order.status}">${order.status}</span></td>
            <td class="px-4 py-3 text-sm text-gray-500">${date}</td>
            <td class="px-4 py-3">
                <button onclick="viewOrderDetail('${order.id}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition">View</button>
            </td>
        </tr>`;
    }).join('');
}

function filterMyOrders() {
    const status = document.getElementById('orderStatusFilter').value;
    if (!status) {
        renderMyOrders();
    } else {
        renderMyOrders(myOrders.filter(o => o.status === status));
    }
}

function viewOrderDetail(orderId) {
    const order = myOrders.find(o => o.id === orderId);
    if (!order) return;

    const clientName = order.lead?.full_name || `${order.lead?.first_name || ''} ${order.lead?.last_name || ''}`.trim() || '-';
    const content = document.getElementById('orderDetailContent');
    content.innerHTML = `
        <div class="space-y-3">
            <div class="grid grid-cols-2 gap-4">
                <div><p class="text-xs text-gray-500">Order #</p><p class="font-medium">${order.order_number || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Client</p><p class="font-medium">${clientName}</p></div>
                <div><p class="text-xs text-gray-500">Package</p><p class="font-medium">${order.package?.name || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Status</p><p class="font-medium"><span class="px-2 py-0.5 rounded-full text-xs status-${order.status}">${order.status}</span></p></div>
                <div><p class="text-xs text-gray-500">Service ID</p><p class="font-medium">${order.lead?.service_id || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Address</p><p class="font-medium">${order.lead?.address || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Tracking #</p><p class="font-medium">${order.tracking_number || '-'}</p></div>
                <div><p class="text-xs text-gray-500">Created</p><p class="font-medium">${order.created_at ? new Date(order.created_at).toLocaleString() : '-'}</p></div>
            </div>
            ${order.notes ? `<div><p class="text-xs text-gray-500">Notes</p><p class="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg mt-1">${order.notes}</p></div>` : ''}
        </div>
    `;
    document.getElementById('orderDetailModal').classList.add('active');
}

// ─── Preorders ───
function renderPreorders() {
    const tbody = document.getElementById('preordersTable');
    if (!tbody) return;

    if (myPreorders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">No preorders</td></tr>';
        return;
    }

    tbody.innerHTML = myPreorders.map(p => {
        const name = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || '-';
        const date = p.created_at ? new Date(p.created_at).toLocaleDateString() : '-';
        return `<tr class="table-row border-b">
            <td class="px-4 py-3 text-sm font-medium text-gray-800">${name}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${p.package?.name || '-'}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${p.address || '-'}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs status-${p.status}">${p.status}</span></td>
            <td class="px-4 py-3 text-sm text-gray-500">${date}</td>
        </tr>`;
    }).join('');
}

// ─── Shipping ───
function renderShipping() {
    const tbody = document.getElementById('shippingTable');
    if (!tbody) return;

    if (myShipping.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No shipping items</td></tr>';
        return;
    }

    tbody.innerHTML = myShipping.map(s => {
        const clientName = s.lead?.full_name || `${s.lead?.first_name || ''} ${s.lead?.last_name || ''}`.trim() || '-';
        const date = s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '-';
        return `<tr class="table-row border-b">
            <td class="px-4 py-3 text-sm font-mono">${s.order_number || '-'}</td>
            <td class="px-4 py-3 text-sm font-medium text-gray-800">${clientName}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${s.lead?.address || '-'}</td>
            <td class="px-4 py-3 text-sm font-mono">${s.tracking_number || '-'}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs status-${s.shipping_status || s.status}">${s.shipping_status || s.status}</span></td>
            <td class="px-4 py-3 text-sm text-gray-500">${date}</td>
        </tr>`;
    }).join('');
}

// ─── Returned Items ───
function renderReturned() {
    const tbody = document.getElementById('returnedTable');
    if (!tbody) return;

    if (myReturned.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">No returned items</td></tr>';
        return;
    }

    tbody.innerHTML = myReturned.map(r => {
        const name = r.full_name || r.lead?.full_name || `${r.first_name || r.lead?.first_name || ''} ${r.last_name || r.lead?.last_name || ''}`.trim() || '-';
        const date = r.returned_at || r.updated_at ? new Date(r.returned_at || r.updated_at).toLocaleDateString() : '-';
        return `<tr class="table-row border-b">
            <td class="px-4 py-3 text-sm"><span class="px-2 py-0.5 rounded-full text-xs ${r._type === 'lead' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}">${r._type}</span></td>
            <td class="px-4 py-3 text-sm font-medium text-gray-800">${name}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${r.return_reason || '-'}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs status-returned">Returned</span></td>
            <td class="px-4 py-3 text-sm text-gray-500">${date}</td>
        </tr>`;
    }).join('');
}

// ─── Reports ───
function renderReports() {
    const converted = myOrders.length;
    const qualified = myLeads.filter(l => l.status === 'qualified').length;
    const lost = myLeads.filter(l => l.status === 'lost').length;

    document.getElementById('rptTotalLeads').textContent = myLeads.length + converted;
    document.getElementById('rptConverted').textContent = converted;
    document.getElementById('rptQualified').textContent = qualified;
    document.getElementById('rptLost').textContent = lost;

    // Status breakdown chart
    const statusCounts = {};
    myLeads.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });

    const statusCtx = document.getElementById('statusChart');
    if (statusCtx && statusCtx.getContext) {
        if (window._statusChart) window._statusChart.destroy();
        window._statusChart = new Chart(statusCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusCounts),
                datasets: [{
                    data: Object.values(statusCounts),
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6b7280']
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // Monthly chart
    const months = [];
    const leadCounts = [];
    const orderCounts = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
        months.push(label);
        leadCounts.push(myLeads.filter(l => l.created_at >= start && l.created_at <= end).length);
        orderCounts.push(myOrders.filter(o => o.created_at >= start && o.created_at <= end).length);
    }

    const monthlyCtx = document.getElementById('monthlyChart');
    if (monthlyCtx && monthlyCtx.getContext) {
        if (window._monthlyChart) window._monthlyChart.destroy();
        window._monthlyChart = new Chart(monthlyCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    { label: 'Leads', data: leadCounts, backgroundColor: '#3b82f6' },
                    { label: 'Orders', data: orderCounts, backgroundColor: '#10b981' }
                ]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

// ─── Badges ───
function updateBadges() {
    const setBadge = (id, count) => {
        const el = document.getElementById(id);
        if (el) {
            if (count > 0) { el.textContent = count; el.classList.remove('hidden'); }
            else { el.classList.add('hidden'); }
        }
    };

    setBadge('myLeadsBadge', myLeads.filter(l => l.status === 'new').length);
    setBadge('myOrdersBadge', myOrders.filter(o => o.status === 'pending').length);
    setBadge('preordersBadge', myPreorders.length);
    setBadge('shippingBadge', myShipping.length);
    setBadge('returnedBadge', myReturned.length);
}

// ─── Settings ───
function populateSettings() {
    document.getElementById('settingName').value = currentUser.full_name || '';
    document.getElementById('settingPicture').value = currentUser.profile_picture || '';
    document.getElementById('settingEmail').textContent = currentUser.email || '-';
    document.getElementById('settingRole').textContent = currentUser.role || '-';
    document.getElementById('settingAgentId').textContent = currentUser.agent_table_id || 'Not linked';
    highlightColorScheme(currentUser.color_scheme || 'default');
}

function highlightColorScheme(scheme) {
    document.querySelectorAll('#colorSchemeOptions button').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-offset-2', 'ring-green-500');
        const onclick = btn.getAttribute('onclick') || '';
        if (onclick.includes(`'${scheme}'`)) {
            btn.classList.add('ring-2', 'ring-offset-2', 'ring-green-500');
        }
    });
}

function setColorScheme(scheme) {
    document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
    if (scheme !== 'default') {
        document.body.classList.add('theme-' + scheme);
    }
    highlightColorScheme(scheme);

    window.supabaseClient
        .from('profiles')
        .update({ color_scheme: scheme })
        .eq('id', currentUser.id)
        .then(({ error }) => {
            if (error) console.error('Error saving color scheme:', error);
            else currentUser.color_scheme = scheme;
        });
}

function previewProfilePicture() {
    const url = document.getElementById('settingPicture').value;
    const preview = document.getElementById('settingPicturePreview');
    if (url) {
        preview.innerHTML = `<img src="${url}" alt="Profile" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<span class=\\'text-red-400 text-xs\\'>Invalid URL</span>'">`;
    }
}

function applyProfilePicture(url) {
    if (!url) return;
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
        avatar.innerHTML = `<img src="${url}" alt="Profile" class="w-full h-full object-cover rounded-full" onerror="this.style.display='none'">`;
    }
}

function setupFormHandlers() {
    document.getElementById('profileSettingsForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('settingName').value.trim();
        const picture = document.getElementById('settingPicture').value.trim();

        try {
            const { error } = await window.supabaseClient
                .from('profiles')
                .update({ full_name: name, profile_picture: picture || null })
                .eq('id', currentUser.id);

            if (error) throw error;

            currentUser.full_name = name;
            currentUser.profile_picture = picture || null;

            document.getElementById('userName').textContent = name;
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            document.getElementById('userInitials').textContent = initials;

            if (picture) applyProfilePicture(picture);

            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings: ' + error.message);
        }
    });
}

// ─── Section Navigation ───
function showSection(section) {
    currentSection = section;

    // Hide all sections
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));

    // Show target section
    const target = document.getElementById('section-' + section);
    if (target) target.classList.remove('hidden');

    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
        n.classList.add('text-white/70');
        n.classList.remove('text-white');
    });
    const navLink = document.querySelector(`a[href="#${section}"]`);
    if (navLink) {
        navLink.classList.add('active', 'text-white');
        navLink.classList.remove('text-white/70');
    }

    // Update page title
    const titles = {
        'dashboard': ['Axxess Sales', 'Agent sales performance from the Axxess tracking system'],
        'my-leads': ['My Leads', 'Leads assigned to you'],
        'my-orders': ['My Orders', 'Your order pipeline'],
        'reports': ['Reports', 'Performance analytics'],
        'preorders': ['Preorders', 'Pending preorder installations'],
        'shipping': ['Shipping', 'Shipment tracking'],
        'returned': ['Returned Items', 'Items returned for review'],
        'settings': ['Settings', 'Profile and preferences']
    };
    const [title, subtitle] = titles[section] || ['Axxess Sales', ''];
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageSubtitle').textContent = subtitle;

    // Section-specific loading
    if (section === 'reports') {
        renderReports();
    }
}

// ─── Utilities ───
function closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
}

function openModal(id) {
    document.getElementById(id)?.classList.add('active');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

function handleSearch(value) {
    // Search across current section
    if (currentSection === 'my-leads') {
        if (!value) { renderMyLeads(); return; }
        const q = value.toLowerCase();
        const filtered = myLeads.filter(l => {
            const name = (l.full_name || `${l.first_name || ''} ${l.last_name || ''}`).toLowerCase();
            return name.includes(q) || (l.email || '').toLowerCase().includes(q) || (l.phone || '').includes(q) || (l.order_number || '').toLowerCase().includes(q);
        });
        renderMyLeads(filtered);
    }
}
