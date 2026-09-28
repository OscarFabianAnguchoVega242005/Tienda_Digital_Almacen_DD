import { supabase } from './supabase_client.js';
import { CONFIG } from './config.js';

// Variables globales
let productos = [];
let categorias = [];
let descuentos = [];
let categoriaActiva = 'todos';

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    await cargarDatos();
    renderizarFiltros();
    renderizarProductos();
});

// ==================== CARGA DE DATOS ====================

async function cargarDatos() {
    try {
        // Cargar categorías
        const { data: cats, error: errorCats } = await supabase
            .from('categorias')
            .select('*')
            .eq('activa', true)
            .order('orden');
        
        if (errorCats) throw errorCats;
        categorias = cats || [];

        // Cargar productos disponibles
        const { data: prods, error: errorProds } = await supabase
            .from('productos')
            .select('*, categorias(nombre, icono)')
            .eq('disponible', true)
            .order('destacado', { ascending: false })
            .order('created_at', { ascending: false });
        
        if (errorProds) throw errorProds;
        productos = prods || [];

        // Cargar descuentos activos
        const { data: descs } = await supabase
            .from('descuentos')
            .select('*');
        descuentos = (descs || []).filter(d => {
            if (!d.activa) return false;
            if (d.fecha_fin && new Date(d.fecha_fin) < new Date()) return false;
            return true;
        });

    } catch (error) {
        console.error('Error cargando datos:', error);
        document.getElementById('contenedorProductos').innerHTML = `
            <div style="text-align: center; padding: 4rem; grid-column: 1/-1;">
                <p style="color: #ef4444; font-size: 1.25rem;">❌ Error cargando productos</p>
                <p style="color: #6b7280; margin-top: 1rem;">Por favor recarga la página</p>
            </div>
        `;
    }
}

// ==================== RENDERIZADO ====================

function descuentoEfectivo(prod) {
    const promo = descuentos.find(d => {
        if (d.tipo === 'producto') return d.referencia_id === prod.id;
        if (d.tipo === 'categoria') return d.referencia_id === prod.categoria_id;
        return false;
    });
    return Math.max(prod.descuento || 0, promo ? promo.descuento : 0);
}

function renderizarFiltros() {
    const container = document.getElementById('filtrosCategorias');
    if (!container) return;

    container.innerHTML = categorias.map(cat => `
        <button class="filtro-btn" onclick="filtrarCategoria('${cat.id}')" data-cat="${cat.id}">
            ${cat.icono || '📦'} ${cat.nombre}
        </button>
    `).join('');
}

function renderizarProductos(filtrados = null) {
    const container = document.getElementById('contenedorProductos');
    if (!container) return;

    const productosMostrar = filtrados || productos;

    if (productosMostrar.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem; grid-column: 1/-1;">
                <p style="font-size: 1.25rem; color: #6b7280;">No se encontraron productos</p>
            </div>
        `;
        return;
    }

    container.innerHTML = productosMostrar.map((prod, index) => {
        // Calcular precio con descuento
        const descuento = descuentoEfectivo(prod);
        const precioOriginal = prod.precio;
        const precioFinal = descuento > 0 
            ? Math.round(precioOriginal * (1 - descuento / 100))
            : precioOriginal;

        // Badges
        let badges = '';
        if (!prod.disponible || prod.stock === 0) {
            badges += '<div class="item-badge no-disponible">Agotado</div>';
        } else if (descuento > 0) {
            badges += `<div class="item-badge descuento">-${descuento}%</div>`;
        }

        // Stock message
        let stockMsg = '';
        if (prod.stock === 0) {
            stockMsg = '<p class="item-stock bajo">⛔ Agotado</p>';
        } else if (prod.stock < 5) {
            stockMsg = `<p class="item-stock bajo">⚠️ Solo ${prod.stock} disponibles</p>`;
        } else {
            stockMsg = `<p class="item-stock">✅ ${prod.stock} en stock</p>`;
        }

        // Precio display
        const precioHTML = descuento > 0
            ? `<div class="item-precio">
                <span class="precio-original">$${precioOriginal.toLocaleString('es-CO')}</span>
                $${precioFinal.toLocaleString('es-CO')}
                <span class="descuento-tag">(-${descuento}%)</span>
               </div>`
            : `<div class="item-precio">$${precioFinal.toLocaleString('es-CO')}</div>`;

        // Variantes select
        let variantesHTML = '';
        if (prod.variantes && prod.variantes.length > 0) {
            const selectId = `variante-${prod.id}`;
            variantesHTML = `
                <select class="variantes-select" id="${selectId}">
                    <option value="">Seleccionar opción...</option>
                    ${prod.variantes.map(v => `<option value="${v}">${v}</option>`).join('')}
                </select>
            `;
        }

        // Botón agregar
        const puedeAgregar = prod.disponible && prod.stock > 0;
        const btnHTML = puedeAgregar
            ? `<button class="btn-agregar" onclick="agregarAlCarritoDesdeTienda('${prod.id}')">
                 🛒 Agregar al carrito
               </button>`
            : `<button class="btn-agregar" disabled>
                 ⛔ No disponible
               </button>`;

        // Delay animation
        const delay = index * 0.05;

        return `
            <div class="item" style="animation-delay: ${delay}s">
                ${badges}
                <div class="item-image-wrapper">
                    ${prod.imagen_url 
                        ? `<img src="${prod.imagen_url}" alt="${prod.nombre}" loading="lazy">`
                        : '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 3rem;">📦</div>'
                    }
                </div>
                <div class="item-content">
                    <h2>${prod.nombre}</h2>
                    <p class="item-description">${prod.descripcion || ''}</p>
                    ${precioHTML}
                    ${stockMsg}
                    ${variantesHTML}
                    ${btnHTML}
                </div>
            </div>
        `;
    }).join('');
}

// ==================== FILTROS Y BÚSQUEDA ====================

function filtrarCategoria(catId) {
    categoriaActiva = catId;
    
    // Actualizar UI de botones
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.cat === catId || (catId === 'todos' && !btn.dataset.cat)) {
            btn.classList.add('active');
        }
    });

    // Filtrar productos
    let filtrados = productos;
    if (catId !== 'todos') {
        filtrados = productos.filter(p => p.categoria_id === catId);
    }

    renderizarProductos(filtrados);
}

function buscarProductos(termino) {
    const terminoLower = termino.toLowerCase().trim();
    
    if (!terminoLower) {
        filtrarCategoria(categoriaActiva);
        return;
    }

    const filtrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(terminoLower) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(terminoLower)) ||
        (p.categorias?.nombre && p.categorias.nombre.toLowerCase().includes(terminoLower))
    );

    // Resetear filtros visuales
    document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
    
    renderizarProductos(filtrados);
}

// ==================== CARRITO ====================

function agregarAlCarritoDesdeTienda(productoId) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    if (producto.stock <= 0) {
        mostrarNotificacion('⛔ Producto agotado', 'error');
        return;
    }

    // Obtener variante seleccionada
    const selectVariante = document.getElementById(`variante-${productoId}`);
    const variante = selectVariante ? selectVariante.value : '';

    // APLICAR DESCUENTO EFECTIVO
    const descuento = descuentoEfectivo(producto);
    const precioOriginal = producto.precio;
    const precioConDescuento = descuento > 0 
        ? Math.round(precioOriginal * (1 - descuento / 100))
        : precioOriginal;

    // Crear objeto para carrito
    const itemCarrito = {
        id: producto.id,
        nombre: producto.nombre,
        descripcion: producto.descripcion || '',
        precio: precioConDescuento,        // Precio YA CON DESCUENTO APLICADO
        precioOriginal: precioOriginal,     // Guardamos original para mostrar tachado
        descuento: descuento,               // Porcentaje de descuento (0 si no tiene)
        imagen: producto.imagen_url || 'imagenes/placeholder.jpg',
        variante: variante,
        cantidad: 1,
        categoria: producto.categorias?.nombre || 'General'
    };

    // Guardar en localStorage
    let carrito = JSON.parse(localStorage.getItem('almacen_don_diego_carrito_v1')) || [];
    
    const existente = carrito.find(item => 
        item.nombre === itemCarrito.nombre && item.variante === itemCarrito.variante
    );

    if (existente) {
        existente.cantidad += 1;
    } else {
        carrito.push(itemCarrito);
    }

    localStorage.setItem('almacen_don_diego_carrito_v1', JSON.stringify(carrito));

    const mensaje = variante 
        ? `${producto.nombre} (${variante}) agregado al carrito ✅`
        : `${producto.nombre} agregado al carrito ✅`;
    
    mostrarNotificacion(mensaje, 'success');
}

// ==================== NOTIFICACIONES ====================

function mostrarNotificacion(mensaje, tipo = 'success') {
    // Remover notificación anterior si existe
    const anterior = document.getElementById('notificacion-flotante');
    if (anterior) anterior.remove();

    const div = document.createElement('div');
    div.id = 'notificacion-flotante';
    div.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        background: ${tipo === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;
    div.textContent = mensaje;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(div);

    setTimeout(() => {
        div.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

// ==================== SOPORTE (WhatsApp) ====================

function abrirModalSoporte() {
    document.getElementById('modalSoporte').classList.add('active');
}

function cerrarModalSoporte() {
    document.getElementById('modalSoporte').classList.remove('active');
}

function enviarWhatsAppSoporte() {
    const mensaje = document.getElementById('mensajeSoporte').value.trim();
    
    if (!mensaje) {
        alert('Por favor escribe tu pregunta');
        return;
    }

    const texto = encodeURIComponent(
        `¡Hola! Tengo una consulta desde la Página Web de Almacén Don Diego:\n\n"${mensaje}"`
    );

    window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${texto}`, '_blank');
    
    document.getElementById('mensajeSoporte').value = '';
    cerrarModalSoporte();
}

// Cerrar modal al hacer click fuera
document.addEventListener('click', (e) => {
    const modal = document.getElementById('modalSoporte');
    if (e.target === modal) {
        cerrarModalSoporte();
    }
});

// ==================== EXPORTS GLOBALES ====================

window.filtrarCategoria = filtrarCategoria;
window.buscarProductos = buscarProductos;
window.agregarAlCarritoDesdeTienda = agregarAlCarritoDesdeTienda;
window.abrirModalSoporte = abrirModalSoporte;
window.cerrarModalSoporte = cerrarModalSoporte;
window.enviarWhatsAppSoporte = enviarWhatsAppSoporte;