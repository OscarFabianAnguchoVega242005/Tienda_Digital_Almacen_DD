import { CONFIG } from './config.js';

// ============================================================
// CARRITO DE COMPRAS - ALMACÉN DON DIEGO
// Descuentos aplicados desde panel de admin
// BOT DE TELEGRAM: SIN MODIFICACIONES
// ============================================================

const STORAGE_KEY = "almacen_don_diego_carrito_v1";

// Variables globales
let seleccionados = new Set();
let carrito = [];

// ============================================================
// FUNCIONES BASE
// ============================================================

function getCart() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
        console.error("Error leyendo carrito:", e);
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

// ============================================================
// RENDERIZADO DEL CARRITO
// ============================================================

function mostrarCarritoConSeleccion() {
    const lista = document.getElementById("lista-carrito");
    const totalDiv = document.getElementById("total-carrito");
    const checkTodo = document.getElementById("select-todo");

    if (!lista) return;
    
    carrito = getCart();
    lista.innerHTML = "";

    if (!carrito || carrito.length === 0) {
        lista.innerHTML = `
            <div class="carrito-vacio">
                <div class="carrito-vacio-icon">🛒</div>
                <h3>Tu carrito está vacío</h3>
                <p>¡Agrega productos desde nuestra tienda!</p>
                <a href="index.html" class="btn-seguir">← Seguir comprando</a>
            </div>
        `;
        if (totalDiv) totalDiv.innerHTML = '<span style="color:gray;">Selecciona productos para ver el total</span>';
        if (checkTodo) checkTodo.checked = false;
        return;
    }

    let totalProductos = 0;
    
    carrito.forEach((item, index) => {
        // El precio YA viene con descuento aplicado desde tienda.js
        // Pero guardamos el original para mostrar tachado
        const precioConDescuento = item.precio; // Este ya tiene descuento aplicado
        const precioOriginal = item.precioOriginal || item.precio;
        const tieneDescuento = item.descuento > 0 && precioOriginal > precioConDescuento;
        
        const subtotal = precioConDescuento * item.cantidad;
        if (seleccionados.has(index)) totalProductos += subtotal;

        lista.innerHTML += `
            <div class="producto" data-index="${index}">
                <img src="${item.imagen || 'imagenes/placeholder.jpg'}" alt="${item.nombre}" class="producto-imagen">
                <div class="producto-info">
                    <div class="nombre">${item.nombre}</div>
                    ${item.variante ? `<div class="variante">📌 ${item.variante}</div>` : ''}
                    ${item.descripcion ? `<div class="descripcion">${item.descripcion}</div>` : ''}
                    
                    <div class="producto-precio">
                        ${tieneDescuento ? `<span class="precio-original">$${precioOriginal.toLocaleString('es-CO')}</span>` : ''}
                        <span class="precio-final">$${precioConDescuento.toLocaleString('es-CO')}</span>
                        ${tieneDescuento ? `<span class="descuento-tag">-${item.descuento}%</span>` : ''}
                    </div>

                    <div class="producto-acciones">
                        <input type="checkbox" class="producto-check" id="check-${index}" 
                               ${seleccionados.has(index) ? "checked" : ""} 
                               onchange="toggleSeleccion(${index})">
                        <label for="check-${index}">Seleccionar</label>
                        
                        <label>Cantidad:</label>
                        <input type="number" min="1" value="${item.cantidad}" 
                               onchange="cambiarCantidad(${index}, this.value)">
                        
                        <button class="btn-eliminar" onclick="eliminarProducto(${index})">❌ Eliminar</button>
                    </div>
                </div>
            </div>
        `;
    });

    // Calcular envío y total
    const envio = totalProductos >= CONFIG.ENVIO_GRATIS_MINIMO ? 0 : CONFIG.COSTO_ENVIO;
    const totalFinal = totalProductos + envio;

    if (totalDiv) {
        totalDiv.innerHTML = seleccionados.size > 0
            ? `
                <div class="resumen-envio">
                    Subtotal: <strong>$${totalProductos.toLocaleString('es-CO')}</strong>
                </div>
                <div class="resumen-envio ${envio === 0 ? 'envio-gratis' : ''}">
                    Envío: ${envio === 0 ? '¡GRATIS! 🎉' : '$' + envio.toLocaleString('es-CO')}
                </div>
                <div style="font-size: 1.3rem; margin-top: 0.5rem;">
                    Total: <strong style="color: var(--primary);">$${totalFinal.toLocaleString('es-CO')}</strong>
                </div>
            `
            : `<span style="color:gray;">Selecciona productos para ver el total</span>`;
    }

    if (checkTodo) {
        checkTodo.checked = carrito.length > 0 && seleccionados.size === carrito.length;
    }
}

// ============================================================
// CONTROL DE SELECCIÓN
// ============================================================

function toggleSeleccion(index) {
    if (seleccionados.has(index)) {
        seleccionados.delete(index);
    } else {
        seleccionados.add(index);
    }
    mostrarCarritoConSeleccion();
}

function seleccionarTodo(checkbox) {
    seleccionados.clear();
    if (checkbox.checked) {
        carrito.forEach((_, i) => seleccionados.add(i));
    }
    mostrarCarritoConSeleccion();
}

// ============================================================
// GESTIÓN DE PRODUCTOS
// ============================================================

function cambiarCantidad(index, nuevaCantidad) {
    nuevaCantidad = parseInt(nuevaCantidad) || 1;
    if (nuevaCantidad < 1) nuevaCantidad = 1;
    
    carrito[index].cantidad = nuevaCantidad;
    saveCart(carrito);
    mostrarCarritoConSeleccion();
}

function eliminarProducto(index) {
    if (!confirm('¿Eliminar este producto del carrito?')) return;
    
    carrito.splice(index, 1);
    saveCart(carrito);

    const nuevosSeleccionados = new Set();
    seleccionados.forEach(i => {
        if (i < index) nuevosSeleccionados.add(i);
        else if (i > index) nuevosSeleccionados.add(i - 1);
    });
    seleccionados = nuevosSeleccionados;

    mostrarCarritoConSeleccion();
}

function vaciarCarrito() {
    if (!confirm('¿Vaciar todo el carrito?')) return;
    
    localStorage.removeItem(STORAGE_KEY);
    seleccionados.clear();
    mostrarCarritoConSeleccion();
}

// ============================================================
// MODAL DE COMPRA
// ============================================================

function continuarConCompra() {
    if (seleccionados.size === 0) {
        mostrarPopup("⚠️ Selecciona al menos un producto.");
        return;
    }

    let productosHTML = '';
    let subtotal = 0;

    seleccionados.forEach(index => {
        const item = carrito[index];
        const itemSubtotal = item.precio * item.cantidad; // precio ya tiene descuento
        subtotal += itemSubtotal;

        productosHTML += `
            <div class="producto-resumen">
                <span>${item.nombre} ${item.variante ? `(${item.variante})` : ''} × ${item.cantidad}</span>
                <span>$${itemSubtotal.toLocaleString('es-CO')}</span>
            </div>
        `;
    });

    document.getElementById('productos-seleccionados').innerHTML = productosHTML;
    document.getElementById('subtotal-valor').textContent = '$' + subtotal.toLocaleString('es-CO');

    document.getElementById('direccion-entrega').value = '';
    document.getElementById('modal-compra').style.display = 'flex';
    
    actualizarEntrega();
}

function cerrarModal() {
    document.getElementById('modal-compra').style.display = 'none';
}

function actualizarEntrega() {
    const tipo = document.querySelector('input[name="tipo-entrega"]:checked')?.value;
    const campoDireccion = document.getElementById('campo-direccion');
    const btn = document.getElementById('btn-comprar-whatsapp');

    if (tipo === 'envio') {
        campoDireccion.style.display = 'block';
        const direccion = document.getElementById('direccion-entrega').value.trim();
        btn.disabled = !direccion;
    } else {
        campoDireccion.style.display = 'none';
        btn.disabled = false;
    }

    const subtotalTexto = document.getElementById('subtotal-valor').textContent;
    const subtotal = parseInt(subtotalTexto.replace(/\D/g, '')) || 0;

    let envio = 0;
    if (tipo === 'envio') {
        envio = subtotal >= CONFIG.ENVIO_GRATIS_MINIMO ? 0 : CONFIG.COSTO_ENVIO;
    }

    const total = subtotal + envio;

    const envioElem = document.getElementById('envio-valor');
    const totalElem = document.getElementById('total-valor');

    if (envio === 0 && tipo === 'envio') {
        envioElem.innerHTML = '<span class="envio-gratis">¡GRATIS! 🎉</span>';
    } else if (tipo === 'recoger') {
        envioElem.textContent = '$0 (recoger)';
    } else {
        envioElem.textContent = '$' + envio.toLocaleString('es-CO');
    }

    totalElem.textContent = '$' + total.toLocaleString('es-CO');
}

// Listener dirección
document.addEventListener('DOMContentLoaded', () => {
    const inputDireccion = document.getElementById('direccion-entrega');
    if (inputDireccion) {
        inputDireccion.addEventListener('input', () => {
            const tipo = document.querySelector('input[name="tipo-entrega"]:checked')?.value;
            const btn = document.getElementById('btn-comprar-whatsapp');
            if (tipo === 'envio') {
                btn.disabled = !inputDireccion.value.trim();
            }
        });
    }
    
    mostrarCarritoConSeleccion();
});

// ============================================================
// BOT DE TELEGRAM - SIN MODIFICACIONES
// ============================================================

const TELEGRAM_BOT_TOKEN = "8289049932:AAFsUuhtqZJsZ4E9_scf-Lux2y6XOJxa6Ic";
const TELEGRAM_CHAT_ID = "6568426129";

function sendSaleToBot(sale) {
    try {
        let texto = "🔔 *Nueva venta registrada (web)*\n\n";
        sale.productos.forEach(p => {
            texto += `• ${p.nombre} × ${p.cantidad} → $${p.subtotal.toLocaleString('es-CO')}\n`;
        });
        texto += `\n💰 Subtotal: $${sale.subtotal.toLocaleString('es-CO')}`;
        texto += `\n📦 Envío: ${sale.envio === 0 ? 'Gratis' : '$' + sale.envio.toLocaleString('es-CO')}`;
        texto += `\n✅ Total: $${sale.total.toLocaleString('es-CO')}`;
        texto += `\n\n🚚 Tipo: ${sale.tipoEntrega === 'recoger' ? 'Retiro en almacén' : 'Envío a domicilio'}`;
        if (sale.tipoEntrega === 'envio' && sale.direccion) {
            texto += `\n📍 Dirección: ${sale.direccion}`;
        }
        texto += `\n\n🕒 Fecha: ${sale.fecha}`;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: texto,
                parse_mode: "Markdown"
            })
        });
    } catch (e) {
        // Silencioso
    }
}

// ============================================================
// ENVÍO FINAL A WHATSAPP
// ============================================================

function enviarWhatsAppFinal() {
    const tipo = document.querySelector('input[name="tipo-entrega"]:checked')?.value;
    
    if (tipo === 'envio') {
        const direccion = document.getElementById('direccion-entrega').value.trim();
        if (!direccion) {
            alert('Por favor ingresa la dirección de entrega');
            return;
        }
    }

    let mensaje = "¡Hola! Quisiera hacer el siguiente pedido:\n\n";

    let productosParaRegistro = [];
    let subtotal = 0;

    seleccionados.forEach(index => {
        const item = carrito[index];
        const itemSubtotal = item.precio * item.cantidad; // Ya tiene descuento aplicado
        subtotal += itemSubtotal;

        mensaje += `- ${item.nombre}`;
        if (item.variante) mensaje += ` (${item.variante})`;
        mensaje += ` ×${item.cantidad} → $${itemSubtotal.toLocaleString('es-CO')}\n`;

        productosParaRegistro.push({
            nombre: item.nombre,
            cantidad: item.cantidad,
            subtotal: itemSubtotal
        });
    });

    const envioTexto = document.getElementById('envio-valor').textContent;
    const totalTexto = document.getElementById('total-valor').textContent;
    
    const envio = envioTexto.includes('GRATIS') || envioTexto.includes('$0') ? 0 : CONFIG.COSTO_ENVIO;
    const total = parseInt(totalTexto.replace(/\D/g, '')) || (subtotal + envio);

    mensaje += `\n💰 Subtotal: $${subtotal.toLocaleString('es-CO')}`;
    mensaje += `\n📦 Envío: ${envio === 0 ? 'Gratis' : '$' + envio.toLocaleString('es-CO')}`;
    mensaje += `\n✅ Total: ${totalTexto}\n`;

    if (tipo === 'recoger') {
        mensaje += "\n📍 Retiro en almacén\nCra. 18 Este #36-19, Brr. Morichal, Villavicencio";
    } else {
        const direccion = document.getElementById('direccion-entrega').value.trim();
        mensaje += `\n🚚 Envío a domicilio:\n${direccion}`;
    }

    // Enviar a Telegram
    const salePayload = {
        productos: productosParaRegistro,
        subtotal: subtotal,
        envio: envio,
        total: total,
        tipoEntrega: tipo || 'recoger',
        direccion: tipo === 'envio' ? document.getElementById('direccion-entrega').value.trim() : '',
        fecha: new Date().toLocaleString('es-CO')
    };

    sendSaleToBot(salePayload);

    // Abrir WhatsApp
    window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`, "_blank");

    cerrarModal();
}

// ============================================================
// UTILIDADES
// ============================================================

function mostrarPopup(mensaje) {
    const div = document.createElement("div");
    div.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1e3a8a;
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    div.textContent = mensaje;
    document.body.appendChild(div);

    setTimeout(() => {
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 300);
    }, 2000);
}

// ============================================================
// EXPORTS GLOBALES
// ============================================================

window.mostrarCarritoConSeleccion = mostrarCarritoConSeleccion;
window.toggleSeleccion = toggleSeleccion;
window.seleccionarTodo = seleccionarTodo;
window.cambiarCantidad = cambiarCantidad;
window.eliminarProducto = eliminarProducto;
window.vaciarCarrito = vaciarCarrito;
window.continuarConCompra = continuarConCompra;
window.cerrarModal = cerrarModal;
window.actualizarEntrega = actualizarEntrega;
window.enviarWhatsAppFinal = enviarWhatsAppFinal;