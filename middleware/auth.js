const jwt = require("jsonwebtoken");

// Replace with your actual secret key (same used in login)
const JWT_SECRET = process.env.JWT_SECRET || "PrabhuXCode";

const authenticateUser = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized: No token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // decoded should contain at least user.id
    next();
  } catch (err) {
    return res
      .status(403)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

module.exports = authenticateUser;
