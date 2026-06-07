import { useState, useEffect, useCallback, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot, collection,
  getDocs, deleteDoc, writeBatch
} from "firebase/firestore";

// ─── FIREBASE SETUP ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDkbYvoaHCKwUU7-mNPHwC_OfvNfSHQqsM",
  authDomain: "daray-shop-pos.firebaseapp.com",
  projectId: "daray-shop-pos",
  storageBucket: "daray-shop-pos.firebasestorage.app",
  messagingSenderId: "525756275417",
  appId: "1:525756275417:web:89365be1172b9de291bcc8",
  measurementId: "G-NWRZTKVG6K"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ─── FIRESTORE DB HELPERS ────────────────────────────────────────────────────
// All data is stored as single documents in a "store" collection
// Key: collection name, Value: JSON array stored as a document field
const FDB = {
  async get(key: string, def: any = []) {
    try {
      const snap = await getDoc(doc(db, "store", key));
      if (snap.exists()) return snap.data().value ?? def;
      return def;
    } catch { return def; }
  },
  async set(key: string, val: any) {
    try {
      await setDoc(doc(db, "store", key), { value: val });
    } catch (e) { console.error("FDB.set error", e); }
  },
  subscribe(key: string, callback: (val: any) => void) {
    return onSnapshot(doc(db, "store", key), (snap) => {
      if (snap.exists()) callback(snap.data().value);
    });
  }
};

// ─── LOCAL FALLBACK (used only for session/auth) ──────────────────────────
const LOCAL = {
  get: (key: string, def: any = null) => {
    try { const v = localStorage.getItem("pos_" + key); return v ? JSON.parse(v) : def; } catch { return def; }
  },
  set: (key: string, val: any) => {
    try { localStorage.setItem("pos_" + key, JSON.stringify(val)); } catch {}
  },
};

const genId = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));

// ─── SEED DATA ───────────────────────────────────────────────────────────────
async function seedData() {
  const seeded = await FDB.get("seeded", false);
  if (seeded) return;
  const categories = [
    { id: "cat1", name: "Food & Beverages" }, { id: "cat2", name: "Household" },
    { id: "cat3", name: "Electronics" }, { id: "cat4", name: "Clothing" }, { id: "cat5", name: "Medicines" },
  ];
  const suppliers = [
    { id: "sup1", name: "Daallo Trading Co.", phone: "063-4123456", address: "Hargeisa, Somaliland", balance: 0, products: "Food, Beverages" },
    { id: "sup2", name: "Berbera Wholesale", phone: "063-7654321", address: "Berbera, Somaliland", balance: 15000, products: "Household" },
    { id: "sup3", name: "Mogadishu Imports", phone: "061-9988776", address: "Mogadishu, Somalia", balance: 0, products: "Electronics" },
  ];
  const products = [
    { id: "p1", barcode: "001", name: "Rice (50kg)", category: "cat1", brand: "Golden", costPrice: 85000, sellingPrice: 110000, quantity: 42, reorderLevel: 10, supplier: "sup1", image: "🌾" },
    { id: "p2", barcode: "002", name: "Flour (25kg)", category: "cat1", brand: "Dhuuban", costPrice: 42000, sellingPrice: 55000, quantity: 28, reorderLevel: 8, supplier: "sup1", image: "🫘" },
    { id: "p3", barcode: "003", name: "Sugar (1kg)", category: "cat1", brand: "Aden", costPrice: 3500, sellingPrice: 5000, quantity: 120, reorderLevel: 20, supplier: "sup1", image: "🍬" },
    { id: "p4", barcode: "004", name: "Cooking Oil (5L)", category: "cat1", brand: "Nura", costPrice: 28000, sellingPrice: 36000, quantity: 55, reorderLevel: 15, supplier: "sup2", image: "🫙" },
    { id: "p5", barcode: "005", name: "Soap (12 pack)", category: "cat2", brand: "Lifebuoy", costPrice: 12000, sellingPrice: 18000, quantity: 80, reorderLevel: 20, supplier: "sup2", image: "🧼" },
    { id: "p6", barcode: "006", name: "Shampoo 400ml", category: "cat2", brand: "Head&Shoulders", costPrice: 8500, sellingPrice: 13000, quantity: 45, reorderLevel: 10, supplier: "sup2", image: "🧴" },
    { id: "p7", barcode: "007", name: "Tea (500g)", category: "cat1", brand: "Somali Tea", costPrice: 6000, sellingPrice: 9000, quantity: 7, reorderLevel: 15, supplier: "sup1", image: "🍵" },
    { id: "p8", barcode: "008", name: "Mobile Charger", category: "cat3", brand: "Vivo", costPrice: 15000, sellingPrice: 25000, quantity: 22, reorderLevel: 5, supplier: "sup3", image: "🔌" },
    { id: "p9", barcode: "009", name: "Biscuits (box)", category: "cat1", brand: "Digestive", costPrice: 4500, sellingPrice: 7000, quantity: 3, reorderLevel: 10, supplier: "sup1", image: "🍪" },
    { id: "p10", barcode: "010", name: "Milk Powder (400g)", category: "cat1", brand: "Nido", costPrice: 18000, sellingPrice: 26000, quantity: 35, reorderLevel: 12, supplier: "sup1", image: "🥛" },
  ];
  const customers = [
    { id: "cus1", name: "Amina Hassan", phone: "063-1234567", address: "Burao Center", balance: -12000, notes: "Regular customer" },
    { id: "cus2", name: "Mohamed Abdi", phone: "061-9876543", address: "Goljano Area", balance: 5000, notes: "Paid in advance" },
    { id: "cus3", name: "Fadumo Omar", phone: "063-5556789", address: "Horseed Rd", balance: 0, notes: "" },
  ];
  const expenses = [
    { id: "ex1", name: "Shop Rent", category: "Rent", amount: 200000, date: "2025-01-01", notes: "Monthly rent" },
    { id: "ex2", name: "Electricity Bill", category: "Electricity", amount: 15000, date: "2025-01-05", notes: "" },
    { id: "ex3", name: "Staff Salary", category: "Salaries", amount: 150000, date: "2025-01-31", notes: "2 staff" },
    { id: "ex4", name: "Internet", category: "Internet", amount: 8000, date: "2025-01-10", notes: "Monthly" },
  ];
  await Promise.all([
    FDB.set("categories", categories),
    FDB.set("suppliers", suppliers),
    FDB.set("products", products),
    FDB.set("customers", customers),
    FDB.set("sales", []),
    FDB.set("expenses", expenses),
    FDB.set("purchases", []),
    FDB.set("users", DEFAULT_USERS),
    FDB.set("seeded", true),
  ]);
}

// ─── USERS ───────────────────────────────────────────────────────────────────
const DEFAULT_USERS = [
  { id: "u1", username: "admin", password: "admin123", role: "admin", name: "Admin User" },
  { id: "u2", username: "cashier", password: "cash123", role: "cashier", name: "Cashier" },
];

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const users = await FDB.get("users", DEFAULT_USERS);
    const user = users.find(u => u.username === username && u.password === password);
    setLoading(false);
    if (user) {
      LOCAL.set("session", user);
      onLogin(user);
    } else {
      setError("Invalid username or password");
      setTimeout(() => setError(""), 3000);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1a1d2e 0%,#262b40 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px 36px", width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, background: "linear-gradient(135deg,#4f8cff,#a259f7)", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px" }}>🏪</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1a1d2e" }}>Daray Shop</div>
          <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>POS Management System</div>
        </div>
        {error && <div style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#ef4444", textAlign: "center" }}>{error}</div>}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="Enter username"
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #ddd", borderRadius: 10, fontSize: 14, boxSizing: "border-box", outline: "none" }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Password</label>
          <div style={{ position: "relative" }}>
            <input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
              type={showPass ? "text" : "password"} placeholder="Enter password"
              style={{ width: "100%", padding: "12px 14px", border: "1px solid #ddd", borderRadius: 10, fontSize: 14, boxSizing: "border-box", outline: "none" }} />
            <button onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#888" }}>
              {showPass ? "🙈" : "👁️"}
            </button>
          </div>
        </div>
        <button onClick={handleLogin} disabled={loading}
          style={{ width: "100%", background: "linear-gradient(135deg,#4f8cff,#a259f7)", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Signing in..." : "Sign In →"}
        </button>
        <div style={{ marginTop: 24, padding: "14px", background: "#f8f9fc", borderRadius: 10, fontSize: 12, color: "#888" }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: "#555" }}>Default Accounts:</div>
          <div>👑 Admin: <strong>admin</strong> / <strong>admin123</strong></div>
          <div style={{ marginTop: 4 }}>💰 Cashier: <strong>cashier</strong> / <strong>cash123</strong></div>
          <div style={{ marginTop: 6, fontSize: 11, color: "#aaa" }}>Change passwords in Settings after login.</div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => !!LOCAL.get("session", null));
  const [user, setUser] = useState(() => LOCAL.get("session", { name: "Admin User", role: "admin" }));
  const [page, setPage] = useState("dashboard");
  const [darkMode, setDarkMode] = useState(false);
  const [notification, setNotification] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setSyncing(true);
    seedData().then(() => setSyncing(false));
  }, []);

  const handleLogin = (u) => { setUser(u); setLoggedIn(true); };
  const handleLogout = () => { LOCAL.set("session", null); setLoggedIn(false); setPage("dashboard"); };

  if (!loggedIn) return <LoginPage onLogin={handleLogin} />;

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "pos", label: "Point of Sale", icon: "🛒" },
    { id: "products", label: "Products", icon: "📦" },
    { id: "purchases", label: "Purchases", icon: "🚚" },
    { id: "expenses", label: "Expenses", icon: "💸" },
    { id: "customers", label: "Customers", icon: "👥" },
    { id: "suppliers", label: "Suppliers", icon: "🏭" },
    { id: "reports", label: "Reports", icon: "📈" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  const styles = {
    app: { display: "flex", height: "100vh", background: darkMode ? "#0f1117" : "#f4f5f7", color: darkMode ? "#e8eaf0" : "#1a1d2e", fontFamily: "'Outfit',system-ui,sans-serif", overflow: "hidden" },
    sidebar: { width: sidebarOpen ? 220 : 60, background: "#1a1d2e", display: "flex", flexDirection: "column", transition: "width 0.2s", overflow: "hidden", flexShrink: 0 },
    logo: { padding: "20px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 8 },
    navItem: (active) => ({ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer", borderRadius: 8, margin: "2px 8px", background: active ? "rgba(79,140,255,0.18)" : "transparent", color: active ? "#4f8cff" : "rgba(255,255,255,0.7)", fontSize: 13.5, fontWeight: active ? 600 : 400, transition: "all 0.15s", whiteSpace: "nowrap", overflow: "hidden" }),
    main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
    topbar: { background: darkMode ? "#1a1d2e" : "#fff", borderBottom: darkMode ? "1px solid #262b40" : "1px solid #e8eaf0", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
    content: { flex: 1, overflow: "auto", padding: "24px" },
  };

  return (
    <div style={styles.app}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.logo}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setSidebarOpen(o => !o)}>
            <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#4f8cff,#a259f7)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🏪</div>
            {sidebarOpen && <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Daray Shop</div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>POS System</div>
            </div>}
          </div>
        </div>
        {nav.map(n => (
          <div key={n.id} style={styles.navItem(page === n.id)} onClick={() => setPage(n.id)}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{n.icon}</span>
            {sidebarOpen && <span>{n.label}</span>}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: "12px 8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={styles.navItem(false)}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>👤</span>
            {sidebarOpen && <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{user.role}</div>
            </div>}
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={styles.main}>
        <div style={styles.topbar}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{nav.find(n => n.id === page)?.label}</div>
            <div style={{ fontSize: 12, color: "#888", background: darkMode ? "#262b40" : "#f4f5f7", padding: "2px 10px", borderRadius: 20 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </div>
            {syncing && <div style={{ fontSize: 11, color: "#f59e0b", background: "#fff9e6", padding: "2px 10px", borderRadius: 20 }}>🔄 Syncing...</div>}
            <div style={{ fontSize: 11, color: "#22c55e", background: "#f0fff4", padding: "2px 10px", borderRadius: 20 }}>☁️ Firebase</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setDarkMode(d => !d)} style={{ background: "none", border: "1px solid", borderColor: darkMode ? "#333" : "#e0e0e0", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "inherit", fontSize: 13 }}>
              {darkMode ? "☀️ Light" : "🌙 Dark"}
            </button>
            <button onClick={handleLogout} style={{ background: "none", border: "1px solid #ef4444", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#ef4444", fontSize: 13, fontWeight: 600 }}>
              🚪 Logout
            </button>
          </div>
        </div>

        {notification && (
          <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: notification.type === "success" ? "#22c55e" : "#ef4444", color: "#fff", padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
            {notification.msg}
          </div>
        )}

        <div style={styles.content}>
          {page === "dashboard" && <Dashboard darkMode={darkMode} />}
          {page === "pos" && <POS notify={notify} darkMode={darkMode} />}
          {page === "products" && <Products notify={notify} darkMode={darkMode} />}
          {page === "purchases" && <Purchases notify={notify} darkMode={darkMode} />}
          {page === "expenses" && <Expenses notify={notify} darkMode={darkMode} />}
          {page === "customers" && <Customers notify={notify} darkMode={darkMode} />}
          {page === "suppliers" && <Suppliers notify={notify} darkMode={darkMode} />}
          {page === "reports" && <Reports darkMode={darkMode} />}
          {page === "settings" && <Settings notify={notify} darkMode={darkMode} currentUser={user} onUserUpdate={(u) => { setUser(u); LOCAL.set("session", u); }} />}
        </div>
      </div>
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 500 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#888", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 }}>{label}</label>}
      <input style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", outline: "none" }} {...props} />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 }}>{label}</label>}
      <select style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", outline: "none", background: "#fff" }} {...props}>{children}</select>
    </div>
  );
}

function Btn({ children, onClick, color = "#4f8cff", size = "md", variant = "solid", style = {} }) {
  const pad = size === "sm" ? "6px 12px" : "9px 18px";
  const fs = size === "sm" ? 12 : 14;
  return (
    <button onClick={onClick} style={{ background: variant === "solid" ? color : "transparent", color: variant === "solid" ? "#fff" : color, border: `1px solid ${color}`, borderRadius: 8, padding: pad, fontSize: fs, fontWeight: 600, cursor: "pointer", transition: "opacity 0.15s", ...style }}>{children}</button>
  );
}

function Badge({ label, color = "#4f8cff" }) {
  return <span style={{ background: color + "22", color: color, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, display: "inline-block" }}>{label}</span>;
}

function Table({ headers, rows, darkMode = false }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: darkMode ? "#1e2235" : "#f8f9fc" }}>
            {headers.map((h, i) => <th key={i} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, color: "#888", borderBottom: "1px solid #e8eaf0", whiteSpace: "nowrap" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f0f1f5" }}>
              {row.map((cell, j) => <td key={j} style={{ padding: "10px 14px", verticalAlign: "middle" }}>{cell}</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={headers.length} style={{ padding: 40, textAlign: "center", color: "#bbb", fontSize: 14 }}>No records found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ darkMode }) {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    const unsub1 = FDB.subscribe("sales", setSales);
    const unsub2 = FDB.subscribe("products", setProducts);
    const unsub3 = FDB.subscribe("expenses", setExpenses);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const todaySales = sales.filter(s => s.date?.startsWith(today));
  const todayRevenue = todaySales.reduce((a, s) => a + s.total, 0);
  const todayCost = todaySales.reduce((a, s) => a + s.items.reduce((b, i) => b + (i.costPrice || 0) * i.qty, 0), 0);
  const todayProfit = todayRevenue - todayCost;
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthSales = sales.filter(s => s.date?.startsWith(monthKey));
  const monthRevenue = monthSales.reduce((a, s) => a + s.total, 0);
  const monthExpenses = expenses.filter(e => e.date?.startsWith(monthKey)).reduce((a, e) => a + e.amount, 0);
  const monthProfit = monthRevenue - monthExpenses;
  const lowStock = products.filter(p => p.quantity <= p.reorderLevel);
  const totalInventoryValue = products.reduce((a, p) => a + p.quantity * p.sellingPrice, 0);
  const recentSales = [...sales].reverse().slice(0, 5);
  const topProducts = products.map(p => {
    const sold = sales.reduce((a, s) => a + s.items.filter(i => i.productId === p.id).reduce((b, i) => b + i.qty, 0), 0);
    return { ...p, sold };
  }).sort((a, b) => b.sold - a.sold).slice(0, 5);

  const cardStyle = { background: darkMode ? "#1a1d2e" : "#fff", border: `1px solid ${darkMode ? "#262b40" : "#e8eaf0"}` };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "TODAY'S REVENUE", value: `SOS ${fmt(todayRevenue)}`, sub: `${todaySales.length} transactions` },
          { label: "TODAY'S PROFIT", value: `SOS ${fmt(todayProfit)}`, sub: "After COGS", color: todayProfit >= 0 ? "#22c55e" : "#ef4444" },
          { label: "MONTHLY REVENUE", value: `SOS ${fmt(monthRevenue)}`, sub: `Net: SOS ${fmt(monthProfit)}` },
          { label: "INVENTORY VALUE", value: `SOS ${fmt(totalInventoryValue)}`, sub: `${products.length} products` },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ ...cardStyle, borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, color: "#888", fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: color || (darkMode ? "#e8eaf0" : "#1a1d2e") }}>{value}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div style={{ background: "#fff9e6", border: "1px solid #f5c842", borderRadius: 12, padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#92400e" }}>Low Stock Alert</div>
            <div style={{ fontSize: 13, color: "#a16207" }}>{lowStock.map(p => `${p.name} (${p.quantity} left)`).join(" • ")}</div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ ...cardStyle, borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Recent Transactions</div>
          {recentSales.length === 0 && <div style={{ color: "#bbb", fontSize: 14, textAlign: "center", padding: "20px 0" }}>No sales yet</div>}
          {recentSales.map(s => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f0f1f5" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.customer || "Walk-in"}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{new Date(s.date).toLocaleString()} • {s.paymentMethod}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>+{fmt(s.total)}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{s.items.length} items</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...cardStyle, borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Top Selling Products</div>
          {topProducts.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f0f1f5" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#4f8cff22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{p.image || "📦"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{p.sold} sold • {p.quantity} in stock</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4f8cff" }}>SOS {fmt(p.sellingPrice)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={{ ...cardStyle, borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📊 Sales — Last 7 Days</div>
          <WeeklyBarChart sales={sales} darkMode={darkMode} />
        </div>
        <div style={{ ...cardStyle, borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>💳 Payment Methods This Month</div>
          <PaymentDonut sales={monthSales} darkMode={darkMode} />
        </div>
      </div>

      <div style={{ ...cardStyle, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📈 Revenue vs Expenses — Last 6 Months</div>
        <MonthlyLineChart sales={sales} expenses={expenses} darkMode={darkMode} />
      </div>
    </div>
  );
}

// ─── CHART COMPONENTS ────────────────────────────────────────────────────────
function WeeklyBarChart({ sales, darkMode }) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    const rev = sales.filter(s => s.date?.startsWith(key)).reduce((a, s) => a + s.total, 0);
    days.push({ label, rev });
  }
  const maxVal = Math.max(...days.map(d => d.rev), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140, padding: "0 4px" }}>
      {days.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 10, color: "#888", fontWeight: 600 }}>{d.rev > 0 ? fmt(d.rev / 1000) + "k" : ""}</div>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", flex: 1, gap: 2 }}>
            <div style={{ width: "100%", background: "#4f8cff", borderRadius: "4px 4px 0 0", height: `${Math.max(4, (d.rev / maxVal) * 100)}%`, minHeight: d.rev > 0 ? 8 : 0, transition: "height 0.3s" }} />
          </div>
          <div style={{ fontSize: 10, color: "#888", fontWeight: 600, textAlign: "center" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function PaymentDonut({ sales, darkMode }) {
  const methods = ["Cash", "ZAAD", "eDahab", "Bank Transfer", "Split"];
  const colors = { Cash: "#22c55e", ZAAD: "#4f8cff", eDahab: "#f59e0b", "Bank Transfer": "#06b6d4", Split: "#a259f7" };
  const data = methods.map(m => ({ m, total: sales.filter(s => s.paymentMethod === m).reduce((a, s) => a + s.total, 0), color: colors[m] })).filter(d => d.total > 0);
  const grandTotal = data.reduce((a, d) => a + d.total, 0);
  if (grandTotal === 0) return <div style={{ textAlign: "center", color: "#bbb", padding: "30px 0", fontSize: 13 }}>No sales this month</div>;
  let cumulative = 0;
  const size = 120, cx = 60, cy = 60, r = 45, inner = 28;
  const slices = data.map(d => {
    const pct = d.total / grandTotal;
    const start = cumulative; cumulative += pct;
    const s = start * 2 * Math.PI - Math.PI / 2, e = cumulative * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const xi1 = cx + inner * Math.cos(s), yi1 = cy + inner * Math.sin(s);
    const xi2 = cx + inner * Math.cos(e), yi2 = cy + inner * Math.sin(e);
    const large = pct > 0.5 ? 1 : 0;
    return { ...d, path: `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`, pct };
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity={0.9} />)}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="9" fill="#888">TOTAL</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="10" fontWeight="700" fill={darkMode ? "#fff" : "#1a1d2e"}>{fmt(grandTotal / 1000)}k</text>
      </svg>
      <div style={{ flex: 1 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
              <span style={{ fontSize: 12, color: "#555" }}>{s.m}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#888" }}>{Math.round(s.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyLineChart({ sales, expenses, darkMode }) {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", { month: "short" });
    const rev = sales.filter(s => s.date?.startsWith(key)).reduce((a, s) => a + s.total, 0);
    const exp = expenses.filter(e => e.date?.startsWith(key)).reduce((a, e) => a + e.amount, 0);
    months.push({ label, rev, exp });
  }
  const maxVal = Math.max(...months.map(m => Math.max(m.rev, m.exp)), 1);
  const W = 400, H = 120, pad = 32;
  const pts = (arr, key) => arr.map((m, i) => [pad + (i / (arr.length - 1)) * (W - pad * 2), H - pad - (m[key] / maxVal) * (H - pad * 2)]);
  const revPts = pts(months, "rev"), expPts = pts(months, "exp");
  const toPath = pts => pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + "," + p[1]).join(" ");
  const toArea = (pts, h) => toPath(pts) + " L" + pts[pts.length - 1][0] + "," + (h - 8) + " L" + pts[0][0] + "," + (h - 8) + " Z";
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f8cff" stopOpacity="0.3" /><stop offset="100%" stopColor="#4f8cff" stopOpacity="0" /></linearGradient>
          <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" /><stop offset="100%" stopColor="#ef4444" stopOpacity="0" /></linearGradient>
        </defs>
        <path d={toArea(revPts, H)} fill="url(#revGrad)" />
        <path d={toArea(expPts, H)} fill="url(#expGrad)" />
        <path d={toPath(revPts)} fill="none" stroke="#4f8cff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={toPath(expPts)} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,3" />
        {revPts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill="#4f8cff" />)}
        {months.map((m, i) => <text key={i} x={revPts[i][0]} y={H - 4} textAnchor="middle" fontSize="10" fill="#888">{m.label}</text>)}
      </svg>
      <div style={{ display: "flex", gap: 20, marginTop: 8, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555" }}><div style={{ width: 20, height: 3, background: "#4f8cff", borderRadius: 2 }} /> Revenue</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555" }}><div style={{ width: 20, height: 3, background: "#ef4444", borderRadius: 2 }} /> Expenses</div>
      </div>
    </div>
  );
}

// ─── POS ──────────────────────────────────────────────────────────────────────
function POS({ notify, darkMode }) {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState(0);
  const [payments, setPayments] = useState({ Cash: "0", ZAAD: "0", eDahab: "0", "Bank Transfer": "0" });
  const [selCustomer, setSelCustomer] = useState("");
  const [showReceipt, setShowReceipt] = useState(null);

  useEffect(() => {
    const unsub1 = FDB.subscribe("products", setProducts);
    const unsub2 = FDB.subscribe("customers", setCustomers);
    return () => { unsub1(); unsub2(); };
  }, []);

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search));

  const addToCart = (p) => {
    setCart(c => {
      const ex = c.find(i => i.productId === p.id);
      if (ex) return c.map(i => i.productId === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { productId: p.id, name: p.name, price: p.sellingPrice, costPrice: p.costPrice, qty: 1, image: p.image }];
    });
  };

  const updateQty = (pid, qty) => {
    if (qty <= 0) { setCart(c => c.filter(i => i.productId !== pid)); return; }
    setCart(c => c.map(i => i.productId === pid ? { ...i, qty } : i));
  };

  const subtotal = cart.reduce((a, i) => a + i.price * i.qty, 0);
  const discountAmt = Math.round(subtotal * discount / 100);
  const total = subtotal - discountAmt;
  const METHODS = ["Cash", "ZAAD", "eDahab", "Bank Transfer"];
  const COLORS = { Cash: "#22c55e", ZAAD: "#4f8cff", eDahab: "#f59e0b", "Bank Transfer": "#06b6d4" };
  const totalPaid = METHODS.reduce((a, m) => a + (parseFloat(payments[m]) || 0), 0);
  const change = Math.max(0, totalPaid - total);
  const remaining = Math.max(0, total - totalPaid);

  const completeSale = async () => {
    if (cart.length === 0) { notify("Cart is empty", "error"); return; }
    if (totalPaid < total) { notify("Payment is less than total", "error"); return; }
    const paymentBreakdown: any = {};
    METHODS.forEach(m => { if ((parseFloat(payments[m]) || 0) > 0) paymentBreakdown[m] = parseFloat(payments[m]); });
    const sale = {
      id: genId(), date: now(),
      items: cart.map(i => ({ ...i })),
      subtotal, discount, discountAmt, total,
      paymentMethod: Object.keys(paymentBreakdown).length === 1 ? Object.keys(paymentBreakdown)[0] : "Split",
      paymentBreakdown, totalPaid, change,
      customer: selCustomer ? customers.find(c => c.id === selCustomer)?.name : "Walk-in",
      customerId: selCustomer || null,
    };
    const allSales = await FDB.get("sales", []);
    await FDB.set("sales", [...allSales, sale]);
    const prods = products.map(p => {
      const item = cart.find(i => i.productId === p.id);
      if (item) return { ...p, quantity: Math.max(0, p.quantity - item.qty) };
      return p;
    });
    await FDB.set("products", prods);
    setShowReceipt(sale);
    setCart([]); setDiscount(0);
    setPayments({ Cash: "0", ZAAD: "0", eDahab: "0", "Bank Transfer": "0" });
    setSelCustomer("");
    notify("Sale completed! ✓");
  };

  const s = { bg: darkMode ? "#1a1d2e" : "#fff", border: darkMode ? "#262b40" : "#e8eaf0", text: darkMode ? "#e8eaf0" : "#1a1d2e" };

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 110px)", minHeight: 0 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search products or scan barcode..."
          style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${s.border}`, fontSize: 14, marginBottom: 16, background: s.bg, color: s.text, outline: "none", width: "100%", boxSizing: "border-box" }} />
        <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 12, alignContent: "start" }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => addToCart(p)} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: 14, cursor: "pointer", transition: "transform 0.1s", userSelect: "none" }}
              onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
              onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}>
              <div style={{ fontSize: 28, marginBottom: 8, textAlign: "center" }}>{p.image || "📦"}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: s.text, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4f8cff" }}>SOS {fmt(p.sellingPrice)}</div>
              <div style={{ fontSize: 11, color: p.quantity <= p.reorderLevel ? "#ef4444" : "#888", marginTop: 2 }}>Stock: {p.quantity}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: 480, display: "flex", flexDirection: "column", background: s.bg, border: `1px solid ${s.border}`, borderRadius: 16, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${s.border}`, fontWeight: 700, fontSize: 17 }}>🛒 Cart — {cart.length} items</div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", minHeight: 0 }}>
          {cart.length === 0 && <div style={{ textAlign: "center", color: "#bbb", padding: "40px 0", fontSize: 14 }}>Tap products to add them</div>}
          {cart.map(item => (
            <div key={item.productId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: `1px solid ${s.border}`, minHeight: 60 }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>{item.image || "📦"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>SOS {fmt(item.price)} each</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => updateQty(item.productId, item.qty - 1)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #ddd", background: "none", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>-</button>
                <span style={{ fontSize: 15, fontWeight: 700, minWidth: 28, textAlign: "center" }}>{item.qty}</span>
                <button onClick={() => updateQty(item.productId, item.qty + 1)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #4f8cff", background: "#4f8cff", color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>+</button>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", minWidth: 80, textAlign: "right" }}>{fmt(item.price * item.qty)}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: "14px 16px", borderTop: `1px solid ${s.border}`, overflowY: "auto", maxHeight: 360 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            <Select label="Customer" value={selCustomer} onChange={e => setSelCustomer(e.target.value)}>
              <option value="">Walk-in Customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="Discount %" type="number" value={discount} onChange={e => setDiscount(Math.min(100, Math.max(0, +e.target.value)))} min="0" max="100" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>Payment (split allowed)</div>
            {METHODS.map(m => (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[m], flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, width: 90, flexShrink: 0, color: "#555" }}>{m}</span>
                <input type="number" min="0" value={payments[m]}
                  onChange={e => setPayments(p => ({ ...p, [m]: e.target.value }))}
                  onFocus={e => { if (e.target.value === "0") setPayments(p => ({ ...p, [m]: "" })); }}
                  onBlur={e => { if (e.target.value === "") setPayments(p => ({ ...p, [m]: "0" })); }}
                  style={{ flex: 1, padding: "6px 10px", border: `1px solid ${(parseFloat(payments[m]) || 0) > 0 ? COLORS[m] : "#ddd"}`, borderRadius: 8, fontSize: 13, outline: "none", background: (parseFloat(payments[m]) || 0) > 0 ? COLORS[m] + "11" : "#fff" }} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#888" }}><span>Subtotal</span><span>SOS {fmt(subtotal)}</span></div>
            {discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#ef4444" }}><span>Discount ({discount}%)</span><span>- SOS {fmt(discountAmt)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `2px solid ${s.border}`, fontWeight: 700, fontSize: 16, marginTop: 6 }}><span>Total</span><span style={{ color: "#4f8cff" }}>SOS {fmt(total)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#888" }}><span>Total Paid</span><span style={{ color: totalPaid >= total ? "#22c55e" : "#f59e0b", fontWeight: 600 }}>SOS {fmt(totalPaid)}</span></div>
            {remaining > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#ef4444", fontWeight: 600 }}><span>Remaining</span><span>SOS {fmt(remaining)}</span></div>}
            {change > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#22c55e", fontWeight: 600 }}><span>Change</span><span>SOS {fmt(change)}</span></div>}
          </div>
          <button onClick={completeSale} style={{ width: "100%", background: "#4f8cff", color: "#fff", border: "none", borderRadius: 10, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>✓ Complete Sale</button>
          <button onClick={() => { setCart([]); setDiscount(0); }} style={{ width: "100%", background: "transparent", color: "#ef4444", border: "1px solid #ef4444", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>Clear Cart</button>
        </div>
      </div>
      {showReceipt && <Receipt sale={showReceipt} onClose={() => setShowReceipt(null)} />}
    </div>
  );
}

function Receipt({ sale, onClose }) {
  const [settings, setSettings] = useState({ shopName: "Daray Shop", phone: "063-XXXXXXX", address: "Burao, Somalia", receiptFooter: "Thank you for your business!" });
  useEffect(() => { FDB.get("settings", settings).then(s => { if (s) setSettings(s); }); }, []);
  return (
    <Modal title="Receipt" onClose={onClose} width={380}>
      <div style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.8, background: "#fafafa", border: "1px solid #e0e0e0", borderRadius: 10, padding: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{settings.shopName}</div>
          <div style={{ fontSize: 12, color: "#666" }}>{settings.address}</div>
          <div style={{ fontSize: 12, color: "#666" }}>{settings.phone}</div>
          <div style={{ borderTop: "1px dashed #999", marginTop: 12, paddingTop: 12, fontSize: 11, color: "#888" }}>
            #{sale.id.toUpperCase()} • {new Date(sale.date).toLocaleString()}
          </div>
        </div>
        <div style={{ borderTop: "1px dashed #999", paddingTop: 10 }}>
          {sale.items.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{item.name} x{item.qty}</span>
              <span>SOS {fmt(item.price * item.qty)}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px dashed #999", marginTop: 10, paddingTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>SOS {fmt(sale.subtotal)}</span></div>
          {sale.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#ef4444" }}><span>Discount</span><span>-SOS {fmt(sale.discountAmt)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, marginTop: 6 }}><span>TOTAL</span><span>SOS {fmt(sale.total)}</span></div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            {sale.paymentBreakdown && Object.keys(sale.paymentBreakdown).length > 1
              ? Object.entries(sale.paymentBreakdown).map(([m, v]) => <div key={m}>{m}: SOS {fmt(v as number)}</div>)
              : <div>Payment: {sale.paymentMethod}</div>}
            {sale.change > 0 && <div style={{ color: "#22c55e" }}>Change: SOS {fmt(sale.change)}</div>}
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#aaa", borderTop: "1px dashed #999", paddingTop: 12 }}>
          {settings.receiptFooter}<br />شكراً لزيارتكم
        </div>
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <Btn onClick={() => window.print()} color="#4f8cff" style={{ flex: 1 }}>🖨️ Print Receipt</Btn>
        <Btn onClick={onClose} color="#888" variant="outline" style={{ flex: 1 }}>Close</Btn>
      </div>
    </Modal>
  );
}

// ─── PRODUCTS ────────────────────────────────────────────────────────────────
function Products({ notify, darkMode }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", barcode: "", category: "", brand: "", costPrice: "", sellingPrice: "", quantity: "", reorderLevel: "", supplier: "", image: "📦", description: "" });

  useEffect(() => {
    const u1 = FDB.subscribe("products", setProducts);
    const u2 = FDB.subscribe("categories", setCategories);
    const u3 = FDB.subscribe("suppliers", setSuppliers);
    return () => { u1(); u2(); u3(); };
  }, []);

  const save = async () => {
    if (!form.name || !form.sellingPrice) { notify("Name and selling price required", "error"); return; }
    const p = { ...form, costPrice: +form.costPrice, sellingPrice: +form.sellingPrice, quantity: +form.quantity, reorderLevel: +form.reorderLevel };
    let updated;
    if (editing) { updated = products.map(x => x.id === editing ? { ...x, ...p } : x); notify("Product updated ✓"); }
    else { updated = [...products, { ...p, id: genId(), dateAdded: now() }]; notify("Product added ✓"); }
    await FDB.set("products", updated);
    setShowForm(false); setEditing(null);
    setForm({ name: "", barcode: "", category: "", brand: "", costPrice: "", sellingPrice: "", quantity: "", reorderLevel: "", supplier: "", image: "📦", description: "" });
  };

  const del = async (id) => {
    if (!confirm("Delete this product?")) return;
    await FDB.set("products", products.filter(p => p.id !== id));
    notify("Product deleted");
  };

  const edit = (p) => {
    setForm({ ...p, costPrice: String(p.costPrice), sellingPrice: String(p.sellingPrice), quantity: String(p.quantity), reorderLevel: String(p.reorderLevel) });
    setEditing(p.id); setShowForm(true);
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search products..."
          style={{ padding: "10px 16px", border: "1px solid #e0e0e0", borderRadius: 10, fontSize: 14, width: 300, outline: "none" }} />
        <Btn onClick={() => { setShowForm(true); setEditing(null); }}>+ Add Product</Btn>
      </div>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8eaf0", overflow: "hidden" }}>
        <Table headers={["", "Name", "Category", "Cost", "Selling", "Stock", "Status", "Actions"]} rows={filtered.map(p => [
          <span style={{ fontSize: 22 }}>{p.image || "📦"}</span>,
          <div><div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div><div style={{ fontSize: 11, color: "#888" }}>{p.barcode}</div></div>,
          <Badge label={categories.find(c => c.id === p.category)?.name || "—"} color="#a259f7" />,
          <span style={{ fontSize: 13 }}>SOS {fmt(p.costPrice)}</span>,
          <span style={{ fontSize: 13, fontWeight: 600 }}>SOS {fmt(p.sellingPrice)}</span>,
          <span style={{ fontWeight: 600, color: p.quantity <= p.reorderLevel ? "#ef4444" : p.quantity <= p.reorderLevel * 2 ? "#f59e0b" : "#22c55e" }}>{p.quantity}</span>,
          p.quantity === 0 ? <Badge label="Out of Stock" color="#ef4444" /> : p.quantity <= p.reorderLevel ? <Badge label="Low Stock" color="#f59e0b" /> : <Badge label="In Stock" color="#22c55e" />,
          <div style={{ display: "flex", gap: 6 }}>
            <Btn size="sm" onClick={() => edit(p)}>Edit</Btn>
            <Btn size="sm" color="#ef4444" onClick={() => del(p.id)}>Del</Btn>
          </div>
        ])} />
      </div>
      {showForm && (
        <Modal title={editing ? "Edit Product" : "Add Product"} onClose={() => { setShowForm(false); setEditing(null); }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Input label="Product Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input label="Barcode" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
            <Input label="Brand" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
            <Input label="Emoji Icon" value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} />
            <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Supplier" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}>
              <option value="">Select supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input label="Cost Price (SOS)" type="number" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} />
            <Input label="Selling Price (SOS) *" type="number" value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: e.target.value })} />
            <Input label="Quantity" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            <Input label="Reorder Level" type="number" value={form.reorderLevel} onChange={e => setForm({ ...form, reorderLevel: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn onClick={() => { setShowForm(false); setEditing(null); }} color="#888" variant="outline">Cancel</Btn>
            <Btn onClick={save}>{editing ? "Update" : "Add Product"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PURCHASES ───────────────────────────────────────────────────────────────
function Purchases({ notify, darkMode }) {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ supplier: "", product: "", quantity: "", unitCost: "", date: new Date().toISOString().split("T")[0], notes: "" });

  useEffect(() => {
    const u1 = FDB.subscribe("purchases", setPurchases);
    const u2 = FDB.subscribe("products", setProducts);
    const u3 = FDB.subscribe("suppliers", setSuppliers);
    return () => { u1(); u2(); u3(); };
  }, []);

  const save = async () => {
    if (!form.supplier || !form.product || !form.quantity || !form.unitCost) { notify("All fields required", "error"); return; }
    const p = products.find(x => x.id === form.product);
    const purchase = {
      id: genId(), purchaseNo: "PO-" + Date.now().toString().slice(-6),
      supplier: suppliers.find(s => s.id === form.supplier)?.name || "", supplierId: form.supplier,
      product: p?.name || "", productId: form.product,
      quantity: +form.quantity, unitCost: +form.unitCost, totalCost: (+form.quantity) * (+form.unitCost),
      date: form.date, notes: form.notes,
    };
    await FDB.set("purchases", [...purchases, purchase]);
    const prods = products.map(x => x.id === form.product ? { ...x, quantity: x.quantity + (+form.quantity) } : x);
    await FDB.set("products", prods);
    notify("Purchase recorded. Stock updated ✓");
    setShowForm(false);
    setForm({ supplier: "", product: "", quantity: "", unitCost: "", date: new Date().toISOString().split("T")[0], notes: "" });
  };

  const totalSpent = purchases.reduce((a, p) => a + p.totalCost, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "TOTAL PURCHASES", value: purchases.length },
          { label: "TOTAL SPENT", value: `SOS ${fmt(totalSpent)}`, color: "#ef4444" },
          { label: "THIS MONTH", value: `SOS ${fmt(purchases.filter(p => p.date?.startsWith(new Date().toISOString().slice(0, 7))).reduce((a, p) => a + p.totalCost, 0))}` },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8eaf0", padding: 20 }}>
            <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: color || "#1a1d2e" }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Btn onClick={() => setShowForm(true)}>+ New Purchase</Btn>
      </div>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8eaf0", overflow: "hidden" }}>
        <Table headers={["PO#", "Supplier", "Product", "Qty", "Unit Cost", "Total", "Date"]} rows={purchases.map(p => [
          <span style={{ fontSize: 12, fontWeight: 600, color: "#4f8cff" }}>{p.purchaseNo}</span>,
          p.supplier, p.product, p.quantity, `SOS ${fmt(p.unitCost)}`,
          <span style={{ fontWeight: 600, color: "#ef4444" }}>SOS {fmt(p.totalCost)}</span>, p.date,
        ])} />
      </div>
      {showForm && (
        <Modal title="Record Purchase" onClose={() => setShowForm(false)}>
          <Select label="Supplier *" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}>
            <option value="">Select supplier</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select label="Product *" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })}>
            <option value="">Select product</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input label="Quantity *" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            <Input label="Unit Cost (SOS) *" type="number" value={form.unitCost} onChange={e => setForm({ ...form, unitCost: e.target.value })} />
          </div>
          <Input label="Purchase Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          {form.quantity && form.unitCost && <div style={{ background: "#f0f8ff", borderRadius: 8, padding: "12px 16px", marginBottom: 14, fontSize: 14 }}>Total Cost: <strong>SOS {fmt((+form.quantity) * (+form.unitCost))}</strong></div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn onClick={() => setShowForm(false)} color="#888" variant="outline">Cancel</Btn>
            <Btn onClick={save}>Record Purchase</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── EXPENSES ────────────────────────────────────────────────────────────────
function Expenses({ notify, darkMode }) {
  const [expenses, setExpenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", amount: "", date: new Date().toISOString().split("T")[0], notes: "" });
  const cats = ["Rent", "Salaries", "Electricity", "Water", "Internet", "Transport", "Miscellaneous"];
  const colors = { Rent: "#4f8cff", Salaries: "#a259f7", Electricity: "#f59e0b", Water: "#06b6d4", Internet: "#22c55e", Transport: "#f97316", Miscellaneous: "#888" };

  useEffect(() => { return FDB.subscribe("expenses", setExpenses); }, []);

  const save = async () => {
    if (!form.name || !form.amount) { notify("Name and amount required", "error"); return; }
    await FDB.set("expenses", [...expenses, { ...form, amount: +form.amount, id: genId() }]);
    notify("Expense recorded ✓"); setShowForm(false);
    setForm({ name: "", category: "", amount: "", date: new Date().toISOString().split("T")[0], notes: "" });
  };

  const del = async (id) => {
    if (!confirm("Delete this expense?")) return;
    await FDB.set("expenses", expenses.filter(e => e.id !== id));
    notify("Expense deleted");
  };

  const totalExpenses = expenses.reduce((a, e) => a + e.amount, 0);
  const byCategory = cats.map(cat => ({ cat, total: expenses.filter(e => e.category === cat).reduce((a, e) => a + e.amount, 0) }));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
        {byCategory.filter(c => c.total > 0).map(c => (
          <div key={c.cat} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8eaf0", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: colors[c.cat] || "#888", fontWeight: 700 }}>{c.cat.toUpperCase()}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>SOS {fmt(c.total)}</div>
          </div>
        ))}
        <div style={{ background: "#fff3f3", borderRadius: 12, border: "1px solid #fcc", padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>TOTAL EXPENSES</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: "#ef4444" }}>SOS {fmt(totalExpenses)}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Btn onClick={() => setShowForm(true)}>+ Add Expense</Btn>
      </div>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8eaf0", overflow: "hidden" }}>
        <Table headers={["Name", "Category", "Amount", "Date", "Notes", "Actions"]} rows={[...expenses].reverse().map(e => [
          <span style={{ fontWeight: 600, fontSize: 13 }}>{e.name}</span>,
          <Badge label={e.category || "—"} color={colors[e.category] || "#888"} />,
          <span style={{ fontWeight: 600, color: "#ef4444" }}>SOS {fmt(e.amount)}</span>,
          e.date, <span style={{ fontSize: 12, color: "#888" }}>{e.notes || "—"}</span>,
          <Btn size="sm" color="#ef4444" onClick={() => del(e.id)}>Del</Btn>,
        ])} />
      </div>
      {showForm && (
        <Modal title="Add Expense" onClose={() => setShowForm(false)}>
          <Input label="Expense Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            <option value="">Select category</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input label="Amount (SOS) *" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <Input label="Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", resize: "vertical", minHeight: 70 }} />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn onClick={() => setShowForm(false)} color="#888" variant="outline">Cancel</Btn>
            <Btn onClick={save}>Add Expense</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────
function Customers({ notify, darkMode }) {
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", balance: "0", notes: "" });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const u1 = FDB.subscribe("customers", setCustomers);
    const u2 = FDB.subscribe("sales", setSales);
    return () => { u1(); u2(); };
  }, []);

  const save = async () => {
    if (!form.name) { notify("Name required", "error"); return; }
    const c = { ...form, balance: +form.balance };
    let updated;
    if (editing) { updated = customers.map(x => x.id === editing ? { ...x, ...c } : x); notify("Customer updated ✓"); }
    else { updated = [...customers, { ...c, id: genId() }]; notify("Customer added ✓"); }
    await FDB.set("customers", updated);
    setShowForm(false); setEditing(null);
  };

  const del = async (id) => {
    if (!confirm("Delete this customer?")) return;
    await FDB.set("customers", customers.filter(c => c.id !== id));
    notify("Customer deleted");
  };

  const customerSales = selected ? sales.filter(s => s.customerId === selected.id) : [];
  const totalSpent = customerSales.reduce((a, s) => a + s.total, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8eaf0", padding: 20 }}>
          <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>TOTAL CUSTOMERS</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{customers.length}</div>
        </div>
        <div style={{ background: "#fff8e1", borderRadius: 14, border: "1px solid #ffd", padding: 20 }}>
          <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>OUTSTANDING DEBTS</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: "#f59e0b" }}>SOS {fmt(customers.filter(c => c.balance < 0).reduce((a, c) => a + Math.abs(c.balance), 0))}</div>
        </div>
        <div style={{ background: "#f0fff4", borderRadius: 14, border: "1px solid #d1fae5", padding: 20 }}>
          <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>CUSTOMER CREDITS</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: "#22c55e" }}>SOS {fmt(customers.filter(c => c.balance > 0).reduce((a, c) => a + c.balance, 0))}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Btn onClick={() => { setShowForm(true); setEditing(null); }}>+ Add Customer</Btn>
      </div>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8eaf0", overflow: "hidden" }}>
        <Table headers={["Name", "Phone", "Address", "Balance", "Actions"]} rows={customers.map(c => [
          <button onClick={() => setSelected(c)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#4f8cff", textDecoration: "underline" }}>{c.name}</button>,
          c.phone, c.address,
          <span style={{ fontWeight: 600, color: c.balance < 0 ? "#ef4444" : c.balance > 0 ? "#22c55e" : "#888" }}>
            {c.balance < 0 ? `-SOS ${fmt(Math.abs(c.balance))}` : c.balance > 0 ? `+SOS ${fmt(c.balance)}` : "—"}
          </span>,
          <div style={{ display: "flex", gap: 6 }}>
            <Btn size="sm" onClick={() => { setForm({ ...c, balance: String(c.balance) }); setEditing(c.id); setShowForm(true); }}>Edit</Btn>
            <Btn size="sm" color="#ef4444" onClick={() => del(c.id)}>Del</Btn>
          </div>
        ])} />
      </div>
      {selected && (
        <Modal title={`${selected.name} — Transaction History`} onClose={() => setSelected(null)} width={600}>
          <div style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[{ label: "TOTAL TRANSACTIONS", value: customerSales.length }, { label: "TOTAL SPENT", value: `SOS ${fmt(totalSpent)}`, color: "#22c55e" }, { label: "BALANCE", value: `SOS ${fmt(Math.abs(selected.balance))}`, color: selected.balance < 0 ? "#ef4444" : "#22c55e" }].map(({ label, value, color }) => (
              <div key={label} style={{ background: "#f8f9fc", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, color: "#888" }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: color || "#1a1d2e" }}>{value}</div>
              </div>
            ))}
          </div>
          <Table headers={["Date", "Items", "Total", "Payment"]} rows={customerSales.map(s => [
            new Date(s.date).toLocaleDateString(), s.items.length, `SOS ${fmt(s.total)}`, <Badge label={s.paymentMethod} color="#4f8cff" />
          ])} />
        </Modal>
      )}
      {showForm && (
        <Modal title={editing ? "Edit Customer" : "Add Customer"} onClose={() => { setShowForm(false); setEditing(null); }}>
          <Input label="Customer Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input label="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input label="Balance (SOS)" type="number" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} />
          </div>
          <Input label="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", resize: "vertical", minHeight: 60 }} />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn onClick={() => { setShowForm(false); setEditing(null); }} color="#888" variant="outline">Cancel</Btn>
            <Btn onClick={save}>{editing ? "Update" : "Add Customer"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── SUPPLIERS ───────────────────────────────────────────────────────────────
function Suppliers({ notify, darkMode }) {
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", products: "", balance: "0" });

  useEffect(() => { return FDB.subscribe("suppliers", setSuppliers); }, []);

  const save = async () => {
    if (!form.name) { notify("Name required", "error"); return; }
    const s = { ...form, balance: +form.balance };
    let updated;
    if (editing) { updated = suppliers.map(x => x.id === editing ? { ...x, ...s } : x); notify("Supplier updated ✓"); }
    else { updated = [...suppliers, { ...s, id: genId() }]; notify("Supplier added ✓"); }
    await FDB.set("suppliers", updated);
    setShowForm(false); setEditing(null);
  };

  const del = async (id) => {
    if (!confirm("Delete this supplier?")) return;
    await FDB.set("suppliers", suppliers.filter(s => s.id !== id));
    notify("Supplier deleted");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: "#888" }}>Managing {suppliers.length} suppliers</div>
        <Btn onClick={() => { setShowForm(true); setEditing(null); }}>+ Add Supplier</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
        {suppliers.map(s => (
          <div key={s.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8eaf0", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#4f8cff22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏭</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{s.phone}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn size="sm" onClick={() => { setForm({ ...s, balance: String(s.balance) }); setEditing(s.id); setShowForm(true); }}>Edit</Btn>
                <Btn size="sm" color="#ef4444" onClick={() => del(s.id)}>Del</Btn>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>📍 {s.address}</div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>📦 {s.products}</div>
            {s.balance > 0 && <div style={{ background: "#fff3f3", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>Outstanding Balance: <strong style={{ color: "#ef4444" }}>SOS {fmt(s.balance)}</strong></div>}
          </div>
        ))}
      </div>
      {showForm && (
        <Modal title={editing ? "Edit Supplier" : "Add Supplier"} onClose={() => { setShowForm(false); setEditing(null); }}>
          <Input label="Supplier Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input label="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input label="Outstanding Balance" type="number" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} />
          </div>
          <Input label="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <Input label="Products Supplied" value={form.products} onChange={e => setForm({ ...form, products: e.target.value })} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn onClick={() => { setShowForm(false); setEditing(null); }} color="#888" variant="outline">Cancel</Btn>
            <Btn onClick={save}>{editing ? "Update" : "Add Supplier"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────
function Reports({ darkMode }) {
  const [period, setPeriod] = useState("month");
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);

  useEffect(() => {
    const u1 = FDB.subscribe("sales", setSales);
    const u2 = FDB.subscribe("expenses", setExpenses);
    const u3 = FDB.subscribe("products", setProducts);
    const u4 = FDB.subscribe("purchases", setPurchases);
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const now2 = new Date();
  const filterSales = sales.filter(s => {
    const d = new Date(s.date);
    if (period === "today") return s.date?.startsWith(now2.toISOString().split("T")[0]);
    if (period === "week") { const wk = new Date(now2); wk.setDate(wk.getDate() - 7); return d >= wk; }
    if (period === "month") return s.date?.startsWith(now2.toISOString().slice(0, 7));
    if (period === "year") return s.date?.startsWith(String(now2.getFullYear()));
    return true;
  });
  const filterExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    if (period === "today") return e.date?.startsWith(now2.toISOString().split("T")[0]);
    if (period === "week") { const wk = new Date(now2); wk.setDate(wk.getDate() - 7); return d >= wk; }
    if (period === "month") return e.date?.startsWith(now2.toISOString().slice(0, 7));
    if (period === "year") return e.date?.startsWith(String(now2.getFullYear()));
    return true;
  });

  const revenue = filterSales.reduce((a, s) => a + s.total, 0);
  const cogs = filterSales.reduce((a, s) => a + s.items.reduce((b, i) => b + (i.costPrice || 0) * i.qty, 0), 0);
  const grossProfit = revenue - cogs;
  const totalExpenses = filterExpenses.reduce((a, e) => a + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;
  const grossMargin = revenue > 0 ? (grossProfit / revenue * 100).toFixed(1) : 0;
  const stockValue = products.reduce((a, p) => a + p.quantity * p.costPrice, 0);
  const stockRetailValue = products.reduce((a, p) => a + p.quantity * p.sellingPrice, 0);
  const periodLabel = { today: "Today", week: "This Week", month: "This Month", year: "This Year" }[period];
  const cardS = { background: darkMode ? "#1a1d2e" : "#fff", border: `1px solid ${darkMode ? "#262b40" : "#e8eaf0"}`, borderRadius: 14, padding: 20 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["today", "week", "month", "year"].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: period === p ? "#4f8cff" : "transparent", color: period === p ? "#fff" : "#888", border: `1px solid ${period === p ? "#4f8cff" : "#e0e0e0"}` }}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ ...cardS, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>📊 Profit & Loss — {periodLabel}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          {[
            { label: "Revenue", value: revenue, color: "#4f8cff" },
            { label: "Cost of Goods", value: cogs, color: "#888" },
            { label: "Gross Profit", value: grossProfit, color: "#22c55e" },
            { label: "Expenses", value: totalExpenses, color: "#ef4444" },
            { label: "Net Profit", value: netProfit, color: netProfit >= 0 ? "#22c55e" : "#ef4444" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#f8f9fc", borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${color}` }}>
              <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>{label.toUpperCase()}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6, color }}>{value < 0 ? "-" : ""}SOS {fmt(Math.abs(value))}</div>
            </div>
          ))}
          <div style={{ background: "#f8f9fc", borderRadius: 10, padding: "14px 16px", borderLeft: "3px solid #a259f7" }}>
            <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>GROSS MARGIN</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6, color: "#a259f7" }}>{grossMargin}%</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={cardS}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Sales by Payment Method</div>
          {["Cash", "ZAAD", "eDahab", "Bank Transfer"].map(m => {
            const total = filterSales.filter(s => s.paymentMethod === m).reduce((a, s) => a + s.total, 0);
            const pct = revenue > 0 ? (total / revenue * 100).toFixed(0) : 0;
            return (
              <div key={m} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{m}</span>
                  <span style={{ color: "#888" }}>SOS {fmt(total)} ({pct}%)</span>
                </div>
                <div style={{ background: "#f0f1f5", borderRadius: 20, height: 8 }}>
                  <div style={{ width: `${pct}%`, height: 8, background: "#4f8cff", borderRadius: 20 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={cardS}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Inventory Summary</div>
          {[
            { label: "TOTAL PRODUCTS", value: products.length },
            { label: "STOCK VALUE (COST)", value: `SOS ${fmt(stockValue)}` },
            { label: "STOCK VALUE (RETAIL)", value: `SOS ${fmt(stockRetailValue)}`, color: "#22c55e" },
            { label: "LOW STOCK ITEMS", value: products.filter(p => p.quantity <= p.reorderLevel).length, color: "#ef4444" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: color || "#1a1d2e" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={cardS}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Sales Transactions — {periodLabel}</div>
        <Table headers={["Date", "Customer", "Items", "Total", "Payment", "Profit"]} rows={[...filterSales].reverse().map(s => {
          const cost = s.items.reduce((a, i) => a + (i.costPrice || 0) * i.qty, 0);
          const profit = s.total - cost;
          return [
            new Date(s.date).toLocaleDateString(), s.customer || "Walk-in", s.items.length,
            `SOS ${fmt(s.total)}`, <Badge label={s.paymentMethod} color="#4f8cff" />,
            <span style={{ fontWeight: 600, color: profit >= 0 ? "#22c55e" : "#ef4444" }}>SOS {fmt(profit)}</span>
          ];
        })} />
      </div>
    </div>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
function Settings({ notify, darkMode, currentUser, onUserUpdate }) {
  const [settings, setSettings] = useState({
    shopName: "Daray Shop", phone: "063-XXXXXXX", address: "Burao, Togdheer, Somalia",
    currency: "SOS", taxRate: "0", zaadNumber: "", edahabNumber: "", evcNumber: "",
    receiptFooter: "Thank you for your business!",
  });
  const [users, setUsers] = useState([]);
  const [pwForms, setPwForms] = useState({});   // { userId: { current, newPw, confirm } }
  const [showPwForm, setShowPwForm] = useState(null); // userId
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    FDB.get("settings", settings).then(s => { if (s) setSettings(s); });
    FDB.subscribe("users", setUsers);
  }, []);

  const saveSettings = async () => {
    await FDB.set("settings", settings);
    notify("Settings saved ✓");
  };

  const resetData = async () => {
    if (!confirm("This will delete ALL data. Are you sure?")) return;
    const keys = ["categories", "suppliers", "products", "customers", "sales", "expenses", "purchases", "settings", "users", "seeded"];
    await Promise.all(keys.map(k => FDB.set(k, null)));
    notify("All data cleared. Refresh the page.");
  };

  const openPwForm = (userId) => {
    setPwForms(f => ({ ...f, [userId]: { current: "", newPw: "", confirm: "" } }));
    setShowPwForm(userId);
    setPwError("");
  };

  const changePassword = async (userId) => {
    const f = pwForms[userId];
    const user = users.find(u => u.id === userId);
    if (!user) return;

    // Admins can change anyone's password without needing the current one
    // Regular users must provide their current password
    if (currentUser.role !== "admin" || currentUser.id === userId) {
      if (f.current !== user.password) { setPwError("Current password is incorrect"); return; }
    }
    if (f.newPw.length < 4) { setPwError("New password must be at least 4 characters"); return; }
    if (f.newPw !== f.confirm) { setPwError("Passwords do not match"); return; }

    const updated = users.map(u => u.id === userId ? { ...u, password: f.newPw } : u);
    await FDB.set("users", updated);

    // If changing own password, update session
    if (currentUser.id === userId) {
      onUserUpdate({ ...currentUser, password: f.newPw });
    }

    setShowPwForm(null);
    setPwError("");
    notify("Password changed successfully ✓");
  };

  const s = { section: { background: "#fff", borderRadius: 14, border: "1px solid #e8eaf0", padding: 24, marginBottom: 20 } };

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={s.section}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>🏪 Shop Information</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
          <Input label="Shop Name" value={settings.shopName} onChange={e => setSettings({ ...settings, shopName: e.target.value })} />
          <Input label="Phone Number" value={settings.phone} onChange={e => setSettings({ ...settings, phone: e.target.value })} />
        </div>
        <Input label="Address" value={settings.address} onChange={e => setSettings({ ...settings, address: e.target.value })} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
          <Select label="Currency" value={settings.currency} onChange={e => setSettings({ ...settings, currency: e.target.value })}>
            <option value="SOS">SOS — Somali Shilling</option>
            <option value="USD">USD — US Dollar</option>
          </Select>
          <Input label="Tax Rate (%)" type="number" value={settings.taxRate} onChange={e => setSettings({ ...settings, taxRate: e.target.value })} />
        </div>
      </div>

      <div style={s.section}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>📱 Mobile Money Accounts</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
          <Input label="ZAAD Number" value={settings.zaadNumber} onChange={e => setSettings({ ...settings, zaadNumber: e.target.value })} placeholder="063-XXXXXXX" />
          <Input label="eDahab Number" value={settings.edahabNumber} onChange={e => setSettings({ ...settings, edahabNumber: e.target.value })} placeholder="061-XXXXXXX" />
        </div>
        <Input label="EVC Plus Number" value={settings.evcNumber} onChange={e => setSettings({ ...settings, evcNumber: e.target.value })} placeholder="061-XXXXXXX" />
      </div>

      <div style={s.section}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>🧾 Receipt Settings</div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5 }}>Receipt Footer Text</label>
          <textarea value={settings.receiptFooter} onChange={e => setSettings({ ...settings, receiptFooter: e.target.value })}
            style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", resize: "vertical", minHeight: 70 }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <Btn onClick={saveSettings} style={{ flex: 1 }}>💾 Save Settings</Btn>
      </div>

      {/* ── PASSWORD MANAGEMENT ── */}
      <div style={s.section}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>🔐 User Accounts & Passwords</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
          {currentUser.role === "admin" ? "As admin, you can change any user's password." : "You can change your own password below."}
        </div>

        {users.filter(u => currentUser.role === "admin" || u.id === currentUser.id).map(u => (
          <div key={u.id} style={{ marginBottom: 16, background: "#f8f9fc", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showPwForm === u.id ? 16 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 22 }}>{u.role === "admin" ? "👑" : "💰"}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{u.username} · {u.role}{u.id === currentUser.id ? " (you)" : ""}</div>
                </div>
              </div>
              {showPwForm !== u.id && (
                <Btn size="sm" onClick={() => openPwForm(u.id)}>🔑 Change Password</Btn>
              )}
            </div>

            {showPwForm === u.id && (
              <div>
                {pwError && <div style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#ef4444" }}>{pwError}</div>}

                {/* Only ask for current password if not admin changing someone else's */}
                {(currentUser.role !== "admin" || currentUser.id === u.id) && (
                  <Input label="Current Password" type="password"
                    value={pwForms[u.id]?.current || ""}
                    onChange={e => { setPwForms(f => ({ ...f, [u.id]: { ...f[u.id], current: e.target.value } })); setPwError(""); }}
                    placeholder="Enter current password" />
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Input label="New Password" type="password"
                    value={pwForms[u.id]?.newPw || ""}
                    onChange={e => { setPwForms(f => ({ ...f, [u.id]: { ...f[u.id], newPw: e.target.value } })); setPwError(""); }}
                    placeholder="Min. 4 characters" />
                  <Input label="Confirm Password" type="password"
                    value={pwForms[u.id]?.confirm || ""}
                    onChange={e => { setPwForms(f => ({ ...f, [u.id]: { ...f[u.id], confirm: e.target.value } })); setPwError(""); }}
                    placeholder="Re-enter new password" />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <Btn onClick={() => changePassword(u.id)}>✓ Save Password</Btn>
                  <Btn onClick={() => { setShowPwForm(null); setPwError(""); }} color="#888" variant="outline">Cancel</Btn>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ ...s.section, border: "1px solid #fcc" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12, color: "#ef4444" }}>⚠️ Danger Zone</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 14 }}>These actions cannot be undone. Be careful!</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Btn onClick={resetData} color="#ef4444">🗑️ Reset All Data</Btn>
        </div>
      </div>
    </div>
  );
}
