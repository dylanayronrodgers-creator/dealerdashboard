// Supabase Configuration
// Credentials are loaded from localStorage (set via setup.html)

function getSupabaseConfig() {
    const url = localStorage.getItem('SUPABASE_URL');
    const key = localStorage.getItem('SUPABASE_ANON_KEY');
    
    if (!url || !key) {
        // Redirect to setup if not configured (except on setup/index pages)
        const currentPath = window.location.pathname.toLowerCase();
        if (!currentPath.includes('setup.html') && !currentPath.includes('index.html') && !currentPath.endsWith('/')) {
            alert('Supabase is not configured. Please set up your API keys first.');
            window.location.href = 'setup.html';
            return null;
        }
        return null;
    }
    
    return { url, key };
}

// Initialize Supabase client only if the library is loaded
let supabase = null;

function initSupabase() {
    // Check if Supabase library is available
    if (typeof window.supabase === 'undefined') {
        console.log('Supabase library not loaded on this page');
        return null;
    }
    
    const config = getSupabaseConfig();
    if (config) {
        return window.supabase.createClient(config.url, config.key);
    }
    return null;
}

supabase = initSupabase();

// Export for use in other modules
window.supabaseClient = supabase;
window.getSupabaseConfig = getSupabaseConfig;
window.initSupabase = initSupabase;
