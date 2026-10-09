const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Static Files Serve Line
app.use(express.static(__dirname));

// 🔑 Your Exact Credentials & Configurations
const TOKEN = '8864054482:AAHHLXKwCv_sHKqGNSmEfg1yuABqmzZ3Xx4'; 
const ADMIN_ID = 7779071715; 
const WEBAPP_URL = 'https://findphone-rxl7.onrender.com';

const bot = new TelegramBot(TOKEN, { polling: true });

// Memory Storage
let appSettings = {
  bkashNumber: "01700000000",
  nagadNumber: "01700000000",
  binanceAddress: "123456789 (Pay ID)",
  targetBotUrl: "https://t.me/YourTargetBotUsername",
  requiredChannel: "@nexuslink0",
  channelLink: "https://t.me/nexuslink0",
  bannerAdText: "🔥 স্পন্সর ওয়েবসাইট দেখে অফার উপভোগ করুন!",
  bannerAdUrl: "https://example.com",
  thirdPartyScript: ""
};

let bannedUsers = new Set();
let approvedUsers = new Set([ADMIN_ID]);
let payments = [];

// Helper: Check Telegram Channel Membership
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

// Serve Main HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Bot Command Listener
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text ? msg.text.toLowerCase() : '';

  if (bannedUsers.has(userId)) {
    return bot.sendMessage(chatId, "❌ **আপনার অ্যাকাউন্টটি ব্যান করা হয়েছে!**");
  }

  if (text.includes('find my device') || text === '/start') {
    bot.sendMessage(chatId, `📱 **Welcome to Find My Device Service**\n\nঅ্যাপটি ব্যবহার করতে নিচের বাটনে চাপ দিন:`, {
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

// 🟢 2. Check Channel Join Status
app.get('/api/check-join/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const isJoined = await checkChannelMembership(userId);
  res.json({ isJoined: isJoined });
});

// 🟢 3. Submit Payment Request
app.post('/api/submit-payment', (req, res) => {
  const { userId, userName, phone, method, trxId } = req.body;

  if (!userId || !trxId) {
    return res.status(400).json({ success: false, message: "TrxID এবং ইনফরমেশন প্রদান করুন!" });
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

  // Send Notification to Admin in Telegram
  bot.sendMessage(ADMIN_ID, 
    `🔔 **নতুন পেমেন্ট রিকোয়েস্ট!**\n\n👤 **User:** ${userName} (\`${userId}\`)\n📱 **Phone:** \`${phone}\`\n💳 **Method:** ${method}\n🧾 **TrxID:** \`${trxId}\``, 
    { parse_mode: 'Markdown' }
  );

  res.json({ success: true, message: "পেমেন্ট সফলভাবে জমা হয়েছে! অ্যাডমিন রিভিউ করে কনফার্ম করবেন।" });
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
      bot.sendMessage(payment.userId, "🎉 **আপনার পেমেন্ট সফলভাবে অনুমোদিত হয়েছে!** আপনি এখন সার্ভিস ব্যবহার করতে পারবেন।");
    } else {
      bot.sendMessage(payment.userId, "❌ **আপনার দেওয়া পেমেন্ট রিকোয়েস্টটি বাতিল করা হয়েছে।** সঠিক ট্রানজেকশন আইডিসহ আবার চেষ্টা করুন।");
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
    res.json({ success: true, message: "মেসেজ/ছবি সফলভাবে ইউজারের টেলিগ্রামে পাঠানো হয়েছে!" });
  } catch (error) {
    console.error("Send message error:", error);
    res.json({ success: false, message: "মেসেজ পাঠাতে সমস্যা হয়েছে। User ID পরীক্ষা করুন।" });
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
