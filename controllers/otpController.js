const db = require("../db");
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

    // Check resend limit
    const [recent] = await db
      .promise()
      .query(
        "SELECT COUNT(*) AS count FROM verify WHERE username = ? AND time >= NOW() - INTERVAL 5 MINUTE",
        [phone]
      );
    if (recent[0].count > 0) {
      return res.status(429).json({
        success: false,
        message: "OTP already sent. Try again later.",
      });
    }

    const otp = Math.floor(Math.random() * 10000 + 50000);

    await db
      .promise()
      .query("INSERT INTO verify (username, otp) VALUES (?, ?)", [phone, otp]);

    const [apiRow] = await db
      .promise()
      .query("SELECT api FROM otp WHERE id = 1");
    const apiKey = apiRow[0]?.api;
    if (!apiKey)
      return res
        .status(500)
        .json({ success: false, message: "SMS API key not found" });

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

    const [match] = await db
      .promise()
      .query(
        "SELECT * FROM verify WHERE username = ? AND otp = ? AND time >= NOW() - INTERVAL 10 MINUTE ORDER BY time DESC LIMIT 1",
        [phone, otp]
      );

    if (match.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    const [existing] = await db
      .promise()
      .query("SELECT * FROM users WHERE email = ?", [phone]);
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newReferralCode = generateReferralCode();

    const insertUser = async (referredById = null) => {
      await db.promise().query(
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

    if (referralCode) {
      const [referrer] = await db
        .promise()
        .query("SELECT id FROM users WHERE referral_code = ?", [referralCode]);

      if (referrer.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid referral code" });
      }

      return await insertUser(referrer[0].id);
    }

    await insertUser();
  } catch (err) {
    console.error("OTP Verify Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
