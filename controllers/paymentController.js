const crypto = require("crypto");
const db = require("../db");

exports.initiateRecharge = async (req, res) => {
  const user = req.user;
  const { amount, phone } = req.body;

  if (!user || !amount || !phone) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  const mch_id = "84423629";
  const mch_order_no = `ORDER${Date.now()}${user.id}`;
  const notifyUrl = "https://api.bullvibe.co.in/api/recharge/callback";
  const page_url = "https://bullvibe.co.in/recharge-history";
  const trade_amount = parseInt(amount); // Must be integer
  const currency = "INR";
  const pay_type = "INDIA_UPI";
  const attach = "recharge";
  const sign_type = "MD5";
  const payer_phone = phone;

  // Step 1: Build sign string
  const payload = {
    mch_id,
    mch_order_no,
    notifyUrl,
    page_url,
    trade_amount,
    currency,
    pay_type,
    payer_phone,
    attach,
  };

  const privateKey = "762a827b2515e4463ba01945711c8532";

  // Create sign string in required order
  const signString =
    Object.keys(payload)
      .sort()
      .map((k) => `${k}=${payload[k]}`)
      .join("&") + `&key=${privateKey}`;

  const sign = crypto.createHash("md5").update(signString).digest("hex");

  // Final payload to send
  const postPayload = {
    ...payload,
    sign,
    sign_type,
  };

  // Step 2: Build and return HTML form
  const formHtml = `
    <html>
    <body>
      <form id="payForm" method="POST" action="https://xyu10.top/api/payGate/payCollect">
        ${Object.entries(postPayload)
          .map(
            ([key, val]) =>
              `<input type="hidden" name="${key}" value="${val}" />`
          )
          .join("\n")}
      </form>
      <script>document.getElementById('payForm').submit();</script>
    </body>
    </html>
  `;

  res.send(formHtml);
};

exports.handlePaymentCallback = (req, res) => {
  const { userId, amount, txnid, status, sign, ...otherFields } = req.body;

  if (!userId || !amount || !txnid || !sign) {
    return res.status(400).send("Missing fields");
  }

  // Recreate the same signature string
  const privateKey = "762a827b2515e4463ba01945711c8532";
  const payload = { userId, amount, txnid, status, ...otherFields };
  const signString =
    Object.keys(payload)
      .sort()
      .map((key) => `${key}=${payload[key]}`)
      .join("&") + `&key=${privateKey}`;

  const expectedSign = crypto
    .createHash("md5")
    .update(signString)
    .digest("hex");

  if (expectedSign !== sign) {
    return res.status(403).send("Invalid signature");
  }

  // Insert recharge record
  db.query(
    "INSERT INTO recharge_requests (user_id, amount, status, gateway_txn_id) VALUES (?, ?, ?, ?)",
    [userId, amount, status, txnid],
    (err) => {
      if (err) {
        console.error("Recharge insert error", err);
        return res.status(500).send("DB error");
      }

      if (status === "success") {
        db.query(
          "UPDATE users SET balance = balance + ?, is_recharge = 1 WHERE id = ?",
          [amount, userId],
          (err2) => {
            if (err2) return res.status(500).send("Balance update error");
            return res.send("ok");
          }
        );
      } else {
        return res.send("rejected");
      }
    }
  );
};
