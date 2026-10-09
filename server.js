const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Static Files Serve
app.use(express.static(__dirname));

// Configuration
const TOKEN = '8864054482:AAHhLXKwCv_sHKqGNSmEfg1yuABqmzZ3Xx4'; 
const ADMIN_ID = 7779071715; 
const WEBAPP_URL = 'https://findphone-rxl7.onrender.com';

const bot = new TelegramBot(TOKEN, { polling: true });

// Memory Database
let appSettings = {
  bkashNumber: "01700000000",
  nagadNumber: "01700000000",
  binanceAddress: "123456789 (Pay ID)",
  subPrice: "100 BDT",
  requiredChannel: "@nexuslink0",
  channelLink: "https://t.me/nexuslink0",
  bannerAdText: "🔥 ৫০% ডিসকাউন্ট পেতে স্পন্সর ওয়েবসাইট দেখুন!",
  bannerAdUrl: "https://example.com",
  socialBarScript: "", // Adsterra / Monetag Social bar script URL
  popunderScript: "",  // Popunder Ads script URL
  videoAdScript: ""    // Video Ads script URL
};

let bannedUsers = new Set();
let subscribers = new Set([ADMIN_ID]); // Admin by default active
let paymentRequests = [];

// Force Join Check
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

// Serve Frontend
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Bot Commands
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text ? msg.text.toLowerCase() : '';

  if (bannedUsers.has(userId)) {
    return bot.sendMessage(chatId, "❌ **আপনার অ্যাকাউন্টটি ব্যান করা হয়েছে!**");
  }

  if (text.includes('find my device') || text === '/start') {
    const caption = `📱 **Welcome to Find My Device App**\n\n` +
                    `অ্যাপটি ব্যবহার করতে নিচের **Open App** বাটনে চাপ দিন:`;

    bot.sendMessage(chatId, caption, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Open App", web_app: { url: WEBAPP_URL } }]
        ]
      }
    });
  }
});

// API Routes
app.get('/api/init-app/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);

  if (bannedUsers.has(userId)) {
    return res.json({ isBanned: true });
  }

  const isJoined = await checkChannelMembership(userId);
  const isSubscribed = subscribers.has(userId);

  res.json({
    isBanned: false,
    isJoined: isJoined,
    isSubscribed: isSubscribed,
    isAdmin: userId === ADMIN_ID,
    appSettings: appSettings
  });
});

app.get('/api/check-join/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const isJoined = await checkChannelMembership(userId);
  res.json({ joined: isJoined });
});

// Submit Payment for Subscription
app.post('/api/subscribe/submit', (req, res) => {
  const { userId, username, method, trxId } = req.body;
  if (!userId || !trxId) return res.status(400).json({ success: false, message: 'Missing fields' });

  const reqObj = { id: Date.now(), userId: parseInt(userId), username: username || 'User', method, trxId, status: 'pending' };
  paymentRequests.push(reqObj);

  // Notify Admin in Telegram
  bot.sendMessage(ADMIN_ID, `🔔 **নতুন সাবস্ক্রিপশন পেমেন্ট রিকোয়েস্ট!**\n\nUser ID: \`${userId}\`\nMethod: ${method}\nTrxID: \`${trxId}\``, { parse_mode: 'Markdown' });

  res.json({ success: true, message: 'Payment submitted for review.' });
});

// Admin Panel APIs
app.get('/api/admin/payments', (req, res) => {
  res.json({ payments: paymentRequests });
});

app.post('/api/admin/approve-payment', (req, res) => {
  const { adminId, reqId } = req.body;
  if (parseInt(adminId) !== ADMIN_ID) return res.status(403).json({ success: false });

  const pReq = paymentRequests.find(p => p.id === reqId);
  if (pReq) {
    pReq.status = 'approved';
    subscribers.add(pReq.userId);
    bot.sendMessage(pReq.userId, "🎉 **আপনার সাবস্ক্রিপশন সফলভাবে অ্যাক্টিভ হয়েছে!**");
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false });
  }
});

app.post('/api/admin/user-control', (req, res) => {
  const { adminId, targetUserId, action } = req.body;
  if (parseInt(adminId) !== ADMIN_ID) return res.status(403).json({ success: false });

  const targetId = parseInt(targetUserId);

  if (action === 'ban') {
    bannedUsers.add(targetId);
  } else if (action === 'unban') {
    bannedUsers.delete(targetId);
  } else if (action === 'add_sub') {
    subscribers.add(targetId);
  } else if (action === 'remove_sub') {
    subscribers.delete(targetId);
  }

  res.json({ success: true, bannedUsers: Array.from(bannedUsers), subscribers: Array.from(subscribers) });
});

app.post('/api/admin/settings', (req, res) => {
  const { adminId, bkashNumber, nagadNumber, binanceAddress, subPrice, requiredChannel, bannerAdText, bannerAdUrl, socialBarScript, popunderScript, videoAdScript } = req.body;

  if (parseInt(adminId) === ADMIN_ID) {
    if (bkashNumber) appSettings.bkashNumber = bkashNumber;
    if (nagadNumber) appSettings.nagadNumber = nagadNumber;
    if (binanceAddress) appSettings.binanceAddress = binanceAddress;
    if (subPrice) appSettings.subPrice = subPrice;
    if (requiredChannel) {
      appSettings.requiredChannel = requiredChannel;
      appSettings.channelLink = `https://t.me/${requiredChannel.replace('@', '')}`;
    }
    if (bannerAdText) appSettings.bannerAdText = bannerAdText;
    if (bannerAdUrl) appSettings.bannerAdUrl = bannerAdUrl;
    if (socialBarScript !== undefined) appSettings.socialBarScript = socialBarScript;
    if (popunderScript !== undefined) appSettings.popunderScript = popunderScript;
    if (videoAdScript !== undefined) appSettings.videoAdScript = videoAdScript;

    res.json({ success: true, appSettings });
  } else {
    res.status(403).json({ success: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
