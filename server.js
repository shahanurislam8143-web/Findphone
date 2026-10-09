const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// 🟢 HTML স্ট্যাটিক ফাইল সার্ভ করার জন্য প্রয়োজনীয় লাইন:
app.use(express.static(__dirname));

const TOKEN = '8864054482:AAHhLXKwCv_sHKqGNSmEfg1yuABqmzZ3Xx4'; 
const ADMIN_ID = 7779071715; 
const WEBAPP_URL = 'https://findphone-rxl7.onrender.com';  

const bot = new TelegramBot(TOKEN, { polling: true });

let appSettings = {
  bkashNumber: "01700000000",
  nagadNumber: "01700000000",
  binanceAddress: "123456789 (Pay ID)",
  targetBotUrl: "https://t.me/YourTargetBotUsername",
  requiredChannel: "@nexuslink0",
  channelLink: "https://t.me/nexuslink0",
  bannerAdText: "🔥 বিশেষ ছাড়! ৫০% ডিসকাউন্ট পেতে স্পন্সর ওয়েবসাইট দেখুন।",
  bannerAdUrl: "https://example.com"
};

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

// 🟢 হোম রাউটে সরাসরি আপডেট হওয়া index.html ফাইল পাঠানো
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.toLowerCase() : '';

  if (text.includes('find my device') || text === '/start') {
    const caption = `📱 **Welcome to Find My Device Service**\n\n` +
                    `বিস্তারিত অ্যাক্সেস করার জন্য নিচের বাটনে ক্লিক করুন:`;

    bot.sendMessage(chatId, caption, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Open Find My Device App", web_app: { url: WEBAPP_URL } }]
        ]
      }
    });
  }
});

app.get('/api/init-app/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const isJoined = await checkChannelMembership(userId);

  res.json({
    isJoined: isJoined,
    isAdmin: userId === ADMIN_ID,
    appSettings: appSettings
  });
});

app.get('/api/check-join/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  const isJoined = await checkChannelMembership(userId);
  res.json({ joined: isJoined });
});

app.post('/api/admin/settings', (req, res) => {
  const { adminId, bkashNumber, nagadNumber, requiredChannel, bannerAdText, bannerAdUrl } = req.body;

  if (parseInt(adminId) === ADMIN_ID) {
    if (bkashNumber) appSettings.bkashNumber = bkashNumber;
    if (nagadNumber) appSettings.nagadNumber = nagadNumber;
    if (requiredChannel) {
      appSettings.requiredChannel = requiredChannel;
      appSettings.channelLink = `https://t.me/${requiredChannel.replace('@', '')}`;
    }
    if (bannerAdText) appSettings.bannerAdText = bannerAdText;
    if (bannerAdUrl) appSettings.bannerAdUrl = bannerAdUrl;

    res.json({ success: true, appSettings });
  } else {
    res.status(403).json({ success: false, message: 'Unauthorized' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
      
