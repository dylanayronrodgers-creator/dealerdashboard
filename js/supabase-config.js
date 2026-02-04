// Centralized Supabase Configuration
// UPDATE THESE VALUES ONCE - All dashboards will use them automatically

const SUPABASE_CONFIG = {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key-here'
};

// ============================================
// NO NEED TO EDIT BELOW THIS LINE
// ============================================

function getSupabaseConfig() {
    // First check if centralized config is set
    if (SUPABASE_CONFIG.url !== 'https://your-project.supabase.co' && 
        SUPABASE_CONFIG.anonKey !== 'your-anon-key-here') {
        return SUPABASE_CONFIG;
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
