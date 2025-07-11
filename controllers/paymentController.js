const crypto = require("crypto");
const db = require("../db");
const axios = require("axios");

exports.initiateRecharge = async (req, res) => {
  const user = req.user;
  const { amount, phone } = req.body;

  const payload = {
    mch_id: "84423629",
    mch_order_no: `ORDER${Date.now()}UID${user.id}`,
    notifyUrl: "https://api.bullvibe.co.in/api/recharge/callback",
    page_url: "https://bullvibe.co.in/recharge-history",
    trade_amount: parseInt(amount),
    currency: "INR",
    pay_type: "INDIA_UPI",
    payer_phone: phone,
    attach: "recharge",
  };

  const privateKey = "762a827b2515e4463ba01945711c8532";

  const signStr =
    Object.keys(payload)
      .sort()
      .map((k) => `${k}=${payload[k]}`)
      .join("&") + `&key=${privateKey}`;

  const sign = crypto.createHash("md5").update(signStr).digest("hex");

  const finalPayload = {
    ...payload,
    sign,
    sign_type: "MD5",
  };

  try {
    const { data } = await axios.post(
      "https://xyu10.top/api/payGate/payCollect",
      new URLSearchParams(finalPayload).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    if (data.code === 0 && data.data?.url) {
      // ✅ Return payment link to frontend
      return res.json({ success: true, url: data.data.url });
    } else {
      return res
        .status(400)
        .json({ success: false, message: data.msg || "Gateway rejected" });
    }
  } catch (err) {
    console.error("Gateway error", err.response?.data || err.message);
    return res
      .status(500)
      .json({ success: false, message: "Payment gateway error" });
  }
};

// exports.initiateRecharge = async (req, res) => {
//   const user = req.user;
//   const { amount, phone } = req.body;

//   if (!user || !amount || !phone) {
//     return res.status(400).json({ success: false, message: "Missing fields" });
//   }

//   const mch_id = "84423629";
//   const mch_order_no = `ORDER${Date.now()}${user.id}`;
//   const notifyUrl = "https://api.bullvibe.co.in/api/recharge/callback";
//   const page_url = "https://bullvibe.co.in/recharge-history";
//   const trade_amount = parseInt(amount); // Must be integer
//   const currency = "INR";
//   const pay_type = "INDIA_UPI";
//   const attach = "recharge";
//   const sign_type = "MD5";
//   const payer_phone = phone;

//   // Step 1: Build sign string
//   const payload = {
//     mch_id,
//     mch_order_no,
//     notifyUrl,
//     page_url,
//     trade_amount,
//     currency,
//     pay_type,
//     payer_phone,
//     attach,
//   };

//   const privateKey = "762a827b2515e4463ba01945711c8532";

//   // Create sign string in required order
//   const signString =
//     Object.keys(payload)
//       .sort()
//       .map((k) => `${k}=${payload[k]}`)
//       .join("&") + `&key=${privateKey}`;

//   const sign = crypto.createHash("md5").update(signString).digest("hex");

//   // Final payload to send
//   const postPayload = {
//     ...payload,
//     sign,
//     sign_type,
//   };

//   // Step 2: Build and return HTML form
//   const formHtml = `
//     <html>
//     <body>
//       <form id="payForm" method="POST" action="https://xyu10.top/api/payGate/payCollect">
//         ${Object.entries(postPayload)
//           .map(
//             ([key, val]) =>
//               `<input type="hidden" name="${key}" value="${val}" />`
//           )
//           .join("\n")}
//       </form>
//       <script>document.getElementById('payForm').submit();</script>
//     </body>
//     </html>
//   `;

//   res.send(formHtml);
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
//     sign_type,
//   } = req.body;

//   if (!mch_order_no || !trade_amount || !sign) {
//     return res.status(400).send("Missing required fields");
//   }

//   // Extract userId from order_no
//   const match = mch_order_no.match(/(\d+)$/);
//   const userId = match ? parseInt(match[1]) : null;
//   if (!userId) return res.status(400).send("Invalid user ID");

//   const privateKey = "762a827b2515e4463ba01945711c8532";

//   // Verify sign
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

//   if (expectedSign !== sign) {
//     return res.status(403).send("Invalid signature");
//   }

//   // Save recharge and update balance
//   db.query(
//     "INSERT INTO recharge_requests (user_id, amount, gateway_txn_id, status) VALUES (?, ?, ?, 'success')",
//     [userId, trade_amount, mch_order_no],
//     (err) => {
//       if (err) {
//         console.error("Recharge insert error", err);
//         return res.status(500).send("DB error");
//       }

//       db.query(
//         "UPDATE users SET balance = balance + ? WHERE id = ?",
//         [trade_amount, userId],
//         () => res.send("ok")
//       );
//     }
//   );
// };

exports.handlePaymentCallback = (req, res) => {
  const {
    mch_id,
    mch_order_no,
    trade_amount,
    currency,
    pay_type,
    attach,
    sign,
    sign_type = "MD5",
  } = req.body;

  if (!mch_order_no || !trade_amount || !sign) {
    return res.status(400).send("Missing required fields");
  }

  const userId = parseInt(mch_order_no.split("UID")[1]);
  if (!userId || isNaN(userId)) {
    return res.status(400).send("Invalid user ID in order number");
  }

  const privateKey = "762a827b2515e4463ba01945711c8532";

  const signData = {
    attach,
    currency,
    mch_id,
    mch_order_no,
    pay_type,
    trade_amount,
  };

  const signStr =
    Object.keys(signData)
      .sort()
      .map((key) => `${key}=${signData[key]}`)
      .join("&") + `&key=${privateKey}`;

  const expectedSign = crypto.createHash("md5").update(signStr).digest("hex");
  if (expectedSign !== sign) return res.status(403).send("Invalid signature");

  // Check if already inserted
  db.query(
    "SELECT id FROM recharge_requests WHERE gateway_txn_id = ?",
    [mch_order_no],
    (err, results) => {
      if (err) return res.status(500).send("DB read error");
      if (results.length > 0) return res.send("ok"); // already handled

      // Insert recharge
      db.query(
        "INSERT INTO recharge_requests (user_id, amount, gateway_txn_id, status) VALUES (?, ?, ?, 'success')",
        [userId, trade_amount, mch_order_no],
        (err2) => {
          if (err2) {
            console.error("Recharge insert error", err2);
            return res.status(500).send("DB error");
          }

          db.query(
            "UPDATE users SET balance = balance + ? WHERE id = ?",
            [trade_amount, userId],
            () => res.send("ok")
          );
        }
      );
    }
  );
};
