const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");
const util = require("util");
const app = express();
const db = new sqlite3.Database(path.join(__dirname, ".database/datasource.db"));
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "public/uploads"),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only .jpg and .png files are allowed!'), false);
        }
    }
});

const getAsync = util.promisify(db.get).bind(db);
const allAsync = util.promisify(db.all).bind(db);
const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: "secure_random_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 86400000 }
}));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use("/images", express.static(path.join(__dirname, "public/images")));
const isAuthenticated = (req, res, next) => {
    if (req.session?.user) return next();
    res.redirect("/");
};
const isAdmin = (req, res, next) => {
    if (req.session?.user?.admin) return next();
    res.redirect("/homepage.html");
};
const getUserByEmail = (email) => new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await getUserByEmail(email);
        if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        req.session.user = {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        profile_picture: user.profile_picture,
        admin: user.admin
        };
        res.json({ success: true, message: "Login successful", user: req.session.user });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
app.post("/api/signup", async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ success: false, message: "All fields are required." });
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, row) => {
        if (err) return res.status(500).json({ success: false, message: "Database error." });
        if (row) return res.status(409).json({ success: false, message: "Email already registered." });
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, hashedPassword], function (err) {
        if (err) return res.status(500).json({ success: false, message: "Failed to create user." });
        res.status(201).json({ success: true, message: "User created successfully." });
        });
    });
});
app.post("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ success: false, message: "Logout failed" });
        res.clearCookie("connect.sid");
        res.json({ success: true, message: "Logged out" });
    });
});
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Menu Page and Cart
app.get("/api/menu", (req, res) => {
    db.all(`SELECT m.food_id, m.food_name, m.description, m.price, c.category_name AS category FROM menu m JOIN categories c ON m.category_id = c.category_id`, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Database error." });
        res.json({ success: true, menu: rows });
    });
});
app.post("/api/cart", async (req, res) => {
    const user_id = req.session?.user?.user_id;
    const { food_id } = req.body;
    if (!user_id) return res.status(401).json({ success: false, message: "Not logged in" });

    try {
        // Check if item already in cart
        const existing = await getAsync(
            "SELECT quantity FROM cart WHERE user_id = ? AND cart_item_id = ?",
            [user_id, food_id]
        );

        if (existing) {
            await runAsync(
                "UPDATE cart SET quantity = quantity + 1 WHERE user_id = ? AND cart_item_id = ?",
                [user_id, food_id]
            );
        } else {
            await runAsync(
                "INSERT INTO cart (user_id, cart_item_id, quantity) VALUES (?, ?, 1)",
                [user_id, food_id]
            );
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to update cart" });
    }
});
app.get("/api/cart/count", async (req, res) => {
    const user_id = req.session?.user?.user_id;
    if (!user_id) return res.json({ success: true, count: 0 });

    try {
        const result = await getAsync("SELECT SUM(quantity) AS count FROM cart WHERE user_id = ?", [user_id]);
        res.json({ success: true, count: result.count });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to get cart count" });
    }
});
app.get("/api/cart", async (req, res) => {
    const user_id = req.session?.user?.user_id;
    if (!user_id) return res.status(401).json({ success: false, message: "Not logged in" });

    try {
        const items = await allAsync(`
            SELECT 
                m.food_id,
                m.food_name,
                m.price,
                c.quantity,
                c.cart_item_id AS cart_item_id,
                (m.price * c.quantity) AS total_price
            FROM cart c
            JOIN menu m ON c.cart_item_id = m.food_id
            WHERE c.user_id = ?
        `, [user_id]);

        const user = await getAsync("SELECT username FROM users WHERE user_id = ?", [user_id]);

        res.json({ success: true, cart: items, username: user?.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to fetch cart" });
    }
});
app.delete("/api/cart/clear", async (req, res) => {
    const user_id = req.session?.user?.user_id;
    if (!user_id) return res.status(401).json({ success: false, message: "Not logged in" });

    try {
        await runAsync("DELETE FROM cart WHERE user_id = ?", [user_id]); // 🔥 scoped to current user
        res.json({ success: true });
    } catch (err) {
        console.error("Error clearing cart:", err);
        res.status(500).json({ success: false, message: "Failed to clear cart" });
    }
});
app.put("/api/cart/update", (req, res) => {
    const user_id = req.session.user?.user_id;
    if (!user_id) {
        return res.status(401).json({ success: false, message: "Not logged in" });
    }

    const { cart_item_id, action } = req.body;

    db.get("SELECT quantity FROM cart WHERE user_id = ? AND cart_item_id = ?", [user_id, cart_item_id], (err, row) => {
        if (err) {
            return res.json({ success: false, message: "Database error" });
        }
        if (!row) {
            return res.json({ success: false, message: "Cart item not found" });
        }

        let newQty = row.quantity + (action === "increase" ? 1 : -1);

        if (newQty <= 0) {
            db.run("DELETE FROM cart WHERE user_id = ? AND cart_item_id = ?", [user_id, cart_item_id], (err) => {
                if (err) {
                    return res.json({ success: false, message: "Failed to delete cart item" });
                }
                return res.json({ success: true });
            });
        } else {
            db.run("UPDATE cart SET quantity = ? WHERE user_id = ? AND cart_item_id = ?", [newQty, user_id, cart_item_id], (err) => {
                if (err) {
                    return res.json({ success: false, message: "Failed to update quantity" });
                }
                return res.json({ success: true });
            });
        }
    });
});
app.delete("/api/cart/item/:food_id", async (req, res) => {
    const user_id = req.session?.user?.user_id;
    const food_id = req.params.food_id;
    if (!user_id) return res.status(401).json({ success: false });

    try {
        await runAsync("DELETE FROM cart WHERE user_id = ? AND cart_item_id = ?", [user_id, food_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to remove item" });
    }
});



// Admin dashboard and user management routes
app.get("/admin-dashboard", isAdmin, (req, res) => res.sendFile(path.join(__dirname, "public/admin-dashboard.html")));
app.post("/api/admin/users", upload.single("profile_picture"), async (req, res) => {
    const { username, email, password, admin } = req.body;
    if (!username || !email || !password || !req.file) return res.json({ success: false, message: "Missing fields" });
    const profilePictureUrl = `uploads/${req.file.filename}`;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        await runAsync("INSERT INTO users (username, email, password, admin, profile_picture) VALUES (?, ?, ?, ?, ?)", [username, email, hashedPassword, admin ? 1 : 0, profilePictureUrl]);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: "Error creating user" });
    }
});
app.get("/api/admin/users", isAdmin, (req, res) => {
    db.all("SELECT user_id, username, email, admin FROM users", [], (err, rows) => {
        if (err) return res.json({ success: false, message: "Error fetching users" });
        res.json({ success: true, users: rows });
    });
});
app.get("/api/admin/users/:user_id", isAdmin, async (req, res) => {
    try {
        const user = await getAsync("SELECT user_id, username, email, admin, profile_picture FROM users WHERE user_id = ?", [req.params.user_id]);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});
app.get('/api/admin/menu', isAdmin, (req, res) => {
    db.all(`
        SELECT 
            m.food_id, 
            m.food_name, 
            m.description, 
            m.price, 
            c.category_name AS category_name
        FROM menu m
        LEFT JOIN categories c ON m.category_id = c.category_id
    `, [], (err, rows) => {
        if (err) {
            console.error('Menu fetch error:', err);
            return res.json({ success: false, message: 'Failed to fetch menu.' });
        }
        res.json({ success: true, menu: rows });
    });
});
app.get('/api/categories', (req, res) => {
    db.all("SELECT * FROM categories", [], (err, rows) => {
        if (err) {
            console.error("Failed to fetch categories:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        res.json({ success: true, categories: rows });
    });
});
app.delete("/api/admin/menu/:food_id", isAdmin, async (req, res) => {
    try {
        await runAsync("DELETE FROM menu WHERE food_id = ?", [req.params.food_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error deleting menu item" });
    }
});
app.delete("/api/admin/users/:user_id", isAdmin, async (req, res) => {
    try {
        await runAsync("DELETE FROM users WHERE user_id = ?", [req.params.user_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error deleting user" });
    }
});
app.put("/api/admin/users/:user_id", isAdmin, upload.single("profile_picture"), async (req, res) => {
    const { username, email, admin } = req.body;
    const isAdminFlag = admin === "true" ? 1 : 0;

    try {
        let sql, params;

        if (req.file) {
            const profile_picture = `/uploads/${req.file.filename}`;
            sql = `UPDATE users SET username = ?, email = ?, admin = ?, profile_picture = ? WHERE user_id = ?`;
            params = [username, email, isAdminFlag, profile_picture, req.params.user_id];
        } else {
            sql = `UPDATE users SET username = ?, email = ?, admin = ? WHERE user_id = ?`;
            params = [username, email, isAdminFlag, req.params.user_id];
        }

        await runAsync(sql, params);
        res.json({ success: true });
    } catch (err) {
        console.error("User update error:", err);
        res.status(500).json({ success: false, message: "Failed to update user" });
    }
});
app.get("/api/admin/menu/:food_id", isAdmin, async (req, res) => {
    try {
        const item = await getAsync(`
            SELECT 
                m.food_id, 
                m.food_name, 
                m.description, 
                m.price, 
                m.category_id 
            FROM menu m 
            WHERE m.food_id = ?
        `, [req.params.food_id]);
        if (!item) return res.status(404).json({ success: false, message: "Menu item not found" });
        res.json({ success: true, menuItem: item });
    } catch (err) {
        console.error("Error fetching menu item:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
app.put("/api/admin/menu/:food_id", isAdmin, async (req, res) => {
    const { food_name, description, price, category_id } = req.body;
    try {
        await runAsync(`
            UPDATE menu 
            SET food_name = ?, description = ?, price = ?, category_id = ? 
            WHERE food_id = ?
        `, [food_name, description, price, category_id, req.params.food_id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error updating menu item:", err);
        res.status(500).json({ success: false, message: "Failed to update menu item" });
    }
});
app.post("/api/admin/menu", isAdmin, async (req, res) => {
    const { food_name, description, price, category_id } = req.body;

    if (!food_name || !price || !category_id) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    try {
        await runAsync(`
            INSERT INTO menu (food_name, description, price, category_id)
            VALUES (?, ?, ?, ?)
        `, [food_name, description ?? "", price, category_id]);

        res.json({ success: true });
    } catch (err) {
        console.error("Error creating menu item:", err);
        res.status(500).json({ success: false, message: "Failed to create menu item" });
    }
});

// Profile routes
app.get("/api/profile", (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
    const { user_id, username, email, admin, profile_picture } = req.session.user;
    res.json({ user_id, username, email, admin, profile_picture });
});
app.put("/api/profile/username", (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { username } = req.body;
    db.run("UPDATE users SET username = ? WHERE user_id = ?", [username, req.session.user.user_id], function (err) {
        if (err) return res.status(500).json({ success: false });
        req.session.user.username = username;
        res.json({ success: true, username });
    });
});
app.put("/api/profile/email", (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false });
    const { email } = req.body;
    db.run("UPDATE users SET email = ? WHERE user_id = ?", [email, req.session.user.user_id], function (err) {
        if (err) return res.status(500).json({ success: false });
        req.session.user.email = email;
        res.json({ success: true, email });
    });
});
app.put("/api/profile/profile_picture", upload.single("profile_picture"), async (req, res) => {
    if (!req.session.user || !req.file) return res.status(400).json({ success: false });
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded." });
    const imageUrl = `/uploads/${req.file.filename}`;
    await runAsync("UPDATE users SET profile_picture = ? WHERE user_id = ?", [imageUrl, req.session.user.user_id]);
    req.session.user.profile_picture = imageUrl;
    res.json({ success: true, imageUrl });
});
app.post('/api/profile/profile_picture', isAuthenticated, upload.single('profile_picture'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "Invalid file type or no file uploaded." });
    }
    const userId = req.session.user?.user_id;
    const filePath = `/uploads/${req.file.filename}`;

    const sql = `UPDATE users SET profile_picture = ? WHERE id = ?`;
    db.run(sql, [filePath, userId], function (err) {
        if (err) {
            console.error("Error updating profile picture:", err.message);
            return res.status(500).json({ success: false, message: "Internal server error." });
        }
        res.json({ success: true, message: "Profile picture updated successfully." });
    });
});
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || err.message.includes("Only .jpg and .png")) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
});


// Static pages
app.get("/homepage.html", isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, "public", "homepage.html")));
app.get("/profile.html", isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, "public", "profile.html")));
app.get("/menu.html", isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, "public", "menu.html")));

// Auth check
app.get("/api/check-auth", (req, res) => {
    if (req.session.user) res.json({ loggedIn: true, user: req.session.user });
    else res.json({ loggedIn: false });
});

// CRUD routes for menu & users (admin only) omitted here but should follow same style as above.
app.listen(8000, () => console.log("Server running on http://localhost:8000"));
