const crypto = require("crypto");
const axios = require("axios");
const db = require("../db");

//lgpay
exports.initiateRecharge = async (req, res) => {
  const user = req.user;
  const { amount } = req.body;

  if (!user || !amount || isNaN(amount) || amount < 1) {
    return res
      .status(400)
      .json({ success: false, message: "Missing or invalid fields" });
  }

  // 🔧 Generate 19-digit numeric LGPay-style order ID
  const generateOrderId = () => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    const timePart =
      now.getFullYear().toString() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds());

    const randomPart = Math.floor(10000000 + Math.random() * 90000000); // 8-digit random
    return timePart + randomPart;
  };

  const order_sn = generateOrderId();

  const app_id = "YD4141";
  const secret_key = "XQnjoIu2B8soZbndtmKg9tsVKQwiboVY";
  const trade_type = "INRUPI";
  const notify_url = "https://api.bullvibe.co.in/api/recharge/callback";
  const return_url = "https://bullvibe.co.in/recharge-history";
  const ip = "139.180.137.164";
  const remark = "inr888";
  const money = parseInt(amount * 100); // LGPay uses paise-style units

  // ✅ Insert into recharge_requests as unpaid
  db.query(
    "INSERT INTO recharge_requests (user_id, amount, gateway_txn_id, status, created_at, username) VALUES (?, ?, ?, 'unpaid', NOW(), ?)",
    [user.id, amount, order_sn, user.name],
    async (err) => {
      if (err) {
        console.error("DB insert error:", err);
        return res
          .status(500)
          .json({ success: false, message: "Database error" });
      }

      // Prepare parameters
      const params = {
        app_id,
        trade_type,
        order_sn,
        money,
        notify_url,
        return_url,
        ip,
        remark,
      };

      // Sign string
      const signString =
        Object.keys(params)
          .sort()
          .map((k) => `${k}=${params[k]}`)
          .join("&") + `&key=${secret_key}`;
      const sign = crypto
        .createHash("md5")
        .update(signString)
        .digest("hex")
        .toUpperCase();

      params.sign = sign;

      try {
        const encodedData = new URLSearchParams(params).toString();

        const { data } = await axios.post(
          "https://www.lg-pay.com/api/order/create",
          encodedData,
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        if (data?.status === 1 && data?.data?.pay_url) {
          return res.json({ success: true, url: data.data.pay_url });
        } else {
          console.error("LGPay error response:", data);
          return res
            .status(400)
            .json({ success: false, message: data.msg || "Gateway rejected" });
        }
      } catch (err2) {
        console.error(
          "LGPay axios error:",
          err2?.response?.data || err2.message
        );
        return res
          .status(500)
          .json({ success: false, message: "LGPay API error" });
      }
    }
  );
};

exports.handlePaymentCallback = (req, res) => {
  const { mch_id, order_sn, order_amount, order_no, sign } = req.body;

  const secret_key = "XQnjoIu2B8soZbndtmKg9tsVKQwiboVY";

  if (!order_sn || !order_amount || !order_no || !sign) {
    return res.status(400).send("Missing fields");
  }

  const signParams = {
    mch_id,
    order_sn,
    order_amount,
    order_no,
  };

  const signString =
    Object.keys(signParams)
      .filter((key) => signParams[key])
      .sort()
      .map((k) => `${k}=${signParams[k]}`)
      .join("&") + `&key=${secret_key}`;

  const expectedSign = crypto
    .createHash("md5")
    .update(signString)
    .digest("hex")
    .toUpperCase();

  if (expectedSign !== sign) {
    return res.status(403).send("Invalid signature");
  }

  // Extract userId from order_sn like: ORDER165432123456UID10
  const userId = parseInt(order_sn.split("UID")[1]);
  if (!userId || isNaN(userId)) {
    return res.status(400).send("Invalid user ID");
  }

  const amount = parseFloat(order_amount) / 100;

  // Prevent duplicate
  db.query(
    "SELECT id FROM recharge_requests WHERE gateway_txn_id = ?",
    [order_sn],
    (err, results) => {
      if (err) return res.status(500).send("DB error");
      if (results.length > 0) return res.send("success"); // Already processed

      db.query(
        "INSERT INTO recharge_requests (user_id, amount, gateway_txn_id, status) VALUES (?, ?, ?, 'success')",
        [userId, amount, order_sn],
        (err2) => {
          if (err2) {
            console.error("Insert error:", err2);
            return res.status(500).send("DB error");
          }

          db.query(
            "UPDATE users SET balance = balance + ? WHERE id = ?",
            [amount, userId],
            () => res.send("success")
          );
        }
      );
    }
  );
};

//hefupay
// exports.initiateRecharge = async (req, res) => {
//   const user = req.user;
//   const { amount, phone } = req.body;

//   const payload = {
//     mch_id: "84423629",
//     mch_order_no: `ORDER${Date.now()}UID${user.id}`,
//     notifyUrl: "https://api.bullvibe.co.in/api/recharge/callback",
//     page_url: "https://bullvibe.co.in/recharge-history",
//     trade_amount: parseInt(amount),
//     currency: "INR",
//     pay_type: "INDIA_UPI",
//     payer_phone: phone,
//     attach: "recharge",
//   };

//   const privateKey = "762a827b2515e4463ba01945711c8532";

//   const signStr =
//     Object.keys(payload)
//       .sort()
//       .map((k) => `${k}=${payload[k]}`)
//       .join("&") + `&key=${privateKey}`;

//   const sign = crypto.createHash("md5").update(signStr).digest("hex");

//   const finalPayload = {
//     ...payload,
//     sign,
//     sign_type: "MD5",
//   };

//   try {
//     const { data } = await axios.post(
//       "https://xyu10.top/api/payGate/payCollect",
//       new URLSearchParams(finalPayload).toString(),
//       {
//         headers: { "Content-Type": "application/x-www-form-urlencoded" },
//       }
//     );

//     if (data.code === 0 && data.data?.url) {
//       // ✅ Return payment link to frontend
//       return res.json({ success: true, url: data.data.url });
//     } else {
//       return res
//         .status(400)
//         .json({ success: false, message: data.msg || "Gateway rejected" });
//     }
//   } catch (err) {
//     console.error("Gateway error", err.response?.data || err.message);
//     return res
//       .status(500)
//       .json({ success: false, message: "Payment gateway error" });
//   }
// };

// exports.handlePaymentCallback = (req, res) => {
//   const {
//     mch_id,
//     mch_order_no,
//     trade_amount,
//     currency,
//     pay_type,
//     attach,
//     sign,
//     sign_type = "MD5",
//   } = req.body;
//   console.log("📩 Callback received:", req.body);

//   if (!mch_order_no || !trade_amount || !sign) {
//     return res.status(400).send("Missing required fields");
//   }

//   const userId = parseInt(mch_order_no.split("UID")[1]);
//   if (!userId || isNaN(userId)) {
//     return res.status(400).send("Invalid user ID in order number");
//   }

//   const privateKey = "762a827b2515e4463ba01945711c8532";

//   const signData = {
//     attach,
//     currency,
//     mch_id,
//     mch_order_no,
//     pay_type,
//     trade_amount,
//   };

//   const signStr =
//     Object.keys(signData)
//       .sort()
//       .map((key) => `${key}=${signData[key]}`)
//       .join("&") + `&key=${privateKey}`;

//   const expectedSign = crypto.createHash("md5").update(signStr).digest("hex");
//   if (expectedSign !== sign) return res.status(403).send("Invalid signature");

//   // Check if already inserted
//   db.query(
//     "SELECT id FROM recharge_requests WHERE gateway_txn_id = ?",
//     [mch_order_no],
//     (err, results) => {
//       if (err) return res.status(500).send("DB read error");
//       if (results.length > 0) return res.send("ok"); // already handled

//       // Insert recharge
//       db.query(
//         "INSERT INTO recharge_requests (user_id, amount, gateway_txn_id, status) VALUES (?, ?, ?, 'success')",
//         [userId, trade_amount, mch_order_no],
//         (err2) => {
//           if (err2) {
//             console.error("Recharge insert error", err2);
//             return res.status(500).send("DB error");
//           }

//           db.query(
//             "UPDATE users SET balance = balance + ? WHERE id = ?",
//             [trade_amount, userId],
//             () => res.send("ok")
//           );
//         }
//       );
//     }
//   );
// };
