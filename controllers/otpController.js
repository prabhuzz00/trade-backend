const db = require("../db"); // your MySQL connection
const axios = require("axios");
const bcrypt = require("bcrypt");

exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^\+91\d{10}$/.test(phone)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid phone number" });
    }

    // Check rate limit: prevent resend within 5 minutes
    const [recent] = await db.query(
      "SELECT COUNT(*) AS count FROM verify WHERE username = ? AND time >= NOW() - INTERVAL 5 MINUTE",
      [phone]
    );
    if (recent[0].count > 0) {
      return res.status(429).json({
        success: false,
        message: "OTP already sent. Try again later.",
      });
    }

    // Generate OTP
    const otp = Math.floor(Math.random() * 10000 + 50000);

    // Save to DB
    await db.query("INSERT INTO verify (username, otp) VALUES (?, ?)", [
      phone,
      otp,
    ]);

    // Fetch API key from DB
    const [apiRow] = await db.query("SELECT api FROM otp WHERE id = 1");
    const apiKey = apiRow[0]?.api;
    if (!apiKey)
      return res
        .status(500)
        .json({ success: false, message: "SMS API key not found" });

    // Send SMS
    const payload = {
      sender_id: "15018",
      variables_values: `${otp}`,
      route: "otp",
      numbers: phone.replace("+91", ""),
    };

    const response = await axios.post(
      "https://ninzasms.in.net/auth/send_sms",
      payload,
      {
        headers: {
          authorization: apiKey,
          "content-type": "application/json",
        },
      }
    );

    return res.json({
      success: true,
      message: "OTP sent",
      response: response.data,
    });
  } catch (err) {
    console.error("OTP Send Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

function generateReferralCode() {
  return "REF" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp, name, password, referralCode } = req.body;

    if (!phone || !otp || !name || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Missing fields" });
    }

    // Check OTP
    const [match] = await db.query(
      "SELECT * FROM verify WHERE username = ? AND otp = ? AND time >= NOW() - INTERVAL 10 MINUTE ORDER BY time DESC LIMIT 1",
      [phone, otp]
    );

    if (match.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Check for existing user
    const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [
      phone,
    ]);
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "User already exists" });
    }

    // Prepare new user data
    const hashedPassword = await bcrypt.hash(password, 10);
    const newReferralCode = generateReferralCode();

    const insertUser = async (referredById = null) => {
      await db.query(
        `INSERT INTO users 
         (email, password, name, referral_code, referred_by, balance, bonus, is_recharge, created_at)
         VALUES (?, ?, ?, ?, ?, 0, 0, 0, NOW())`,
        [phone, hashedPassword, name, newReferralCode, referredById]
      );
      return res.json({
        success: true,
        message: "User registered successfully",
      });
    };

    // Handle referral code if provided
    if (referralCode) {
      const [referrer] = await db.query(
        "SELECT id FROM users WHERE referral_code = ?",
        [referralCode]
      );

      if (referrer.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid referral code" });
      }

      return await insertUser(referrer[0].id);
    }

    // No referral
    await insertUser();
  } catch (err) {
    console.error("OTP Verify Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
