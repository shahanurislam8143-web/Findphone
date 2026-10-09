const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

const TOKEN = '8864054482:AAHHLXKwCv_sHKqGNSmEfg1yuABqmzZ3Xx4'; 
const ADMIN_ID = 7779071715; 
const WEBAPP_URL = 'https://findphone-rxl7.onrender.com';

const bot = new TelegramBot(TOKEN, { polling: true });

// Full Dynamic Control State
let appSettings = {
  bkashNumber: "01700000000",
  nagadNumber: "01700000000",
  binanceAddress: "123456789 (Pay ID)",
  subPrice: "100 BDT",
  requiredChannel: "@nexuslink0",
  channelLink: "https://t.me/nexuslink0",
  premiumBotLink: "https://t.me/YourPremiumBotUsername",
  bannerAdText: "🔥 ৫০% ডিসকাউন্ট পেতে স্পন্সর ওয়েবসাইট দেখুন!",
  bannerAdUrl: "https://example.com",
  adCodeFull: "" // HTML Script Code for Ads (Monetag / Adsterra / Popunder / Social Bar)
};

let bannedUsers = new Set();
let subscribers = new Set([ADMIN_ID]);
let paymentRequests = [];

async function checkChannelMembership(userId) {
  try {
    if (!appSettings.requiredChannel) return true;
    const member = await bot.getChatMember(appSettings.requiredChannel, userId);
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch (error) {
    return false;
  }
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text ? msg.text.toLowerCase() : '';

  if (bannedUsers.has(userId)) {
    return bot.sendMessage(chatId, "❌ **আপনার অ্যাকাউন্টটি ব্যান করা হয়েছে!**");
  }

  if (text.includes('find my device') || text === '/start') {
    bot.sendMessage(chatId, `📱 **Welcome to Find My Device App**\n\nঅ্যাপটি ওপেন করতে নিচের বাটনে ক্লিক করুন:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Open App", web_app: { url: WEBAPP_URL } }]
        ]
      }
    });
  }
});

// Admin Approval Buttons in Telegram
bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  if (query.from.id !== ADMIN_ID) return;

  if (data.startsWith('approve_')) {
    const targetUserId = parseInt(data.split('_')[1]);
    subscribers.add(targetUserId);

    bot.editMessageText(`✅ **পেমেন্ট অ্যাপ্রুভ করা হয়েছে!**\nUser ID: \`${targetUserId}\``, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });

    bot.sendMessage(targetUserId, "🎉 **আপনার সাবস্ক্রিপশন অনুমোদিত হয়েছে!**\nএখন আপনি প্রিমিয়াম বট ব্যবহার করতে পারবেন।");
  } else if (data.startsWith('reject_')) {
    const targetUserId = parseInt(data.split('_')[1]);

    bot.editMessageText(`❌ **পেমেন্ট বাতিল করা হয়েছে!**\nUser ID: \`${targetUserId}\``, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });

    bot.sendMessage(targetUserId, "❌ **আপনার পেমেন্ট বাতিল করা হয়েছে।** সঠিক ট্রানজেকশন আইডিসহ আবার চেষ্টা করুন।");
  }
});

// App Sync API
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

// Submit Payment
app.post('/api/subscribe/submit', (req, res) => {
  const { userId, method, trxId } = req.body;
  if (!userId || !trxId) return res.status(400).json({ success: false });

  const reqObj = { id: Date.now(), userId: parseInt(userId), method, trxId, status: 'pending' };
  paymentRequests.push(reqObj);

  bot.sendMessage(ADMIN_ID, 
    `🔔 **নতুন পেমেন্ট রিকোয়েস্ট!**\n\n👤 **User ID:** \`${userId}\`\n💳 **Method:** ${method}\n🧾 **TrxID:** \`${trxId}\``, 
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve_${userId}` },
            { text: "❌ Reject", callback_data: `reject_${userId}` }
          ]
        ]
      }
    }
  );

  res.json({ success: true });
});

// Admin User Control
app.post('/api/admin/user-control', (req, res) => {
  const { adminId, targetUserId, action } = req.body;
  if (parseInt(adminId) !== ADMIN_ID) return res.status(403).json({ success: false });

  const targetId = parseInt(targetUserId);
  if (action === 'ban') bannedUsers.add(targetId);
  else if (action === 'unban') bannedUsers.delete(targetId);
  else if (action === 'add_sub') subscribers.add(targetId);
  else if (action === 'remove_sub') subscribers.delete(targetId);

  res.json({ success: true });
});

// Admin Save Settings
app.post('/api/admin/settings', (req, res) => {
  const { adminId, bkashNumber, nagadNumber, binanceAddress, subPrice, requiredChannel, premiumBotLink, bannerAdText, bannerAdUrl, adCodeFull } = req.body;

  if (parseInt(adminId) === ADMIN_ID) {
    if (bkashNumber) appSettings.bkashNumber = bkashNumber;
    if (nagadNumber) appSettings.nagadNumber = nagadNumber;
    if (binanceAddress) appSettings.binanceAddress = binanceAddress;
    if (subPrice) appSettings.subPrice = subPrice;
    if (premiumBotLink) appSettings.premiumBotLink = premiumBotLink;
    if (requiredChannel) {
      appSettings.requiredChannel = requiredChannel;
      appSettings.channelLink = `https://t.me/${requiredChannel.replace('@', '')}`;
    }
    if (bannerAdText) appSettings.bannerAdText = bannerAdText;
    if (bannerAdUrl) appSettings.bannerAdUrl = bannerAdUrl;
    if (adCodeFull !== undefined) appSettings.adCodeFull = adCodeFull;

    res.json({ success: true, appSettings });
  } else {
    res.status(403).json({ success: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
