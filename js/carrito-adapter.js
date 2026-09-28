// Adaptador para que tu carrito.js actual funcione con productos de Supabase
// Incluir ESTE archivo ANTES de carrito.js en Carrito.html

// Sobrescribir la función de agregar para que use los nuevos datos
const originalAgregarAlCarrito = window.agregarAlCarrito;

window.agregarAlCarrito = function(nombreProducto, variante = '') {
    // Buscar en el catálogo actual (que ahora viene de Supabase en tienda.js)
    // Si no existe, usar el catálogo estático como fallback
    
    // La función original ya maneja el localStorage, solo necesitamos
    // asegurar que el formato sea compatible
    
    return originalAgregarAlCarrito.apply(this, arguments);
};

// Función para sincronizar stock (opcional - llamar después de una compra)
async function actualizarStock(productoId, cantidadVendida) {
    // Esta función se puede llamar desde el panel admin cuando confirmas una venta
    const { data: producto } = await supabase
        .from('productos')
        .select('stock')
        .eq('id', productoId)
        .single();
    
    if (producto) {
        const nuevoStock = Math.max(0, producto.stock - cantidadVendida);
        const disponible = nuevoStock > 0;
        
        await supabase
            .from('productos')
            .update({ stock: nuevoStock, disponible })
            .eq('id', productoId);
    }
}