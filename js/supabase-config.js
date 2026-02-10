// Centralized Supabase Configuration
// UPDATE THESE VALUES ONCE - All dashboards will use them automatically

const SUPABASE_CONFIG = {
    url: 'https://xitiatikzlzcswakgevy.supabase.co',
    anonKey: 'sb_publishable_o-2_PZ2xRLLPt7JfC2Stzw_knc5GHGE'
};

// ============================================
// NO NEED TO EDIT BELOW THIS LINE
// ============================================

function getSupabaseConfig() {
    // Use centralized config if set
    if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
        return { url: SUPABASE_CONFIG.url, key: SUPABASE_CONFIG.anonKey };
    }
    
    // Fallback to localStorage for backward compatibility
    const url = localStorage.getItem('SUPABASE_URL');
    const key = localStorage.getItem('SUPABASE_ANON_KEY');
    
    if (url && key) {
        return { url, key };
    }
    
    return null;
}

function isSupabaseConfigured() {
    return getSupabaseConfig() !== null;
}

// Initialize Supabase client only if the library is loaded
let supabaseClient = null;

function initSupabase() {
    // Check if Supabase library is available
    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient === 'undefined') {
        console.log('Supabase library not loaded on this page');
        return null;
    }
    
    const config = getSupabaseConfig();
    if (config) {
        console.log('Supabase initialized with centralized config');
        return window.supabase.createClient(config.url, config.key);
    }
    
    console.warn('Supabase not configured. Please update SUPABASE_CONFIG in js/supabase-config.js');
    return null;
}

supabaseClient = initSupabase();

// Export for use in other modules
window.supabaseClient = supabaseClient;
window.getSupabaseConfig = getSupabaseConfig;
window.initSupabase = initSupabase;
window.isSupabaseConfigured = isSupabaseConfigured;
