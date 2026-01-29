// ===== GLOBAL VARIABLES AND CONFIGURATION =====
let currentUser = null;
let authToken = null;
let cart = [];
let products = [];
let categories = [];
let deliveryZones = [];
let selectedProduct = null;
let pendingBuyNow = null;
let salesChartInstance = null;
let categoryChartInstance = null;

// API Configuration
const API_URL = window.location.origin + '/api';


document.addEventListener('DOMContentLoaded', function() {
    const burgerMenu = document.getElementById('burgerMenu');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const closeMobileMenu = document.getElementById('closeMobileMenu');
    const body = document.body;
    
    if (!burgerMenu || !mobileMenu) {
        console.log('Mobile menu elements not found');
        return;
    }
    
    // Open mobile menu
    function openMobileMenu() {
        mobileMenu.classList.add('active');
        mobileOverlay.classList.add('active');
        body.classList.add('menu-open');
        console.log('Mobile menu opened');
    }
    
    // Close mobile menu
    function closeMobileMenuFunc() {
        mobileMenu.classList.remove('active');
        mobileOverlay.classList.remove('active');
        body.classList.remove('menu-open');
        console.log('Mobile menu closed');
    }
    
    // Event listeners
    burgerMenu.addEventListener('click', openMobileMenu);
    closeMobileMenu.addEventListener('click', closeMobileMenuFunc);
    mobileOverlay.addEventListener('click', closeMobileMenuFunc);
    
    // Close on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
            closeMobileMenuFunc();
        }
    });
    
    // Close menu on window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768 && mobileMenu.classList.contains('active')) {
            closeMobileMenuFunc();
        }
    });
    
    // Make close function globally available
    window.closeMobileMenuFunc = closeMobileMenuFunc;
});

// Simple navigation function that closes menu after navigation
function navigateAndClose(category) {
    console.log('Navigating to:', category);
    
    // Navigate
    if (category === 'home') {
        showHome();
    } else {
        showCategory(category);
    }
    
    // Close mobile menu
    if (window.closeMobileMenuFunc) {
        setTimeout(window.closeMobileMenuFunc, 100);
    }
}
// Ensure functions are globally available
if (typeof window.showHome !== 'function') {
    window.showHome = showHome;
}
if (typeof window.showCategory !== 'function') {
    window.showCategory = showCategory;
}
// ===== CART PERSISTENCE FUNCTIONS =====
async function loadCartFromDatabase() {
    if (!currentUser || !authToken) {
        cart = [];
        updateCartDisplay();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/cart`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const cartData = await response.json();
            cart = cartData.items || [];
        } else {
            cart = [];
        }
    } catch (error) {
        console.error('Error loading cart from database:', error);
        cart = [];
    }
    
    updateCartDisplay();
}

async function saveCartToDatabase() {
    if (!currentUser || !authToken) return;
    
    try {
        // The cart will be saved automatically when items are added/updated
        // This function is kept for compatibility but doesn't need to do anything
        // as the cart is managed through individual API calls
    } catch (error) {
        console.error('Error saving cart to database:', error);
    }
}

async function clearCartDatabase() {
    if (!currentUser || !authToken) return;
    
    try {
        await fetch(`${API_URL}/cart/clear`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        cart = [];
        updateCartDisplay();
    } catch (error) {
        console.error('Error clearing cart from database:', error);
    }
}

// ===== VARIANT MANAGER OBJECT =====
const VariantManager = {
    variants: [],
    
    init() {
        this.variants = [];
        this.updateDisplay();
    },
    
    add(variant) {
        console.log('Adding variant:', variant);
        this.variants.push(variant);
        this.updateDisplay();
    },
    
    remove(index) {
        this.variants.splice(index, 1);
        this.updateDisplay();
    },
    
    getAll() {
        return [...this.variants];
    },
    
    clear() {
        this.variants = [];
        this.updateDisplay();
    },
    
    updateDisplay() {
        // Update the variant list in the form
        const variantsList = document.getElementById('variantsList');
        const variantCount = document.getElementById('variantCount');
        const variantSummaryGrid = document.getElementById('variantSummaryGrid');
        
        if (this.variants.length === 0) {
            if (variantsList) {
                variantsList.style.display = 'none';
            }
            return;
        }
        
        if (variantsList) {
            variantsList.style.display = 'block';
        }
        
        if (variantCount) {
            variantCount.textContent = this.variants.length;
        }
        
        if (variantSummaryGrid) {
            variantSummaryGrid.innerHTML = this.variants.map((v, index) => `
                <div class="variant-summary-item">
                    <div class="variant-summary-item-info">
                        <span class="variant-type-badge">${v.type.toUpperCase()}</span>
                        <span>${v.name}</span>
                    </div>
                    <div>
                        <span class="variant-summary-item-price">${v.price} MAD</span>
                        <span style="color: #666; margin-left: 1rem;">Stock: ${v.stock}</span>
                    </div>
                </div>
            `).join('');
        }
        
        // Update the temp variants list in modal
        this.updateTempList();
    },
    
    updateTempList() {
        const list = document.getElementById('tempVariantsList');
        if (!list) return;
        
        if (this.variants.length === 0) {
            list.innerHTML = '<p style="color: #666;">No variants added yet.</p>';
            return;
        }
        
        list.innerHTML = `
            <h3 style="color: #7a5c2e; margin-bottom: 1rem;">Added Variants (${this.variants.length})</h3>
            ${this.variants.map((variant, index) => `
                <div class="variant-item">
                    <div class="variant-item-info">
                        <span class="variant-type-badge">${variant.type.toUpperCase()}</span>
                        <span style="font-weight: 600;">${variant.name}</span>
                        <span>${variant.price} MAD</span>
                        <span>Stock: ${variant.stock}</span>
                    </div>
                    <button onclick="VariantManager.remove(${index})">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            `).join('')}
        `;
    }
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('App initialized');
    VariantManager.init();
    
    checkAuth();
    setupEventListeners();
    loadCategories();
    
    // Header message rotation
    const deliveryMsgs = [
        'Free delivery in Fquih Ben Salah',
        'Livraison gratuite à Fquih Ben Salah',
        'التوصيل مجاني في الفقيه بن صالح'
    ];
    let msgIndex = 0;
    setInterval(() => {
        msgIndex = (msgIndex + 1) % deliveryMsgs.length;
        document.getElementById('header-delivery-msg').textContent = deliveryMsgs[msgIndex];
    }, 3000);
    
    // Add after DOMContentLoaded
    
    // Real-time image validation for product
    const productImageInput = document.getElementById('productImage');
    const productImageError = document.createElement('div');
    productImageError.style.color = 'red';
    productImageError.style.fontSize = '0.9rem';
    productImageError.style.marginTop = '0.3rem';
    productImageInput.parentNode.appendChild(productImageError);
    productImageInput.addEventListener('input', function() {
        const value = productImageInput.value.trim();
        if (!value || !(value.startsWith('http') || value.startsWith('/uploads/') || value.startsWith('data:'))) {
            productImageError.textContent = 'Please enter a valid image URL or upload an image.';
        } else {
            productImageError.textContent = '';
        }
    });
    
    // Real-time image validation for category
    const categoryImageInput = document.getElementById('categoryImage');
    const categoryImageError = document.createElement('div');
    categoryImageError.style.color = 'red';
    categoryImageError.style.fontSize = '0.9rem';
    categoryImageError.style.marginTop = '0.3rem';
    categoryImageInput.parentNode.appendChild(categoryImageError);
    categoryImageInput.addEventListener('input', function() {
        const value = categoryImageInput.value.trim();
        if (!value || !(value.startsWith('http') || value.startsWith('/uploads/') || value.startsWith('data:'))) {
            categoryImageError.textContent = 'Please enter a valid image URL or upload an image.';
        } else {
            categoryImageError.textContent = '';
        }
    });
});

// ===== AUTHENTICATION FUNCTIONS =====
function logoutWrapper() {
    logout().catch(error => {
        console.error('Error during logout:', error);
        // Fallback logout
        localStorage.removeItem('authToken');
        authToken = null;
        currentUser = null;
        cart = [];
        updateUIForUser();
        showToast('Logged out successfully');
        goHome();
    });
}

function checkAuth() {
    authToken = localStorage.getItem('authToken');
    if (authToken) {
        fetchUserProfile();
    } else {
        showHome();
    }
}

async function fetchUserProfile() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            await updateUIForUser();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
    }
}

async function updateUIForUser() {
    const userIcon = document.getElementById('userIcon');
    const customerContent = document.getElementById('customerContent');
    const adminContent = document.getElementById('adminContent');
    const homeSlider = document.getElementById('home-slider');
    const customerNav = document.getElementById('customerNav');
    const authContainer = document.getElementById('authContainer');

    if (currentUser) {
        authContainer.classList.add('hidden');
        
        if (currentUser.role === 'admin') {
            // Admin view
            customerContent.classList.add('hidden');
            homeSlider.classList.add('hidden');
            customerNav.classList.add('hidden');
            adminContent.classList.remove('hidden');
            loadAdminDashboard();
            loadAdminData();
        } else {
            // Customer view
            adminContent.classList.add('hidden');
            customerContent.classList.remove('hidden');
            homeSlider.classList.remove('hidden');
            customerNav.classList.remove('hidden');
            loadProducts();
        }
        
        userIcon.style.color = '#27ae60';
        
        // Load cart from database for logged-in users
        await loadCartFromDatabase();
    } else {
        // Not logged in
        adminContent.classList.add('hidden');
        customerContent.classList.remove('hidden');
        homeSlider.classList.remove('hidden');
        customerNav.classList.remove('hidden');
        userIcon.style.color = '#7a5c2e';
        loadProducts();
        
        // Clear cart for non-logged-in users
        cart = [];
        updateCartDisplay();
    }
}

function showAuthTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.auth-tab');
    
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabs[0].classList.add('active');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabs[1].classList.add('active');
    }
}

async function login(e) {
    e.preventDefault();
    showLoading();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            showToast('Login successful!', 'success');
            await updateUIForUser();
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function register(e) {
    e.preventDefault();
    showLoading();
    
    const userData = {
        name: document.getElementById('registerName').value,
        email: document.getElementById('registerEmail').value,
        phone: document.getElementById('registerPhone').value,
        password: document.getElementById('registerPassword').value
    };
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            showToast('Registration successful!', 'success');
            await updateUIForUser();
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function logout() {
    // Don't clear cart from database - keep it for when user logs back in
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    cart = [];
    
    // Immediately hide the user dropdown
    document.getElementById('userDropdown').classList.remove('active');
    
    updateUIForUser();
    showToast('Logged out successfully');
    goHome();
}

// ===== NAVIGATION FUNCTIONS =====
function goHome() {
    // Close mobile menu if it's open
    // if (window.closeMobileMenu) {
    //     window.closeMobileMenu();
    // }
    
    // Hide auth container when going home
    document.getElementById('authContainer').classList.add('hidden');
    
    // Check if user is admin or customer
    if (currentUser && currentUser.role === 'admin') {
        // If admin, load admin dashboard
        loadAdminDashboard();
    } else {
        // If customer or not logged in, show home
        showHome();
    }
}

// Method to show home page for customers
// REPLACE your showHome and showCategory functions with these fixed versions

function showHome() {
    console.log('showHome called');
    
    // Hide auth container when going home
    const authContainer = document.getElementById('authContainer');
    if (authContainer) authContainer.classList.add('hidden');
    
    // Check if user is admin or customer
    if (currentUser && currentUser.role === 'admin') {
        // If admin, load admin dashboard
        loadAdminDashboard();
    } else {
        // If customer or not logged in, show home
        const homeSlider = document.getElementById('home-slider');
        const customerContent = document.getElementById('customerContent');
        const profileSection = document.getElementById('profileSection');
        const ordersSection = document.getElementById('ordersSection');
        const productsContainer = document.getElementById('productsContainer');
        
        if (homeSlider) homeSlider.style.display = 'block';
        if (customerContent) customerContent.classList.remove('hidden');
        if (profileSection) profileSection.classList.add('hidden');
        if (ordersSection) ordersSection.classList.add('hidden');
        if (productsContainer) productsContainer.classList.remove('hidden');
        
        // Load all products (no category filter)
        loadProducts();
    }
}

function showCategory(category) {
    console.log('showCategory called with:', category);
    
    // Hide home slider when showing category
    const homeSlider = document.getElementById('home-slider');
    const profileSection = document.getElementById('profileSection');
    const ordersSection = document.getElementById('ordersSection');
    const productsContainer = document.getElementById('productsContainer');
    
    if (homeSlider) homeSlider.style.display = 'none';
    if (profileSection) profileSection.classList.add('hidden');
    if (ordersSection) ordersSection.classList.add('hidden');
    if (productsContainer) productsContainer.classList.remove('hidden');
    
    // Load products for specific category
    loadProducts(category);
}

// Also make sure these are available globally
window.showHome = showHome;
window.showCategory = showCategory;
function handleNavClick(navFunction) {
    // Execute the navigation function first
    console.log('clicked')
    navFunction();
    
    // Then close the mobile menu if it's open
    // if (window.closeMobileMenu && document.getElementById('customerNav').classList.contains('active')) {
    //     setTimeout(() => {
    //         window.closeMobileMenu();
    //     }, 100);
    // }
}

function showProfile() {
    if (!currentUser) {
        // User is not logged in, show auth container with login tab
        document.getElementById('authContainer').classList.remove('hidden');
        document.getElementById('customerContent').classList.add('hidden');
        document.getElementById('home-slider').classList.add('hidden');
        
        // Make sure login tab is active
        showAuthTab('login');
        showToast('Please login to view your profile', 'info');
    } else {
        // User is logged in, show profile section based on role
        if (currentUser.role === 'admin') {
            // For admin users, show admin profile section
            showAdminSection('profile');
        } else {
            // For customer users, show customer profile section
            // Hide home slider and products, show profile
            document.getElementById('home-slider').classList.add('hidden');
            document.getElementById('productsContainer').classList.add('hidden');
            document.getElementById('profileSection').classList.remove('hidden');
            
            // Populate profile information
            document.getElementById('profileName').textContent = currentUser.name || 'Not provided';
            document.getElementById('profileEmail').textContent = currentUser.email || 'Not provided';
            document.getElementById('profilePhone').textContent = currentUser.phone || 'Not provided';
            document.getElementById('profileAddress').textContent = currentUser.address || 'Not provided';
            document.getElementById('profileCity').textContent = currentUser.city || 'Not provided';
            
            // Format registration date
            const registrationDate = currentUser.registrationDate ? new Date(currentUser.registrationDate).toLocaleDateString() : 'Unknown';
            document.getElementById('profileDate').textContent = registrationDate;
            
            // Load user orders for the orders tab
            loadUserOrders();
        }
    }
}

// Function to handle profile tab switching
function showProfileTab(tab) {
    // Remove active class from all nav buttons
    document.querySelectorAll('.profile-nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Hide all tabs
    document.querySelectorAll('.profile-tab').forEach(tabElement => tabElement.classList.add('hidden'));
    
    // Show selected tab and activate button
    if (tab === 'info') {
        document.getElementById('profileInfoTab').classList.remove('hidden');
        document.querySelector('.profile-nav-btn[onclick="showProfileTab(\'info\')"]').classList.add('active');
    } else if (tab === 'orders') {
        document.getElementById('profileOrdersTab').classList.remove('hidden');
        document.querySelector('.profile-nav-btn[onclick="showProfileTab(\'orders\')"]').classList.add('active');
        // Load orders if not already loaded
        loadUserOrders();
    }
}

// ===== PRODUCT FUNCTIONS =====
async function loadProducts(category = null) {
    showLoading();
    
    try {
        let url = `${API_URL}/products`;
        if (category) {
            url += `?category=${category}`;
        }
        
        const response = await fetch(url);
        products = await response.json();
        renderProducts(products);
    } catch (error) {
        showToast('Error loading products', 'error');
    } finally {
        hideLoading();
    }
}

function renderProducts(productList) {
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    if (productList.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #7a5c2e;">
                <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <h3>No products found</h3>
                <p>Please check back later or browse other categories.</p>
            </div>
        `;
        return;
    }

    productList.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        
        // Stock indicator
        let stockHTML = '';
        const totalStock = product.variants?.length > 0 
            ? product.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
            : product.stock;

        if (totalStock <= 5) {
            stockHTML = `<div class="stock-indicator ${totalStock <= 2 ? 'stock-low' : ''}">
                <i class="fas fa-exclamation-triangle"></i>
                ${totalStock} left
            </div>`;
        } else {
            stockHTML = `<div class="stock-indicator">
                <i class="fas fa-check-circle"></i>
                In Stock
            </div>`;
        }

        // Variant count
        let variantHTML = '';
        if (product.variants && product.variants.length > 0) {
            variantHTML = `<div class="variant-count">
                <i class="fas fa-layer-group"></i>
                ${product.variants.length} Options
            </div>`;
        }

        const imageUrl = getImageUrl(product.image, 'Product');

        productCard.innerHTML = `
            <div class="product-image-container">
                ${stockHTML}
                <img src="${imageUrl}" alt="${product.name}" onerror="this.src='${generatePlaceholderImage(200, 200, 'Product')}'">
                <div class="quick-view-overlay">
                    <button class="quick-view-btn" onclick="showProductDetail('${product._id}')">
                        <i class="fas fa-eye" style="margin-right: 0.5rem;"></i>
                        Quick View
                    </button>
                </div>
            </div>
           <div class="product-info">
  <div class="title-wrapper">
    <h3 class="product-title"><i class="fas fa-star"></i>${product.name}</h3>
  </div>

  <div class="product-price-section">
    <div class="product-price">
      <i class="fas fa-tag"></i>
      <span>${product.price} MAD</span>
    </div>
    ${variantHTML}
  </div>

  <div class="product-actions">
    <!-- Your buttons or actions here -->
  </div>
</div>


        `;
        
        container.appendChild(productCard);
    });
}

async function showProductDetail(productId) {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/products/${productId}`);
        const product = await response.json();
        selectedProduct = product;
        
        const modal = document.getElementById('productModal');
        const content = document.getElementById('productModalContent');
        
        const imageUrl = product.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjhmM2VkIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJHZW9yZ2lhLCBzZXJpZiIgZm9udC1zaXplPSIxNnB4IiBmaWxsPSIjN2E1YzJlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+UHJvZHVjdDwvdGV4dD4KPC9zdmc+';
        
        content.innerHTML = `
            <div>
                <img src="${imageUrl}" alt="${product.name}" style="width: 100%; border-radius: 12px;" onerror="this.src='${generatePlaceholderImage(400, 400, 'Product')}'">
            </div>
            <div>
                <h2 style="color: #000000; margin-bottom: 1rem;">${product.name}</h2>
                <p style="color: #000000; margin-bottom: 1.5rem; line-height: 1.6;">${product.description || 'High-quality cosmetic product'}</p>
                
                ${product.variants && product.variants.length > 0 ? `
                    <div class="modal-product-section">
                   
                        <div class="variant-selector">
                            ${product.variants.map((variant, index) => 
                                `<div class="variant-option ${index === 0 ? 'selected' : ''}" 
                                     onclick="selectModalVariant(${index}, ${variant.price})"
                                     data-variant-index="${index}">
                                    ${variant.name} (${variant.type})
                                </div>`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="quantity-selector-modal">
                    <button class="quantity-btn-modal" onclick="changeModalQuantity(-1)">
                        <i class="fas fa-minus"></i>
                    </button>
                    <span class="quantity-display-modal" id="modalQuantity">1</span>
                    <button class="quantity-btn-modal" onclick="changeModalQuantity(1)">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                
                <div style="font-size: 1.4rem; color: #7a5c2e; font-weight: bold; margin-bottom: 2rem; text-align: left;">
                    <i class="fas fa-tag" style="margin-right: 0.5rem; color: #e6b8a2;"></i>
                     <span id="modalPrice">${product.variants && product.variants.length > 0 ? product.variants[0].price : product.price}</span> MAD
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-primary" onclick="buyNowFromModal()" style="flex: 1;">
                        <i class="fas fa-bolt"></i>
                        Buy Now
                    </button>
                    <button class="btn btn-secondary" onclick="addToCartFromModal()" style="flex: 1;">
                        <i class="fas fa-shopping-cart"></i>
                        Add to Cart
                    </button>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
    } catch (error) {
        showToast('Error loading product details', 'error');
    } finally {
        hideLoading();
    }
}

function selectModalVariant(index, price) {
    document.querySelectorAll('.variant-option').forEach((option, i) => {
        option.classList.toggle('selected', i === index);
    });
    document.getElementById('modalPrice').textContent = price;
}

function changeModalQuantity(delta) {
    const quantityElement = document.getElementById('modalQuantity');
    let quantity = parseInt(quantityElement.textContent) + delta;
    if (quantity < 1) quantity = 1;
    if (quantity > 10) quantity = 10;
    quantityElement.textContent = quantity;
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
    selectedProduct = null;
}

// ===== CART FUNCTIONS =====
async function buyNow(productId) {
    const product = products.find(p => p._id === productId);
    if (!product) return;

    if (product.variants && product.variants.length > 0) {
        // Show variant selection modal
        showVariantSelectionModal(product, 'buyNow');
    } else {
        // Direct checkout
        cart = [{
            product: product._id,
            productName: product.name,
            price: product.price,
            quantity: 1,
            image: product.image
        }];
        updateCartDisplay();
        proceedToCheckout();
    }
}

function buyNowFromModal() {
    if (!selectedProduct) return;
    
    const quantity = parseInt(document.getElementById('modalQuantity').textContent);
    let price = selectedProduct.price;
    let variant = null;
    
    if (selectedProduct.variants && selectedProduct.variants.length > 0) {
        const selectedVariantIndex = Array.from(document.querySelectorAll('.variant-option')).findIndex(opt => opt.classList.contains('selected'));
        variant = selectedProduct.variants[selectedVariantIndex];
        price = variant.price;
    }
    
    cart = [{
        product: selectedProduct._id,
        productName: selectedProduct.name,
        price: price,
        quantity: quantity,
        image: selectedProduct.image,
        variant: variant
    }];
    
    updateCartDisplay();
    closeProductModal();
    proceedToCheckout();
}

function showVariantSelectionModal(product, action) {
    pendingBuyNow = { product, action };
    const modal = document.getElementById('variantSelectionModal');
    const content = document.getElementById('variantSelectionContent');
    
    content.innerHTML = `
        <div class="modal-product-section">
            <h3 style="color: #7a5c2e; margin-bottom: 1rem;">${product.name}</h3>
            <label style="display: block; margin-bottom: 0.5rem; color: #7a5c2e; font-weight: bold;">
                Select ${product.variants[0].type}:
            </label>
            <div class="variant-selector">
                ${product.variants.map((variant, index) => 
                    `<div class="variant-option ${index === 0 ? 'selected' : ''}" 
                         onclick="selectBuyNowVariant(${index}, ${variant.price})"
                         data-variant-index="${index}">
                        ${variant.name} - ${variant.price} MAD
                    </div>`
                ).join('')}
            </div>
        </div>
        
        <div class="quantity-selector-modal">
            <button class="quantity-btn-modal" onclick="changeBuyNowQuantity(-1)">
                <i class="fas fa-minus"></i>
            </button>
            <span class="quantity-display-modal" id="buyNowQuantity">1</span>
            <button class="quantity-btn-modal" onclick="changeBuyNowQuantity(1)">
                <i class="fas fa-plus"></i>
            </button>
        </div>
        
        <div style="display: flex; gap: 1rem; margin-top: 2rem;">
            <button class="btn btn-primary" onclick="confirmBuyNow()" style="flex: 1;">
                <i class="fas fa-check"></i>
                Confirm & ${action === 'buyNow' ? 'Buy Now' : 'Add to Cart'}
            </button>
            <button class="btn btn-outline" onclick="closeVariantSelectionModal()" style="flex: 1;">
                Cancel
            </button>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function selectBuyNowVariant(index, price) {
    document.querySelectorAll('#variantSelectionModal .variant-option').forEach((option, i) => {
        option.classList.toggle('selected', i === index);
    });
}

function changeBuyNowQuantity(delta) {
    const quantityElement = document.getElementById('buyNowQuantity');
    let quantity = parseInt(quantityElement.textContent) + delta;
    if (quantity < 1) quantity = 1;
    if (quantity > 10) quantity = 10;
    quantityElement.textContent = quantity;
}

function confirmBuyNow() {
    if (!pendingBuyNow) return;
    
    const { product, action } = pendingBuyNow;
    const selectedVariantIndex = Array.from(document.querySelectorAll('#variantSelectionModal .variant-option')).findIndex(opt => opt.classList.contains('selected'));
    const variant = product.variants[selectedVariantIndex];
    const quantity = parseInt(document.getElementById('buyNowQuantity').textContent);
    
    if (action === 'buyNow') {
        cart = [{
            product: product._id,
            productName: product.name,
            price: variant.price,
            quantity: quantity,
            image: product.image,
            variant: variant
        }];
        updateCartDisplay();
        closeVariantSelectionModal();
        proceedToCheckout();
    } else {
        // Add to cart
        const existingItem = cart.find(item => 
            item.product === product._id && 
            JSON.stringify(item.variant) === JSON.stringify(variant)
        );
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({
                product: product._id,
                productName: product.name,
                price: variant.price,
                quantity: quantity,
                image: product.image,
                variant: variant
            });
        }
        
        updateCartDisplay();
        closeVariantSelectionModal();
        showToast('Product added to cart!', 'success');
    }
}

function closeVariantSelectionModal() {
    document.getElementById('variantSelectionModal').style.display = 'none';
    pendingBuyNow = null;
}

async function addToCart(productId) {
    const product = products.find(p => p._id === productId);
    if (!product) return;

    if (product.variants && product.variants.length > 0) {
        showVariantSelectionModal(product, 'addToCart');
    } else {
        if (!currentUser || !authToken) {
            showToast('Please login to add items to cart', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/cart/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    productId: productId,
                    productName: product.name,
                    price: product.price,
                    quantity: 1
                })
            });
            
            if (response.ok) {
                const cartData = await response.json();
                cart = cartData.items || [];
                updateCartDisplay();
                showToast('Product added to cart!', 'success');
            } else {
                const error = await response.json();
                showToast(error.error || 'Failed to add to cart', 'error');
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            showToast('Failed to add to cart', 'error');
        }
    }
}

async function addToCartFromModal() {
    if (!selectedProduct) return;
    
    if (!currentUser || !authToken) {
        showToast('Please login to add items to cart', 'error');
        return;
    }
    
    const quantity = parseInt(document.getElementById('modalQuantity').textContent);
    let price = selectedProduct.price;
    let variant = null;
    
    if (selectedProduct.variants && selectedProduct.variants.length > 0) {
        const selectedVariantIndex = Array.from(document.querySelectorAll('.variant-option')).findIndex(opt => opt.classList.contains('selected'));
        variant = selectedProduct.variants[selectedVariantIndex];
        price = variant.price;
    }
    
    try {
        const response = await fetch(`${API_URL}/cart/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                productId: selectedProduct._id,
                productName: selectedProduct.name,
                variant: variant,
                price: price,
                quantity: quantity
            })
        });
        
        if (response.ok) {
            const cartData = await response.json();
            cart = cartData.items || [];
            updateCartDisplay();
            closeProductModal();
            showToast('Product added to cart!', 'success');
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to add to cart', 'error');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        showToast('Failed to add to cart', 'error');
    }
}

function updateCartDisplay() {
    const cartCount = document.querySelector('.cart-count');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    cartCount.style.display = totalItems > 0 ? 'block' : 'none';
}

async function showCart() {
    if (!currentUser || !authToken) {
        showToast('Please login to view your cart', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/cart`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const cartData = await response.json();
            cart = cartData.items || [];
        } else {
            cart = [];
        }
    } catch (error) {
        console.error('Error loading cart:', error);
        cart = [];
    }
    
    const modal = document.getElementById('cartModal');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p style="text-align: center; color: #666;">Your cart is empty</p>';
        cartTotal.textContent = '0 MAD';
        modal.style.display = 'flex';
        return;
    }
    
    let total = 0;
    cartItems.innerHTML = cart.map((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const imageUrl = getImageUrl(item.product?.image, 'Product');
        
        return `
            <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; border-bottom: 1px solid #e6b8a2;">
                <img src="${imageUrl}" alt="${item.productName}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;" onerror="this.src='${generatePlaceholderImage(60, 60, 'Product')}'">
                <div style="flex: 1;">
                    <h4>${item.productName}</h4>
                    ${item.variant ? `<p style="color: #666; font-size: 0.9rem;">${item.variant.type}: ${item.variant.name}</p>` : ''}
                    <p style="color: #7a5c2e; font-weight: bold;">${item.price} MAD × ${item.quantity}</p>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button onclick="updateCartQuantity(${index}, -1)" style="width: 25px; height: 25px; border: 1px solid #e6b8a2; background: white; border-radius: 50%; cursor: pointer;">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateCartQuantity(${index}, 1)" style="width: 25px; height: 25px; border: 1px solid #e6b8a2; background: white; border-radius: 50%; cursor: pointer;">+</button>
                    <button onclick="removeFromCart(${index})" style="margin-left: 1rem; background: #ff6b6b; color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer;">×</button>
                </div>
            </div>
        `;
    }).join('');
    
    cartTotal.textContent = `${total} MAD`;
    modal.style.display = 'flex';
}

async function updateCartQuantity(index, delta) {
    if (!currentUser || !authToken) return;
    
    const item = cart[index];
    const newQuantity = item.quantity + delta;
    
    try {
        const response = await fetch(`${API_URL}/cart/update`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                productId: item.product._id || item.product,
                variant: item.variant,
                quantity: newQuantity
            })
        });
        
        if (response.ok) {
            const cartData = await response.json();
            cart = cartData.items || [];
            updateCartDisplay();
            showCart();
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to update cart', 'error');
        }
    } catch (error) {
        console.error('Error updating cart quantity:', error);
        showToast('Failed to update cart', 'error');
    }
}

async function removeFromCart(index) {
    if (!currentUser || !authToken) return;
    
    const item = cart[index];
    
    try {
        const response = await fetch(`${API_URL}/cart/update`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                productId: item.product._id || item.product,
                variant: item.variant,
                quantity: 0 // This will remove the item
            })
        });
        
        if (response.ok) {
            const cartData = await response.json();
            cart = cartData.items || [];
            updateCartDisplay();
            showCart();
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to remove item', 'error');
        }
    } catch (error) {
        console.error('Error removing from cart:', error);
        showToast('Failed to remove item', 'error');
    }
}

function closeCartModal() {
    document.getElementById('cartModal').style.display = 'none';
}

async function proceedToCheckout() {
    if (cart.length === 0) {
        showToast('Your cart is empty!', 'error');
        return;
    }
    
    if (!currentUser) {
        showToast('Please login to checkout', 'error');
        closeCartModal();
        showProfile();
        return;
    }
    
    closeCartModal();
    showCheckoutForm();
}

// ===== CHECKOUT FUNCTIONS =====
async function showCheckoutForm() {
    // Load delivery zones
    try {
        const response = await fetch(`${API_URL}/delivery-zones`);
        deliveryZones = await response.json();
    } catch (error) {
        console.error('Error loading delivery zones:', error);
    }
    
    const checkoutDiv = document.createElement('div');
    checkoutDiv.className = 'checkout-overlay';
    checkoutDiv.id = 'checkout-section';
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    checkoutDiv.innerHTML = `
        <button class="exit-btn" onclick="closeCheckout()">← Back</button>
        <div class="checkout-wrapper">
            <form class="checkout-form-section" id="checkoutForm">
                <h2 style="margin-bottom: 2rem; color: #7a5c2e;">Contact Information</h2>
                
                <div class="form-group">
                    <label for="customerEmail">Email</label>
                    <input type="email" id="customerEmail" value="${currentUser.email}" required>
                </div>
                
                <h3 style="margin: 2rem 0 1rem 0; color: #7a5c2e;">Delivery Information</h3>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="firstName">First Name</label>
                        <input type="text" id="firstName" value="${currentUser.name.split(' ')[0] || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="lastName">Last Name</label>
                        <input type="text" id="lastName" value="${currentUser.name.split(' ').slice(1).join(' ') || ''}" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="address">Address</label>
                    <input type="text" id="address" value="${currentUser.address || ''}" required>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="postalCode">Postal Code (Optional)</label>
                        <input type="text" id="postalCode">
                    </div>
                    <div class="form-group">
                        <label for="city">City</label>
                        <input type="text" id="city" value="${currentUser.city || ''}" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="phone">Phone Number</label>
                    <input type="tel" id="phone" value="${currentUser.phone || ''}" required>
                </div>
                
                <h3 style="margin: 2rem 0 1rem 0; color: #7a5c2e;">Delivery Method</h3>
                
                <div class="radio-group" id="deliveryOptions">
                    ${deliveryZones.map((zone, index) => `
                        <label class="radio-option ${index === 0 ? 'selected' : ''}" onclick="selectDeliveryZone('${zone._id}', ${zone.price})">
                            <span style="flex: 1; color: #7a5c2e; font-weight: 600;">${zone.name}</span>
                            <span style="color: #a88c5f; font-weight: 600;">${zone.price === 0 ? 'Free' : zone.price + ' MAD'}</span>
                            <input type="radio" name="delivery" value="${zone._id}" ${index === 0 ? 'checked' : ''} style="margin-left: 1rem;">
                        </label>
                    `).join('')}
                </div>
                
                <div class="form-group" style="margin: 2rem 0;">
                    <label for="couponCode">Coupon Code (Optional)</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" id="couponCode" placeholder="Enter coupon code">
                        <button type="button" class="btn btn-secondary" onclick="applyCoupon()">Apply</button>
                    </div>
                    <div id="couponMessage" style="margin-top: 0.5rem; font-size: 0.9rem;"></div>
                </div>
                
                <h3 style="margin: 2rem 0 1rem 0; color: #7a5c2e;">Payment Method</h3>
                
                <div class="radio-group">
                    <label class="radio-option selected">
                        <span style="flex: 1; color: #7a5c2e; font-weight: 600;">Cash on Delivery</span>
                        <span style="color: #a88c5f; font-weight: 600;">الدفع عند الاستلام</span>
                        <input type="radio" name="payment" value="cod" checked style="margin-left: 1rem;">
                    </label>
                </div>
                
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 2rem; padding: 1rem; font-size: 1.1rem;">
                    Complete Order
                </button>
            </form>
            
            <div class="checkout-summary-section">
                <h3 style="margin-bottom: 2rem; color: #7a5c2e;">Order Summary</h3>
                
                ${cart.map(item => {
                    const imageUrl = item.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y4ZjNlZCIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iR2VvcmdpYSwgc2VyaWYiIGZvbnQtc2l6ZT0iMTBweCIgZmlsbD0iIzdhNWMyZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlPC90ZXh0Pgo8L3N2Zz4=';
                    return `
                        <div class="summary-product">
                            <img src="${imageUrl}" alt="${item.productName}">
                            <div class="summary-product-details">
                                <div style="font-weight: bold; color: #7a5c2e;">${item.productName}</div>
                                ${item.variant ? `<div style="color: #666; font-size: 0.9rem;">${item.variant.type}: ${item.variant.name}</div>` : ''}
                                <div style="color: #a88c5f;">${item.price} MAD × ${item.quantity}</div>
                            </div>
                        </div>
                    `;
                }).join('')}
                
                <div class="summary-total">
                    <span>Subtotal:</span>
                    <span id="summarySubtotal">${subtotal.toFixed(2)} MAD</span>
                </div>
                
                <div class="summary-total">
                    <span>Delivery:</span>
                    <span id="summaryDelivery">${deliveryZones[0]?.price || 0} MAD</span>
                </div>
                
                <div class="summary-total" id="couponDiscount" style="display: none;">
                    <span>Discount:</span>
                    <span id="summaryDiscount">0.00 MAD</span>
                </div>
                
                <div class="summary-total" style="font-size: 1.2rem; font-weight: bold; border-top: 2px solid #e6b8a2; padding-top: 1rem; margin-top: 1rem;">
                    <span>Total:</span>
                    <span id="summaryTotal">${(subtotal + (deliveryZones[0]?.price || 0)).toFixed(2)} MAD</span>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(checkoutDiv);
    document.getElementById('checkoutForm').onsubmit = handleCheckoutSubmit;
}

function selectDeliveryZone(zoneId, price) {
    document.querySelectorAll('#deliveryOptions .radio-option').forEach(option => {
        option.classList.remove('selected');
    });
    document.querySelector(`input[value="${zoneId}"]`).closest('.radio-option').classList.add('selected');
    
    document.getElementById('summaryDelivery').textContent = `${price} MAD`;
    updateOrderTotal();
}

async function applyCoupon() {
    const couponCode = document.getElementById('couponCode').value.trim();
    const messageDiv = document.getElementById('couponMessage');
    
    if (!couponCode) {
        messageDiv.innerHTML = '<span style="color: #ff6b6b;">Please enter a coupon code</span>';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/coupons/validate/${couponCode}`);
        const data = await response.json();
        
        if (response.ok) {
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            if (data.minOrder && subtotal < data.minOrder) {
                messageDiv.innerHTML = `<span style="color: #ff6b6b;">Minimum order of ${data.minOrder} MAD required</span>`;
                return;
            }
            
            let discount = 0;
            if (data.type === 'percentage') {
                discount = subtotal * (data.value / 100);
            } else {
                discount = data.value;
            }
            
            document.getElementById('summaryDiscount').textContent = `-${discount.toFixed(2)} MAD`;
            document.getElementById('couponDiscount').style.display = 'flex';
            messageDiv.innerHTML = `<span style="color: #27ae60;">Coupon applied! You saved ${discount.toFixed(2)} MAD</span>`;
            
            window.appliedCoupon = { ...data, discount };
            updateOrderTotal();
        } else {
            messageDiv.innerHTML = `<span style="color: #ff6b6b;">${data.error}</span>`;
        }
    } catch (error) {
        messageDiv.innerHTML = '<span style="color: #ff6b6b;">Error applying coupon</span>';
    }
}

function updateOrderTotal() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryElement = document.getElementById('summaryDelivery');
    const deliveryPrice = parseFloat(deliveryElement.textContent.replace(' MAD', '')) || 0;
    const discount = window.appliedCoupon ? window.appliedCoupon.discount : 0;
    
    const total = subtotal + deliveryPrice - discount;
    document.getElementById('summaryTotal').textContent = `${total.toFixed(2)} MAD`;
}

async function handleCheckoutSubmit(e) {
    e.preventDefault();
    showLoading();
    
    const selectedDeliveryZone = deliveryZones.find(z => 
        z._id === document.querySelector('input[name="delivery"]:checked').value
    );
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryPrice = selectedDeliveryZone ? selectedDeliveryZone.price : 0;
    const discount = window.appliedCoupon ? window.appliedCoupon.discount : 0;
    const total = subtotal + deliveryPrice - discount;
    
    const orderData = {
        customerInfo: {
            name: `${document.getElementById('firstName').value} ${document.getElementById('lastName').value}`,
            email: document.getElementById('customerEmail').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
            city: document.getElementById('city').value,
            postalCode: document.getElementById('postalCode').value
        },
        items: cart.map(item => ({
            product: item.product,
            productName: item.productName,
            variant: item.variant,
            price: item.price,
            quantity: item.quantity
        })),
        subtotal: subtotal,
        deliveryZone: selectedDeliveryZone.name,
        deliveryPrice: deliveryPrice,
        discount: discount,
        total: total,
        coupon: window.appliedCoupon ? window.appliedCoupon.code : null,
        paymentMethod: 'cod'
    };
    
    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(orderData)
        });
        
        if (response.ok) {
            // Clear cart from database
            await clearCartDatabase();
            window.appliedCoupon = null;
            showToast('Order placed successfully! We will contact you shortly.', 'success');
            closeCheckout();
            goHome();
        } else {
            const error = await response.json();
            showToast(error.error || 'Error placing order', 'error');
        }
    } catch (error) {
        console.log(error)
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function closeCheckout() {
    const checkoutSection = document.getElementById('checkout-section');
    if (checkoutSection) {
        checkoutSection.remove();
    }
}

// ===== ADMIN FUNCTIONS =====
async function loadAdminDashboard() {
    // Ensure dashboard stats and admin nav are visible
    const dashboardStats = document.querySelector('.dashboard-stats');
    const adminNav = document.querySelector('.admin-nav');
    const adminPanelTitle = document.querySelector('.admin-panel h2');
    
    if (dashboardStats) {
        dashboardStats.style.display = 'grid';
    }
    if (adminNav) {
        adminNav.style.display = 'flex';
    }
    if (adminPanelTitle) {
        adminPanelTitle.style.display = 'block';
    }
    
    try {
        const response = await fetch(`${API_URL}/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('totalProducts').textContent = stats.totalProducts;
            document.getElementById('totalOrders').textContent = stats.totalOrders;
            document.getElementById('totalUsers').textContent = stats.totalUsers;
            document.getElementById('totalRevenue').textContent = `${stats.totalRevenue.toFixed(2)} MAD`;
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Chart cleanup function
function cleanupCharts() {
    console.log('=== CLEANUP CHARTS START ===');
    
    // Destroy sales chart
    if (salesChartInstance && typeof salesChartInstance.destroy === 'function') {
        salesChartInstance.destroy();
        salesChartInstance = null;
    }
    
    // Destroy category chart
    if (categoryChartInstance && typeof categoryChartInstance.destroy === 'function') {
        categoryChartInstance.destroy();
        categoryChartInstance = null;
    }
    
    console.log('=== CLEANUP CHARTS END ===');
}

function showAdminSection(section) {
    // Clean up charts when switching away from reports
    if (section !== 'reports') {
        cleanupCharts();
    }
    
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.admin-nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show selected section - use the correct ID format
    const sectionId = section === 'products' ? 'admin-products' : `admin-${section}`;
    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
        sectionElement.classList.remove('hidden');
    }
    
    // Add active class to clicked button
    event.target.classList.add('active');
    
    // Hide dashboard stats when showing profile
    const dashboardStats = document.querySelector('.dashboard-stats');
    const dashboardTitle = document.querySelector('.dashboard-title');
    
    if (section === 'profile') {
        if (dashboardStats) dashboardStats.classList.add('hidden');
        if (dashboardTitle) dashboardTitle.classList.add('hidden');
    } else {
        if (dashboardStats) dashboardStats.classList.remove('hidden');
        if (dashboardTitle) dashboardTitle.classList.remove('hidden');
    }
    
    // Load data based on section
    switch(section) {
        case 'products':
            loadAdminProducts();
            break;
        case 'categories':
            loadAdminCategories();
            break;
        case 'orders':
            loadAdminOrders();
            break;
        case 'delivery':
            loadAdminDeliveryZones();
            break;
        case 'coupons':
            loadAdminCoupons();
            break;
        case 'users':
            loadAdminUsers();
            break;
        case 'reports':
            loadReports();
            break;
        case 'profile':
            loadAdminProfile();
            break;
    }
}

async function loadAdminData() {
    await loadCategories();
    loadAdminProducts();
}

async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`);
        categories = await response.json();
        
        // Update category select
        const categorySelect = document.getElementById('productCategory');
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Select Category</option>' +
                categories.map(cat => `<option value="${cat.slug}">${cat.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadAdminProducts() {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/products`);
        const products = await response.json();
        
        const tbody = document.getElementById('productsTableBody');
        tbody.innerHTML = products.map(product => `
            <tr>
                <td>${product.name}</td>
                <td>${product.category}</td>
                <td>${product.price} MAD</td>
                <td>${product.stock}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editProduct('${product._id}')" style="margin-right: 0.5rem;">Edit</button>
                    <button class="btn" onclick="deleteProduct('${product._id}')" style="background: #ff6b6b; color: white;">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('Error loading products', 'error');
    } finally {
        hideLoading();
    }
}

async function loadAdminCategories() {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/categories`);
        const categories = await response.json();
        
        const tbody = document.getElementById('categoriesTableBody');
        tbody.innerHTML = categories.map(category => `
            <tr>
                <td>${category.name}</td>
                <td>${category.slug}</td>
                <td>${products.filter(p => p.category === category.slug).length}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editCategory('${category._id}')" style="margin-right: 0.5rem;">Edit</button>
                    <button class="btn" onclick="deleteCategory('${category._id}')" style="background: #ff6b6b; color: white;">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('Error loading categories', 'error');
    } finally {
        hideLoading();
    }
}

async function loadAdminOrders() {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/orders`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const orders = await response.json();
        
        const tbody = document.getElementById('ordersTableBody');
        tbody.innerHTML = orders.map(order => `
            <tr>
                <td>${order.orderNumber}</td>
                <td>${order.customerInfo.name}</td>
                <td>${order.total} MAD</td>
                <td>
                    <select onchange="updateOrderStatus('${order._id}', this.value)" style="padding: 0.3rem; border: 1px solid #e6b8a2; border-radius: 4px;">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-secondary" onclick="viewOrderDetails('${order._id}')">View Details</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('Error loading orders', 'error');
    } finally {
        hideLoading();
    }
}

async function loadAdminDeliveryZones() {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/delivery-zones`);
        const zones = await response.json();
        
        const tbody = document.getElementById('deliveryTableBody');
        tbody.innerHTML = zones.map(zone => `
            <tr>
                <td>${zone.name}</td>
                <td>${zone.price} MAD</td>
                <td>${zone.cities.join(', ')}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editDeliveryZone('${zone._id}')" style="margin-right: 0.5rem;">Edit</button>
                    <button class="btn" onclick="deleteDeliveryZone('${zone._id}')" style="background: #ff6b6b; color: white;">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('Error loading delivery zones', 'error');
    } finally {
        hideLoading();
    }
}

async function loadAdminCoupons() {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/coupons`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const coupons = await response.json();
        
        const tbody = document.getElementById('couponsTableBody');
        tbody.innerHTML = coupons.map(coupon => `
            <tr>
                <td>${coupon.code}</td>
                <td>${coupon.type}</td>
                <td>${coupon.value}${coupon.type === 'percentage' ? '%' : ' MAD'}</td>
                <td>${coupon.minOrder || 'None'} MAD</td>
                <td>${coupon.expiry ? new Date(coupon.expiry).toLocaleDateString() : 'No expiry'}</td>
                <td>${coupon.used || 0}/${coupon.usageLimit || '∞'}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editCoupon('${coupon._id}')" style="margin-right: 0.5rem;">Edit</button>
                    <button class="btn" onclick="deleteCoupon('${coupon._id}')" style="background: #ff6b6b; color: white;">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('Error loading coupons', 'error');
    } finally {
        hideLoading();
    }
}

async function loadAdminUsers() {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const users = await response.json();
        
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.phone}</td>
                <td>${new Date(user.registrationDate).toLocaleDateString()}</td>
                <td>${user.orderCount || 0}</td>
                <td>${user.totalSpent || 0} MAD</td>
                <td>
                    <button class="btn btn-secondary" onclick="viewUserDetails('${user._id}')">View Details</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showToast('Error loading users', 'error');
    } finally {
        hideLoading();
    }
}

function loadAdminProfile() {
    // Populate admin profile information
    document.getElementById('adminProfileName').textContent = currentUser.name || 'Not provided';
    document.getElementById('adminProfileEmail').textContent = currentUser.email || 'Not provided';
    document.getElementById('adminProfilePhone').textContent = currentUser.phone || 'Not provided';
    document.getElementById('adminProfileAddress').textContent = currentUser.address || 'Not provided';
    document.getElementById('adminProfileCity').textContent = currentUser.city || 'Not provided';
    
    // Format registration date
    const registrationDate = currentUser.registrationDate ? new Date(currentUser.registrationDate).toLocaleDateString() : 'Unknown';
    document.getElementById('adminProfileDate').textContent = registrationDate;
}

// ===== VARIANT MANAGEMENT FUNCTIONS =====
function showVariantModal() {
    console.log('Opening variant modal');
    document.getElementById('variantModal').style.display = 'flex';
    VariantManager.updateTempList();
}

function closeVariantModal() {
    document.getElementById('variantModal').style.display = 'none';
}

function addVariant() {
    const type = document.getElementById('variantType').value;
    const name = document.getElementById('variantName').value.trim();
    const price = parseFloat(document.getElementById('variantPrice').value);
    const stock = parseInt(document.getElementById('variantStock').value) || 0;
    
    if (!name) {
        showToast('Please enter variant name', 'error');
        return;
    }
    
    if (isNaN(price) || price <= 0) {
        showToast('Please enter a valid price', 'error');
        return;
    }
    
    const newVariant = { type, name, price, stock };
    VariantManager.add(newVariant);
    
    // Clear form but keep type selected
    document.getElementById('variantName').value = '';
    document.getElementById('variantPrice').value = '150';
    document.getElementById('variantStock').value = '10';
    
    showToast('Variant added successfully', 'success');
}

function saveVariants() {
    if (VariantManager.variants.length === 0) {
        showToast('No variants to save', 'error');
        return;
    }
    
    closeVariantModal();
    showToast(`${VariantManager.variants.length} variants ready to be saved with product`, 'success');
}

// ===== FORM HANDLERS =====
function setupEventListeners() {
    // Auth forms
    document.getElementById('loginForm').addEventListener('submit', login);
    document.getElementById('registerForm').addEventListener('submit', register);
    
    // Product form submission
    document.getElementById('productForm').addEventListener('submit', handleProductSubmit);
    
    // Category form submission
    document.getElementById('categoryForm').addEventListener('submit', handleCategorySubmit);
    
    // Delivery form submission
    document.getElementById('deliveryForm').addEventListener('submit', handleDeliverySubmit);
    
    // Coupon form submission
    document.getElementById('couponForm').addEventListener('submit', handleCouponSubmit);
    
    // Change password form submission
    document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);
    
    // Admin change password form submission
    document.getElementById('adminChangePasswordForm').addEventListener('submit', handleAdminChangePassword);
    
    // File upload handling
    document.getElementById('productImageFile').addEventListener('change', handleFileUpload);
    document.getElementById('categoryImageFile').addEventListener('change', handleCategoryFileUpload);
    
    // User dropdown
    document.getElementById('userIcon').onclick = function() {
        if (currentUser) {
            document.getElementById('userDropdown').classList.toggle('active');
        } else {
            showProfile();
        }
    };
    
    // Close dropdowns on click outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.user-menu')) {
            document.getElementById('userDropdown').classList.remove('active');
        }
    });
}

async function handleProductSubmit(e) {
    e.preventDefault();
    showLoading();
    
    const imageValue = document.getElementById('productImage').value.trim();
    // Validate image field
    if (!imageValue || !(imageValue.startsWith('http') || imageValue.startsWith('/uploads/') || imageValue.startsWith('data:'))) {
        showToast('Please upload an image or provide a valid image URL.', 'error');
        hideLoading();
        return;
    }
    
    const productData = {
        name: document.getElementById('productName').value,
        category: document.getElementById('productCategory').value,
        price: parseFloat(document.getElementById('productPrice').value),
        stock: parseInt(document.getElementById('productStock').value),
        description: document.getElementById('productDescription').value,
        image: imageValue,
        variants: VariantManager.getAll()
    };
    
    console.log('Submitting product with variants:', productData.variants);
    
    try {
        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(productData)
        });
        
        if (response.ok) {
            showToast('Product added successfully!', 'success');
            document.getElementById('productForm').reset();
            VariantManager.clear();
            loadAdminProducts();
        } else {
            const error = await response.json();
            showToast(error.error || 'Error adding product', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function handleCategorySubmit(e) {
    e.preventDefault();
    showLoading();
    
    const imageValue = document.getElementById('categoryImage').value.trim();
    // Validate image field
    if (!imageValue || !(imageValue.startsWith('http') || imageValue.startsWith('/uploads/') || imageValue.startsWith('data:'))) {
        showToast('Please upload an image or provide a valid image URL.', 'error');
        hideLoading();
        return;
    }
    
    const categoryData = {
        name: document.getElementById('categoryName').value,
        slug: document.getElementById('categorySlug').value,
        description: document.getElementById('categoryDescription').value,
        image: imageValue
    };
    
    try {
        const response = await fetch(`${API_URL}/categories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(categoryData)
        });
        
        if (response.ok) {
            showToast('Category added successfully!', 'success');
            document.getElementById('categoryForm').reset();
            loadCategories();
            loadAdminCategories();
        } else {
            const error = await response.json();
            showToast(error.error || 'Error adding category', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function handleDeliverySubmit(e) {
    e.preventDefault();
    showLoading();
    
    const deliveryData = {
        name: document.getElementById('zoneName').value,
        price: parseFloat(document.getElementById('zonePrice').value),
        cities: document.getElementById('zoneCities').value.split(',').map(city => city.trim())
    };
    
    try {
        const response = await fetch(`${API_URL}/delivery-zones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(deliveryData)
        });
        
        if (response.ok) {
            showToast('Delivery zone added successfully!', 'success');
            document.getElementById('deliveryForm').reset();
            loadAdminDeliveryZones();
        } else {
            const error = await response.json();
            showToast(error.error || 'Error adding delivery zone', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function handleCouponSubmit(e) {
    e.preventDefault();
    showLoading();
    
    const couponData = {
        code: document.getElementById('couponCode').value,
        type: document.getElementById('couponType').value,
        value: parseFloat(document.getElementById('couponValue').value),
        minOrder: parseFloat(document.getElementById('couponMinOrder').value) || null,
        expiry: document.getElementById('couponExpiry').value || null,
        usageLimit: parseInt(document.getElementById('couponUsageLimit').value) || null
    };
    
    try {
        const response = await fetch(`${API_URL}/coupons`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(couponData)
        });
        
        if (response.ok) {
            showToast('Coupon added successfully!', 'success');
            document.getElementById('couponForm').reset();
            loadAdminCoupons();
        } else {
            const error = await response.json();
            showToast(error.error || 'Error adding coupon', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    showLoading();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        hideLoading();
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('New password must be at least 6 characters long', 'error');
        hideLoading();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });
        
        if (response.ok) {
            showToast('Password changed successfully!', 'success');
            document.getElementById('changePasswordForm').reset();
        } else {
            const error = await response.json();
            showToast(error.error || 'Error changing password', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function handleAdminChangePassword(e) {
    e.preventDefault();
    showLoading();
    
    const currentPassword = document.getElementById('adminCurrentPassword').value;
    const newPassword = document.getElementById('adminNewPassword').value;
    const confirmPassword = document.getElementById('adminConfirmPassword').value;
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        hideLoading();
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('New password must be at least 6 characters long', 'error');
        hideLoading();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });
        
        if (response.ok) {
            showToast('Password changed successfully!', 'success');
            document.getElementById('adminChangePasswordForm').reset();
        } else {
            const error = await response.json();
            showToast(error.error || 'Error changing password', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// ===== CRUD OPERATIONS =====
async function editProduct(productId) {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/products/${productId}`);
        const product = await response.json();
        
        // Populate the form with product data
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productStock').value = product.stock;
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productImage').value = product.image || '';
        
        // Show image preview if product has an image
        if (product.image) {
            document.getElementById('previewImg').src = product.image;
            document.getElementById('imagePreview').style.display = 'flex';
            document.getElementById('fileInfo').textContent = 'Image from URL';
        } else {
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('fileInfo').textContent = 'No file selected';
        }
        
        // Load variants if they exist
        if (product.variants && product.variants.length > 0) {
            VariantManager.clear();
            product.variants.forEach(variant => {
                VariantManager.add(variant);
            });
        }
        
        // Change form button text and add product ID for update
        const submitBtn = document.querySelector('#productForm button[type="submit"]');
        submitBtn.textContent = 'Update Product';
        submitBtn.onclick = (e) => updateProduct(e, productId);
        
        showToast('Product loaded for editing', 'info');
        
    } catch (error) {
        showToast('Error loading product for editing', 'error');
    } finally {
        hideLoading();
    }
}

async function updateProduct(e, productId) {
    e.preventDefault();
    showLoading();
    
    const productData = {
        name: document.getElementById('productName').value,
        category: document.getElementById('productCategory').value,
        price: parseFloat(document.getElementById('productPrice').value),
        stock: parseInt(document.getElementById('productStock').value),
        description: document.getElementById('productDescription').value,
        image: document.getElementById('productImage').value || '',
        variants: VariantManager.getAll()
    };
    
    try {
        const response = await fetch(`${API_URL}/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(productData)
        });
        
        if (response.ok) {
            showToast('Product updated successfully!', 'success');
            clearProductForm();
            loadAdminProducts();
        } else {
            const error = await response.json();
            showToast(error.error || 'Error updating product', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            showToast('Product deleted successfully!', 'success');
            loadAdminProducts();
        } else {
            showToast('Error deleting product', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function editCategory(categoryId) {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/categories/${categoryId}`);
        const category = await response.json();
        
        // Populate the form with category data
        document.getElementById('categoryName').value = category.name;
        document.getElementById('categorySlug').value = category.slug;
        document.getElementById('categoryDescription').value = category.description || '';
        document.getElementById('categoryImage').value = category.image || '';
        
        // Show image preview if category has an image
        if (category.image) {
            document.getElementById('categoryPreviewImg').src = category.image;
            document.getElementById('categoryImagePreview').style.display = 'flex';
            document.getElementById('categoryFileInfo').textContent = 'Image from URL';
        } else {
            document.getElementById('categoryImagePreview').style.display = 'none';
            document.getElementById('categoryFileInfo').textContent = 'No file selected';
        }
        
        // Change form button text and add category ID for update
        const submitBtn = document.querySelector('#categoryForm button[type="submit"]');
        submitBtn.textContent = 'Update Category';
        submitBtn.onclick = (e) => updateCategory(e, categoryId);
        
        showToast('Category loaded for editing', 'info');
        
    } catch (error) {
        showToast('Error loading category for editing', 'error');
    } finally {
        hideLoading();
    }
}

async function updateCategory(e, categoryId) {
    e.preventDefault();
    showLoading();
    
    const categoryData = {
        name: document.getElementById('categoryName').value,
        slug: document.getElementById('categorySlug').value,
        description: document.getElementById('categoryDescription').value,
        image: document.getElementById('categoryImage').value || ''
    };
    
    try {
        const response = await fetch(`${API_URL}/categories/${categoryId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(categoryData)
        });
        
        if (response.ok) {
            showToast('Category updated successfully!', 'success');
            clearCategoryForm();
            loadAdminCategories();
            loadCategories();
        } else {
            const error = await response.json();
            showToast(error.error || 'Error updating category', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function clearCategoryForm() {
    document.getElementById('categoryForm').reset();
    
    // Clear category image upload
    clearCategoryImagePreview();
    
    // Reset form button back to "Add Category"
    const submitBtn = document.querySelector('#categoryForm button[type="submit"]');
    submitBtn.textContent = 'Add Category';
    submitBtn.onclick = handleCategorySubmit;
}

async function deleteCategory(categoryId) {
    if (!confirm('Are you sure you want to delete this category?')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/categories/${categoryId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            showToast('Category deleted successfully!', 'success');
            loadAdminCategories();
            loadCategories();
        } else {
            showToast('Error deleting category', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function editDeliveryZone(zoneId) {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/delivery-zones/${zoneId}`);
        const zone = await response.json();
        
        // Populate the form with delivery zone data
        document.getElementById('zoneName').value = zone.name;
        document.getElementById('zonePrice').value = zone.price;
        document.getElementById('zoneCities').value = zone.cities.join(', ');
        
        // Change form button text and add zone ID for update
        const submitBtn = document.querySelector('#deliveryForm button[type="submit"]');
        submitBtn.textContent = 'Update Zone';
        submitBtn.onclick = (e) => updateDeliveryZone(e, zoneId);
        
        showToast('Delivery zone loaded for editing', 'info');
        
    } catch (error) {
        showToast('Error loading delivery zone for editing', 'error');
    } finally {
        hideLoading();
    }
}

async function updateDeliveryZone(e, zoneId) {
    e.preventDefault();
    showLoading();
    
    const zoneData = {
        name: document.getElementById('zoneName').value,
        price: parseFloat(document.getElementById('zonePrice').value),
        cities: document.getElementById('zoneCities').value.split(',').map(city => city.trim())
    };
    
    try {
        const response = await fetch(`${API_URL}/delivery-zones/${zoneId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(zoneData)
        });
        
        if (response.ok) {
            showToast('Delivery zone updated successfully!', 'success');
            clearDeliveryForm();
            loadAdminDeliveryZones();
        } else {
            const error = await response.json();
            showToast(error.error || 'Error updating delivery zone', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function clearDeliveryForm() {
    document.getElementById('deliveryForm').reset();
    
    // Reset form button back to "Add Zone"
    const submitBtn = document.querySelector('#deliveryForm button[type="submit"]');
    submitBtn.textContent = 'Add Zone';
    submitBtn.onclick = handleDeliverySubmit;
}

async function deleteDeliveryZone(zoneId) {
    if (!confirm('Are you sure you want to delete this delivery zone?')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/delivery-zones/${zoneId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            showToast('Delivery zone deleted successfully!', 'success');
            loadAdminDeliveryZones();
        } else {
            showToast('Error deleting delivery zone', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function editCoupon(couponId) {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/coupons/${couponId}`);
        const coupon = await response.json();
        
        // Populate the form with coupon data
        document.getElementById('couponCode').value = coupon.code;
        document.getElementById('couponType').value = coupon.type;
        document.getElementById('couponValue').value = coupon.value;
        document.getElementById('couponMinOrder').value = coupon.minOrder || '';
        document.getElementById('couponExpiry').value = coupon.expiry ? coupon.expiry.split('T')[0] : '';
        document.getElementById('couponUsageLimit').value = coupon.usageLimit || '';
        
        // Change form button text and add coupon ID for update
        const submitBtn = document.querySelector('#couponForm button[type="submit"]');
        submitBtn.textContent = 'Update Coupon';
        submitBtn.onclick = (e) => updateCoupon(e, couponId);
        
        showToast('Coupon loaded for editing', 'info');
        
    } catch (error) {
        showToast('Error loading coupon for editing', 'error');
    } finally {
        hideLoading();
    }
}

async function updateCoupon(e, couponId) {
    e.preventDefault();
    showLoading();
    
    const couponData = {
        code: document.getElementById('couponCode').value,
        type: document.getElementById('couponType').value,
        value: parseFloat(document.getElementById('couponValue').value),
        minOrder: parseFloat(document.getElementById('couponMinOrder').value) || null,
        expiry: document.getElementById('couponExpiry').value || null,
        usageLimit: parseInt(document.getElementById('couponUsageLimit').value) || null
    };
    
    try {
        const response = await fetch(`${API_URL}/coupons/${couponId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(couponData)
        });
        
        if (response.ok) {
            showToast('Coupon updated successfully!', 'success');
            clearCouponForm();
            loadAdminCoupons();
        } else {
            const error = await response.json();
            showToast(error.error || 'Error updating coupon', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function clearCouponForm() {
    document.getElementById('couponForm').reset();
    
    // Reset form button back to "Add Coupon"
    const submitBtn = document.querySelector('#couponForm button[type="submit"]');
    submitBtn.textContent = 'Add Coupon';
    submitBtn.onclick = handleCouponSubmit;
}

async function deleteCoupon(couponId) {
    if (!confirm('Are you sure you want to delete this coupon?')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/coupons/${couponId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            showToast('Coupon deleted successfully!', 'success');
            loadAdminCoupons();
        } else {
            showToast('Error deleting coupon', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function updateOrderStatus(orderId, newStatus) {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            showToast('Order status updated successfully!', 'success');
        } else {
            showToast('Error updating order status', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

async function viewOrderDetails(orderId) {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const order = await response.json();
            
            // Helper function to get variant name
            const getVariantName = (item) => {
                if (!item.variant) return 'Standard';
                
                // If variant is already populated with name
                if (typeof item.variant === 'object' && item.variant.name) {
                    return `${item.variant.name} (${item.variant.type})`;
                }
                
                // If variant is just an ID, find it in product variants
                if (item.product && item.product.variants) {
                    const variant = item.product.variants.find(v => v._id === item.variant);
                    if (variant) {
                        return `${variant.name} (${variant.type})`;
                    }
                }
                
                return 'Variant not found';
            };
            
            // Create an improved admin modal
            const modal = document.createElement('div');
            modal.className = 'modal admin-order-modal';
            modal.style.display = 'flex';
            
            modal.innerHTML = `
                <div class="modal-content">
                    <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
                    
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <h2 style="color: #7a5c2e; margin-bottom: 0.5rem;">Order Details</h2>
                        <div style="display: flex; justify-content: center; align-items: center; gap: 1rem;">
                            <span class="status-badge ${order.status}" style="font-size: 1rem;">${order.status.toUpperCase()}</span>
                            <span style="color: #666; font-size: 1.1rem;">#${order.orderNumber}</span>
                        </div>
                    </div>
                    
                    <div class="order-detail-section">
                        <h3><i class="fas fa-user-circle"></i> Customer Information</h3>
                        <div class="delivery-info">
                            <p><strong>Name:</strong> ${order.customerInfo.name}</p>
                            <p><strong>Phone:</strong> ${order.customerInfo.phone}</p>
                            <p><strong>Email:</strong> ${order.customerInfo.email || 'Not provided'}</p>
                            <p><strong>Address:</strong> ${order.customerInfo.address}</p>
                            <p><strong>City:</strong> ${order.customerInfo.city}</p>
                        </div>
                    </div>
                    
                    <div class="order-detail-section">
                        <h3><i class="fas fa-shopping-bag"></i> Order Items</h3>
                        <div class="order-items-table">
                            <div class="order-item-row" style="background: #7a5c2e; color: white; font-weight: 600;">
                                <div>Product</div>
                                <div>Variant</div>
                                <div>Price</div>
                                <div>Quantity</div>
                                <div>Total</div>
                            </div>
                            ${order.items.map(item => `
                                <div class="order-item-row">
                                    <div class="item-info">
                                        <div class="item-name">${item.productName}</div>
                                    </div>
                                    <div>${getVariantName(item)}</div>
                                    <div>${item.price} MAD</div>
                                    <div>${item.quantity}</div>
                                    <div><strong>${item.price * item.quantity} MAD</strong></div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="order-detail-section">
                        <h3><i class="fas fa-calculator"></i> Order Summary</h3>
                        <div class="order-summary">
                            <div class="summary-row">
                                <span>Subtotal:</span>
                                <span>${order.subtotal} MAD</span>
                            </div>
                            <div class="summary-row">
                                <span>Delivery Fee:</span>
                                <span>${order.deliveryPrice} MAD</span>
                            </div>
                            ${order.coupon ? `
                                <div class="summary-row">
                                    <span>Coupon Discount (${order.coupon}):</span>
                                    <span style="color: #dc3545;">-${order.discount} MAD</span>
                                </div>
                            ` : ''}
                            <div class="summary-row total">
                                <span><strong>Total Amount:</strong></span>
                                <span><strong style="font-size: 1.2rem;">${order.total} MAD</strong></span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="order-detail-section">
                        <h3><i class="fas fa-info-circle"></i> Order Information</h3>
                        <div class="order-status-info">
                            <p>
                                <strong>Order Date:</strong> 
                                <span>${new Date(order.createdAt).toLocaleString()}</span>
                            </p>
                            <p>
                                <strong>Payment Method:</strong> 
                                <span>${order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod.toUpperCase()}</span>
                            </p>
                            <p>
                                <strong>Delivery Zone:</strong> 
                                <span>${order.deliveryZone || 'Not specified'}</span>
                            </p>
                            ${order.notes ? `
                                <p>
                                    <strong>Customer Notes:</strong> 
                                    <span>${order.notes}</span>
                                </p>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="order-detail-section">
                        <h3><i class="fas fa-cogs"></i> Order Management</h3>
                        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                            <select id="orderStatusSelect" style="padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; flex: 1; min-width: 200px;">
                                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                                <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                                <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                            <button class="btn btn-primary" onclick="updateOrderStatus('${order._id}', document.getElementById('orderStatusSelect').value)">
                                <i class="fas fa-save"></i> Update Status
                            </button>
                            <button class="btn btn-secondary" onclick="printOrder('${order._id}')">
                                <i class="fas fa-print"></i> Print Order
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        } else {
            showToast('Error loading order details', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function getStatusColor(status) {
    switch (status) {
        case 'pending': return '#f39c12';
        case 'confirmed': return '#3498db';
        case 'shipped': return '#9b59b6';
        case 'delivered': return '#27ae60';
        case 'cancelled': return '#e74c3c';
        default: return '#7a5c2e';
    }
}

async function viewUserDetails(userId) {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const user = await response.json();
            
            // Create a modal to show user details
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
                    <h2 style="color: #7a5c2e; margin-bottom: 1.5rem;">User Details</h2>
                    
                    <div style="margin-bottom: 1rem;">
                        <p><strong>Name:</strong> ${user.name}</p>
                        <p><strong>Email:</strong> ${user.email}</p>
                        <p><strong>Phone:</strong> ${user.phone}</p>
                        <p><strong>Address:</strong> ${user.address || 'Not provided'}</p>
                        <p><strong>City:</strong> ${user.city || 'Not provided'}</p>
                        <p><strong>Role:</strong> ${user.role}</p>
                        <p><strong>Registration Date:</strong> ${new Date(user.registrationDate).toLocaleDateString()}</p>
                        <p><strong>Total Orders:</strong> ${user.orderCount || 0}</p>
                        <p><strong>Total Spent:</strong> ${user.totalSpent || 0} MAD</p>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        } else {
            showToast('Error loading user details', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function filterOrders() {
    const status = document.getElementById('orderStatusFilter').value;
    loadAdminOrders(status);
}

function clearProductForm() {
    document.getElementById('productForm').reset();
    VariantManager.clear();
    
    // Clear file upload
    clearImagePreview();
    
    // Reset form button back to "Add Product"
    const submitBtn = document.querySelector('#productForm button[type="submit"]');
    submitBtn.textContent = 'Add Product';
    submitBtn.onclick = handleProductSubmit;
}

// ===== UTILITY FUNCTIONS =====
function showLoading() {
    document.getElementById('loadingSpinner').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingSpinner').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type} show`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

function showOrders() {
    if (!currentUser) {
        // User is not logged in, show auth container with login tab
        document.getElementById('authContainer').classList.remove('hidden');
        document.getElementById('customerContent').classList.add('hidden');
        document.getElementById('home-slider').classList.add('hidden');
        
        // Make sure login tab is active
        showAuthTab('login');
        showToast('Please login to view your orders', 'info');
    } else {
        // User is logged in, show profile with orders tab
        showProfile();
        showProfileTab('orders');
    }
}

async function loadUserOrders() {
    showLoading();
    
    console.log('=== LOAD USER ORDERS DEBUG ===');
    console.log('Current user:', currentUser);
    console.log('Auth token:', authToken ? 'Present' : 'Missing');
    
    try {
        const response = await fetch(`${API_URL}/orders`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        if (response.ok) {
            const orders = await response.json();
            console.log('Received orders:', orders);
            console.log('Orders count:', orders.length);
            renderUserOrders(orders);
        } else {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            showToast('Error loading orders', 'error');
        }
    } catch (error) {
        console.error('Network error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
        console.log('=== END LOAD USER ORDERS DEBUG ===');
    }
}

function renderUserOrders(orders) {
    const container = document.getElementById('userOrdersContainer');
    
    // Helper function to get variant name
    const getVariantName = (item) => {
        if (!item.variant) return '';
        
        // If variant is already populated with name
        if (typeof item.variant === 'object' && item.variant.name) {
            return `${item.variant.name} (${item.variant.type})`;
        }
        
        // If variant is just an ID, find it in product variants
        if (item.product && item.product.variants) {
            const variant = item.product.variants.find(v => v._id === item.variant);
            if (variant) {
                return `${variant.name} (${variant.type})`;
            }
        }
        
        return 'Variant not found';
    };
    
    if (orders.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #7a5c2e;">
                <i class="fas fa-shopping-bag" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <h3>No Orders Yet</h3>
                <p>You haven't placed any orders yet. Start shopping to see your orders here!</p>
                <button class="btn btn-primary" onclick="showHome()" style="margin-top: 1rem;">
                    <i class="fas fa-home"></i> Start Shopping
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <h2 style="color: #7a5c2e; margin-bottom: 2rem; text-align: center;">My Orders</h2>
        <div class="orders-grid">
            ${orders.map(order => `
                <div class="order-card">
                    <div class="order-header">
                        <div class="order-info">
                            <h3>Order #${order.orderNumber}</h3>
                            <p class="order-date">${new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div class="order-status">
                            <span class="status-badge ${order.status}">${order.status.toUpperCase()}</span>
                        </div>
                    </div>
                    
                    <div class="order-items">
                        ${order.items.slice(0, 2).map(item => `
                            <div class="order-item">
                                <span class="item-name">${item.productName}</span>
                                <span class="item-details">${getVariantName(item)} x${item.quantity}</span>
                            </div>
                        `).join('')}
                        ${order.items.length > 2 ? `<div class="more-items">+${order.items.length - 2} more items</div>` : ''}
                    </div>
                    
                    <div class="order-footer">
                        <div class="order-total">
                            <strong>Total: ${order.total} MAD</strong>
                        </div>
                        <button class="btn btn-secondary" onclick="viewUserOrderDetails('${order._id}')">
                            View Details
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function viewUserOrderDetails(orderId) {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const order = await response.json();
            
            // Helper function to get variant name
            const getVariantName = (item) => {
                if (!item.variant) return 'Standard';
                
                // If variant is already populated with name
                if (typeof item.variant === 'object' && item.variant.name) {
                    return `${item.variant.name} (${item.variant.type})`;
                }
                
                // If variant is just an ID, find it in product variants
                if (item.product && item.product.variants) {
                    const variant = item.product.variants.find(v => v._id === item.variant);
                    if (variant) {
                        return `${variant.name} (${variant.type})`;
                    }
                }
                
                return 'Variant not found';
            };
            
            // Create a modal to show order details
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
                    <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
                    <h2 style="color: #7a5c2e; margin-bottom: 1.5rem;">Order Details - ${order.orderNumber}</h2>
                    
                    <div style="margin-bottom: 2rem;">
                        <h3 style="color: #7a5c2e; margin-bottom: 1rem;">
                            <i class="fas fa-user"></i> Delivery Information
                        </h3>
                        <div class="delivery-info">
                            <p><strong>Name:</strong> ${order.customerInfo.name}</p>
                            <p><strong>Phone:</strong> ${order.customerInfo.phone}</p>
                            <p><strong>Address:</strong> ${order.customerInfo.address}</p>
                            <p><strong>City:</strong> ${order.customerInfo.city}</p>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 2rem;">
                        <h3 style="color: #7a5c2e; margin-bottom: 1rem;">
                            <i class="fas fa-shopping-cart"></i> Order Items
                        </h3>
                        <div class="order-items-table">
                            ${order.items.map(item => `
                                <div class="order-item-row">
                                    <div class="item-info">
                                        <div class="item-name">${item.productName}</div>
                                        <div class="item-variant">${getVariantName(item)}</div>
                                    </div>
                                    <div class="item-price">${item.price} MAD</div>
                                    <div class="item-quantity">x${item.quantity}</div>
                                    <div class="item-total">${item.price * item.quantity} MAD</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 2rem;">
                        <h3 style="color: #7a5c2e; margin-bottom: 1rem;">
                            <i class="fas fa-receipt"></i> Order Summary
                        </h3>
                        <div class="order-summary">
                            <div class="summary-row">
                                <span>Subtotal:</span>
                                <span>${order.subtotal} MAD</span>
                            </div>
                            <div class="summary-row">
                                <span>Delivery:</span>
                                <span>${order.deliveryPrice} MAD</span>
                            </div>
                            ${order.coupon ? `
                                <div class="summary-row">
                                    <span>Coupon (${order.coupon}):</span>
                                    <span>-${order.discount} MAD</span>
                                </div>
                            ` : ''}
                            <div class="summary-row total">
                                <span><strong>Total:</strong></span>
                                <span><strong>${order.total} MAD</strong></span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 2rem;">
                        <h3 style="color: #7a5c2e; margin-bottom: 1rem;">
                            <i class="fas fa-info-circle"></i> Order Status
                        </h3>
                        <div class="order-status-info">
                            <p><strong>Status:</strong> <span class="status-badge ${order.status}">${order.status.toUpperCase()}</span></p>
                            <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                            <p><strong>Payment Method:</strong> ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod}</p>
                            <p><strong>Delivery Zone:</strong> ${order.deliveryZone || 'Not specified'}</p>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        } else {
            showToast('Error loading order details', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// ===== SEARCH FUNCTIONALITY =====
document.getElementById('searchIcon').addEventListener('click', function() {
    const searchQuery = prompt('Search for products:');
    if (searchQuery) {
        searchProducts(searchQuery);
    }
});

async function searchProducts(query) {
    showLoading();
    
    try {
        const response = await fetch(`${API_URL}/products/search?q=${encodeURIComponent(query)}`);
        const products = await response.json();
        renderProducts(products);
    } catch (error) {
        showToast('Error searching products', 'error');
    } finally {
        hideLoading();
    }
}

// ===== SLIDER FUNCTIONALITY =====
const sliderImages = [
    'HOME1.jpeg',
    'home1.jpg',
    'esn3.jpg',
    'HOME4.jpeg'
];

let currentSlide = 0;
setInterval(() => {
    currentSlide = (currentSlide + 1) % sliderImages.length;
    document.getElementById('slider-img').src = sliderImages[currentSlide];
}, 5000);

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', function(e) {
    // Escape key to close modals
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        });
        
        // Close checkout if open
        const checkoutSection = document.getElementById('checkout-section');
        if (checkoutSection) {
            checkoutSection.remove();
        }
    }
});

// ===== EXPORT FUNCTIONS FOR TESTING =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        addToCart,
        updateCartDisplay,
        showToast,
        VariantManager
    };
}

// Reporting Functions
async function loadReports() {
    showLoading();
    
    try {
        // Set default date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
        document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
        
        // Load categories for filter
        const categoriesResponse = await fetch(`${API_URL}/categories`);
        if (categoriesResponse.ok) {
            const categories = await categoriesResponse.json();
            const categoryFilter = document.getElementById('categoryFilter');
            categoryFilter.innerHTML = '<option value="">All Categories</option>';
            categories.forEach(category => {
                categoryFilter.innerHTML += `<option value="${category._id}">${category.name}</option>`;
            });
        }
        
        await generateReports();
    } catch (error) {
        showToast('Error loading reports', 'error');
    } finally {
        hideLoading();
    }
}

async function generateReports() {
    console.log('=== GENERATE REPORTS START ===');
    console.log('Function called at:', new Date().toISOString());
    
    showLoading();
    let success = false;
    
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const categoryFilter = document.getElementById('categoryFilter').value;
        
        console.log('Report parameters:', { startDate, endDate, categoryFilter });
        
        if (!authToken) {
            console.error('No auth token available');
            showToast('Authentication required. Please login again.', 'error');
            return;
        }
        
        console.log('Making API request to reports endpoint...');
        const url = `${API_URL}/reports?startDate=${startDate}&endDate=${endDate}&category=${categoryFilter}`;
        console.log('Request URL:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response received:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Response data received:', data);
            console.log('Data structure:', {
                totalSales: data.totalSales,
                totalOrders: data.totalOrders,
                averageOrderValue: data.averageOrderValue,
                totalProductsSold: data.totalProductsSold,
                productPerformanceLength: data.productPerformance ? data.productPerformance.length : 0,
                salesTrendLength: data.salesTrend ? data.salesTrend.length : 0,
                categorySalesLength: data.categorySales ? data.categorySales.length : 0
            });
            
            success = true;
            renderReports(data);
            showToast('Reports generated successfully!', 'success');
        } else {
            const errorData = await response.text();
            console.error('API Error Response:', errorData);
            showToast(`Error: ${response.status} - ${response.statusText}`, 'error');
        }
    } catch (error) {
        console.error('Network or other error:', error);
        console.error('Error stack:', error.stack);
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
        console.log('Generate reports completed. Success:', success);
        console.log('=== GENERATE REPORTS END ===');
    }
}

function renderReports(data) {
    console.log('=== RENDER REPORTS START ===');
    console.log('Function called at:', new Date().toISOString());
    console.log('Input data:', data);
    console.log('Data keys:', Object.keys(data));
    
    try {
        // Ensure reports section is visible
        const reportsSection = document.getElementById('admin-reports');
        if (reportsSection && reportsSection.classList.contains('hidden')) {
            console.log('Making reports section visible');
            reportsSection.classList.remove('hidden');
        }
        
        // Update summary cards
        const totalSalesEl = document.getElementById('totalSales');
        const totalOrdersEl = document.getElementById('totalOrders');
        const reportTotalOrdersEl = document.getElementById('reportTotalOrders');
        const avgOrderValueEl = document.getElementById('avgOrderValue');
        const productsSoldEl = document.getElementById('productsSold');
        
        console.log('Summary elements found:', {
            totalSales: !!totalSalesEl,
            totalOrders: !!totalOrdersEl,
            reportTotalOrders: !!reportTotalOrdersEl,
            avgOrderValue: !!avgOrderValueEl,
            productsSold: !!productsSoldEl
        });
        
        if (totalSalesEl) {
            totalSalesEl.textContent = `${data.totalSales} MAD`;
            console.log('Updated totalSales:', data.totalSales);
        }
        if (totalOrdersEl) {
            totalOrdersEl.textContent = data.totalOrders;
            console.log('Updated totalOrders:', data.totalOrders);
        }
        if (reportTotalOrdersEl) {
            reportTotalOrdersEl.textContent = data.totalOrders;
            console.log('Updated reportTotalOrders:', data.totalOrders);
        }
        if (avgOrderValueEl) {
            avgOrderValueEl.textContent = `${data.averageOrderValue} MAD`;
            console.log('Updated averageOrderValue:', data.averageOrderValue);
        }
        if (productsSoldEl) {
            productsSoldEl.textContent = data.totalProductsSold;
            console.log('Updated totalProductsSold:', data.totalProductsSold);
        }
        
        // Render product performance table
        const productTable = document.getElementById('productReportTable');
        if (productTable && data.productPerformance) {
            console.log('Rendering product performance table with', data.productPerformance.length, 'products');
            productTable.innerHTML = data.productPerformance.map(product => `
                <tr>
                    <td>${product.name}</td>
                    <td>${product.category}</td>
                    <td>${product.unitsSold}</td>
                    <td>${product.revenue} MAD</td>
                    <td>${product.profitMargin}%</td>
                    <td><span class="badge ${product.stockLevel === 'In Stock' ? 'success' : 'danger'}">${product.stockLevel}</span></td>
                </tr>
            `).join('');
        }
        
        // Render top products table
        const topProductsTable = document.getElementById('topProductsTable');
        if (topProductsTable && data.topProducts) {
            console.log('Rendering top products table with', data.topProducts.length, 'products');
            topProductsTable.innerHTML = data.topProducts.map((product, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${product.name}</td>
                    <td>${product.revenue} MAD</td>
                    <td>${product.unitsSold}</td>
                    <td><span class="badge ${product.growth >= 0 ? 'success' : 'danger'}">${product.growth >= 0 ? '+' : ''}${product.growth}%</span></td>
                </tr>
            `).join('');
        }
        
        // Render order status table
        const orderStatusTable = document.getElementById('orderStatusTable');
        if (orderStatusTable && data.orderStatusDistribution) {
            console.log('Rendering order status table with', data.orderStatusDistribution.length, 'statuses');
            orderStatusTable.innerHTML = data.orderStatusDistribution.map(status => `
                <tr>
                    <td>${status.status}</td>
                    <td>${status.count}</td>
                    <td>${status.percentage}%</td>
                    <td>${status.revenue} MAD</td>
                </tr>
            `).join('');
        }
        
        // Create charts
       // Create charts with the new functions
       if (data.salesTrend && data.salesTrend.length > 0) {
        createSalesChart(data.salesTrend);
    }
    
    if (data.categorySales && data.categorySales.length > 0) {
        createCategoryChart(data.categorySales);
    }
        
        console.log('=== RENDER REPORTS END ===');
    } catch (error) {
        console.error('Error rendering reports:', error);
        console.error('Error stack:', error.stack);
    }
}

function createCategoryChart(categoryData) {
    console.log('Creating category chart with data:', categoryData);
    
    // Clean up existing chart
    if (categoryChartInstance) {
        categoryChartInstance.destroy();
        categoryChartInstance = null;
    }
    
    const canvas = document.getElementById('categoryChart');
    if (!canvas) {
        console.error('Category chart canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Prepare data
    const labels = categoryData.map(item => item.category);
    const data = categoryData.map(item => item.sales);
    
    // Create chart with responsive settings
    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#7a5c2e',
                    '#a88c5f',
                    '#e6b8a2',
                    '#f0c4ae',
                    '#fad0ba'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: window.innerWidth < 768 ? 'bottom' : 'right',
                    labels: {
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        },
                        padding: window.innerWidth < 768 ? 10 : 15,
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    return {
                                        text: `${label}: ${value} MAD`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: window.innerWidth < 768 ? 10 : 12
                    },
                    bodyFont: {
                        size: window.innerWidth < 768 ? 10 : 12
                    },
                    padding: window.innerWidth < 768 ? 8 : 10,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const sum = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / sum) * 100).toFixed(1);
                            return `${label}: ${value} MAD (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}


function createSalesChart(salesData) {
    console.log('Creating sales chart with data:', salesData);
    
    // Clean up existing chart
    if (salesChartInstance) {
        salesChartInstance.destroy();
        salesChartInstance = null;
    }
    
    const canvas = document.getElementById('salesChart');
    if (!canvas) {
        console.error('Sales chart canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Prepare data
    const labels = salesData.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const data = salesData.map(item => item.sales);
    
    // Create chart with responsive settings
    salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sales (MAD)',
                data: data,
                borderColor: '#7a5c2e',
                backgroundColor: 'rgba(122, 92, 46, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#7a5c2e',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        },
                        padding: window.innerWidth < 768 ? 10 : 15
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: window.innerWidth < 768 ? 10 : 12
                    },
                    bodyFont: {
                        size: window.innerWidth < 768 ? 10 : 12
                    },
                    padding: window.innerWidth < 768 ? 8 : 10
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: window.innerWidth < 768 ? 9 : 11
                        },
                        maxRotation: window.innerWidth < 768 ? 45 : 0,
                        autoSkip: true,
                        maxTicksLimit: window.innerWidth < 768 ? 6 : 10
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: window.innerWidth < 768 ? 9 : 11
                        },
                        callback: function(value) {
                            return value + ' MAD';
                        }
                    }
                }
            }
        }
    });
}


function createSimpleSalesChart(salesData) {
    console.log('Creating simple HTML sales chart...');
    
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;
    
    // Reset canvas
    canvas.style.height = '400px';
    canvas.style.width = '100%';
    canvas.height = 400;
    canvas.width = canvas.offsetWidth;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Limit data
    const dataToShow = salesData.slice(-10);
    if (dataToShow.length === 0) return;
    
    const maxSales = Math.max(...dataToShow.map(item => item.sales));
    const padding = 60;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const barWidth = chartWidth / dataToShow.length;
    
    // Draw bars
    ctx.fillStyle = '#7a5c2e';
    dataToShow.forEach((item, index) => {
        const barHeight = (item.sales / maxSales) * chartHeight;
        const x = padding + index * barWidth + barWidth * 0.1;
        const y = canvas.height - padding - barHeight;
        const width = barWidth * 0.8;
        
        ctx.fillRect(x, y, width, barHeight);
        
        // Draw value
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(item.sales + ' MAD', x + width/2, y - 5);
        
        // Draw date
        ctx.fillText(item.date, x + width/2, canvas.height - padding + 20);
        ctx.fillStyle = '#7a5c2e';
    });
    
    // Draw title
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Sales Trend (Last 10 Days)', canvas.width / 2, 20);
}

function createSimpleCategoryChart(categoryData) {
    console.log('Creating simple HTML category chart...');
    
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    
    // Reset canvas
    canvas.style.height = '400px';
    canvas.style.width = '100%';
    canvas.height = 400;
    canvas.width = canvas.offsetWidth;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Limit data
    const dataToShow = categoryData.slice(0, 5);
    if (dataToShow.length === 0) return;
    
    const totalSales = dataToShow.reduce((sum, item) => sum + item.sales, 0);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 80;
    
    const colors = ['#7a5c2e', '#8b6b3a', '#9c7a48', '#ad8956', '#be9864'];
    
    let currentAngle = -Math.PI / 2; // Start from top
    
    dataToShow.forEach((item, index) => {
        const sliceAngle = (item.sales / totalSales) * 2 * Math.PI;
        
        // Draw slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();
        
        // Draw label
        const labelAngle = currentAngle + sliceAngle / 2;
        const labelRadius = radius + 30;
        const labelX = centerX + Math.cos(labelAngle) * labelRadius;
        const labelY = centerY + Math.sin(labelAngle) * labelRadius;
        
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(item.category, labelX, labelY);
        ctx.fillText(item.sales + ' MAD', labelX, labelY + 15);
        
        currentAngle += sliceAngle;
    });
    
    // Draw title
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Sales by Category', canvas.width / 2, 20);
}

function exportReports() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Report Period," + startDate + " to " + endDate + "\n\n";
    
    // Add summary data
    csvContent += "Summary\n";
    csvContent += "Total Sales," + document.getElementById('totalSales').textContent + "\n";
    csvContent += "Total Orders," + document.getElementById('reportTotalOrders').textContent + "\n";
    csvContent += "Average Order Value," + document.getElementById('avgOrderValue').textContent + "\n";
    csvContent += "Products Sold," + document.getElementById('productsSold').textContent + "\n\n";
    
    // Add product performance data
    csvContent += "Product Performance\n";
    csvContent += "Product,Category,Units Sold,Revenue,Profit Margin,Stock Level\n";
    
    const productRows = document.querySelectorAll('#productReportTable tr');
    productRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const rowData = Array.from(cells).map(cell => cell.textContent.trim());
            csvContent += rowData.join(',') + '\n';
        }
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Report exported successfully', 'success');
}

function printReports() {
    try {
        const printWindow = window.open('', '_blank');
        const reportContent = document.getElementById('admin-reports');
        
        if (!reportContent) {
            showToast('Reports section not found', 'error');
            return;
        }
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Sales Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .report-filters, .report-actions { display: none; }
                        .summary-card { 
                            display: inline-block; 
                            margin: 10px; 
                            padding: 15px; 
                            border: 1px solid #ccc; 
                            border-radius: 8px;
                            background: #f8f9fa;
                        }
                        .report-card { 
                            margin: 20px 0; 
                            padding: 15px; 
                            border: 1px solid #ccc; 
                            border-radius: 8px;
                        }
                        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background: #f2f2f2; }
                        .chart-container { display: none; }
                    </style>
                </head>
                <body>
                    <h1>Sales Report</h1>
                    <p>Generated on: ${new Date().toLocaleString()}</p>
                    ${reportContent.innerHTML}
                </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.print();
    } catch (error) {
        console.error('Error printing reports:', error);
        showToast('Error printing reports', 'error');
    }
}

function printOrder(orderId) {
    // This would generate a printable order receipt
    showToast('Print functionality will be implemented', 'info');
}

// Add event listeners for report filters
document.addEventListener('DOMContentLoaded', function() {
    const dateRange = document.getElementById('dateRange');
    if (dateRange) {
        dateRange.addEventListener('change', function() {
            const days = parseInt(this.value);
            if (days && days !== 'custom') {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);
                
                document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
                document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
            }
        });
    }
});

// Add test function for debugging
window.testReports = async function() {
    console.log('Testing reports functionality...');
    console.log('API_URL:', API_URL);
    console.log('authToken:', authToken);
    
    try {
        const response = await fetch(`${API_URL}/reports?startDate=2025-06-01&endDate=2025-06-30`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Reports data:', data);
            return data;
        } else {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            return null;
        }
    } catch (error) {
        console.error('Test reports error:', error);
        return null;
    }
};

// Add cleanup on page unload
window.addEventListener('beforeunload', function() {
    cleanupCharts();
});

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Update chart options on resize
        if (salesChartInstance) {
            salesChartInstance.options.plugins.legend.labels.font.size = window.innerWidth < 768 ? 10 : 12;
            salesChartInstance.options.scales.x.ticks.font.size = window.innerWidth < 768 ? 9 : 11;
            salesChartInstance.options.scales.y.ticks.font.size = window.innerWidth < 768 ? 9 : 11;
            salesChartInstance.options.scales.x.ticks.maxRotation = window.innerWidth < 768 ? 45 : 0;
            salesChartInstance.update();
        }
        
        if (categoryChartInstance) {
            categoryChartInstance.options.plugins.legend.position = window.innerWidth < 768 ? 'bottom' : 'right';
            categoryChartInstance.options.plugins.legend.labels.font.size = window.innerWidth < 768 ? 10 : 12;
            categoryChartInstance.update();
        }
    }, 250);
});


// Add test function for debugging
window.testUserOrders = async function() {
    console.log('=== TESTING USER ORDERS ===');
    console.log('Current user:', currentUser);
    console.log('Auth token:', authToken);
    
    try {
        const response = await fetch(`${API_URL}/debug/user-orders`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Debug response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Debug data:', data);
            return data;
        } else {
            const errorText = await response.text();
            console.error('Debug error response:', errorText);
            return null;
        }
    } catch (error) {
        console.error('Debug test error:', error);
        return null;
    }
};

// File Upload Functions
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error');
        return;
    }
    
    // Show file info
    document.getElementById('fileInfo').textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('previewImg').src = e.target.result;
        document.getElementById('imagePreview').style.display = 'flex';
    };
    reader.readAsDataURL(file);
    
    // Upload file to server
    try {
        showLoading();
        const formData = new FormData();
        formData.append('image', file);
        
        console.log('=== FRONTEND UPLOAD DEBUG ===');
        console.log('File to upload:', file);
        console.log('FormData entries:');
        for (let [key, value] of formData.entries()) {
            console.log(key, value);
        }
        
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        console.log('Upload response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Upload result:', result);
            // Set the uploaded file URL in the image input
            document.getElementById('productImage').value = result.fileUrl;
            console.log('Set image input value to:', result.fileUrl);
            showToast('Image uploaded successfully!', 'success');
        } else {
            const error = await response.json();
            console.error('Upload error:', error);
            showToast(error.error || 'Error uploading image', 'error');
        }
    } catch (error) {
        console.error('Upload network error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function clearImagePreview() {
    document.getElementById('productImageFile').value = '';
    document.getElementById('fileInfo').textContent = 'No file selected';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('productImage').value = '';
}

// Category Image Upload Functions
async function handleCategoryFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error');
        return;
    }
    
    // Show file info
    document.getElementById('categoryFileInfo').textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('categoryPreviewImg').src = e.target.result;
        document.getElementById('categoryImagePreview').style.display = 'flex';
    };
    reader.readAsDataURL(file);
    
    // Upload file to server
    try {
        showLoading();
        const formData = new FormData();
        formData.append('image', file);
        
        console.log('=== CATEGORY FRONTEND UPLOAD DEBUG ===');
        console.log('File to upload:', file);
        console.log('FormData entries:');
        for (let [key, value] of formData.entries()) {
            console.log(key, value);
        }
        
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        console.log('Category upload response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Category upload result:', result);
            // Set the uploaded file URL in the image input
            document.getElementById('categoryImage').value = result.fileUrl;
            console.log('Set category image input value to:', result.fileUrl);
            showToast('Image uploaded successfully!', 'success');
        } else {
            const error = await response.json();
            console.error('Category upload error:', error);
            showToast(error.error || 'Error uploading image', 'error');
        }
    } catch (error) {
        console.error('Category upload network error:', error);
        showToast('Network error. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function clearCategoryImagePreview() {
    document.getElementById('categoryImageFile').value = '';
    document.getElementById('categoryFileInfo').textContent = 'No file selected';
    document.getElementById('categoryImagePreview').style.display = 'none';
    document.getElementById('categoryImage').value = '';
}

// ===== UTILITY FUNCTIONS =====
function generatePlaceholderImage(width = 200, height = 200, text = 'No Image') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#f8f3ed';
    ctx.fillRect(0, 0, width, height);
    
    // Border
    ctx.strokeStyle = '#e6b8a2';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);
    
    // Text
    ctx.fillStyle = '#7a5c2e';
    ctx.font = '14px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);
    
    return canvas.toDataURL();
}

function getImageUrl(imagePath, fallbackText = 'No Image') {
    if (!imagePath || imagePath.trim() === '') {
        return generatePlaceholderImage(200, 200, fallbackText);
    }
    
    // If it's already a data URL, return as is
    if (imagePath.startsWith('data:')) {
        return imagePath;
    }
    
    // If it's a relative path, make it absolute
    if (imagePath.startsWith('/')) {
        return window.location.origin + imagePath;
    }
    
    // If it's a full URL, return as is
    if (imagePath.startsWith('http')) {
        return imagePath;
    }
    
    // Default to local uploads
    return window.location.origin + '/uploads/' + imagePath;
}


// Add this JavaScript to your app.js file or in a script tag

// Fix for Android/Samsung horizontal scrolling issues
document.addEventListener('DOMContentLoaded', function() {
    // Detect if on mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    
    if (isMobile) {
        const navLinks = document.querySelector('.nav-links');
        
        if (navLinks) {
            // Enable smooth scrolling with touch
            let isScrolling = false;
            let startX = 0;
            let scrollLeft = 0;
            
            // Touch start
            navLinks.addEventListener('touchstart', (e) => {
                isScrolling = true;
                startX = e.touches[0].pageX - navLinks.offsetLeft;
                scrollLeft = navLinks.scrollLeft;
                
                // Add active class for visual feedback
                navLinks.style.cursor = 'grabbing';
            }, { passive: true });
            
            // Touch move
            navLinks.addEventListener('touchmove', (e) => {
                if (!isScrolling) return;
                
                const x = e.touches[0].pageX - navLinks.offsetLeft;
                const walk = (x - startX) * 1.5; // Increase scroll speed
                navLinks.scrollLeft = scrollLeft - walk;
            }, { passive: true });
            
            // Touch end
            navLinks.addEventListener('touchend', () => {
                isScrolling = false;
                navLinks.style.cursor = 'grab';
            });
            
            // Add momentum scrolling for Android
            if (isAndroid) {
                navLinks.style.scrollBehavior = 'smooth';
                navLinks.style.WebkitOverflowScrolling = 'touch';
                
                // Force hardware acceleration
                navLinks.style.transform = 'translateZ(0)';
                navLinks.style.WebkitTransform = 'translateZ(0)';
                
                // Ensure the container can scroll
                navLinks.style.overflowX = 'auto';
                navLinks.style.overflowY = 'hidden';
                
                // Set explicit width to enable scrolling
                const totalWidth = Array.from(navLinks.children).reduce((width, child) => {
                    return width + child.offsetWidth + parseInt(window.getComputedStyle(child).marginRight) + parseInt(window.getComputedStyle(child).marginLeft);
                }, 0);
                
                // Create an inner wrapper if needed
                if (totalWidth > navLinks.offsetWidth) {
                    navLinks.style.display = 'flex';
                    navLinks.style.flexWrap = 'nowrap';
                }
            }
            
            // Add scroll indicators
            function updateScrollIndicators() {
                const maxScroll = navLinks.scrollWidth - navLinks.clientWidth;
                const currentScroll = navLinks.scrollLeft;
                
                if (currentScroll > 10) {
                    navLinks.classList.add('can-scroll-left');
                } else {
                    navLinks.classList.remove('can-scroll-left');
                }
                
                if (currentScroll < maxScroll - 10) {
                    navLinks.classList.add('can-scroll-right');
                } else {
                    navLinks.classList.remove('can-scroll-right');
                }
            }
            
            // Update indicators on scroll
            navLinks.addEventListener('scroll', updateScrollIndicators, { passive: true });
            
            // Initial check
            updateScrollIndicators();
            
            // Ensure scroll works after orientation change
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    updateScrollIndicators();
                    navLinks.scrollLeft = 0; // Reset scroll position
                }, 300);
            });
        }
    }
});

// Alternative fix using wrapper approach
function fixAndroidNavScroll() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;
    
    // Check if already wrapped
    if (navLinks.parentElement.classList.contains('nav-links-wrapper')) return;
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'nav-links-wrapper';
    wrapper.style.cssText = `
        width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        scroll-behavior: smooth;
        position: relative;
    `;
    
    // Wrap the nav-links
    navLinks.parentNode.insertBefore(wrapper, navLinks);
    wrapper.appendChild(navLinks);
    
    // Adjust nav-links styles
    navLinks.style.cssText += `
        display: inline-flex !important;
        width: max-content !important;
        flex-wrap: nowrap !important;
    `;
}

// Call the fix on mobile devices
if (window.innerWidth <= 768) {
    fixAndroidNavScroll();
}

// Also fix on resize
window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
        fixAndroidNavScroll();
    }
});