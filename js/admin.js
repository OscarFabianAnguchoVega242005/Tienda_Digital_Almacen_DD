import { supabase, isAuthenticated, getCurrentUser, login, logout, loginWithGoogle } from './supabase_client.js';
import { CONFIG } from './config.js';

// Variables globales
let categorias = [];
let productos = [];
let pedidos = [];
let editingProductId = null;

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar si está autenticado
    const auth = await isAuthenticated();
    
    if (auth) {
        showPanel();
        await loadInitialData();
    } else {
        showLogin();
    }

    // Event listeners
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('productoForm')?.addEventListener('submit', handleSaveProducto);
    document.getElementById('categoriaForm')?.addEventListener('submit', handleSaveCategoria);
});

// ==================== AUTENTICACIÓN ====================

function showLogin() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('panelSection').style.display = 'none';
}

function showPanel() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('panelSection').style.display = 'block';
    
    getCurrentUser().then(user => {
        document.getElementById('userEmail').textContent = user?.email || 'Admin';
    });
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    console.log('🔐 Intentando login...');
    console.log('Email:', email);
    
    // Validar campos
    if (!email || !password) {
        errorDiv.textContent = 'Por favor ingresa email y contraseña';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Mostrar cargando
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Ingresando...';
    submitBtn.disabled = true;
    errorDiv.style.display = 'none';
    
    try {
        const { data, error } = await login(email, password);
        
        if (error) {
            console.error('❌ Error de autenticación:', error);
            
            // Mensajes de error amigables
            let mensajeError = 'Error al iniciar sesión';
            
            if (error.message.includes('Invalid login credentials')) {
                mensajeError = 'Email o contraseña incorrectos';
            } else if (error.message.includes('Email not confirmed')) {
                mensajeError = 'El email no ha sido confirmado. Revisa tu correo.';
            } else if (error.message.includes('network')) {
                mensajeError = 'Error de conexión. Verifica tu internet.';
            } else {
                mensajeError = error.message;
            }
            
            errorDiv.textContent = mensajeError;
            errorDiv.style.display = 'block';
            
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            return;
        }
        
        if (!data || !data.user) {
            errorDiv.textContent = 'Error: No se pudo obtener información del usuario';
            errorDiv.style.display = 'block';
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            return;
        }
        
        console.log('✅ Login exitoso, mostrando panel...');
        showPanel();
        await loadInitialData();
        
    } catch (e) {
        console.error('❌ Error inesperado en login:', e);
        errorDiv.textContent = 'Error inesperado: ' + e.message;
        errorDiv.style.display = 'block';
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}
// ==================== CARGA DE DATOS ====================

async function loadInitialData() {
    await Promise.all([
        loadCategorias(),
        loadProductos(),
        loadPedidos()
    ]);
    
    populateCategoriasSelect();
    renderProductos();
    renderCategorias();
    renderPedidos();
    calcularEstadisticas();
}

// ==================== CATEGORÍAS ====================

async function loadCategorias() {
    const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('activa', true)
        .order('orden');
    
    if (error) {
        console.error('Error cargando categorías:', error);
        return;
    }
    
    categorias = data || [];
}

function populateCategoriasSelect() {
    const select = document.getElementById('prodCategoria');
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleccionar...</option>';
    
    categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = `${cat.icono || '📦'} ${cat.nombre}`;
        select.appendChild(option);
    });
}

function renderCategorias() {
    const container = document.getElementById('listaCategorias');
    if (!container) return;
    
    container.innerHTML = categorias.map(cat => `
        <div class="categoria-item">
            <div class="categoria-info">
                <span class="categoria-icon">${cat.icono || '📦'}</span>
                <div>
                    <strong>${cat.nombre}</strong>
                    <small style="display: block; color: var(--text-gray);">
                        Slug: ${cat.slug} | Orden: ${cat.orden}
                    </small>
                </div>
            </div>
            <div>
                <button class="btn-action btn-edit" onclick="editCategoria('${cat.id}')">✏️</button>
                <button class="btn-action btn-delete" onclick="deleteCategoria('${cat.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

function showModalCategoria() {
    document.getElementById('modalCategoria').classList.add('active');
    document.getElementById('categoriaForm').reset();
}

function closeModalCategoria() {
    document.getElementById('modalCategoria').classList.remove('active');
}

async function handleSaveCategoria(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('catNombre').value.trim();
    const icono = document.getElementById('catIcono').value.trim() || '📦';
    const orden = parseInt(document.getElementById('catOrden').value) || 0;
    
    // Generar slug automáticamente
    const slug = nombre.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    
    const { data, error } = await supabase
        .from('categorias')
        .insert([{ nombre, icono, orden, slug }])
        .select();
    
    if (error) {
        alert('Error creando categoría: ' + error.message);
        return;
    }
    
    alert('✅ Categoría creada correctamente');
    closeModalCategoria();
    await loadCategorias();
    populateCategoriasSelect();
    renderCategorias();
}

async function deleteCategoria(id) {
    if (!confirm('¿Eliminar esta categoría? Los productos quedarán sin categoría.')) return;
    
    const { error } = await supabase
        .from('categorias')
        .update({ activa: false })
        .eq('id', id);
    
    if (error) {
        alert('Error eliminando categoría: ' + error.message);
        return;
    }
    
    await loadCategorias();
    populateCategoriasSelect();
    renderCategorias();
}

// ==================== PRODUCTOS ====================

async function loadProductos() {
    const { data, error } = await supabase
        .from('productos')
        .select('*, categorias(nombre, icono)')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error cargando productos:', error);
        return;
    }
    
    productos = data || [];
}

function renderProductos() {
    const tbody = document.getElementById('tbodyProductos');
    if (!tbody) return;
    
    if (productos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No hay productos registrados</td></tr>';
        return;
    }
    
    tbody.innerHTML = productos.map(prod => {
        const categoria = prod.categorias || { nombre: 'Sin categoría', icono: '❓' };
        const precioFormateado = new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(prod.precio);
        
        let estadoClass = 'badge-success';
        let estadoText = 'Disponible';
        
        if (!prod.disponible) {
            estadoClass = 'badge-danger';
            estadoText = 'No disponible';
        } else if (prod.stock === 0) {
            estadoClass = 'badge-warning';
            estadoText = 'Sin stock';
        } else if (prod.stock < 5) {
            estadoClass = 'badge-warning';
            estadoText = `Stock bajo (${prod.stock})`;
        }
        
        return `
            <tr>
                <td>
                    ${prod.imagen_url 
                        ? `<img src="${prod.imagen_url}" class="product-img" alt="${prod.nombre}">`
                        : '<div style="width: 60px; height: 60px; background: var(--bg-light); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">📦</div>'
                    }
                </td>
                <td>
                    <strong>${prod.nombre}</strong>
                    ${prod.descuento > 0 ? `<br><small style="color: var(--accent);">-${prod.descuento}% descuento</small>` : ''}
                </td>
                <td>${categoria.icono} ${categoria.nombre}</td>
                <td>${precioFormateado}</td>
                <td>${prod.stock}</td>
                <td><span class="badge ${estadoClass}">${estadoText}</span></td>
                <td>
                    <button class="btn-action btn-edit" onclick="editProducto('${prod.id}')" title="Editar">✏️</button>
                    <button class="btn-action btn-toggle" onclick="toggleDisponible('${prod.id}', ${!prod.disponible})" title="${prod.disponible ? 'Desactivar' : 'Activar'}">
                        ${prod.disponible ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteProducto('${prod.id}')" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Preview de imagen antes de subir
function previewImage(input) {
    const preview = document.getElementById('imagePreview');
    const uploadText = document.getElementById('uploadText');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            uploadText.style.display = 'none';
        };
        
        reader.readAsDataURL(input.files[0]);
    }
}

// Manejar variantes
function addVariante() {
    const container = document.getElementById('variantesList');
    const row = document.createElement('div');
    row.className = 'variante-row';
    row.innerHTML = `
        <input type="text" placeholder="Ej: Color azul" class="variante-input">
        <button type="button" class="btn-remove-variante" onclick="removeVariante(this)">❌</button>
    `;
    container.appendChild(row);
}

function removeVariante(btn) {
    btn.parentElement.remove();
}

// Guardar producto (crear o editar)
async function handleSaveProducto(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<span class="loading"></span> Guardando...';
    submitBtn.disabled = true;
    
    try {
        // Recoger datos del formulario
        const nombre = document.getElementById('prodNombre').value.trim();
        const categoria_id = document.getElementById('prodCategoria').value;
        const precio = parseInt(document.getElementById('prodPrecio').value) || 0;
        const stock = parseInt(document.getElementById('prodStock').value) || 0;
        const descripcion = document.getElementById('prodDescripcion').value.trim();
        const descuento = parseInt(document.getElementById('prodDescuento').value) || 0;
        const disponible = document.getElementById('prodDisponible').checked;
        const destacado = document.getElementById('prodDestacado').checked;
        
        // Recoger variantes
        const variantes = [];
        document.querySelectorAll('.variante-input').forEach(input => {
            if (input.value.trim()) {
                variantes.push(input.value.trim());
            }
        });
        
        // Preparar objeto producto
        const productoData = {
            nombre,
            categoria_id: categoria_id || null,
            precio,
            stock,
            descripcion,
            descuento,
            disponible,
            destacado,
            variantes: variantes.length > 0 ? variantes : []
        };
        
        // Subir imagen si hay archivo nuevo
        const imagenFile = document.getElementById('prodImagen').files[0];
        let imagen_url = null;
        
        if (imagenFile) {
            const fileExt = imagenFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('productos')
                .upload(fileName, imagenFile, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) {
                throw new Error('Error subiendo imagen: ' + uploadError.message);
            }
            
            // Obtener URL pública
            const { data: { publicUrl } } = supabase.storage
                .from('productos')
                .getPublicUrl(fileName);
            
            imagen_url = publicUrl;
            productoData.imagen_url = imagen_url;
        }
        
        // Insertar o actualizar
        if (editingProductId) {
            // Actualizar
            if (!imagen_url) {
                // Mantener imagen anterior si no se subió nueva
                delete productoData.imagen_url;
            }
            
            const { error } = await supabase
                .from('productos')
                .update(productoData)
                .eq('id', editingProductId);
            
            if (error) throw error;
            
            alert('✅ Producto actualizado correctamente');
        } else {
            // Crear nuevo
            const { error } = await supabase
                .from('productos')
                .insert([productoData]);
            
            if (error) throw error;
            
            alert('✅ Producto creado correctamente');
        }
        
        // Resetear formulario y recargar
        resetForm();
        await loadProductos();
        renderProductos();
        showTab('productos');
        
    } catch (error) {
        alert('❌ Error: ' + error.message);
        console.error(error);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Editar producto existente
async function editProducto(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;
    
    editingProductId = id;
    
    // Llenar formulario
    document.getElementById('productoId').value = id;
    document.getElementById('prodNombre').value = producto.nombre;
    document.getElementById('prodCategoria').value = producto.categoria_id || '';
    document.getElementById('prodPrecio').value = producto.precio;
    document.getElementById('prodStock').value = producto.stock;
    document.getElementById('prodDescripcion').value = producto.descripcion || '';
    document.getElementById('prodDescuento').value = producto.descuento || 0;
    document.getElementById('prodDisponible').checked = producto.disponible;
    document.getElementById('prodDestacado').checked = producto.destacado || false;
    
    // Mostrar imagen actual si existe
    const preview = document.getElementById('imagePreview');
    const uploadText = document.getElementById('uploadText');
    
    if (producto.imagen_url) {
        preview.src = producto.imagen_url;
        preview.style.display = 'block';
        uploadText.style.display = 'none';
    } else {
        preview.style.display = 'none';
        uploadText.style.display = 'block';
    }
    
    // Cargar variantes
    const variantesList = document.getElementById('variantesList');
    variantesList.innerHTML = '';
    
    if (producto.variantes && producto.variantes.length > 0) {
        producto.variantes.forEach(v => {
            const row = document.createElement('div');
            row.className = 'variante-row';
            row.innerHTML = `
                <input type="text" value="${v}" class="variante-input">
                <button type="button" class="btn-remove-variante" onclick="removeVariante(this)">❌</button>
            `;
            variantesList.appendChild(row);
        });
    } else {
        // Fila vacía por defecto
        addVariante();
    }
    
    // Cambiar título y mostrar tab
    document.getElementById('formTitle').textContent = 'Editar Producto';
    showTab('agregar');
}

// Toggle disponible/no disponible
async function toggleDisponible(id, nuevoEstado) {
    const { error } = await supabase
        .from('productos')
        .update({ disponible: nuevoEstado })
        .eq('id', id);
    
    if (error) {
        alert('Error actualizando producto: ' + error.message);
        return;
    }
    
    await loadProductos();
    renderProductos();
}

// Eliminar producto
async function deleteProducto(id) {
    if (!confirm('¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.')) {
        return;
    }
    
    const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', id);
    
    if (error) {
        alert('Error eliminando producto: ' + error.message);
        return;
    }
    
    await loadProductos();
    renderProductos();
}

// Resetear formulario
function resetForm() {
    document.getElementById('productoForm').reset();
    document.getElementById('productoId').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('uploadText').style.display = 'block';
    document.getElementById('formTitle').textContent = 'Agregar Nuevo Producto';
    
    // Reset variantes
    document.getElementById('variantesList').innerHTML = `
        <div class="variante-row">
            <input type="text" placeholder="Ej: Color rojo" class="variante-input">
            <button type="button" class="btn-remove-variante" onclick="removeVariante(this)">❌</button>
        </div>
    `;
    
    editingProductId = null;
}

// ==================== PEDIDOS ====================

async function loadPedidos() {
    const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error cargando pedidos:', error);
        return;
    }
    
    pedidos = data || [];
}

function renderPedidos() {
    const tbody = document.getElementById('tbodyPedidos');
    if (!tbody) return;
    
    if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No hay pedidos registrados</td></tr>';
        return;
    }
    
    tbody.innerHTML = pedidos.map(ped => {
        const fecha = new Date(ped.created_at).toLocaleString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const productosList = ped.productos.map(p => 
            `${p.nombre} x${p.cantidad}`
        ).join(', ');
        
        let estadoClass = 'badge-warning';
        if (ped.estado === 'completado') estadoClass = 'badge-success';
        if (ped.estado === 'cancelado') estadoClass = 'badge-danger';
        
        return `
            <tr>
                <td>${fecha}</td>
                <td>
                    <strong>${ped.cliente_nombre || 'Sin nombre'}</strong>
                    <br><small>${ped.cliente_telefono || ''}</small>
                </td>
                <td style="max-width: 300px; font-size: 0.875rem;">
                    ${productosList}
                </td>
                <td>
                    <strong>$${ped.total.toLocaleString('es-CO')}</strong>
                    <br><small style="color: var(--text-gray);">
                        ${ped.tipo_entrega === 'envio' ? '🚚 Envío' : '📍 Recoger'}
                    </small>
                </td>
                <td><span class="badge ${estadoClass}">${ped.estado}</span></td>
                <td>
                    <button class="btn-action btn-edit" onclick="verPedido('${ped.id}')" title="Ver detalle">👁️</button>
                    ${ped.estado === 'pendiente' ? `
                        <button class="btn-action btn-edit" onclick="cambiarEstadoPedido('${ped.id}', 'completado')" title="Marcar completado">✅</button>
                        <button class="btn-action btn-delete" onclick="cambiarEstadoPedido('${ped.id}', 'cancelado')" title="Cancelar">❌</button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

async function cambiarEstadoPedido(id, nuevoEstado) {
    const { error } = await supabase
        .from('pedidos')
        .update({ estado: nuevoEstado })
        .eq('id', id);
    
    if (error) {
        alert('Error actualizando pedido: ' + error.message);
        return;
    }
    
    await loadPedidos();
    renderPedidos();
    calcularEstadisticas();
}

function verPedido(id) {
    const pedido = pedidos.find(p => p.id === id);
    if (!pedido) return;
    
    const productosDetalle = pedido.productos.map(p => 
        `- ${p.nombre} x${p.cantidad} = $${p.subtotal.toLocaleString('es-CO')}`
    ).join('\n');
    
    const mensaje = `
📦 PEDIDO #${id.slice(0, 8)}

👤 Cliente: ${pedido.cliente_nombre || 'No especificado'}
📱 Teléfono: ${pedido.cliente_telefono || 'No especificado'}

🛒 Productos:
${productosDetalle}

💰 Subtotal: $${pedido.subtotal.toLocaleString('es-CO')}
🚚 Envío: ${pedido.envio === 0 ? 'GRATIS' : '$' + pedido.envio.toLocaleString('es-CO')}
💵 TOTAL: $${pedido.total.toLocaleString('es-CO')}

📍 Tipo entrega: ${pedido.tipo_entrega === 'envio' ? 'Envío a domicilio' : 'Recoger en tienda'}
${pedido.direccion ? `🏠 Dirección: ${pedido.direccion}` : ''}

🕐 Fecha: ${new Date(pedido.created_at).toLocaleString('es-CO')}
📊 Estado: ${pedido.estado.toUpperCase()}
    `.trim();
    
    alert(mensaje);
}

// ==================== ESTADÍSTICAS ====================

async function calcularEstadisticas() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    // Ventas hoy
    const ventasHoy = pedidos
        .filter(p => p.estado === 'completado' && new Date(p.created_at) >= hoy)
        .reduce((sum, p) => sum + p.total, 0);
    
    // Ventas esta semana
    const ventasSemana = pedidos
        .filter(p => p.estado === 'completado' && new Date(p.created_at) >= inicioSemana)
        .reduce((sum, p) => sum + p.total, 0);
    
    // Ventas este mes
    const ventasMes = pedidos
        .filter(p => p.estado === 'completado' && new Date(p.created_at) >= inicioMes)
        .reduce((sum, p) => sum + p.total, 0);
    
    // Total histórico
    const ventasTotal = pedidos
        .filter(p => p.estado === 'completado')
        .reduce((sum, p) => sum + p.total, 0);
    
    // Actualizar UI
    document.getElementById('statHoy').textContent = '$' + ventasHoy.toLocaleString('es-CO');
    document.getElementById('statSemana').textContent = '$' + ventasSemana.toLocaleString('es-CO');
    document.getElementById('statMes').textContent = '$' + ventasMes.toLocaleString('es-CO');
    document.getElementById('statTotal').textContent = '$' + ventasTotal.toLocaleString('es-CO');
    
    // Calcular productos más vendidos
    const productosVendidos = {};
    pedidos
        .filter(p => p.estado === 'completado')
        .forEach(ped => {
            ped.productos.forEach(prod => {
                if (!productosVendidos[prod.nombre]) {
                    productosVendidos[prod.nombre] = {
                        cantidad: 0,
                        total: 0
                    };
                }
                productosVendidos[prod.nombre].cantidad += prod.cantidad;
                productosVendidos[prod.nombre].total += prod.subtotal;
            });
        });
    
    // Ordenar por cantidad vendida
    const topProductos = Object.entries(productosVendidos)
        .sort((a, b) => b[1].cantidad - a[1].cantidad)
        .slice(0, 10);
    
    const tbodyTop = document.getElementById('tbodyTopProductos');
    if (tbodyTop) {
        if (topProductos.length === 0) {
            tbodyTop.innerHTML = '<tr><td colspan="3" style="text-align: center;">No hay ventas registradas</td></tr>';
        } else {
            tbodyTop.innerHTML = topProductos.map(([nombre, datos]) => `
                <tr>
                    <td>${nombre}</td>
                    <td>${datos.cantidad} unidades</td>
                    <td>$${datos.total.toLocaleString('es-CO')}</td>
                </tr>
            `).join('');
        }
    }
}

// ==================== UTILIDADES ====================

function showTab(tabName) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    // Mostrar la seleccionada
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
    event.target?.classList.add('active');
    
    // Recalcular estadísticas si es necesario
    if (tabName === 'estadisticas') {
        calcularEstadisticas();
    }
}

// Exponer funciones globales para los onclick
window.logout = logout;
window.showTab = showTab;
window.previewImage = previewImage;
window.addVariante = addVariante;
window.removeVariante = removeVariante;
window.resetForm = resetForm;
window.editProducto = editProducto;
window.toggleDisponible = toggleDisponible;
window.deleteProducto = deleteProducto;
window.showModalCategoria = showModalCategoria;
window.closeModalCategoria = closeModalCategoria;
window.editCategoria = (id) => alert('Función de editar categoría - implementar si es necesario');
window.deleteCategoria = deleteCategoria;
window.cambiarEstadoPedido = cambiarEstadoPedido;
window.verPedido = verPedido;