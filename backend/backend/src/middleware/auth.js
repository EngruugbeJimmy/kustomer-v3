const jwt  = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    // 1. Extract token — support "Bearer TOKEN" format only
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const token = header.split(" ")[1];
    if (!token || token === "undefined" || token === "null") {
      return res.status(401).json({ error: "Invalid token format" });
    }

    // 2. Verify token — checks signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    } catch (err) {
      if (err.name === "TokenExpiredError") return res.status(401).json({ error: "Session expired. Please log in again." });
      if (err.name === "JsonWebTokenError")  return res.status(401).json({ error: "Invalid session. Please log in again." });
      return res.status(401).json({ error: "Authentication failed" });
    }

    // 3. Load user — exclude sensitive fields
    const user = await User.findById(decoded.id)
      .select("-password -youtubeAccessToken -youtubeRefreshToken");
    if (!user) return res.status(401).json({ error: "Account not found" });

    // 4. Attach user to request
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    res.status(500).json({ error: "Authentication error" });
  }
};
