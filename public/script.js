// ========== CONFIGURAÇÃO ==========
const API_BASE = '/.netlify/functions';

function toNumber(value) {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

// ========== ESTADO GLOBAL ==========
let products = [];
let categories = [];
let cart = JSON.parse(localStorage.getItem('suplemax-cart')) || [];
let currentFilter = 'all';
let activeCoupon = null;
let currentProduct = null;
let currentTab = 'descricao';
let currentSelectedFlavor = null;

// ========== SISTEMA DE CUPONS ==========
const coupons = {
  'BLACKFRIDAY2024': { discount: 20, type: 'percentage', description: '20% de desconto na Black Friday' },
  'PRIMEIRACOMPRA': { discount: 15, type: 'percentage', description: '15% de desconto na primeira compra' },
  'SUPLEMAX10': { discount: 10, type: 'percentage', description: '10% de desconto em qualquer compra' },
  'FRETEGRATIS': { discount: 100, type: 'fixed', description: 'Frete grátis (R$ 100)' },
  'SUPER50': { discount: 50, type: 'fixed', description: 'R$ 50 de desconto' }
};

// ========== FUNÇÕES DO MODAL SOBRE NÓS ==========
function openAbout() {
  document.getElementById('about-overlay').classList.add('active');
  document.getElementById('about-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeAbout() {
  document.getElementById('about-overlay').classList.remove('active');
  document.getElementById('about-modal').classList.remove('active');
  document.body.style.overflow = 'auto';
}

// ========== FUNÇÕES DO MODAL DE PRODUTO ==========
function openProductModal(productId) {
  const product = products.find(p => p.id == productId);
  if (!product) return;
  currentProduct = product;
  currentSelectedFlavor = null;

  document.getElementById('modal-product-name').textContent = product.name;
  const mainImage = product.image_1 || product.image_url || 'https://via.placeholder.com/350';
  document.getElementById('modal-main-image').src = mainImage;

  const cat = categories.find(c => c.slug === product.collection);
  const catName = cat ? cat.name : (categoryNames[product.collection] || product.collection);
  document.getElementById('modal-category').textContent = catName;
  document.getElementById('modal-title').textContent = product.name;

  const starsFull = Math.floor(product.rating || 4);
  const starsHalf = (product.rating % 1 >= 0.5) ? 1 : 0;
  let starsHtml = '<i class="fas fa-star"></i>'.repeat(starsFull);
  if (starsHalf) starsHtml += '<i class="fas fa-star-half-alt"></i>';
  starsHtml += '<i class="far fa-star"></i>'.repeat(5 - starsFull - starsHalf);
  document.getElementById('modal-stars').innerHTML = starsHtml;
  document.getElementById('modal-rating-count').textContent = `(${product.rating || 4})`;

  const isOnSale = product.on_sale && product.original_price > product.price;
  document.getElementById('modal-current-price').textContent = `R$ ${toNumber(product.price).toFixed(2)}`;
  if (isOnSale) {
    document.getElementById('modal-original-price').textContent = `R$ ${toNumber(product.original_price).toFixed(2)}`;
    document.getElementById('modal-original-price').style.display = 'inline';
  } else {
    document.getElementById('modal-original-price').style.display = 'none';
  }
  document.getElementById('modal-installment').innerHTML = `em até <strong>12x de R$ ${(toNumber(product.price) / 12).toFixed(2)}</strong> sem juros`;

  const inStock = product.inventory > 0;
  document.getElementById('modal-stock').innerHTML = inStock
    ? '<i class="fas fa-check-circle in-stock"></i> <span class="in-stock">Em estoque</span>'
    : '<i class="fas fa-times-circle out-of-stock"></i> <span class="out-of-stock">Esgotado</span>';

  let thumbnailsHtml = '';
  for (let i = 1; i <= 3; i++) {
    const imgUrl = product[`image_${i}`];
    if (imgUrl) {
      thumbnailsHtml += `<img src="${imgUrl}" class="thumbnail ${thumbnailsHtml === '' ? 'active' : ''}" onclick="changeMainImage(this, '${imgUrl}')">`;
    }
  }
  if (!thumbnailsHtml) {
    thumbnailsHtml = `<img src="${mainImage}" class="thumbnail active" onclick="changeMainImage(this, '${mainImage}')">`;
  }
  document.getElementById('modal-thumbnails').innerHTML = thumbnailsHtml;

  // Sabores adicionais
  const flavorsContainer = document.getElementById('product-flavors-container');
  flavorsContainer.innerHTML = '';
  if (product.metadata?.flavors && product.metadata.flavors.length > 0) {
    const flavorsDiv = document.createElement('div');
    flavorsDiv.style.display = 'flex';
    flavorsDiv.style.gap = '0.8rem';
    flavorsDiv.style.flexWrap = 'wrap';
    product.metadata.flavors.forEach((flavor, idx) => {
      const btn = document.createElement('button');
      btn.className = 'flavor-option';
      if (idx === 0) {
        btn.classList.add('selected');
        currentSelectedFlavor = { name: flavor.name, image: flavor.image };
      }
      btn.textContent = flavor.name;
      btn.setAttribute('data-img', flavor.image);
      btn.setAttribute('data-name', flavor.name);
      btn.addEventListener('click', function() {
        document.querySelectorAll('#product-flavors-container .flavor-option').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        currentSelectedFlavor = { name: this.dataset.name, image: this.dataset.img };
        document.getElementById('modal-main-image').src = this.dataset.img;
      });
      flavorsDiv.appendChild(btn);
    });
    flavorsContainer.appendChild(flavorsDiv);
  } else {
    currentSelectedFlavor = null;
  }

  currentTab = 'descricao';
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('.tab-btn').classList.add('active');
  document.getElementById('modal-tab-content').innerHTML = product.description || 'Descrição detalhada do produto.';

  document.getElementById('product-modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeProductModal(event) {
  if (event && event.target.classList.contains('product-modal-overlay')) {
    document.getElementById('product-modal-overlay').classList.remove('active');
    document.body.style.overflow = 'auto';
  } else if (!event) {
    document.getElementById('product-modal-overlay').classList.remove('active');
    document.body.style.overflow = 'auto';
  }
}

function changeMainImage(thumbnail, src) {
  document.getElementById('modal-main-image').src = src;
  document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
  thumbnail.classList.add('active');
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  let content = '';
  if (tab === 'descricao') {
    content = currentProduct.description || 'Descrição detalhada do produto.';
  } else if (tab === 'avaliacoes') {
    content = `<div style="display: flex; flex-direction: column; gap: var(--space-md);">
      <div><strong>⭐⭐⭐⭐⭐</strong> João Silva: "Produto excelente, recomendo!"</div>
      <div><strong>⭐⭐⭐⭐</strong> Maria Oliveira: "Muito bom, entrega rápida."</div>
      <div><strong>⭐⭐⭐⭐⭐</strong> Carlos Souza: "Qualidade top, comprarei novamente."</div>
    </div>`;
  } else if (tab === 'info') {
    content = `<ul style="list-style: none; padding: 0;">
      <li><strong>Marca:</strong> ${currentProduct.metadata?.marca || 'SUPLEMAX'}</li>
      <li><strong>Peso:</strong> ${currentProduct.metadata?.peso || '900g'}</li>
      <li><strong>Validade:</strong> 24 meses</li>
      <li><strong>Registro ANVISA:</strong> 123456789</li>
    </ul>`;
  }
  document.getElementById('modal-tab-content').innerHTML = content;
}

function addToCartFromModal() {
  if (currentProduct) {
    let flavor = currentSelectedFlavor;
    if (!flavor && currentProduct.metadata?.flavors && currentProduct.metadata.flavors.length > 0) {
      flavor = currentProduct.metadata.flavors[0];
    }
    addToCart(currentProduct.id, flavor);
  }
}

function addToWishlistFromModal() {
  if (currentProduct) addToWishlist(currentProduct.id);
}

// ========== INICIALIZAR SWIPER ==========
const swiper = new Swiper('.swiper', {
  direction: 'horizontal',
  loop: true,
  autoplay: { delay: 5000, disableOnInteraction: false },
  pagination: { el: '.swiper-pagination', clickable: true },
  effect: 'fade',
  fadeEffect: { crossFade: true }
});

// ========== MAPEAMENTO DE CATEGORIAS ==========
const categoryNames = {
  'massa': 'Whey Protein',
  'emagrecimento': 'Creatina',
  'energia': 'Pré-treino',
  'saude': 'Vitaminas'
};

// ========== CARREGAR DADOS ==========
async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    if (!res.ok) throw new Error('Erro ao carregar categorias');
    categories = await res.json();
  } catch (error) {
    console.error('Erro ao carregar categorias:', error);
    categories = [];
  }
}

async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error('Erro ao carregar produtos');
    products = await res.json();
    products.sort((a, b) => {
      if (a.inventory > 0 && b.inventory <= 0) return -1;
      if (a.inventory <= 0 && b.inventory > 0) return 1;
      return 0;
    });
    renderProducts();
    renderCategories();
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    showNotification('Erro ao carregar produtos. Tente novamente mais tarde.', 'error');
  }
}

// ========== RENDERIZAR PRODUTOS ==========
function renderProducts() {
  const container = document.getElementById('products-grid');
  let filtered = products;
  if (currentFilter !== 'all') filtered = products.filter(p => p.collection === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;">
      <div style="font-size:64px; color:var(--gray-300); margin-bottom:1rem;"><i class="fas fa-box-open"></i></div>
      <h3 style="color:var(--gray-600);">Nenhum produto encontrado</h3>
      <p style="color:var(--gray-500);">Tente buscar por outro termo ou categoria</p>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(product => {
    const isOnSale = product.on_sale && product.original_price > product.price;
    const isOutOfStock = product.inventory <= 0;
    const isNew = new Date(product.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const salePercentage = product.sale_percentage || Math.round((1 - toNumber(product.price) / toNumber(product.original_price)) * 100);
    const cat = categories.find(c => c.slug === product.collection);
    const catName = cat ? cat.name : (categoryNames[product.collection] || product.collection);
    const imgUrl = product.image_1 || product.image_url || 'https://via.placeholder.com/220';
    const outOfStockClass = isOutOfStock ? 'out-of-stock-overlay' : '';
    const overlayHtml = isOutOfStock ? `<div class="out-of-stock-label">ESGOTADO</div>` : '';

    return `<div class="product-card ${outOfStockClass}" onclick="openProductModal(${product.id})">
      <div class="product-badges">
        ${isOnSale ? `<div class="badge badge-sale">${salePercentage}% OFF</div>` : ''}
        ${isNew ? `<div class="badge badge-new">Novo</div>` : ''}
        ${product.best_seller ? `<div class="badge badge-best">Mais Vendido</div>` : ''}
      </div>
      ${overlayHtml}
      <img src="${imgUrl}" alt="${product.name}" class="product-image" onerror="this.src='https://via.placeholder.com/220'">
      <div class="product-info">
        <span class="product-category">${catName}</span>
        <h3 class="product-title">${product.name}</h3>
        <div class="product-rating">
          <div class="stars">${'<i class="fas fa-star"></i>'.repeat(Math.floor(product.rating || 4))}</div>
          <span class="rating-count">(${product.rating || 4})</span>
        </div>
        <div class="stock-status">
          ${isOutOfStock ? '<i class="fas fa-times-circle out-of-stock"></i> <span class="out-of-stock">Esgotado</span>' : '<i class="fas fa-check-circle in-stock"></i> <span class="in-stock">Em estoque</span>'}
        </div>
        <div class="product-price">
          ${isOnSale ? `<span class="original-price">R$ ${toNumber(product.original_price).toFixed(2)}</span>` : ''}
          <span class="current-price">R$ ${toNumber(product.price).toFixed(2)}</span>
        </div>
        <p class="installment">em até <strong>12x de R$ ${(toNumber(product.price) / 12).toFixed(2)}</strong> sem juros</p>
      </div>
    </div>`;
  }).join('');
}

// ========== RENDERIZAR CATEGORIAS ==========
function renderCategories() {
  const container = document.getElementById('categories-grid');
  const catsToShow = categories.length ? categories : [
    { slug: 'massa', name: 'Massa Muscular', icon: 'fa-dumbbell' },
    { slug: 'emagrecimento', name: 'Emagrecimento', icon: 'fa-weight-scale' },
    { slug: 'energia', name: 'Energia', icon: 'fa-bolt' },
    { slug: 'saude', name: 'Saúde', icon: 'fa-heart-pulse' }
  ];
  container.innerHTML = catsToShow.map(cat => {
    const count = products.filter(p => p.collection === cat.slug).length;
    return `<div class="category-card" onclick="filterProducts('${cat.slug}')">
      <div class="category-icon" style="background:var(--primary-light); color:var(--primary);">
        <i class="fas ${cat.icon || 'fa-tag'}"></i>
      </div>
      <h3>${cat.name}</h3>
      <p style="color:var(--gray-600); font-size:14px;">${count} produtos</p>
    </div>`;
  }).join('');
}

// ========== FILTRAR ==========
function filterProducts(categoryId) {
  currentFilter = categoryId;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  renderProducts();
  document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

// ========== CUPONS ==========
function applyCoupon() {
  const input = document.getElementById('coupon-input');
  const code = input.value.trim().toUpperCase();
  const msg = document.getElementById('coupon-message');
  const coupon = coupons[code];
  if (!code) {
    msg.innerHTML = '<span style="color:var(--danger);">Digite um código de cupom</span>';
    return;
  }
  if (!coupon) {
    msg.innerHTML = '<span style="color:var(--danger);">Cupom inválido ou expirado</span>';
    return;
  }
  if (activeCoupon && activeCoupon.code === code) {
    msg.innerHTML = '<span style="color:var(--warning);">Este cupom já está aplicado</span>';
    return;
  }
  activeCoupon = { code, discount: coupon.discount, type: coupon.type, description: coupon.description };
  msg.innerHTML = `<span style="color:var(--success);">✓ Cupom aplicado: ${coupon.description}</span>`;
  input.value = '';
  input.disabled = true;
  updateCartUI();
  showNotification(`Cupom "${code}" aplicado com sucesso!`, 'success');
}

function removeCoupon() {
  if (activeCoupon) {
    showNotification(`Cupom "${activeCoupon.code}" removido`, 'warning');
    activeCoupon = null;
    document.getElementById('coupon-input').value = '';
    document.getElementById('coupon-input').disabled = false;
    document.getElementById('coupon-message').innerHTML = '';
    updateCartUI();
  }
}

function calculateDiscount(subtotal, shipping) {
  if (!activeCoupon) return 0;
  let discount = 0;
  if (activeCoupon.type === 'percentage') discount = subtotal * (activeCoupon.discount / 100);
  else if (activeCoupon.type === 'fixed') {
    if (activeCoupon.description.includes('Frete grátis')) discount = shipping;
    else discount = Math.min(activeCoupon.discount, subtotal);
  }
  return Math.round(discount * 100) / 100;
}

// ========== CARRINHO ==========
function addToCart(productId, flavor = null) {
  const product = products.find(p => p.id == productId);
  if (!product) return showNotification('Produto não encontrado', 'error');
  if (product.inventory <= 0) return showNotification('Produto esgotado!', 'error');

  let displayName = product.name;
  if (flavor && flavor.name) {
    displayName = `${product.name} - ${flavor.name}`;
  }

  const existingIndex = cart.findIndex(item => {
    if (item.id != productId) return false;
    if (item.flavor && flavor && item.flavor.name === flavor.name) return true;
    if (!item.flavor && !flavor) return true;
    return false;
  });

  if (existingIndex !== -1) {
    const item = cart[existingIndex];
    const max = product.inventory || 10;
    if (item.quantity >= max) return showNotification(`Limite de ${max} unidades!`, 'error');
    item.quantity++;
  } else {
    cart.push({
      id: product.id,
      name: displayName,
      price: product.price,
      image: product.image_1 || product.image_url,
      quantity: 1,
      flavor: flavor ? { name: flavor.name, image: flavor.image } : null,
      originalProductName: product.name
    });
  }
  updateCartUI();
  showNotification(`${displayName} adicionado ao carrinho!`, 'success');
}

function addToWishlist(productId) {
  const product = products.find(p => p.id == productId);
  if (product) {
    showNotification(`${product.name} adicionado aos favoritos!`, 'success');
    let wishlist = JSON.parse(localStorage.getItem('suplemax-wishlist')) || [];
    if (!wishlist.includes(productId)) {
      wishlist.push(productId);
      localStorage.setItem('suplemax-wishlist', JSON.stringify(wishlist));
    }
  }
}

function updateCartUI() {
  const total = cart.reduce((s, i) => s + i.quantity, 0);
  document.querySelector('.cart-count').textContent = total;
  localStorage.setItem('suplemax-cart', JSON.stringify(cart));
  renderCartItems();
}

function renderCartItems() {
  const container = document.getElementById('cart-items');
  const summary = document.getElementById('cart-summary');
  if (cart.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:3rem;">
      <div style="font-size:64px; color:var(--gray-300);"><i class="fas fa-shopping-cart"></i></div>
      <h3>Seu carrinho está vazio</h3>
      <p>Adicione produtos para continuar</p>
    </div>`;
    summary.innerHTML = '';
    return;
  }
  container.innerHTML = cart.map((item, idx) => {
    const price = toNumber(item.price);
    const title = item.name;
    return `<div class="cart-item">
      <img src="${item.image || 'https://via.placeholder.com/80'}" class="cart-item-image" onerror="this.src='https://via.placeholder.com/80'">
      <div class="cart-item-info">
        <div class="cart-item-title">${title}</div>
        <div class="cart-item-price">R$ ${price.toFixed(2)}</div>
        <div class="cart-item-actions">
          <div class="quantity-control">
            <button class="quantity-btn" onclick="updateQuantity(${idx}, -1)">-</button>
            <span>${item.quantity}</span>
            <button class="quantity-btn" onclick="updateQuantity(${idx}, 1)">+</button>
          </div>
          <button class="remove-btn" onclick="removeFromCart(${idx})"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
  const subtotal = cart.reduce((s, i) => s + toNumber(i.price) * i.quantity, 0);
  const shipping = subtotal > 150 ? 0 : 15;
  const discount = calculateDiscount(subtotal, shipping);
  const total = Math.max(0, subtotal + shipping - discount);
  summary.innerHTML = `
    <div class="summary-row"><span>Subtotal:</span><span>R$ ${subtotal.toFixed(2)}</span></div>
    <div class="summary-row"><span>Frete:</span><span>${shipping === 0 ? 'Grátis' : `R$ ${shipping.toFixed(2)}`}</span></div>
    ${activeCoupon ? `<div class="summary-row discount-row"><span>Desconto (${activeCoupon.code}):</span><span>- R$ ${discount.toFixed(2)}</span><button onclick="removeCoupon()" style="background:none; border:none; color:var(--danger); cursor:pointer; margin-left:8px;"><i class="fas fa-times"></i></button></div>` : ''}
    <div class="summary-row summary-total"><span>Total:</span><span>R$ ${total.toFixed(2)}</span></div>
  `;
}

function updateQuantity(idx, change) {
  const item = cart[idx];
  if (!item) return;
  const newQty = item.quantity + change;
  if (newQty < 1) return removeFromCart(idx);
  const product = products.find(p => p.id == item.id);
  const max = product?.inventory || 10;
  if (newQty > max) return showNotification(`Limite de ${max} unidades!`, 'error');
  item.quantity = newQty;
  updateCartUI();
}

function removeFromCart(idx) {
  cart.splice(idx, 1);
  updateCartUI();
  showNotification('Item removido do carrinho', 'success');
}

// ========== FINALIZAR COMPRA ==========
async function checkout() {
  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const cep = document.getElementById('customer-cep').value.trim();
  const address = document.getElementById('customer-address').value.trim();
  const number = document.getElementById('customer-number').value.trim();
  const complement = document.getElementById('customer-complement').value.trim();
  const neighborhood = document.getElementById('customer-neighborhood').value.trim();
  const city = document.getElementById('customer-city').value.trim();
  const state = document.getElementById('customer-state').value.trim().toUpperCase();
  const payment = document.querySelector('input[name="payment"]:checked')?.value || 'Não informado';
  if (!name || !phone || !cep || !address || !number || !neighborhood || !city || !state) {
    return showNotification('Preencha todos os campos obrigatórios (*)!', 'error');
  }
  if (state.length !== 2) return showNotification('UF deve ter 2 caracteres (ex: SP)', 'error');
  if (cart.length === 0) return showNotification('Seu carrinho está vazio!', 'error');

  const subtotal = cart.reduce((s, i) => s + toNumber(i.price) * i.quantity, 0);
  const shipping = subtotal > 150 ? 0 : 15;
  const discount = calculateDiscount(subtotal, shipping);
  const total = Math.max(0, subtotal + shipping - discount);

  const orderData = { customer_name: name, customer_phone: phone, items: cart, total_amount: total, status: 'pending' };

  showLoading();
  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    if (!res.ok) throw new Error('Erro ao salvar pedido');
    const saved = await res.json();
    sendWhatsAppMessage(name, phone, cart, total, saved.id, discount, activeCoupon,
      { cep, address, number, complement, neighborhood, city, state }, payment);
    cart = [];
    activeCoupon = null;
    updateCartUI();
    closeCart();
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-phone').value = '';
    document.getElementById('customer-cep').value = '';
    document.getElementById('customer-address').value = '';
    document.getElementById('customer-number').value = '';
    document.getElementById('customer-complement').value = '';
    document.getElementById('customer-neighborhood').value = '';
    document.getElementById('customer-city').value = '';
    document.getElementById('customer-state').value = '';
    document.querySelector('input[name="payment"][value="PIX"]').checked = true;
    showNotification('✅ Pedido realizado com sucesso!', 'success');
  } catch (err) {
    console.error(err);
    showNotification('❌ Erro ao finalizar pedido. Tente novamente.', 'error');
  } finally {
    hideLoading();
  }
}

function sendWhatsAppMessage(name, phone, items, total, orderId, discount, coupon, address, payment) {
  let msg = `*🏋️‍♂️ PEDIDO SUPLEMAX - ${new Date().toLocaleDateString('pt-BR')}* 🏋️‍♂️\n\n`;
  msg += `*Cliente:* ${name}\n*WhatsApp:* ${phone}\n*Nº do Pedido:* ${orderId}\n`;
  if (coupon) msg += `*Cupom Aplicado:* ${coupon.code} (${coupon.description})\n`;
  msg += `\n*📦 ITENS DO PEDIDO:*\n`;
  items.forEach((item, i) => {
    const itemTotal = toNumber(item.price) * item.quantity;
    const flavorText = item.flavor ? ` (Sabor: ${item.flavor.name})` : '';
    msg += `${i+1}. ${item.name}${flavorText}\n   Quantidade: ${item.quantity}\n   Preço unitário: R$ ${toNumber(item.price).toFixed(2)}\n   Subtotal: R$ ${itemTotal.toFixed(2)}\n\n`;
  });
  const subtotal = items.reduce((s, i) => s + toNumber(i.price) * i.quantity, 0);
  msg += `*💰 RESUMO DO PEDIDO:*\nSubtotal: R$ ${subtotal.toFixed(2)}\nFrete: ${subtotal > 150 ? 'Grátis' : 'R$ 15,00'}\n`;
  if (discount > 0) msg += `Desconto: R$ ${discount.toFixed(2)}\n`;
  msg += `*TOTAL DO PEDIDO: R$ ${total.toFixed(2)}*\n\n`;
  msg += `*📍 ENDEREÇO DE ENTREGA:*\n${address.address}, ${address.number}`;
  if (address.complement) msg += `, ${address.complement}`;
  msg += `\n${address.neighborhood}\n${address.city} - ${address.state}\nCEP: ${address.cep}\n\n`;
  msg += `*💳 FORMA DE PAGAMENTO:* ${payment}\n\n`;
  msg += `Agradecemos pela preferência! 🎉\n*Equipe SUPLEMAX - Suplementos Premium*`;
  window.open(`https://wa.me/5511975704123?text=${encodeURIComponent(msg)}`, '_blank');
}

// ========== NOTIFICAÇÕES ==========
function showNotification(msg, type = 'success') {
  const notif = document.getElementById('notification');
  notif.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i><span>${msg}</span><button onclick="hideNotification()"><i class="fas fa-times"></i></button>`;
  notif.className = `notification ${type} active`;
  setTimeout(hideNotification, 5000);
}

function hideNotification() {
  document.getElementById('notification').classList.remove('active');
}

function showLoading() {
  document.getElementById('loading').classList.add('active');
}

function hideLoading() {
  document.getElementById('loading').classList.remove('active');
}

function openCart() {
  renderCartItems();
  document.getElementById('cart-overlay').classList.add('active');
  document.getElementById('cart-sidebar').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-overlay').classList.remove('active');
  document.getElementById('cart-sidebar').classList.remove('active');
  document.body.style.overflow = 'auto';
}

// ========== SCROLL AUTOMÁTICO PARA PRODUTOS ==========
let hasScrolled = false;
function scrollToProducts() {
  if (hasScrolled) return;
  if (window.location.hash && window.location.hash !== '#') return;
  const productsSection = document.getElementById('products');
  if (productsSection) {
    setTimeout(() => {
      const header = document.querySelector('.main-header');
      const headerHeight = header ? header.offsetHeight : 0;
      const elementPosition = productsSection.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - headerHeight - 20;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      hasScrolled = true;
    }, 500);
  }
}

// ========== EVENTOS ==========
function setupEvents() {
  document.getElementById('cart-btn').addEventListener('click', openCart);
  document.getElementById('cart-overlay').addEventListener('click', closeCart);
  document.getElementById('checkout-btn').addEventListener('click', checkout);
  document.getElementById('search-input').addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    if (!term) return renderProducts();
    const filtered = products.filter(p => p.name.toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term) || (p.collection || '').toLowerCase().includes(term));
    const container = document.getElementById('products-grid');
    if (!filtered.length) {
      container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;">
        <div style="font-size:64px; color:var(--gray-300);"><i class="fas fa-search"></i></div>
        <h3>Nenhum produto encontrado</h3>
        <p>Tente buscar por outro termo</p>
      </div>`;
    } else {
      container.innerHTML = filtered.map(product => {
        const imgUrl = product.image_1 || product.image_url || 'https://via.placeholder.com/220';
        const cat = categories.find(c => c.slug === product.collection);
        const catName = cat ? cat.name : (categoryNames[product.collection] || product.collection);
        return `<div class="product-card" onclick="openProductModal(${product.id})">
          <div class="product-badges">${product.on_sale && product.original_price > product.price ? `<div class="badge badge-sale">${Math.round((1 - product.price/product.original_price)*100)}% OFF</div>` : ''}</div>
          <img src="${imgUrl}" class="product-image" onerror="this.src='https://via.placeholder.com/220'">
          <div class="product-info">
            <span class="product-category">${catName}</span>
            <h3 class="product-title">${product.name}</h3>
            <div class="product-price"><span class="current-price">R$ ${toNumber(product.price).toFixed(2)}</span></div>
          </div>
        </div>`;
      }).join('');
    }
  });
  document.getElementById('newsletter-form').addEventListener('submit', e => {
    e.preventDefault();
    const email = e.target.querySelector('input').value;
    showNotification(`Obrigado! Em breve você receberá ofertas no email ${email}`, 'success');
    e.target.reset();
  });
  document.getElementById('coupon-input').addEventListener('keypress', e => { if (e.key === 'Enter') applyCoupon(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCart(); closeAbout(); closeProductModal(); } });
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// ========== INICIALIZAÇÃO ==========
async function init() {
  console.log('🚀 Inicializando SUPLEMAX...');
  setupEvents();
  showLoading();
  await loadCategories();
  await loadProducts();
  updateCartUI();
  scrollToProducts();
  hideLoading();
  console.log('✅ SUPLEMAX inicializada!');
}

document.addEventListener('DOMContentLoaded', init);