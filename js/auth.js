// Authentication Module
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Check if user is already logged in (only if Supabase is configured)
    if (window.supabaseClient) {
        checkAuthState();
    }
});

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    // Check if Supabase is configured
    if (!window.supabaseClient) {
        errorMessage.innerHTML = 'Supabase is not configured. <a href="setup.html" class="underline font-medium">Click here to set up</a>';
        errorMessage.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Sign In</span><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>';
        return;
    }
    
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Signing in...';

    try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        // Get user role from profiles table
        const { data: profile, error: profileError } = await window.supabaseClient
            .from('profiles')
            .select('role, full_name')
            .eq('id', data.user.id)
            .single();

        if (profileError) throw profileError;

        // Store user info in session
        sessionStorage.setItem('userRole', profile.role);
        sessionStorage.setItem('userName', profile.full_name);
        sessionStorage.setItem('userId', data.user.id);

        // Redirect based on role
        if (profile.role === 'admin') {
            window.location.href = 'admin-dashboard.html';
        } else {
            window.location.href = 'agent-dashboard.html';
        }

    } catch (error) {
        console.error('Login error:', error);
        errorMessage.textContent = error.message || 'Invalid email or password. Please try again.';
        errorMessage.classList.remove('hidden');
        
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Sign In</span><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>';
    }
}

async function checkAuthState() {
    if (!window.supabaseClient) return;
    
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        
        if (session) {
            // User is logged in, get their role
            const { data: profile } = await window.supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profile) {
                // Redirect to appropriate dashboard if on login page
                if (window.location.pathname.includes('login.html') || window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
                    if (profile.role === 'admin') {
                        window.location.href = 'admin-dashboard.html';
                    } else {
                        window.location.href = 'agent-dashboard.html';
                    }
                }
            }
        }
    } catch (error) {
        console.error('Auth state check error:', error);
    }
}

async function logout() {
    if (!window.supabaseClient) {
        sessionStorage.clear();
        window.location.href = 'login.html';
        return;
    }
    
    try {
        await window.supabaseClient.auth.signOut();
        sessionStorage.clear();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Protect dashboard pages
async function requireAuth(requiredRole = null) {
    if (!window.supabaseClient) {
        window.location.href = 'login.html';
        return null;
    }
    
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        
        if (!session) {
            window.location.href = 'login.html';
            return null;
        }

        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (!profile) {
            window.location.href = 'login.html';
            return null;
        }

        if (requiredRole && profile.role !== requiredRole) {
            // Redirect to appropriate dashboard
            if (profile.role === 'admin') {
                window.location.href = 'admin-dashboard.html';
            } else {
                window.location.href = 'agent-dashboard.html';
            }
            return null;
        }

        return { session, profile };
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = 'login.html';
        return null;
    }
}
