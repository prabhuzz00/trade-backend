const db = require("../dbPromise"); // Assuming you have a db connection module

// 🟢 User creates a new ticket
exports.createTicket = async (req, res) => {
  const { subject, message } = req.body;
  const userId = req.session.user_id;

  if (!subject || !message) {
    return res.status(400).json({ error: "Missing subject or message" });
  }

  try {
    // 1. Insert into support_tickets
    const [result] = await db.query(
      "INSERT INTO support_tickets (user_id, subject, message) VALUES (?, ?, ?)",
      [userId, subject, message]
    );

    const ticketId = result.insertId;

    // 2. Insert into ticket_messages
    await db.query(
      "INSERT INTO ticket_messages (ticket_id, sender, message) VALUES (?, 'user', ?)",
      [ticketId, message]
    );

    res.json({ success: true, ticketId });
  } catch (err) {
    console.error("createTicket error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// 🟢 Get user's own tickets
exports.getMyTickets = async (req, res) => {
  const userId = req.session.user_id;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [rows] = await db.query(
      "SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load tickets" });
  }
};

exports.getTicketMessages = async (req, res) => {
  const ticketId = req.params.id;
  const isAdmin = req.session.admin_id;
  const userId = req.session.user_id;

  console.log("admin session:", req.session.admin_id);
  console.log("user session:", req.session.user_id);
  try {
    const [[ticket]] = await db.query(
      "SELECT * FROM support_tickets WHERE id = ?",
      [ticketId]
    );

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (!isAdmin && ticket.user_id !== userId)
      return res.status(403).json({ error: "Unauthorized" });

    const [messages] = await db.query(
      "SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC",
      [ticketId]
    );

    res.json({ ticket, messages }); // ✅ Return full ticket with status
  } catch (err) {
    console.error("getTicketMessages error:", err);
    res.status(500).json({ error: "Error loading messages" });
  }
};

// 🟢 Post a message to a ticket
exports.postMessage = async (req, res) => {
  const ticketId = req.params.id;
  const { message } = req.body;
  const isAdmin = req.session.admin_id;
  const userId = req.session.user_id;

  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    const [[ticket]] = await db.query(
      "SELECT * FROM support_tickets WHERE id = ?",
      [ticketId]
    );

    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    // 🛡️ Authorization check
    if (!isAdmin && ticket.user_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const sender = isAdmin ? "admin" : "user";

    await db.query(
      "INSERT INTO ticket_messages (ticket_id, sender, message) VALUES (?, ?, ?)",
      [ticketId, sender, message]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("postMessage error:", err);
    res.status(500).json({ error: "Error sending message" });
  }
};

// 🔴 ADMIN: Get all tickets
exports.getAllTickets = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, u.name AS username FROM support_tickets t 
   LEFT JOIN users u ON t.user_id = u.id 
   ORDER BY t.created_at DESC`
    );
    exports.getAllTickets = async (req, res) => {
      if (!req.session.admin_id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      try {
        const [rows] = await db.query(
          `SELECT t.*, u.name AS username FROM support_tickets t 
       LEFT JOIN users u ON t.user_id = u.id 
       ORDER BY t.created_at DESC`
        );
        res.json(rows);
      } catch (err) {
        console.error("getAllTickets error:", err);
        res.status(500).json({ error: "Failed to fetch tickets" });
      }
    };

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
};

// 🔴 ADMIN: Update ticket status
exports.updateStatus = async (req, res) => {
  if (!req.session.admin_id) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const ticketId = req.params.id;
  const { status } = req.body;

  if (!["open", "resolved", "closed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    await db.query("UPDATE support_tickets SET status = ? WHERE id = ?", [
      status,
      ticketId,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("updateStatus error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
};
