import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Inicializar cliente Supabase
let supabase;

try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    });
    console.log('✅ Supabase inicializado correctamente');
} catch (error) {
    console.error('❌ Error inicializando Supabase:', error);
    throw error;
}

// Helper: Verificar si está autenticado
async function isAuthenticated() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('Error verificando sesión:', error);
            return false;
        }
        return !!session;
    } catch (e) {
        console.error('Error en isAuthenticated:', e);
        return false;
    }
}

// Helper: Obtener usuario actual
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
            console.error('Error obteniendo usuario:', error);
            return null;
        }
        return user;
    } catch (e) {
        console.error('Error en getCurrentUser:', e);
        return null;
    }
}

// Helper: Login con Google
async function loginWithGoogle() {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: 'https://almacen-don-diego.pages.dev/index.html'
            }
        });
        if (error) return { data: null, error };
        return { data, error: null };
    } catch (e) {
        return { data: null, error: { message: 'Error de conexión: ' + e.message } };
    }
}

// Helper: Login con email
async function login(email, password) {
    try {
        console.log('Intentando login con:', email);
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });
        
        if (error) {
            console.error('Error de login:', error);
            return { data: null, error };
        }
        
        console.log('✅ Login exitoso:', data.user?.email);
        return { data, error: null };
        
    } catch (e) {
        console.error('Error en login:', e);
        return { data: null, error: { message: 'Error de conexión: ' + e.message } };
    }
}

// Helper: Logout
async function logout() {
    try {
        await supabase.auth.signOut();
        window.location.href = 'admin.html';
    } catch (e) {
        console.error('Error en logout:', e);
    }
}

export { supabase, isAuthenticated, getCurrentUser, login, logout, loginWithGoogle };