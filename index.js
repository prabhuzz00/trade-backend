const express = require("express");
const cors = require("cors");
const session = require("express-session");
const cookieParser = require("cookie-parser");

const gameRoutes = require("./routes/gameRoutes");
const userRoutes = require("./routes/userRoutes");
const betRoutes = require("./routes/betRoutes");
const rechargeRoutes = require("./routes/rechargeRoutes");
const withdrawRoutes = require("./routes/withdrawRoutes");
const adminRoutes = require("./routes/adminRoutes");
const supportRoutes = require("./routes/supportRoutes");

const app = express();
const PORT = 8000;

const allowedOrigins = [
  // "http://localhost:5173",
  // "http://localhost:5174",
  // "http://192.168.1.40:5173",
  "https://bullvibe.co.in", // ✅ Client site
  "https://www.bullvibe.co.in",
  "https://admin.bullvibe.co.in",
  "https://cashier.rupeerush.vip",
  " https://139.180.137.164",
  " http://139.180.137.164",
  " 139.180.137.164",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🟢 User session (default for all except /admin)
const userSession = session({
  name: "user.sid",
  secret: "user-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: "/api",
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  },
});

// 🔴 Admin session (applied only to /api/admin routes)
const adminSession = session({
  name: "admin.sid", // <- THIS must take effect
  secret: "admin-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: "/api/admin", // restrict it to only admin path
    httpOnly: true,
    sameSite: "lax",
    secure: false,
  },
});

// Mount admin routes with separate session
app.use("/api/admin", adminSession, adminRoutes);

// Mount user routes with user session
app.use(userSession);
app.use("/api", gameRoutes);
app.use("/api", userRoutes);
app.use("/api", betRoutes);
app.use("/api", rechargeRoutes);
app.use("/api", withdrawRoutes);
app.use("/api", supportRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
