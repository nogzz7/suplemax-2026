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
let currentSelectedFlavor = null;

// ========== SISTEMA DE CUPONS ==========
const coupons = {
  'BLACKFRIDAY2024': { discount: 20, type: 'percentage', description: '20% OFF na Black Friday' },
  'PRIMEIRACOMPRA': { discount: 15, type: 'percentage', description: '15% OFF na primeira compra' },
  'SUPLEMAX10': { discount: 10, type: 'percentage', description: '10% OFF em qualquer compra' },
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
  
  // IMAGEM PRINCIPAL: usa image_url (campo principal) ou fallback
  const mainImage = product.image_url || product.image_1 || 'https://picsum.photos/350/350?random=main';
  document.getElementById('modal-main-image').src = mainImage;
  
  const cat = categories.find(c => c.slug === product.collection);
  const catName = cat ? cat.name : (categoryNames[product.collection] || product.collection);
  document.getElementById('modal-category').textContent = catName;
  document.getElementById('modal-title').textContent = product.name;
  
  const starsFull = Math.floor(product.rating || 4);
  let starsHtml = '<i class="fas fa-star"></i>'.repeat(starsFull);
  starsHtml += '<i class="far fa-star"></i>'.repeat(5 - starsFull);
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
  document.getElementById('modal-installment').innerHTML = `em até <strong>6x de R$ ${(toNumber(product.price) / 6).toFixed(2)}</strong> sem juros`;
  
  const inStock = product.inventory > 0;
  document.getElementById('modal-stock').innerHTML = inStock 
    ? '<i class="fas fa-check-circle in-stock"></i> <span class="in-stock">Em estoque</span>'
    : '<i class="fas fa-times-circle out-of-stock"></i> <span class="out-of-stock">Esgotado</span>';
  
  // ===== MINIATURAS (image_url + metadata.images + antigos image_2/3) =====
  let thumbnailsHtml = '';
  const extraImages = product.metadata?.images || [];
  const oldImages = [product.image_2, product.image_3].filter(img => img && img.trim() !== '');
  let allImages = [mainImage, ...extraImages, ...oldImages];
  // Remove duplicatas (set)
  allImages = [...new Set(allImages)];
  
  if (allImages.length === 0) {
    thumbnailsHtml = `<img src="${mainImage}" class="thumbnail active" onclick="changeMainImage(this, '${mainImage}')">`;
  } else {
    allImages.forEach((img, idx) => {
      thumbnailsHtml += `<img src="${img}" class="thumbnail ${idx === 0 ? 'active' : ''}" onclick="changeMainImage(this, '${img}')">`;
    });
  }
  document.getElementById('modal-thumbnails').innerHTML = thumbnailsHtml;
  
  // Informações adicionais
  const detailsContainer = document.getElementById('product-details-under-gallery');
  if (detailsContainer) {
    const marca = product.metadata?.marca || 'SUPLEMAX';
    const peso = product.metadata?.peso || '900g';
    detailsContainer.innerHTML = `
      <span><i class="fas fa-tag"></i> <strong>Marca:</strong> ${marca}</span>
      <span><i class="fas fa-weight-hanging"></i> <strong>Peso:</strong> ${peso}</span>
      <span><i class="fas fa-calendar-alt"></i> <strong>Validade:</strong> 24 meses</span>
      <span><i class="fas fa-check-circle"></i> <strong>Certificação:</strong> ANVISA</span>
    `;
  }
  
  // Sabores
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
  }
  
  // Aba informações
  const infoContent = `
    <ul style="list-style: none; padding: 0; margin: 0;">
      <li><strong>Marca:</strong> ${product.metadata?.marca || 'SUPLEMAX'}</li>
      <li><strong>Peso:</strong> ${product.metadata?.peso || '900g'}</li>
      <li><strong>Validade:</strong> 24 meses</li>
      <li><strong>Registro ANVISA:</strong> 123456789</li>
    </ul>
  `;
  document.getElementById('modal-tab-content').innerHTML = infoContent;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const infoTabBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => btn.textContent.trim() === 'Informações');
  if (infoTabBtn) infoTabBtn.classList.add('active');
  
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
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  let content = '';
  if (tab === 'descricao') {
    content = currentProduct.description || 'Descrição detalhada do produto.';
  } else if (tab === 'avaliacoes') {
    content = `<div><strong>⭐⭐⭐⭐⭐</strong> João Silva: "Produto excelente!"</div>
               <div><strong>⭐⭐⭐⭐</strong> Maria Oliveira: "Muito bom, entrega rápida."</div>
               <div><strong>⭐⭐⭐⭐⭐</strong> Carlos Souza: "Qualidade top, comprarei novamente."</div>`;
  } else if (tab === 'info') {
    content = `
      <ul style="list-style: none; padding: 0; margin: 0;">
        <li><strong>Marca:</strong> ${currentProduct.metadata?.marca || 'SUPLEMAX'}</li>
        <li><strong>Peso:</strong> ${currentProduct.metadata?.peso || '900g'}</li>
        <li><strong>Validade:</strong> 24 meses</li>
        <li><strong>Registro ANVISA:</strong> 123456789</li>
      </ul>
    `;
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
    loadFlashSaleProducts();
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    showNotification('Erro ao carregar produtos. Tente novamente mais tarde.', 'error');
  }
}

function renderProducts() {
  const container = document.getElementById('products-grid');
  let filtered = products;
  if (currentFilter !== 'all') filtered = products.filter(p => p.collection === currentFilter);
  
  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;">
      <i class="fas fa-box-open" style="font-size:64px; color:var(--gray-300);"></i>
      <h3>Nenhum produto encontrado</h3>
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
    const imgUrl = product.image_url || product.image_1 || 'https://picsum.photos/220/220?random=prod';
    const outOfStockClass = isOutOfStock ? 'out-of-stock-overlay' : '';
    const overlayHtml = isOutOfStock ? `<div class="out-of-stock-label">ESGOTADO</div>` : '';
    
    return `<div class="product-card ${outOfStockClass}">
      <div class="product-badges">
        ${isOnSale ? `<div class="badge badge-sale">${salePercentage}% OFF</div>` : ''}
        ${isNew ? `<div class="badge badge-new">Novo</div>` : ''}
        ${product.best_seller ? `<div class="badge badge-best">Mais Vendido</div>` : ''}
      </div>
      ${overlayHtml}
      <img src="${imgUrl}" alt="${product.name}" class="product-image" onclick="openProductModal(${product.id})" style="cursor:pointer;" onerror="this.src='https://picsum.photos/220/220?random=error'">
      <div class="product-info">
        <span class="product-category" onclick="openProductModal(${product.id})" style="cursor:pointer;">${catName}</span>
        <h3 class="product-title" onclick="openProductModal(${product.id})" style="cursor:pointer;">${product.name}</h3>
        <div class="product-rating" onclick="openProductModal(${product.id})" style="cursor:pointer;">
          <div class="stars">${'<i class="fas fa-star"></i>'.repeat(Math.floor(product.rating || 4))}</div>
          <span class="rating-count">(${product.rating || 4})</span>
        </div>
        <div class="stock-status" onclick="openProductModal(${product.id})" style="cursor:pointer;">
          ${isOutOfStock ? '<i class="fas fa-times-circle out-of-stock"></i> <span class="out-of-stock">Esgotado</span>' : '<i class="fas fa-check-circle in-stock"></i> <span class="in-stock">Em estoque</span>'}
        </div>
        <div class="product-price" onclick="openProductModal(${product.id})" style="cursor:pointer;">
          ${isOnSale ? `<span class="original-price">R$ ${toNumber(product.original_price).toFixed(2)}</span>` : ''}
          <span class="current-price">R$ ${toNumber(product.price).toFixed(2)}</span>
        </div>
        <p class="installment" onclick="openProductModal(${product.id})" style="cursor:pointer;">em até <strong>6x de R$ ${(toNumber(product.price) / 6).toFixed(2)}</strong> sem juros</p>
        ${!isOutOfStock ? `<button class="btn-buy" onclick="event.stopPropagation(); addToCart(${product.id})"><i class="fas fa-shopping-cart"></i> COMPRAR</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

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
      <div class="category-icon"><i class="fas ${cat.icon || 'fa-tag'}"></i></div>
      <h3>${cat.name}</h3>
      <p style="color:var(--gray-600); font-size:14px;">${count} produtos</p>
    </div>`;
  }).join('');
}

function filterProducts(categoryId) {
  currentFilter = categoryId;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  renderProducts();
  document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

// ========== FLASH SALE ==========
function startFlashSaleTimer() {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 3);
  targetDate.setHours(23, 59, 59, 999);
  
  function updateTimer() {
    const now = new Date();
    const diff = targetDate - now;
    if (diff <= 0) {
      const timerDiv = document.getElementById('flash-sale-timer');
      if (timerDiv) timerDiv.innerHTML = '<div class="timer-expired" style="color:white; font-weight:bold;">OFERTAS ENCERRADAS! 🎯</div>';
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    const daysEl = document.getElementById('timer-days');
    const hoursEl = document.getElementById('timer-hours');
    const minutesEl = document.getElementById('timer-minutes');
    const secondsEl = document.getElementById('timer-seconds');
    if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
  }
  updateTimer();
  setInterval(updateTimer, 1000);
}

function loadFlashSaleProducts() {
  const saleProducts = products.filter(p => p.on_sale === true && p.inventory > 0);
  const featuredSales = saleProducts.slice(0, 4);
  const container = document.getElementById('flash-sale-products');
  if (!container) return;
  if (featuredSales.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;">
      <i class="fas fa-tag" style="font-size:48px; color:var(--gray-300);"></i>
      <h3>Novas promoções em breve!</h3>
      <p>Fique ligado para ofertas imperdíveis.</p>
    </div>`;
    return;
  }
  container.innerHTML = featuredSales.map(product => {
    const isOnSale = product.on_sale && product.original_price > product.price;
    const salePercentage = product.sale_percentage || Math.round((1 - toNumber(product.price) / toNumber(product.original_price)) * 100);
    const savings = toNumber(product.original_price) - toNumber(product.price);
    const cat = categories.find(c => c.slug === product.collection);
    const catName = cat ? cat.name : (categoryNames[product.collection] || product.collection);
    const imgUrl = product.image_url || product.image_1 || 'https://picsum.photos/220/220?random=flash';
    return `
      <div class="flash-sale-card" onclick="openProductModal(${product.id})">
        <div class="sale-ribbon">-${salePercentage}%</div>
        <img src="${imgUrl}" alt="${product.name}" class="product-image" onerror="this.src='https://picsum.photos/220/220?random=flashError'">
        <div class="product-info">
          <span class="product-category">${catName}</span>
          <h3 class="product-title">${product.name}</h3>
          <div class="flash-sale-price">
            ${isOnSale ? `<span class="original">R$ ${toNumber(product.original_price).toFixed(2)}</span>` : ''}
            <span class="current">R$ ${toNumber(product.price).toFixed(2)}</span>
            <span class="discount-badge">-${salePercentage}%</span>
          </div>
          <div class="flash-sale-savings">
            <i class="fas fa-piggy-bank"></i>
            <span>Economize R$ ${savings.toFixed(2)}</span>
          </div>
          <button class="btn-flash-sale" onclick="event.stopPropagation(); addToCart(${product.id})">
            <i class="fas fa-shopping-cart"></i> COMPRAR AGORA
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ========== CUPONS ==========
function applyCoupon() {
  const input = document.getElementById('coupon-input');
  const code = input.value.trim().toUpperCase();
  const msg = document.getElementById('coupon-message');
  const coupon = coupons[code];
  if (!code) { msg.innerHTML = '<span style="color:var(--danger);">Digite um código</span>'; return; }
  if (!coupon) { msg.innerHTML = '<span style="color:var(--danger);">Cupom inválido</span>'; return; }
  if (activeCoupon && activeCoupon.code === code) { msg.innerHTML = '<span style="color:var(--warning);">Cupom já aplicado</span>'; return; }
  activeCoupon = { code, discount: coupon.discount, type: coupon.type, description: coupon.description };
  msg.innerHTML = `<span style="color:var(--success);">✓ Cupom aplicado: ${coupon.description}</span>`;
  input.value = '';
  input.disabled = true;
  updateCartUI();
  showNotification(`Cupom "${code}" aplicado!`, 'success');
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
      image: product.image_url || product.image_1 || 'https://picsum.photos/80/80?random=cart',
      quantity: 1,
      flavor: flavor ? { name: flavor.name, image: flavor.image } : null
    });
  }
  updateCartUI();
  showNotification(`${displayName} adicionado ao carrinho!`, 'success');
}

function addToWishlist(productId) {
  const product = products.find(p => p.id == productId);
  if (product) {
    showNotification(`${product.name} adicionado aos favoritos!`, 'success');
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
    container.innerHTML = `<div style="text-align:center; padding:3rem;"><i class="fas fa-shopping-cart" style="font-size:64px;"></i><h3>Carrinho vazio</h3></div>`;
    summary.innerHTML = '';
    return;
  }
  container.innerHTML = cart.map((item, idx) => {
    const price = toNumber(item.price);
    const imgSrc = item.image && item.image !== 'null' && item.image !== '' 
      ? item.image 
      : 'https://picsum.photos/80/80?random=cartItem';
    return `<div class="cart-item">
      <img src="${imgSrc}" class="cart-item-image" onerror="this.src='https://picsum.photos/80/80?random=cartError'">
      <div class="cart-item-info">
        <div class="cart-item-title">${item.name}</div>
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
  const shipping = 0;
  const discount = calculateDiscount(subtotal, shipping);
  const total = Math.max(0, subtotal + shipping - discount);
  summary.innerHTML = `
    <div class="summary-row"><span>Subtotal:</span><span>R$ ${subtotal.toFixed(2)}</span></div>
    <div class="summary-row"><span>Frete:</span><span>Grátis</span></div>
    ${activeCoupon ? `<div class="summary-row discount-row"><span>Desconto (${activeCoupon.code}):</span><span>- R$ ${discount.toFixed(2)}</span><button onclick="removeCoupon()" style="background:none; border:none; color:var(--danger); cursor:pointer;"><i class="fas fa-times"></i></button></div>` : ''}
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
  showNotification('Item removido', 'success');
}

// ========== FINALIZAR COMPRA (WhatsApp) ==========
async function checkout() {
  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const cep = document.getElementById('customer-cep').value.trim();
  const address = document.getElementById('customer-address').value.trim();
  const number = document.getElementById('customer-number').value.trim();
  const neighborhood = document.getElementById('customer-neighborhood').value.trim();
  const city = document.getElementById('customer-city').value.trim();
  const state = document.getElementById('customer-state').value.trim().toUpperCase();
  const payment = document.querySelector('input[name="payment"]:checked')?.value || 'Não informado';
  if (!name || !phone || !cep || !address || !number || !neighborhood || !city || !state) {
    return showNotification('Preencha todos os campos obrigatórios!', 'error');
  }
  if (cart.length === 0) return showNotification('Carrinho vazio!', 'error');
  const subtotal = cart.reduce((s, i) => s + toNumber(i.price) * i.quantity, 0);
  const shipping = 0;
  const discount = calculateDiscount(subtotal, shipping);
  const total = Math.max(0, subtotal + shipping - discount);
  const orderId = Date.now();
  sendWhatsAppMessage(name, phone, cart, total, orderId, discount, activeCoupon,
    { cep, address, number, neighborhood, city, state }, payment);
  cart = [];
  activeCoupon = null;
  updateCartUI();
  closeCart();
  document.getElementById('customer-name').value = '';
  document.getElementById('customer-phone').value = '';
  document.getElementById('customer-cep').value = '';
  document.getElementById('customer-address').value = '';
  document.getElementById('customer-number').value = '';
  document.getElementById('customer-neighborhood').value = '';
  document.getElementById('customer-city').value = '';
  document.getElementById('customer-state').value = '';
  document.querySelector('input[name="payment"][value="PIX"]').checked = true;
  showNotification('✅ Pedido enviado! Você será redirecionado ao WhatsApp.', 'success');
}

function sendWhatsAppMessage(name, phone, items, total, orderId, discount, coupon, address, payment) {
  let msg = `*🏋️‍♂️ PEDIDO SUPLEMAX - ${new Date().toLocaleDateString('pt-BR')}*\n\n`;
  msg += `*Cliente:* ${name}\n*WhatsApp:* ${phone}\n*Nº Pedido:* ${orderId}\n`;
  if (coupon) msg += `*Cupom:* ${coupon.code} (${coupon.description})\n`;
  msg += `\n*📦 ITENS DO PEDIDO:*\n`;
  items.forEach((item, i) => {
    const flavorText = item.flavor ? ` (Sabor: ${item.flavor.name})` : '';
    msg += `${i+1}. ${item.name}${flavorText}\n   Quantidade: ${item.quantity}\n   Preço unitário: R$ ${toNumber(item.price).toFixed(2)}\n   Subtotal: R$ ${(toNumber(item.price) * item.quantity).toFixed(2)}\n\n`;
  });
  const subtotal = items.reduce((s, i) => s + toNumber(i.price) * i.quantity, 0);
  msg += `*💰 RESUMO DO PEDIDO:*\nSubtotal: R$ ${subtotal.toFixed(2)}\nFrete: Grátis\n`;
  if (discount > 0) msg += `Desconto: R$ ${discount.toFixed(2)}\n`;
  msg += `*TOTAL DO PEDIDO: R$ ${total.toFixed(2)}*\n\n`;
  msg += `*📍 ENDEREÇO DE ENTREGA:*\n${address.address}, ${address.number}\n${address.neighborhood}\n${address.city} - ${address.state}\nCEP: ${address.cep}\n\n`;
  msg += `*💳 FORMA DE PAGAMENTO:* ${payment}\n\n`;
  msg += `Agradecemos pela preferência! 🎉\n*Equipe SUPLEMAX - Suplementos Premium*`;
  window.open(`https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ========== NOTIFICAÇÕES ==========
function showNotification(msg, type = 'success') {
  const notif = document.getElementById('notification');
  notif.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i><span>${msg}</span><button onclick="hideNotification()"><i class="fas fa-times"></i></button>`;
  notif.className = `notification ${type} active`;
  setTimeout(hideNotification, 5000);
}
function hideNotification() { document.getElementById('notification').classList.remove('active'); }
function showLoading() { document.getElementById('loading').classList.add('active'); }
function hideLoading() { document.getElementById('loading').classList.remove('active'); }
function openCart() { renderCartItems(); document.getElementById('cart-overlay').classList.add('active'); document.getElementById('cart-sidebar').classList.add('active'); document.body.style.overflow = 'hidden'; }
function closeCart() { document.getElementById('cart-overlay').classList.remove('active'); document.getElementById('cart-sidebar').classList.remove('active'); document.body.style.overflow = 'auto'; }

// ========== EVENTOS ==========
function setupEvents() {
  document.getElementById('cart-btn').addEventListener('click', openCart);
  document.getElementById('cart-overlay').addEventListener('click', closeCart);
  document.getElementById('checkout-btn').addEventListener('click', checkout);
  document.getElementById('search-input').addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    if (!term) return renderProducts();
    const filtered = products.filter(p => p.name.toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term));
    const container = document.getElementById('products-grid');
    if (!filtered.length) {
      container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;"><i class="fas fa-search" style="font-size:64px;"></i><h3>Nenhum produto encontrado</h3></div>`;
    } else {
      container.innerHTML = filtered.map(product => {
        const imgUrl = product.image_url || product.image_1 || 'https://picsum.photos/220/220?random=search';
        const cat = categories.find(c => c.slug === product.collection);
        const catName = cat ? cat.name : (categoryNames[product.collection] || product.collection);
        return `<div class="product-card" onclick="openProductModal(${product.id})">
          <img src="${imgUrl}" class="product-image" onerror="this.src='https://picsum.photos/220/220?random=searchError'">
          <div class="product-info">
            <span class="product-category">${catName}</span>
            <h3 class="product-title">${product.name}</h3>
            <div class="product-price"><span class="current-price">R$ ${toNumber(product.price).toFixed(2)}</span></div>
          </div>
        </div>`;
      }).join('');
    }
  });
  document.getElementById('newsletter-form').addEventListener('submit', e => { e.preventDefault(); showNotification('Inscrito com sucesso!', 'success'); e.target.reset(); });
  document.getElementById('coupon-input').addEventListener('keypress', e => { if (e.key === 'Enter') applyCoupon(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCart(); closeAbout(); closeProductModal(); } });
}

// ========== INICIALIZAÇÃO ==========
async function init() {
  console.log('🚀 Inicializando SUPLEMAX...');
  setupEvents();
  showLoading();
  await loadCategories();
  await loadProducts();
  startFlashSaleTimer();
  updateCartUI();
  hideLoading();
}
document.addEventListener('DOMContentLoaded', init);