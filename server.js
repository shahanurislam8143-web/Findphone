const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Serve Static Files
app.use(express.static(__dirname));

// Credentials & Configurations
const TOKEN = '8864054482:AAHHLXKwCv_sHKqGNSmEfg1yuABqmzZ3Xx4'; 
const ADMIN_ID = 7779071715; 
const WEBAPP_URL = 'https://findphone-rxl7.onrender.com';

const bot = new TelegramBot(TOKEN, { polling: true });

// Memory Database
let appSettings = {
  bkashNumber: "01700000000",
  nagadNumber: "01700000000",
  binanceAddress: "123456789 (Pay ID)",
  targetBotUrl: "https://t.me/YourTargetBotUsername",
  requiredChannel: "@nexuslink0",
  channelLink: "https://t.me/nexuslink0",
  bannerAdText: "🔥 SpoNSor Website dekhe offer upobhog korun!",
  bannerAdUrl: "https://example.com",
  thirdPartyScript: ""
};

let bannedUsers = new Set();
let approvedUsers = new Set([ADMIN_ID]);
let payments = [];

// Helper Function: Check Telegram Channel Membership
async function checkChannelMembership(userId) {
  try {
    if (!appSettings.requiredChannel) return true;
    const member = await bot.getChatMember(appSettings.requiredChannel, userId);
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch (error) {
    console.error("Channel check error:", error);
    return false;
  }
}

// Serve Main HTML File
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Bot Command Handler
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text ? msg.text.toLowerCase() : '';

  if (bannedUsers.has(userId)) {
    return bot.sendMessage(chatId, "❌ **Apnar account-ti ban kora hoyeche!**");
  }

  if (text.includes('find my device') || text === '/start') {
    bot.sendMessage(chatId, `📱 **Welcome to Find My Device Service**\n\nApp-ti bebohar korte nicher button-e chap din:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Open App", web_app: { url: WEBAPP_URL } }]
        ]
      }
    });
  }
});

// 🟢 1. Initialize App Data
app.get('/api/init-app/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);

  if (bannedUsers.has(userId)) {
    return res.json({ isBanned: true });
  }

  const isJoined = await checkChannelMembership(userId);
  const approved = approvedUsers.has(userId);

  res.json({
    approved: approved,
    isJoined: isJoined,
    appSettings: appSettings
  });
});

// 🟢 2. Check Channel Membership
app.get('/api/check-join/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const isJoined = await checkChannelMembership(userId);
  res.json({ isJoined: isJoined });
});

// 🟢 3. Submit Payment Request
app.post('/api/submit-payment', (req, res) => {
  const { userId, userName, phone, method, trxId } = req.body;

  if (!userId || !trxId) {
    return res.status(400).json({ success: false, message: "TrxID ebong details sob prodan korun!" });
  }

  const newPayment = {
    id: Date.now(),
    userId: parseInt(userId),
    userName: userName || 'User',
    phone: phone || 'N/A',
    method: method,
    trxId: trxId,
    status: 'pending'
  };

  payments.push(newPayment);

  // Send Alert to Admin in Telegram
  bot.sendMessage(ADMIN_ID, 
    `🔔 **Nutun Payment Request!**\n\n👤 **User:** ${userName} (\`${userId}\`)\n📱 **Phone:** \`${phone}\`\n💳 **Method:** ${method}\n🧾 **TrxID:** \`${trxId}\``, 
    { parse_mode: 'Markdown' }
  );

  res.json({ success: true, message: "Payment safalvabe joma hoyeche! Admin review kore confirm korben." });
});

// 🟢 4. Load Admin Payments Table & Settings
app.get('/api/admin/payments/:adminId', (req, res) => {
  const adminId = parseInt(req.params.adminId);
  if (adminId !== ADMIN_ID) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  res.json({
    payments: payments,
    appSettings: appSettings
  });
});

// 🟢 5. Admin Approve / Reject Action
app.post('/api/admin/action', (req, res) => {
  const { adminId, paymentId, action } = req.body;
  if (parseInt(adminId) !== ADMIN_ID) return res.status(403).json({ success: false });

  const payment = payments.find(p => p.id === paymentId);
  if (payment) {
    payment.status = action === 'approve' ? 'approved' : 'rejected';

    if (action === 'approve') {
      approvedUsers.add(payment.userId);
      
      // Direct Link Button Message to User
      bot.sendMessage(payment.userId, "🎉 **Apnar payment safalvabe anumodito hoyeche!**\n\nNicher button-e click kore mool bot-e probesh korun:", {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🚀 Open Premium Bot", url: appSettings.targetBotUrl || "https://t.me/nexuslink0" }]
          ]
        }
      });
    } else {
      bot.sendMessage(payment.userId, "❌ **Apnar dewa payment request-ti batil kora hoyeche.** Sothik Transaction ID shoho abar chesta korun.");
    }

    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: "Payment request not found" });
  }
});

// 🟢 6. Admin Send Direct Message or Photo to User
app.post('/api/admin/send-message', async (req, res) => {
  const { adminId, targetUserId, messageText, imageUrl } = req.body;

  if (parseInt(adminId) !== ADMIN_ID) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  try {
    const targetId = parseInt(targetUserId);
    if (imageUrl && imageUrl.trim() !== "") {
      await bot.sendPhoto(targetId, imageUrl, {
        caption: messageText || '',
        parse_mode: 'Markdown'
      });
    } else if (messageText && messageText.trim() !== "") {
      await bot.sendMessage(targetId, messageText, { parse_mode: 'Markdown' });
    }
    res.json({ success: true, message: "Message/Chobi safalvabe user-er Telegram-e pathano hoyeche!" });
  } catch (error) {
    console.error("Send message error:", error);
    res.json({ success: false, message: "Message pathate shomossha hoyeche. User ID poriksha korun." });
  }
});

// 🟢 7. Admin Ban/Unban/Sub Control
app.post('/api/admin/user-control', (req, res) => {
  const { adminId, targetUserId, action } = req.body;
  if (parseInt(adminId) !== ADMIN_ID) return res.status(403).json({ success: false });

  const targetId = parseInt(targetUserId);
  if (action === 'ban') {
    bannedUsers.add(targetId);
    approvedUsers.delete(targetId);
  } else if (action === 'unban') {
    bannedUsers.delete(targetId);
  } else if (action === 'add_sub') {
    approvedUsers.add(targetId);
  }

  res.json({ success: true });
});

// 🟢 8. Save Admin Settings
app.post('/api/admin/update-settings', (req, res) => {
  const { adminId, bkashNumber, nagadNumber, binanceAddress, targetBotUrl, requiredChannel, channelLink, bannerAdText, bannerAdUrl, thirdPartyScript } = req.body;

  if (parseInt(adminId) === ADMIN_ID) {
    if (bkashNumber !== undefined) appSettings.bkashNumber = bkashNumber;
    if (nagadNumber !== undefined) appSettings.nagadNumber = nagadNumber;
    if (binanceAddress !== undefined) appSettings.binanceAddress = binanceAddress;
    if (targetBotUrl !== undefined) appSettings.targetBotUrl = targetBotUrl;
    if (requiredChannel !== undefined) appSettings.requiredChannel = requiredChannel;
    if (channelLink !== undefined) appSettings.channelLink = channelLink;
    if (bannerAdText !== undefined) appSettings.bannerAdText = bannerAdText;
    if (bannerAdUrl !== undefined) appSettings.bannerAdUrl = bannerAdUrl;
    if (thirdPartyScript !== undefined) appSettings.thirdPartyScript = thirdPartyScript;

    res.json({ success: true, appSettings });
  } else {
    res.status(403).json({ success: false, message: "Unauthorized" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
