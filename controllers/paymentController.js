const crypto = require("crypto");
const db = require("../db");

exports.initiateRecharge = async (req, res) => {
  const user = req.user;
  const { amount } = req.body;

  if (!user || !amount)
    return res
      .status(400)
      .json({ success: false, message: "Missing user or amount" });

  const merchantId = "84423629";
  const privateKey = "762a827b2515e4463ba01945711c8532";
  const gatewayUrl = "https://xyu10.top/api/payGate/payCollect";
  const notifyUrl = "https://api.bullvibe.co.in/api/recharge/callback"; // Now handled by Node
  const returnUrl = "https://bullvibe.co.in/recharge-history";

  const orderNo = `ORD${Date.now()}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const amountStr = amount.toFixed(2);

  const payload = {
    merchant_id: merchantId,
    order_no: orderNo,
    amount: amountStr,
    notify_url: notifyUrl,
    return_url: returnUrl,
    username: user.name,
    userId: user.id,
    timestamp,
  };

  // Generate MD5 signature
  const signString =
    Object.keys(payload)
      .sort()
      .map((key) => `${key}=${payload[key]}`)
      .join("&") + `&key=${privateKey}`;

  const signature = crypto.createHash("md5").update(signString).digest("hex");

  const formHtml = `
    <html>
      <body>
        <form id="paymentForm" method="POST" action="${gatewayUrl}">
          ${Object.entries({ ...payload, sign: signature })
            .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`)
            .join("\n")}
        </form>
        <script>document.getElementById('paymentForm').submit();</script>
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
