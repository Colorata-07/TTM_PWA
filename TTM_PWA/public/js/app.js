document.addEventListener("DOMContentLoaded", async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const path = window.location.pathname;
    const protectedPages = ["/admin-dashboard.html", "/profile.html", "/menu.html", "/homepage.html","/cart.html"];
    const loginBtn = document.getElementById('login-btn');
    const loginModal = document.getElementById('login-modal');
    const loginCloseBtn = loginModal?.querySelector('.close');
    const loginForm = document.getElementById("login-form");
    const signupBtn = document.getElementById('signup-btn');
    const signupModal = document.getElementById('signup-modal');
    const signupCloseBtn = signupModal?.querySelector('.close');
    const signupForm = document.getElementById("signup-form");
    const adminLink = document.getElementById("admin-link");
    let cartMap = new Map();

    if (user) {
        checkCartCount();
    }

    if (adminLink && user?.admin) adminLink.classList.remove("hidden");

    loginBtn?.addEventListener('click', e => {
        e.preventDefault();
        loginModal?.classList.remove("hidden");
    });
    signupBtn?.addEventListener('click', e => {
        e.preventDefault();
        loginModal?.classList.add("hidden");
        signupModal?.classList.remove("hidden");
    });
    loginCloseBtn?.addEventListener('click', () => loginModal.classList.add("hidden"));
    signupCloseBtn?.addEventListener('click', () => signupModal.classList.add("hidden"));
    loginForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = loginForm.email.value.trim();
        const password = loginForm.password.value.trim();
        if (!email || !password) return alert("Please enter both email and password.");
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem("user", JSON.stringify(data.user));
            window.location.href = "/homepage.html";
        } else {
            alert("Error");
        }
    });
    signupForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = signupForm.username.value.trim();
        const email = signupForm.email.value.trim();
        const password = signupForm.password.value.trim();
        if (!username || !email || !password) return alert("Please fill in all fields.");
        const res = await fetch("/api/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (data.success) {
            signupModal.classList.add("hidden");
            loginModal.classList.remove("hidden");
        } else {
            alert("Error: " + data.message);
        }
    });

    if (protectedPages.includes(path)) {
        try {
            const res = await fetch("/api/check-auth");
            const data = await res.json();
            if (!data.loggedIn) return (window.location.href = "/");
            localStorage.setItem("user", JSON.stringify(data.user));
        } catch {
            window.location.href = "/";
        }
    }

    if (path === "/profile.html") {
        const container = document.getElementById("profile-container");
        const modal = document.getElementById("edit-modal");
        const modalTitle = document.getElementById("modal-title");
        const modalInput = document.getElementById("modal-input");
        const modalFile = document.getElementById("modal-file");
        const modalSave = document.getElementById("modal-save");
        const modalClose = document.getElementById("modal-close");

        let currentEditField = null;

        function openModal(field, value, title) {
            currentEditField = field;
            modalTitle.textContent = title;
            modalInput.classList.add("hidden");
            modalFile.classList.add("hidden");
            if (field === "profile_picture") modalFile.classList.remove("hidden");
            else {
                modalInput.classList.remove("hidden");
                modalInput.value = value;
            }
            modal.classList.remove("hidden");
        }

        function closeModal() {
            modal.classList.add("hidden");
            modalInput.value = "";
            currentEditField = null;
        }

        modalClose?.addEventListener("click", closeModal);

        modalSave?.addEventListener("click", async () => {
            if (!currentEditField) return;
            let body;
            let headers = {};

            if (currentEditField === "profile_picture") {
                const file = modalFile.files[0];
                if (!file) return alert("Please choose a file.");
                body = new FormData();
                body.append("profile_picture", file);
            } else {
                const value = modalInput.value.trim();
                if (!value) return;
                body = JSON.stringify({ [currentEditField]: value });
                headers["Content-Type"] = "application/json";
            }

            const res = await fetch(`/api/profile/${currentEditField}`, {
                method: "PUT",
                headers,
                body
            });
            const data = await res.json();
            if (data.success) {
                location.reload();
            } else {
                alert("Error");
            }
        });

        fetch("/api/profile")
            .then(res => res.json())
            .then(data => {
                container.innerHTML = `
                <div id="header">
                    <div class="left-header">
                        <div id="pfp">
                            <img src="${data.profile_picture || '/images/default.png'}" alt="Profile Picture" />
                            <button id="edit-pfp">Edit</button>
                        </div>
                        <h2><span>Hi,</span> ${data.username}</h2>
                    </div>
                    <a href="#" id="logout-btn">Log Out</a>
                </div>
                <div class="profile-details">
                    <p><span>Username:</span> ${data.username} <button id="edit-username">Edit</button></p>
                    <p><span>Email:</span> ${data.email} <button id="edit-email">Edit</button></p>
                    <p><span>Account Type:</span> ${data.admin ? 'Admin' : 'Customer'}</p>
                </div>
                `;
                
                document.getElementById("logout-btn")?.addEventListener("click", async (e) => {
                    e.preventDefault();

                    try {
                        await fetch("/logout", { method: "POST" });
                        localStorage.removeItem("user");
                        window.location.href = "/";
                    } catch (err) {
                        alert("Error");
                    }
                });
                document.getElementById("edit-username")?.addEventListener("click", () => openModal("username", data.username, "Edit Username"));
                document.getElementById("edit-email")?.addEventListener("click", () => openModal("email", data.email, "Edit Email"));
                document.getElementById("edit-pfp")?.addEventListener("click", () => openModal("profile_picture", null, "Edit Profile Picture"));
            });
    }
    if (path === "/admin-dashboard.html" && user?.admin) {
        const userList = document.getElementById("user-list");
        const createUserForm = document.getElementById("create-user-form");
        const menuForm = document.getElementById("create-menu-form");
        const menuList = document.getElementById("menu-list");
        const categorySelect = document.getElementById("category-select");

        async function loadUsers() {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            userList.innerHTML = "";
            data.users.forEach(u => {
                const div = document.createElement("div");
                div.innerHTML = `
                    <span><strong>${u.username}</strong> (${u.email}) - ${u.admin ? "Admin" : "User"}</span>
                    <button class="edit-user" data-id="${u.user_id}">Edit</button>
                `;
                userList.appendChild(div);
            });
            document.querySelectorAll(".edit-user").forEach(btn => {
                btn.addEventListener("click", () => openEditUserModal(btn.dataset.id));
            });
        }

        createUserForm?.addEventListener("submit", async e => {
            e.preventDefault();
            const formData = new FormData(createUserForm);
            const res = await fetch("/api/admin/users", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                alert("User created");
                createUserForm.reset();
                loadUsers();
            } else {
                alert("Failed to create user");
            }
        });

        function openEditUserModal(id) {
            fetch(`/api/admin/users/${id}`)
                .then(res => res.json())
                .then(data => {
                    const user = data.user;
                    const modal = document.createElement("div");
                    modal.classList.add("modal-overlay");
                    modal.id = "edit-user-modal";
                    modal.innerHTML = `
                        <div class="modal-content">
                            <button id="delete-user-btn" class="danger">Delete User</button>
                            <h3>Edit User</h3>
                            <form id="edit-user-form">
                                <label>Username:<input type="text" name="username" value="${user.username}" /></label>
                                <label>Email:<input type="email" name="email" value="${user.email}" /></label>
                                <label>Admin:<input type="checkbox" name="admin" ${user.admin ? "checked" : ""} /></label>
                                <label>Profile Picture:<input type="file" name="profile_picture" /></label>
                                <div class="modal-buttons">
                                    <button type="submit">Update</button>
                                    <button type="button" id="cancel-user-btn">Cancel</button>
                                </div>
                            </form>
                        </div>`;
                    document.body.appendChild(modal);
                    modal.querySelector("#cancel-user-btn").addEventListener("click", () => modal.remove());
                    modal.querySelector("#edit-user-form").addEventListener("submit", async e => {
                        e.preventDefault();
                        const form = e.target;
                        const formData = new FormData(form);
                        formData.set("admin", formData.get("admin") ? "true" : "false");
                        const res = await fetch(`/api/admin/users/${id}`, {
                            method: "PUT",
                            body: formData
                        });
                        const data = await res.json();
                        if (data.success) {
                            alert("User updated");
                            modal.remove();
                            loadUsers();
                        } else {
                            alert("Failed to update user");
                        }
                    });
                    modal.querySelector("#delete-user-btn").addEventListener("click", async () => {
                        if (!confirm("Delete this user?")) return;
                        const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
                        const data = await res.json();
                        if (data.success) {
                            alert("User deleted");
                            modal.remove();
                            loadUsers();
                        } else {
                            alert("Failed to delete user");
                        }
                    });
                });
        }

        async function loadCategories() {
            const res = await fetch("/api/categories");
            const data = await res.json();
            categorySelect.innerHTML = data.categories.map(c => `<option value="${c.category_id}">${c.category_name}</option>`).join("");
        }

        async function loadMenu() {
            try {
                const res = await fetch("/api/admin/menu");
                const data = await res.json();

                if (!data.success || !Array.isArray(data.menu)) {
                    console.error("Menu response invalid:", data);
                    return;
                }

                menuList.innerHTML = "";

                data.menu.forEach(item => {
                    const div = document.createElement("div");
                    div.innerHTML = `
                        <strong>${item.food_name}</strong> ($${item.price.toFixed(2)}) - ${item.category_name}
                        <button class="edit-menu" data-id="${item.food_id}">Edit</button>
                    `;
                    menuList.appendChild(div);
                });

                document.querySelectorAll(".edit-menu").forEach(button => {
                    button.addEventListener("click", () => openEditMenuModal(button.dataset.id));
                });
            } catch (err) {
                console.error("Failed to load menu:", err);
            }
        }

        menuForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(menuForm);
            const body = {};
            formData.forEach((v, k) => body[k] = v);
            const res = await fetch("/api/admin/menu", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                alert("Menu item added");
                menuForm.reset();
                loadMenu();
            } else {
                alert("Failed to add item");
            }
        });

        function openEditMenuModal(food_id) {
            document.querySelector(".modal-overlay")?.remove();
            fetch(`/api/admin/menu/${food_id}`)
                .then(res => res.json())
                .then(async data => {
                    const item = data.menuItem;
                    const catRes = await fetch('/api/categories');
                    const catData = await catRes.json();
                    const modal = document.createElement('div');
                    modal.classList.add('modal-overlay');
                    modal.innerHTML = `
                        <div class="modal-content">
                            <button type="button" id="delete-menu-btn" class="danger">Delete</button>
                            <h3>Edit Menu Item</h3>
                            <form id="edit-menu-form">
                                <input type="hidden" name="food_id" value="${item.food_id}" />
                                <label>Name:<input type="text" name="food_name" value="${item.food_name}" required /></label>
                                <label>Description:<textarea name="description">${item.description}</textarea></label>
                                <label>Price:<input type="number" name="price" step="0.01" value="${(item.price).toFixed(2)}" required /></label>
                                <label>Category:<select name="category_id">${catData.categories.map(c => `<option value="${c.category_id}" ${c.category_id === item.category_id ? 'selected' : ''}>${c.category_name}</option>`).join('')}</select></label>
                                <div class="modal-buttons">
                                    <button type="submit">Update</button>
                                    <button type="button" id="cancel-menu-btn">Cancel</button>
                                </div>
                            </form>
                        </div>`;
                    document.body.appendChild(modal);
                    modal.querySelector("#cancel-menu-btn").addEventListener("click", () => modal.remove());
                    modal.querySelector("#edit-menu-form").addEventListener("submit", async e => {
                        e.preventDefault();
                        const form = e.target;
                        const formData = new FormData(form);
                        const body = {
                            food_name: formData.get("food_name"),
                            description: formData.get("description"),
                            price: parseFloat(formData.get("price")),
                            category_id: formData.get("category_id")
                        };
                        const res = await fetch(`/api/admin/menu/${item.food_id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        });
                        const data = await res.json();
                        if (data.success) {
                            alert("Menu item updated");
                            modal.remove();
                            loadMenu();
                        } else {
                            alert("Failed to update menu item");
                        }
                    });
                    modal.querySelector("#delete-menu-btn").addEventListener("click", async () => {
                        if (!confirm("Delete this item?")) return;
                        const res = await fetch(`/api/admin/menu/${item.food_id}`, {
                            method: 'DELETE'
                        });
                        const data = await res.json();
                        if (data.success) {
                            alert("Menu item deleted");
                            modal.remove();
                            loadMenu();
                        } else {
                            alert("Failed to delete menu item");
                        }
                    });
                });
        }

        await loadUsers();
        await loadCategories();
        await loadMenu();
    }
    if (path === "/menu.html") {
        const menuContainer = document.getElementById("menu-container");
        const categoryBar = document.getElementById("category-bar");
        const menuModal = document.getElementById("menu-modal");
        const modalName = document.getElementById("food-name");
        const modalDescription = document.getElementById("food-description");
        const modalPrice = document.getElementById("item-price");
        const menuCloseBtn = menuModal?.querySelector(".close");

        function openMenuModal(item) {
            modalName.textContent = item.food_name;
            modalDescription.textContent = item.description;
            modalPrice.textContent = `$${(item.price).toFixed(2)}`;
            menuModal.classList.remove("hidden");

            const modalControls = document.getElementById("modal-controls");
            modalControls.innerHTML = "";

            const inCart = cartMap.get(item.food_id);
            const quantity = inCart?.quantity || 0;

            updateModalControls(item, quantity);
        }

        menuCloseBtn?.addEventListener("click", () => {
            menuModal.classList.add("hidden");
            location.reload();
        });

        function updateModalControls(item, qty) {
            const modalControls = document.getElementById("modal-controls");
            modalControls.innerHTML = "";

            if (qty <= 0) {
                modalControls.innerHTML = `<button id="modal-add-to-cart">Add to Cart</button>`;
                document.getElementById("modal-add-to-cart")?.addEventListener("click", async () => {
                const res = await fetch("/api/cart", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ food_id: item.food_id })
                });
                const data = await res.json();
                if (data.success) {
                    cartMap.set(item.food_id, { ...item, quantity: 1 });
                    updateModalControls(item, 1);
                    updateCardUI(document.querySelector(`.menu-item[data-food-id="${item.food_id}"]`), newQty, item);
                    checkCartCount();
                }
                });
            } else {
                modalControls.innerHTML = `
                <div class="quantity-controls">
                    <button class="modal-qty-btn" data-action="increase">+</button>
                    <span class="qty-count">${qty}</span>
                    <button class="modal-qty-btn" data-action="decrease">-</button>
                </div>
                `;

                modalControls.querySelectorAll(".modal-qty-btn").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        const action = btn.dataset.action;
                        const res = await fetch("/api/cart/update", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ cart_item_id: item.food_id, action })
                        });
                        const data = await res.json();
                        if (data.success) {
                            const current = cartMap.get(item.food_id)?.quantity || 0;
                            const newQty = current + (action === "increase" ? 1 : -1);

                            if (newQty <= 0) {
                                cartMap.delete(item.food_id);
                            } else {
                                cartMap.set(item.food_id, { ...item, quantity: newQty });
                            }

                            updateModalControls(item, newQty);

                            const card = document.querySelector(`.menu-item[data-food-id="${item.food_id}"]`);
                            if (card) updateCardUI(card, newQty); // ✅ ensure the card updates too

                            checkCartCount();
                        }
                    });
                });
            }
        }

        async function loadMenu() {
            try {
                const res = await fetch("/api/menu");
                const data = await res.json();

                if (!data.success || !Array.isArray(data.menu)) {
                    console.error("Invalid menu data:", data);
                    menuContainer.innerHTML = "<p>Error loading menu.</p>";
                    return;
                }
                const [menuRes, cartRes] = await Promise.all([
                    fetch("/api/menu"),
                    fetch("/api/cart")
                ]);

                const menuData = await menuRes.json();
                const cartData = await cartRes.json();

                if (cartData.success && Array.isArray(cartData.cart)) {
                    cartData.cart.forEach(item => {
                        cartMap.set(item.food_id, item);
                    });
                }

                    function renderCard(item) {
                        const inCart = cartMap.get(item.food_id);
                        const quantity = inCart?.quantity || 0;

                        const card = document.createElement("div");
                        card.className = "menu-item";
                        card.dataset.foodId = item.food_id;

                        const controls = quantity > 0
                            ? `
                                <div class="quantity-controls">
                                    <button class="menu-qty-btn" data-action="increase">+</button>
                                    <span class="qty-count">${quantity}</span>
                                    <button class="menu-qty-btn" data-action="decrease">-</button>
                                </div>`
                            : `<button class="add-to-cart">Add to Cart</button>`;

                        card.innerHTML = `
                            <div id="card_content">
                                <div class="food-name">${item.food_name}</div>
                                <div class="description">${item.description ?? ""}</div>
                                <div class="price-controls">
                                    <span class="price">$${(item.price).toFixed(2)}</span>
                                    ${controls}
                                </div>
                            </div>
                        `;

                        const qtyContainer = card.querySelector(".quantity-controls");
                        const addBtn = card.querySelector(".add-to-cart");

                        addBtn?.addEventListener("click", async (e) => {
                            e.stopPropagation();
                            const res = await fetch("/api/cart", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ food_id: item.food_id })
                            });
                            const data = await res.json();
                            if (data.success) {
                                cartMap.set(item.food_id, { ...item, quantity: 1 });
                                updateCardUI(card, 1, item);
                                checkCartCount();
                            }
                        });

                        qtyContainer?.querySelectorAll(".menu-qty-btn").forEach(btn => {
                            btn.addEventListener("click", async (e) => {
                                e.stopPropagation();
                                const action = btn.dataset.action;
                                const res = await fetch("/api/cart/update", {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ cart_item_id: item.food_id, action })
                                });
                                const data = await res.json();
                                if (data.success) {
                                    let newQty = quantity + (action === "increase" ? 1 : -1);
                                    if (newQty <= 0) {
                                        cartMap.delete(item.food_id);
                                    } else {
                                        cartMap.set(item.food_id, { ...item, quantity: newQty });
                                    }
                                    updateCardUI(card, newQty);
                                    checkCartCount();
                                }
                            });
                        });

                        card.addEventListener("click", e => {
                            if (!e.target.classList.contains("menu-qty-btn") && !e.target.classList.contains("add-to-cart")) {
                                openMenuModal(item);
                            }
                        });

                        return card;
                    }

                    function updateCardUI(card, qty, item) {
                        const priceEl = card.querySelector(".price-controls");
                        const foodId = Number(card.dataset.foodId);

                        if (qty <= 0) {
                            priceEl.innerHTML = `
                                <span class="price">$${(Number(priceEl.querySelector(".price")?.textContent?.replace('$','')) || 0).toFixed(2)}</span>
                                <button class="add-to-cart">Add to Cart</button>
                            `;
                            const btn = priceEl.querySelector(".add-to-cart");
                            btn?.addEventListener("click", async (e) => {
                                e.stopPropagation();
                                const res = await fetch("/api/cart", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ food_id: foodId })
                                });
                                const data = await res.json();
                                if (data.success) {
                                    cartMap.set(foodId, { ...item, quantity: 1 });
                                    updateCardUI(card, 1, item);
                                    checkCartCount();
                                }
                            });
                        } else {
                            priceEl.innerHTML = `
                                <span class="price">${priceEl.querySelector(".price").textContent}</span>
                                <div class="quantity-controls">
                                    <button class="menu-qty-btn" data-action="increase">+</button>
                                    <span class="qty-count">${qty}</span>
                                    <button class="menu-qty-btn" data-action="decrease">-</button>
                                </div>
                            `;
                            const dec = priceEl.querySelector('[data-action="decrease"]');
                            const inc = priceEl.querySelector('[data-action="increase"]');

                            dec.addEventListener("click", async (e) => {
                                e.stopPropagation();
                                const res = await fetch("/api/cart/update", {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ cart_item_id: foodId, action: "decrease" })
                                });
                                const data = await res.json();
                                if (data.success) {
                                    const newQty = qty - 1;
                                    if (newQty <= 0) {
                                        cartMap.delete(foodId);
                                    } else {
                                        cartMap.set(foodId, { ...item, quantity: newQty });
                                    }
                                    updateCardUI(card, newQty, item);
                                    checkCartCount();
                                }
                            });

                            inc.addEventListener("click", async (e) => {
                                e.stopPropagation();
                                const res = await fetch("/api/cart/update", {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ cart_item_id: foodId, action: "increase" })
                                });
                                const data = await res.json();
                                if (data.success) {
                                    cartMap.set(foodId, { ...item, quantity: qty + 1 });
                                    updateCardUI(card, qty + 1, item);
                                    checkCartCount();
                                }
                            });
                        }
                    }

                categoryBar.innerHTML = "";
                menuContainer.innerHTML = "";

                const grouped = {};
                data.menu.forEach(item => {
                    if (!grouped[item.category]) grouped[item.category] = [];
                    grouped[item.category].push(item);
                });

                Object.keys(grouped).forEach(category => {
                    const btn = document.createElement("button");
                    btn.textContent = category;
                    btn.addEventListener("click", () => {
                        const section = document.getElementById(`section-${category.replace(/\s+/g, "-").toLowerCase()}`);
                        if (section) section.scrollIntoView({ behavior: "smooth" });
                    });
                    categoryBar.appendChild(btn);
                });

                Object.entries(grouped).forEach(([category, items]) => {
                    const section = document.createElement("article");
                    section.className = "category";
                    section.id = `section-${category.replace(/\s+/g, "-").toLowerCase()}`;

                    const heading = document.createElement("h2");
                    heading.textContent = category;
                    section.appendChild(heading);

                    const grid = document.createElement("div");
                    grid.className = "menu-grid";
                    items.forEach(item => {
                        const card = renderCard(item);
                        grid.appendChild(card);
                    });
                    section.appendChild(grid);
                    menuContainer.appendChild(section);
                });
            } catch (err) {
                console.error("Error loading menu:", err);
                menuContainer.innerHTML = "<p>Error loading menu.</p>";
            }
        }
        loadMenu();
    }

    async function checkCartCount() {
        try {
            const res = await fetch("/api/cart/count");
            const data = await res.json();
            console.log("Cart count response:", data);

            const floatingCartBtn = document.getElementById("floating-cart-btn");
            if (!floatingCartBtn) return;

            if (data.success && data.count > 0) {
                floatingCartBtn.style.display = "block";
                floatingCartBtn.textContent = `Cart (${data.count})`;
            } else {
                floatingCartBtn.style.display = "none";
            }
        } catch (err) {
            console.error("Cart count check failed:", err);
        }
    }

    if (path === "/cart.html") {
        const cartTableBody = document.getElementById("cart-table-body");
        const cartTotalRow = document.getElementById("cart-total-row");
        const cartUsername = document.getElementById("cart-username");

        let total = 0;

        try {
            const res = await fetch("/api/cart");
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            if (!data.cart || data.cart.length === 0) {
                window.location.href = "/homepage.html";
                return;
            }

            if (cartUsername) {
                cartUsername.textContent = `Cart for ${data.username}`;
            }

            cartTableBody.innerHTML = "";
            total = 0; 

            data.cart.forEach(item => {
                total += item.total_price;

                const row = document.createElement("tr");
                row.innerHTML = `
                    <td id = "qty-btn-group">
                        <button class="quantity-btn" data-id="${item.cart_item_id}" data-action="increase">+</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn" data-id="${item.cart_item_id}" data-action="decrease">-</button>
                    </td>
                    <td>${item.food_name}</td>
                    <td>$${item.total_price.toFixed(2)}</td>
                    <td>
                        <button class="remove-item-btn" data-id="${item.cart_item_id}" >x</button>
                    </td>
                `;

                cartTableBody.appendChild(row);
            });
            document.querySelectorAll(".quantity-btn").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const cart_item_id = btn.getAttribute("data-id");
                    const action = btn.getAttribute("data-action");
                    try {
                        const res = await fetch(`/api/cart/update`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ cart_item_id: cart_item_id, action })
                        });
                        const data = await res.json();
                        if (data.success) {
                            window.location.reload();
                        } else {
                            alert("Error");
                        }
                    } catch (err) {
                        console.error("Quantity update error:", err);
                    }
                });
            });

            document.querySelectorAll(".remove-item-btn").forEach(btn => {
                btn.addEventListener("click", async (e) => {
                    const cart_item_id = btn.getAttribute("data-id");
                    try {
                        const res = await fetch(`/api/cart/item/${cart_item_id}`, {
                            method: "DELETE"
                        });
                        const data = await res.json();
                        if (data.success) {
                            window.location.reload();
                        } else {
                            alert("Error");
                        }
                    } catch (err) {
                        console.error("Error deleting item:", err);
                        alert("Error");
                    }
                });
            });


            cartTotalRow.innerHTML = `
                <td><strong>Total Price</strong></td>
                <td style="text-align:right;"><strong>$${total.toFixed(2)}</strong></td>
            `;
        } catch (err) {
            console.error("Failed to load cart:", err);
            cartTableBody.innerHTML = `<tr><td colspan="2">Failed to load cart.</td></tr>`;
        }

        const checkoutBtn = document.getElementById("checkout-btn");
        const checkoutModal = document.getElementById("checkout-modal");
        const checkoutTotal = document.getElementById("checkout-total");
        const payNowBtn = document.getElementById("pay-now-btn");
        const checkoutClose = checkoutModal.querySelector(".checkout-close");

        checkoutBtn?.addEventListener("click", () => {
            checkoutTotal.textContent = `$${total.toFixed(2)}`;
            checkoutModal.classList.remove("hidden");
        });

        checkoutClose?.addEventListener("click", () => {
            checkoutModal.classList.add("hidden");
        });

        payNowBtn?.addEventListener("click", () => {
            checkoutModal.classList.add("hidden");
            document.getElementById("here-modal").classList.remove("hidden");
        });

        const imHereBtn = document.getElementById("im-here-btn");
        imHereBtn?.addEventListener("click", async () => {
            try {
                const res = await fetch("/api/cart/clear", {
                    method: "DELETE"
                });
                const data = await res.json();
                if (data.success) {
                    document.getElementById("here-modal").classList.add("hidden");
                    window.location.href = "/homepage.html";
                } else {
                    alert("Error");
                    window.location.reload();
                }
            } catch (err) {
                console.error("Delete cart failed:", err);
                alert("Error");
            }
        });
    }
});

