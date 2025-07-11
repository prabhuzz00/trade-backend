// paymentController.js
const crypto = require("crypto");
const axios = require("axios");
const db = require("../db");

const APP_ID = "YD4141";
const SECRET_KEY = "XQnjoIu2B8soZbndtmKg9tsVKQwiboVY";
const TRADE_TYPE = "INRUPI";
const NOTIFY_URL = "https://api.bullvibe.co.in/api/recharge/callback";
const RETURN_URL = "https://bullvibe.co.in/recharge-history";
const REMARK = "inr888";
const IP = "139.180.137.164";

exports.initiateRecharge = async (req, res) => {
  const user = req.user;
  const { amount } = req.body;

  if (!user || !amount || isNaN(amount) || amount < 1) {
    return res.status(400).json({ success: false, message: "Invalid input" });
  }

  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  const timePart =
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());
  const randomPart = Math.floor(10000000 + Math.random() * 90000000);
  const order_sn = timePart + randomPart;

  db.query(
    "INSERT INTO recharge_requests (user_id, amount, gateway_txn_id, status, created_at, username) VALUES (?, ?, ?, 'unpaid', NOW(), ?)",
    [user.id, amount, order_sn, user.name],
    async (err) => {
      if (err) {
        console.error("DB insert error:", err);
        return res.status(500).json({ success: false, message: "DB error" });
      }

      const money = parseInt(amount * 100);
      const params = {
        app_id: APP_ID,
        trade_type: TRADE_TYPE,
        order_sn,
        money,
        notify_url: NOTIFY_URL,
        return_url: RETURN_URL,
        ip: IP,
        remark: REMARK,
      };

      const signString =
        Object.keys(params)
          .filter((k) => params[k] !== "")
          .sort()
          .map((k) => `${k}=${params[k]}`)
          .join("&") + `&key=${SECRET_KEY}`;

      const sign = crypto
        .createHash("md5")
        .update(signString)
        .digest("hex")
        .toUpperCase();
      params.sign = sign;

      try {
        const encoded = new URLSearchParams(params).toString();
        const { data } = await axios.post(
          "https://www.lg-pay.com/api/order/create",
          encoded,
          {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          }
        );

        if (data?.status === 1 && data?.data?.pay_url) {
          return res.json({ success: true, url: data.data.pay_url });
        } else {
          return res
            .status(400)
            .json({
              success: false,
              message: data?.msg || "Payment gateway error",
            });
        }
      } catch (error) {
        console.error(
          "LGPay API error:",
          error?.response?.data || error.message
        );
        return res
          .status(500)
          .json({ success: false, message: "Gateway communication failed" });
      }
    }
  );
};

exports.handlePaymentCallback = (req, res) => {
  const { order_sn, money, status, pay_time, msg, remark, sign } = req.body;

  const requestIP =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  if (requestIP !== IP && requestIP !== `::ffff:${IP}`) {
    return res.status(403).send("Unauthorized IP");
  }

  if (!order_sn || !money || !status || !pay_time || !msg || !remark || !sign) {
    return res.status(400).send("Missing fields");
  }

  const signParams = {
    money,
    msg,
    order_sn,
    pay_time,
    remark,
    status,
  };

  const signString =
    Object.keys(signParams)
      .filter((k) => signParams[k])
      .sort()
      .map((k) => `${k}=${signParams[k]}`)
      .join("&") + `&key=${SECRET_KEY}`;

  const expectedSign = crypto
    .createHash("md5")
    .update(signString)
    .digest("hex")
    .toUpperCase();

  if (expectedSign !== sign) return res.status(403).send("Invalid signature");
  if (parseInt(status) !== 1)
    return res.status(400).send("Payment not completed");

  db.query(
    "SELECT * FROM recharge_requests WHERE gateway_txn_id = ?",
    [order_sn],
    (err, results) => {
      if (err || results.length === 0)
        return res.status(500).send("Order not found");

      const recharge = results[0];
      if (recharge.status === "success" || recharge.status === "Success") {
        return res.send("ok");
      }

      const userId = recharge.user_id;
      const amount = recharge.amount;

      db.query(
        "UPDATE recharge_requests SET status = 'success' WHERE id = ?",
        [recharge.id],
        (err2) => {
          if (err2) return res.status(500).send("Recharge update error");

          db.query(
            "UPDATE users SET balance = balance + ? WHERE id = ?",
            [amount, userId],
            (err3) => {
              if (err3) return res.status(500).send("Balance update error");
              return res.send("ok");
            }
          );
        }
      );
    }
  );
};

//hefupay
// exports.initiateRecharge = async (req, res) => {
// const user = req.user;
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
