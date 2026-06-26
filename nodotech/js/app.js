/* ===================================================
   NodoTech — app.js
   - Carga productos desde data/productos.json
   - Renderiza catálogo dinámicamente (DOM)
   - Maneja carrito (eventos, cálculo de totales)
   - Valida y envía formulario de compra y de contacto
   =================================================== */

(function () {
  "use strict";

  /* ---------- Estado global ---------- */
  let productos = [];
  let categoriaActiva = "Todos";
  const carrito = new Map(); // id -> { producto, cantidad }

  /* ---------- Utilidades ---------- */
  const formatoCLP = (valor) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(valor);

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $all = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  /* ---------- Menú móvil ---------- */
  function initNavToggle() {
    const toggle = $("#navToggle");
    const menu = $("#navMenu");
    if (!toggle || !menu) return;
    toggle.addEventListener("click", () => {
      const isOpen = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
    $all("#navMenu a").forEach((link) =>
      link.addEventListener("click", () => {
        menu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* ---------- Carga de productos desde JSON ---------- */
  async function cargarProductos() {
    const grid = $("#productGrid");
    try {
      const respuesta = await fetch("data/productos.json");
      if (!respuesta.ok) throw new Error("No se pudo leer el archivo de productos.");
      productos = await respuesta.json();
      renderFiltros();
      renderProductos();
    } catch (error) {
      console.error(error);
      grid.innerHTML = `<p class="loading-msg">No se pudieron cargar los productos. Intenta recargar la página.</p>`;
    }
  }

  /* ---------- Filtros por categoría ---------- */
  function renderFiltros() {
    const cont = $("#filtros");
    const categorias = ["Todos", ...new Set(productos.map((p) => p.categoria))];
    cont.innerHTML = "";
    categorias.forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn" + (cat === categoriaActiva ? " active" : "");
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        categoriaActiva = cat;
        $all(".filter-btn", cont).forEach((b) => b.classList.toggle("active", b === btn));
        renderProductos();
      });
      cont.appendChild(btn);
    });
  }

  /* ---------- Render del catálogo (DOM dinámico) ---------- */
  function renderProductos() {
    const grid = $("#productGrid");
    const template = $("#productCardTemplate");
    const lista = productos.filter((p) => categoriaActiva === "Todos" || p.categoria === categoriaActiva);

    grid.innerHTML = "";
    if (lista.length === 0) {
      grid.innerHTML = `<p class="loading-msg">No hay productos en esta categoría.</p>`;
      return;
    }

    lista.forEach((producto) => {
      const nodo = template.content.cloneNode(true);
      const card = nodo.querySelector(".product-card");
      card.dataset.id = producto.id;

      const img = nodo.querySelector(".product-img img");
      img.src = producto.imagen;
      img.alt = producto.nombre;

      nodo.querySelector(".product-category").textContent = producto.categoria;
      nodo.querySelector(".product-name").textContent = producto.nombre;
      nodo.querySelector(".product-desc").textContent = producto.descripcion;
      nodo.querySelector(".product-price").textContent = formatoCLP(producto.precio);

      const stockEl = nodo.querySelector(".product-stock");
      const sinStock = producto.stock <= 0;
      stockEl.textContent = sinStock ? "Sin stock disponible" : `Stock: ${producto.stock} unidades`;
      stockEl.classList.toggle("out", sinStock);

      const qtyInput = nodo.querySelector(".qty-input");
      const btnMinus = nodo.querySelector(".qty-minus");
      const btnPlus = nodo.querySelector(".qty-plus");
      const btnAdd = nodo.querySelector(".btn-add");

      qtyInput.max = producto.stock;
      if (sinStock) {
        qtyInput.disabled = true;
        btnMinus.disabled = true;
        btnPlus.disabled = true;
        btnAdd.disabled = true;
        btnAdd.textContent = "Sin stock";
      }

      btnMinus.addEventListener("click", () => {
        qtyInput.value = Math.max(0, Number(qtyInput.value) - 1);
      });
      btnPlus.addEventListener("click", () => {
        qtyInput.value = Math.min(producto.stock, Number(qtyInput.value) + 1);
      });
      qtyInput.addEventListener("change", () => {
        let valor = Number(qtyInput.value);
        if (Number.isNaN(valor) || valor < 0) valor = 0;
        if (valor > producto.stock) valor = producto.stock;
        qtyInput.value = valor;
      });

      btnAdd.addEventListener("click", () => {
        const cantidad = Number(qtyInput.value);
        if (cantidad <= 0) {
          qtyInput.focus();
          return;
        }
        agregarAlCarrito(producto, cantidad);
        qtyInput.value = 0;
      });

      grid.appendChild(nodo);
    });
  }

  /* ---------- Lógica del carrito ---------- */
  function agregarAlCarrito(producto, cantidad) {
    const existente = carrito.get(producto.id);
    const nuevaCantidad = existente ? existente.cantidad + cantidad : cantidad;
    carrito.set(producto.id, { producto, cantidad: Math.min(nuevaCantidad, producto.stock) });
    renderCarrito();
  }

  function quitarDelCarrito(id) {
    carrito.delete(id);
    renderCarrito();
  }

  function calcularTotal() {
    let total = 0;
    carrito.forEach(({ producto, cantidad }) => {
      total += producto.precio * cantidad;
    });
    return total;
  }

  function renderCarrito() {
    const body = $("#cartBody");
    const totalEl = $("#cartTotal");
    const navCount = $("#navCartCount");

    body.innerHTML = "";

    if (carrito.size === 0) {
      body.innerHTML = `<tr class="cart-empty-row"><td colspan="4">Aún no has agregado productos.</td></tr>`;
    } else {
      carrito.forEach(({ producto, cantidad }, id) => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
          <td>${producto.nombre}</td>
          <td>${cantidad}</td>
          <td>${formatoCLP(producto.precio * cantidad)}</td>
          <td><button type="button" class="remove-item" aria-label="Quitar ${producto.nombre}">Quitar</button></td>
        `;
        fila.querySelector(".remove-item").addEventListener("click", () => quitarDelCarrito(id));
        body.appendChild(fila);
      });
    }

    const total = calcularTotal();
    totalEl.textContent = formatoCLP(total);

    let totalUnidades = 0;
    carrito.forEach(({ cantidad }) => (totalUnidades += cantidad));
    navCount.textContent = String(totalUnidades);
  }

  /* ---------- Validaciones genéricas ---------- */
  function mostrarError(inputId, errorId, mensaje) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    if (error) error.textContent = mensaje || "";
    if (input) input.closest(".form-group")?.classList.toggle("has-error", Boolean(mensaje));
    return !mensaje;
  }

  function validarNoVacio(valor) {
    return valor.trim().length > 0;
  }

  function validarCorreo(valor) {
    const patron = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return patron.test(valor.trim());
  }

  function validarSoloNumeros(valor) {
    return /^[0-9]+$/.test(valor.trim());
  }

  /* ---------- Formulario de compra ---------- */
  function initFormCompra() {
    const form = $("#formCompra");
    if (!form) return;

    form.addEventListener("submit", (evento) => {
      let valido = true;

      const nombre = $("#compraNombre").value;
      const correo = $("#compraCorreo").value;
      const telefono = $("#compraTelefono").value;

      valido = mostrarError("compraNombre", "errCompraNombre",
        validarNoVacio(nombre) && nombre.trim().length >= 3 ? "" : "Ingresa tu nombre completo (mínimo 3 caracteres).") && valido;

      valido = mostrarError("compraCorreo", "errCompraCorreo",
        validarNoVacio(correo) ? (validarCorreo(correo) ? "" : "Ingresa un correo electrónico válido.") : "El correo es obligatorio.") && valido;

      if (telefono.trim().length > 0) {
        valido = mostrarError("compraTelefono", "errCompraTelefono",
          validarSoloNumeros(telefono) ? "" : "El teléfono solo debe contener números.") && valido;
      } else {
        mostrarError("compraTelefono", "errCompraTelefono", "");
      }

      const errCarrito = $("#errCarritoVacio");
      if (carrito.size === 0) {
        errCarrito.textContent = "Debes seleccionar al menos un producto antes de enviar la boleta.";
        valido = false;
      } else {
        errCarrito.textContent = "";
      }

      if (!valido) {
        evento.preventDefault();
        return;
      }

      // Prepara el detalle de la boleta como texto legible para el correo.
      const fecha = new Date().toLocaleString("es-CL");
      let detalle = `Boleta NodoTech — ${fecha}\n\n`;
      carrito.forEach(({ producto, cantidad }) => {
        detalle += `${producto.nombre} x${cantidad} — ${formatoCLP(producto.precio * cantidad)}\n`;
      });
      detalle += `\nTOTAL: ${formatoCLP(calcularTotal())}`;

      $("#detalleCompra").value = detalle;
      // El formulario continúa su envío normal hacia FormSubmit.
    });
  }

  /* ---------- Formulario de contacto ---------- */
  function initFormContacto() {
    const form = $("#formContacto");
    if (!form) return;

    form.addEventListener("submit", (evento) => {
      let valido = true;

      const nombre = $("#contNombre").value;
      const correo = $("#contCorreo").value;
      const asunto = $("#contAsunto").value;
      const mensaje = $("#contMensaje").value;

      valido = mostrarError("contNombre", "errContNombre",
        validarNoVacio(nombre) && nombre.trim().length >= 3 ? "" : "Ingresa tu nombre (mínimo 3 caracteres).") && valido;

      valido = mostrarError("contCorreo", "errContCorreo",
        validarNoVacio(correo) ? (validarCorreo(correo) ? "" : "Ingresa un correo electrónico válido.") : "El correo es obligatorio.") && valido;

      valido = mostrarError("contAsunto", "errContAsunto",
        validarNoVacio(asunto) && asunto.trim().length >= 3 ? "" : "Ingresa un asunto (mínimo 3 caracteres).") && valido;

      valido = mostrarError("contMensaje", "errContMensaje",
        mensaje.trim().length >= 10 ? "" : "El mensaje debe tener al menos 10 caracteres.") && valido;

      if (!valido) {
        evento.preventDefault();
      }
      // Si todo es válido, el formulario se envía normalmente a FormSubmit.
    });
  }

  /* ---------- Inicio ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initNavToggle();
    cargarProductos();
    initFormCompra();
    initFormContacto();
  });
})();
