// Supabase Configuration
// Credentials are loaded from localStorage (set via setup.html)

function getSupabaseConfig() {
    const url = localStorage.getItem('SUPABASE_URL');
    const key = localStorage.getItem('SUPABASE_ANON_KEY');
    
    if (!url || !key) {
        return null;
    }
    
    return { url, key };
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
        return window.supabase.createClient(config.url, config.key);
    }
    return null;
}

supabaseClient = initSupabase();

// Export for use in other modules
window.supabaseClient = supabaseClient;
window.getSupabaseConfig = getSupabaseConfig;
window.initSupabase = initSupabase;
window.isSupabaseConfigured = isSupabaseConfigured;
