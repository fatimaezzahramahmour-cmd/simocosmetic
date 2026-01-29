require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { log } = require('console');
const cloudinary = require('cloudinary').v2;


const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Create uploads directory if it doesn't exist
// const uploadsDir = path.join(__dirname, 'uploads');
// if (!fs.existsSync(uploadsDir)) {
//     fs.mkdirSync(uploadsDir, { recursive: true });
// }

// Multer configuration for file uploads
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, uploadsDir);
//     },
//     filename: function (req, file, cb) {
//         // Generate unique filename with timestamp
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//     }
// });

const multerStorage = multer.memoryStorage(); // Store in memory instead of disk

const upload = multer({
    storage: multerStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Check file type
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
// app.use('/uploads', express.static(uploadsDir));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/simo_cosmetics';
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Schemas
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String },
    city: { type: String },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    registrationDate: { type: Date, default: Date.now },
    totalSpent: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 }
});

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    description: { type: String },
    image: { type: String },
    variants: [{
        name: { type: String },
        type: { type: String }, // size, color, etc.
        price: { type: Number },
        stock: { type: Number, default: 0 }
    }],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

const OrderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerInfo: {
        name: String,
        email: String,
        phone: String,
        address: String,
        city: String,
        postalCode: String
    },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        productName: String,
        variant: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        price: Number,
        quantity: Number
    }],
    subtotal: { type: Number, required: true },
    deliveryZone: String,
    deliveryPrice: { type: Number, default: 0 },
    coupon: String,
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    paymentMethod: { type: String, default: 'cod' },
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    image: { type: String },
    isActive: { type: Boolean, default: true }
});

const DeliveryZoneSchema = new mongoose.Schema({
    name: { type: String, required: true },
    cities: [String],
    price: { type: Number, required: true },
    isActive: { type: Boolean, default: true }
});

const CouponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true },
    minOrder: { type: Number, default: 0 },
    usageLimit: { type: Number },
    used: { type: Number, default: 0 },
    expiry: { type: Date },
    isActive: { type: Boolean, default: true }
});

const CartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        productName: { type: String, required: true },
        variant: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 }
    }],
    updatedAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Order = mongoose.model('Order', OrderSchema);
const Category = mongoose.model('Category', CategorySchema);
const DeliveryZone = mongoose.model('DeliveryZone', DeliveryZoneSchema);
const Coupon = mongoose.model('Coupon', CouponSchema);
const Cart = mongoose.model('Cart', CartSchema);

// Middleware for authentication
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        console.log('=== AUTH MIDDLEWARE DEBUG ===');
        console.log('Token present:', !!token);
        console.log('Headers:', req.headers);
        
        if (!token) {
            console.log('No token provided');
            throw new Error();
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Decoded token:', decoded);
        
        const user = await User.findById(decoded.userId).select('-password');
        console.log('Found user:', user ? { id: user._id, email: user.email, role: user.role } : 'Not found');
        
        if (!user) {
            console.log('User not found');
            throw new Error();
        }
        
        req.user = user;
        req.token = token;
        console.log('=== AUTH SUCCESS ===');
        next();
    } catch (error) {
        console.log('=== AUTH FAILED ===');
        console.error('Auth error:', error.message);
        res.status(401).json({ error: 'Please authenticate' });
    }
};

// Admin middleware
const adminMiddleware = async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
};

// Migration function to fix existing orders
async function migrateExistingOrders() {
    try {
        console.log('=== STARTING ORDER MIGRATION ===');
        
        // Find all orders without customer field
        const ordersWithoutCustomer = await Order.find({ customer: { $exists: false } });
        console.log(`Found ${ordersWithoutCustomer.length} orders without customer field`);
        
        for (const order of ordersWithoutCustomer) {
            if (order.customerInfo && order.customerInfo.email) {
                // Find user by email
                const user = await User.findOne({ email: order.customerInfo.email });
                if (user) {
                    // Update order with customer field
                    await Order.findByIdAndUpdate(order._id, { customer: user._id });
                    console.log(`Updated order ${order.orderNumber} with customer ${user._id}`);
                } else {
                    console.log(`No user found for email: ${order.customerInfo.email} in order ${order.orderNumber}`);
                }
            } else {
                console.log(`No customerInfo.email found in order ${order.orderNumber}`);
            }
        }
        
        // Fix variant data format in existing orders
        const ordersWithStringVariants = await Order.find({
            'items.variant': { $type: 'string' }
        });
        console.log(`Found ${ordersWithStringVariants.length} orders with string variants`);
        
        for (const order of ordersWithStringVariants) {
            const updatedItems = order.items.map(item => {
                if (typeof item.variant === 'string') {
                    // Convert string variant to object format
                    return {
                        ...item.toObject(),
                        variant: {
                            name: item.variant,
                            type: 'unknown'
                        }
                    };
                }
                return item;
            });
            
            await Order.findByIdAndUpdate(order._id, { items: updatedItems });
            console.log(`Updated order ${order.orderNumber} variant format`);
        }
        
        console.log('=== ORDER MIGRATION COMPLETED ===');
    } catch (error) {
        console.error('Migration error:', error);
    }
}

// Initialize default data
async function initializeData() {
    try {
        // Check if admin exists
        const adminExists = await User.findOne({ email: 'admin@simocosmetics.com' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                name: 'Admin',
                email: 'admin@simocosmetics.com',
                password: hashedPassword,
                phone: '+212600000000',
                role: 'admin'
            });
            console.log('Default admin created');
        }

        // Check if delivery zones exist
        const zonesCount = await DeliveryZone.countDocuments();
        if (zonesCount === 0) {
            await DeliveryZone.create([
                {
                    name: 'Fquih Ben Salah',
                    cities: ['Fquih Ben Salah'],
                    price: 0
                },
                {
                    name: 'Hors Fquih Ben Salah',
                    cities: ['Other Cities'],
                    price: 35
                }
            ]);
            console.log('Default delivery zones created');
        }

        // Check if categories exist
        const categoriesCount = await Category.countDocuments();
        if (categoriesCount === 0) {
            const categories = [
                { name: 'Makeup', slug: 'makeup', description: 'Beauty makeup products' },
                { name: 'Skin Care', slug: 'skincare', description: 'Skincare and facial products' },
                { name: 'Perfumes', slug: 'perfumes', description: 'Fragrances and perfumes' },
                { name: 'Nails', slug: 'nails', description: 'Nail care and polish' },
                { name: 'Body Care', slug: 'bodycare', description: 'Body lotions and care' },
                { name: 'Accessories', slug: 'accessories', description: 'Beauty accessories' },
                { name: 'Hair Products', slug: 'hair', description: 'Hair care products' },
                { name: 'Baby Products', slug: 'baby', description: 'Baby care products' }
            ];
            await Category.insertMany(categories);
            console.log('Default categories created');
        }

        // Run order migration
        await migrateExistingOrders();

    } catch (error) {
        console.error('Error initializing data:', error);
    }
}

// Routes

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, phone, address, city } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            address,
            city
        });

        await user.save();

        // Generate token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET);

        res.status(201).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET);

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
    res.json({
        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            phone: req.user.phone,
            address: req.user.address,
            city: req.user.city
        }
    });
});

// Change Password Route
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }

        // Get user with password
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        user.password = hashedNewPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// File Upload Route
app.post('/api/upload', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
    try {
        console.log('=== CLOUDINARY UPLOAD DEBUG ===');
        console.log('Request file:', req.file);
        console.log('Request body:', req.body);
        
        if (!req.file) {
            console.log('No file uploaded');
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        console.log('Uploading to Cloudinary...');
        
        // Upload to Cloudinary using buffer
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'simo-cosmetique', // Organize images in a folder
                    resource_type: 'auto',
                    transformation: [
                        { width: 800, height: 800, crop: 'limit' }, // Optimize image size
                        { quality: 'auto:good' } // Auto optimize quality
                    ]
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else {
                        console.log('Cloudinary upload success:', result.secure_url);
                        resolve(result);
                    }
                }
            );
            
            // Write buffer to stream
            uploadStream.end(req.file.buffer);
        });
        
        console.log('File uploaded to Cloudinary:', result.secure_url);
        console.log('Public ID:', result.public_id);
        
        // Return the Cloudinary URL
        res.json({ 
            success: true, 
            fileUrl: result.secure_url,
            publicId: result.public_id,
            filename: result.original_filename || 'uploaded-image'
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Product Routes
app.get('/api/products', async (req, res) => {
    try {
        const { category, search, inStock } = req.query;
        let query = { isActive: true };

        if (category) {
            query.category = category;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        if (inStock === 'true') {
            query.stock = { $gt: 0 };
        }

        const products = await Product.find(query).sort('-createdAt');
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/products', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/products/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/products/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Category Routes
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/categories', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const category = new Category(req.body);
        await category.save();
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/categories/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/categories/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Order Routes
app.post('/api/orders', authMiddleware, async (req, res) => {
    try {
        console.log('=== ORDER CREATION DEBUG ===');
        console.log('User creating order:', req.user._id, req.user.email);
        console.log('Request body:', req.body);
        
        const orderNumber = 'ORD' + Date.now();
        
        // Process items to include variant information
        const processedItems = await Promise.all(req.body.items.map(async (item) => {
            // If variant is already an object with name and type, use it directly
            // Otherwise, try to look it up from product variants
            let variantInfo = null;
            
            if (item.variant) {
                if (typeof item.variant === 'object' && item.variant.name && item.variant.type) {
                    // Variant is already in the correct format
                    variantInfo = item.variant;
                } else if (typeof item.variant === 'string') {
                    // Variant is a string (ID), try to look it up
                    const product = await Product.findById(item.product);
                    if (product && product.variants) {
                        const variant = product.variants.find(v => v._id.toString() === item.variant);
                        if (variant) {
                            variantInfo = {
                                name: variant.name,
                                type: variant.type
                            };
                        }
                    }
                }
            }
            
            return {
                ...item,
                variant: variantInfo
            };
        }));
        
        const orderData = {
            ...req.body,
            items: processedItems,
            orderNumber,
            customer: req.user._id
        };

        console.log('Order data to save:', orderData);
        
        const order = new Order(orderData);
        await order.save();

        console.log('Order saved with ID:', order._id);
        console.log('Order customer:', order.customer);

        // Update user stats
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { 
                totalSpent: order.total,
                orderCount: 1
            }
        });

        // Update product stock
        for (const item of order.items) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { stock: -item.quantity }
            });
        }

        console.log('=== ORDER CREATION SUCCESS ===');
        res.status(201).json(order);
    } catch (error) {
        console.error('=== ORDER CREATION ERROR ===');
        console.error('Error:', error);
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/orders', authMiddleware, async (req, res) => {
    try {
        let query = {};
        
        console.log('=== ORDERS API DEBUG ===');
        console.log('User ID:', req.user._id);
        console.log('User role:', req.user.role);
        console.log('User email:', req.user.email);
        
        if (req.user.role !== 'admin') {
            // Query for orders with customer field OR customerInfo.email matching user email
            query.$or = [
                { customer: req.user._id },
                { 'customerInfo.email': req.user.email }
            ];
        }

        console.log('Query:', query);
        const orders = await Order.find(query)
            .populate('customer', 'name email')
            .sort('-createdAt');
        
        console.log('Found orders count:', orders.length);
        console.log('Orders:', orders.map(o => ({ id: o._id, orderNumber: o.orderNumber, customer: o.customer })));
        console.log('=== END DEBUG ===');
        
        res.json(orders);
    } catch (error) {
        console.error('Orders API error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/orders/:id', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customer', 'name email phone')
            .populate('items.product');

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check access rights
        if (req.user.role !== 'admin' && order.customer?._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/orders/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { status, updatedAt: Date.now() },
            { new: true }
        );
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Cart Routes
app.get('/api/cart', authMiddleware, async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id });
        
        if (!cart) {
            // Create empty cart if none exists
            cart = new Cart({ user: req.user._id, items: [] });
            await cart.save();
        }
        
        // Populate product details
        await cart.populate('items.product', 'name image price stock variants');
        res.json(cart);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/cart/add', authMiddleware, async (req, res) => {
    try {
        const { productId, productName, variant, price, quantity = 1 } = req.body;
        
        // Validate product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Check stock availability
        if (product.stock < quantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }
        
        let cart = await Cart.findOne({ user: req.user._id });
        
        if (!cart) {
            cart = new Cart({ user: req.user._id, items: [] });
        }
        
        // Check if item already exists in cart
        let existingItemIndex = -1;
        
        if (variant) {
            // If variant is provided, try to match by variant name or ID
            existingItemIndex = cart.items.findIndex(item => {
                const productMatch = item.product.toString() === productId;
                if (!productMatch) return false;
                
                // Handle different variant formats
                if (typeof item.variant === 'string') {
                    // Variant stored as string ID, compare with variant name
                    return item.variant === variant.name || item.variant === variant;
                } else if (item.variant && typeof item.variant === 'object') {
                    // Variant stored as object, compare name and type
                    return item.variant.name === variant.name && item.variant.type === variant.type;
                }
                return false;
            });
        } else {
            // No variant, just match by product
            existingItemIndex = cart.items.findIndex(item => 
                item.product.toString() === productId && !item.variant
            );
        }
        
        if (existingItemIndex > -1) {
            // Update quantity
            cart.items[existingItemIndex].quantity += quantity;
        } else {
            // Add new item
            cart.items.push({
                product: productId,
                productName,
                variant,
                price,
                quantity
            });
        }
        
        cart.updatedAt = new Date();
        await cart.save();
        
        // Populate product details
        await cart.populate('items.product', 'name image price stock variants');
        res.json(cart);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/cart/update', authMiddleware, async (req, res) => {
    try {
        const { productId, variant, quantity } = req.body;
        
        // Extract the actual ID from productId (handle both string and object)
        const actualProductId = typeof productId === 'object' ? productId._id : productId;
        console.log('Extracted productId:', actualProductId);
       
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }
       
        // Find item in cart
        let itemIndex = -1;
       
        if (variant) {
            // If variant is provided, try to match by variant ID or name
            itemIndex = cart.items.findIndex(item => {
                const productMatch = item.product.toString() === actualProductId;
                console.log('Comparing products:', item.product.toString(), 'vs', actualProductId, '=', productMatch);
                if (!productMatch) return false;
               
                // Handle different variant formats
                if (typeof item.variant === 'string') {
                    // Item variant is string, request variant is object
                    const variantMatch = item.variant === variant.name || item.variant === variant._id;
                    console.log('Comparing variants (string vs object):', item.variant, 'vs', variant.name, '=', variantMatch);
                    return variantMatch;
                } else if (item.variant && typeof item.variant === 'object') {
                    // Both are objects - compare by _id or name
                    const variantMatch = item.variant._id === variant._id || 
                                       item.variant.name === variant.name;
                    console.log('Comparing variants (object vs object):', item.variant._id, 'vs', variant._id, '=', variantMatch);
                    return variantMatch;
                }
                return false;
            });
        } else {
            // No variant, just match by product
            itemIndex = cart.items.findIndex(item =>
                item.product.toString() === actualProductId && !item.variant
            );
        }
       
        console.log('itemIndex', itemIndex);
        console.log('Looking for variant:', variant);
        console.log('Cart items:', cart.items.map(item => ({
            product: item.product,
            variant: item.variant,
            quantity: item.quantity
        })));
        
        if (itemIndex === -1) {
            return res.status(404).json({ error: 'Item not found in cart' });
        }
       
        if (quantity <= 0) {
            // Remove item
            cart.items.splice(itemIndex, 1);
        } else {
            // Update quantity
            cart.items[itemIndex].quantity = quantity;
        }
       
        cart.updatedAt = new Date();
        await cart.save();
       
        // Populate product details
        await cart.populate('items.product', 'name image price stock variants');
        res.json(cart);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/api/cart/clear', authMiddleware, async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (cart) {
            cart.items = [];
            cart.updatedAt = new Date();
            await cart.save();
        }
        res.json({ message: 'Cart cleared successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/cart', authMiddleware, async (req, res) => {
    try {
        await Cart.findOneAndDelete({ user: req.user._id });
        res.json({ message: 'Cart deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/categories/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delivery Zone Routes
app.get('/api/delivery-zones', async (req, res) => {
    try {
        const zones = await DeliveryZone.find({ isActive: true });
        res.json(zones);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/delivery-zones', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const zone = new DeliveryZone(req.body);
        await zone.save();
        res.status(201).json(zone);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/delivery-zones/:id', async (req, res) => {
    try {
        const zone = await DeliveryZone.findById(req.params.id);
        if (!zone) {
            return res.status(404).json({ error: 'Delivery zone not found' });
        }
        res.json(zone);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/delivery-zones/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const zone = await DeliveryZone.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!zone) {
            return res.status(404).json({ error: 'Delivery zone not found' });
        }
        res.json(zone);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/delivery-zones/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const zone = await DeliveryZone.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        if (!zone) {
            return res.status(404).json({ error: 'Delivery zone not found' });
        }
        res.json({ message: 'Delivery zone deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Coupon Routes
app.get('/api/coupons/validate/:code', async (req, res) => {
    try {
        const coupon = await Coupon.findOne({ 
            code: req.params.code.toUpperCase(),
            isActive: true
        });

        if (!coupon) {
            return res.status(404).json({ error: 'Invalid coupon code' });
        }

        if (coupon.expiry && new Date(coupon.expiry) < new Date()) {
            return res.status(400).json({ error: 'Coupon has expired' });
        }

        if (coupon.usageLimit && coupon.used >= coupon.usageLimit) {
            return res.status(400).json({ error: 'Coupon usage limit reached' });
        }

        res.json(coupon);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/coupons', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const couponData = {
            ...req.body,
            code: req.body.code.toUpperCase()
        };
        const coupon = new Coupon(couponData);
        await coupon.save();
        res.status(201).json(coupon);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/coupons', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const coupons = await Coupon.find();
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/coupons/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!coupon) {
            return res.status(404).json({ error: 'Coupon not found' });
        }
        res.json(coupon);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/coupons/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        if (!coupon) {
            return res.status(404).json({ error: 'Coupon not found' });
        }
        res.json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/coupons/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ error: 'Coupon not found' });
        }
        res.json(coupon);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User Routes (Admin only)
app.get('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dashboard Stats (Admin only)
app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const [
            totalProducts,
            totalOrders,
            totalUsers,
            pendingOrders,
            totalRevenue
        ] = await Promise.all([
            Product.countDocuments({ isActive: true }),
            Order.countDocuments(),
            User.countDocuments({ role: 'customer' }),
            Order.countDocuments({ status: 'pending' }),
            Order.aggregate([
                { $group: { _id: null, total: { $sum: '$total' } } }
            ])
        ]);

        res.json({
            totalProducts,
            totalOrders,
            totalUsers,
            pendingOrders,
            totalRevenue: totalRevenue[0]?.total || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reports endpoint
app.get('/api/reports', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { startDate, endDate, category } = req.query;
        
        // Parse dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
        
        // Build query
        let orderQuery = {
            createdAt: { $gte: start, $lte: end }
        };
        
        // Get orders in date range
        const orders = await Order.find(orderQuery).populate('items.product');
        
        // Calculate summary metrics
        const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = orders.length;
        const averageOrderValue = totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : 0;
        
        // Calculate products sold
        const totalProductsSold = orders.reduce((sum, order) => {
            return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
        }, 0);
        
        // Product performance analysis
        const productStats = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                if (!item.product) return; // Skip if product doesn't exist
                
                const productId = item.product._id.toString();
                if (!productStats[productId]) {
                    productStats[productId] = {
                        name: item.productName,
                        category: item.product.category || 'Uncategorized',
                        unitsSold: 0,
                        revenue: 0,
                        product: item.product
                    };
                }
                productStats[productId].unitsSold += item.quantity;
                productStats[productId].revenue += item.price * item.quantity;
            });
        });
        
        // Convert to array and add profit margin (estimated at 30%)
        const productPerformance = Object.values(productStats).map(product => ({
            ...product,
            profitMargin: 30, // This would be calculated based on actual cost data
            stockLevel: product.product && product.product.stock > 0 ? 'In Stock' : 'Out of Stock'
        }));
        
        // Top products (sorted by revenue)
        const topProducts = productPerformance
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10)
            .map((product, index) => ({
                ...product,
                growth: Math.floor(Math.random() * 50) - 10 // Mock growth data
            }));
        
        // Order status distribution
        const statusCounts = {};
        const statusRevenue = {};
        orders.forEach(order => {
            if (!statusCounts[order.status]) {
                statusCounts[order.status] = 0;
                statusRevenue[order.status] = 0;
            }
            statusCounts[order.status]++;
            statusRevenue[order.status] += order.total;
        });
        
        const orderStatusDistribution = Object.keys(statusCounts).map(status => ({
            status,
            count: statusCounts[status],
            percentage: ((statusCounts[status] / totalOrders) * 100).toFixed(1),
            revenue: statusRevenue[status]
        }));
        
        // Sales trend (daily)
        const salesTrend = [];
        const currentDate = new Date(start);
        while (currentDate <= end) {
            const dayOrders = orders.filter(order => {
                const orderDate = new Date(order.createdAt);
                return orderDate.toDateString() === currentDate.toDateString();
            });
            
            const daySales = dayOrders.reduce((sum, order) => sum + order.total, 0);
            salesTrend.push({
                date: currentDate.toLocaleDateString(),
                sales: daySales
            });
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Category sales
        const categorySales = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                if (!item.product) return; // Skip if product doesn't exist
                
                const category = item.product.category || 'Uncategorized';
                if (!categorySales[category]) {
                    categorySales[category] = 0;
                }
                categorySales[category] += item.price * item.quantity;
            });
        });
        
        const categorySalesArray = Object.keys(categorySales).map(category => ({
            category,
            sales: categorySales[category]
        }));
        
        res.json({
            totalSales,
            totalOrders,
            averageOrderValue,
            totalProductsSold,
            productPerformance,
            topProducts,
            orderStatusDistribution,
            salesTrend,
            categorySales: categorySalesArray
        });
        
    } catch (error) {
        console.error('Error generating reports:', error);
        res.status(500).json({ error: 'Error generating reports' });
    }
});

// Test endpoint for debugging
app.get('/api/debug/user-orders', authMiddleware, async (req, res) => {
    try {
        console.log('=== DEBUG USER ORDERS ENDPOINT ===');
        
        // Get user info
        const user = await User.findById(req.user._id);
        console.log('User from database:', user);
        
        // Test different queries
        const query1 = { customer: req.user._id };
        const query2 = { 'customerInfo.email': req.user.email };
        const query3 = { $or: [query1, query2] };
        
        console.log('Query 1 (customer field):', query1);
        console.log('Query 2 (customerInfo.email):', query2);
        console.log('Query 3 (combined):', query3);
        
        // Get orders with different queries
        const ordersByCustomer = await Order.find(query1);
        const ordersByEmail = await Order.find(query2);
        const ordersCombined = await Order.find(query3);
        
        console.log('Orders by customer field:', ordersByCustomer.length);
        console.log('Orders by email:', ordersByEmail.length);
        console.log('Orders combined:', ordersCombined.length);
        
        // Get all orders for this user
        const userOrders = await Order.find(query3);
        console.log('User orders count:', userOrders.length);
        console.log('User orders:', userOrders.map(o => ({
            id: o._id,
            orderNumber: o.orderNumber,
            customer: o.customer,
            customerInfo: o.customerInfo,
            total: o.total,
            status: o.status
        })));
        
        // Get all orders in the database
        const allOrders = await Order.find({});
        console.log('All orders count:', allOrders.length);
        console.log('All orders customers:', allOrders.map(o => ({
            id: o._id,
            orderNumber: o.orderNumber,
            customer: o.customer,
            customerInfo: o.customerInfo
        })));
        
        res.json({
            user: {
                id: req.user._id,
                email: req.user.email,
                role: req.user.role
            },
            queries: {
                byCustomer: query1,
                byEmail: query2,
                combined: query3
            },
            results: {
                byCustomer: ordersByCustomer.length,
                byEmail: ordersByEmail.length,
                combined: ordersCombined.length
            },
            userOrdersCount: userOrders.length,
            userOrders: userOrders,
            allOrdersCount: allOrders.length,
            allOrders: allOrders
        });
    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve HTML
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    await initializeData();
});

module.exports = app;