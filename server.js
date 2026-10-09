const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Static Files Serve
app.use(express.static(__dirname));

// 🟢 সঠিক Credentials বসানো হয়েছে:
const TOKEN = '8864054482:AAHHLXKwCv_sHKqGNSmEfg1yuABqmzZ3Xx4'; 
const ADMIN_ID = 7779071715; 
const WEBAPP_URL = 'https://findphone-rxl7.onrender.com'; 

const bot = new TelegramBot(TOKEN, { polling: true });

let payments = []; 
let userAccess = new Map(); 

let appSettings = {
    bkashNumber: "01700000000",
    nagadNumber: "01700000000",
    binanceAddress: "123456789 (Pay ID)",
    targetBotUrl: "https://t.me/YourTargetBotUsername",
    requiredChannel: "@nexuslink0",
    channelLink: "https://t.me/nexuslink0",
    bannerAdText: "🔥 বিশেষ ছাড়! ৫০% ডিসকাউন্ট পেতে স্পন্সর ওয়েবসাইট দেখুন।",
    bannerAdUrl: "https://example.com",
    thirdPartyScript: ""
};

// 🔍 চ্যানেল জয়েন চেক ফাংশন
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

// চ্যাট হ্যান্ডলার
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.toLowerCase() : '';

    if (text.includes('find my device') || text === '/start') {
        const caption = `📢 **Welcome to Find My Device Service**\n\n` +
                        `ডিভাইস ট্র্যাক করার জন্য সেবাটি ব্যবহার করতে নিচে ক্লিক করুন:`;

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

// API Routes
app.get('/api/init-app/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    const isApproved = userAccess.get(userId) || false;
    const isJoined = await checkChannelMembership(userId);

    res.json({
        approved: isApproved,
        isJoined: isJoined,
        appSettings: appSettings
    });
});

app.get('/api/check-join/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    const isJoined = await checkChannelMembership(userId);
    res.json({ isJoined: isJoined });
});

app.post('/api/submit-payment', (req, res) => {
    const { userId, userName, phone, method, trxId } = req.body;

    if (!userId || !trxId || !phone) {
        return res.status(400).json({ success: false, error: 'সবগুলো তথ্য সঠিকভাবে দিন!' });
    }

    const newPayment = {
        id: Date.now(),
        userId: parseInt(userId),
        userName: userName || 'Unknown',
        phone: phone,
        method: method,
        trxId: trxId,
        status: 'pending',
        date: new Date().toLocaleString()
    };

    payments.unshift(newPayment);

    bot.sendMessage(ADMIN_ID,
        `💰 **নতুন পেমেন্ট রিকোয়েস্ট!**\n\n` +
        `👤 **User:** ${userName} (\`${userId}\`)\n` +
        `📱 **Phone/Account:** \`${phone}\`\n` +
        `💳 **Method:** ${method}\n` +
        `🧾 **TrxID/TxID:** \`${trxId}\`\n\n` +
        `অনুমোদনের জন্য মিনি অ্যাপের অ্যাডমিন প্যানেল ভিজিট করুন।`,
        { parse_mode: 'Markdown' }
    );

    res.json({ success: true, message: 'পেমেন্ট সাবমিট করা হয়েছে! অ্যাডমিন ভেরিফাই করলে সেবা আনলক হবে।' });
});

app.get('/api/admin/payments/:adminId', (req, res) => {
    const adminId = parseInt(req.params.adminId);
    if (adminId !== ADMIN_ID) {
        return res.status(403).json({ error: 'Unauthorized!' });
    }
    res.json({ payments: payments, appSettings: appSettings });
});

app.post('/api/admin/action', (req, res) => {
    const { adminId, paymentId, action } = req.body;

    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({ error: 'Unauthorized!' });
    }

    const payIndex = payments.findIndex(p => p.id === paymentId);
    if (payIndex === -1) {
        return res.status(404).json({ error: 'Payment record not found' });
    }

    const targetPayment = payments[payIndex];

    if (action === 'approve') {
        targetPayment.status = 'approved';
        userAccess.set(targetPayment.userId, true);

        bot.sendMessage(targetPayment.userId, 
            '🎉 **অভিনন্দন! আপনার পেমেন্ট সফল হয়েছে।**\n\nঅ্যাপে ঢুকে চ্যানেল জয়েন ভেরিফাই করে মূল সার্ভিস ব্যবহার করুন।', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🚀 Open Target Bot", url: appSettings.targetBotUrl || "https://t.me/nexuslink0" }]
                    ]
                }
            });
    } else if (action === 'reject') {
        targetPayment.status = 'rejected';
        userAccess.set(targetPayment.userId, false);

        bot.sendMessage(targetPayment.userId, '❌ দুঃখিত, আপনার পেমেন্ট রিকোয়েস্টটি বাতিল করা হয়েছে। সঠিক TrxID দিন।');
    }

    res.json({ success: true, payment: targetPayment });
});

// 📩 ইউজারকে ডিরেক্ট মেসেজ ও ছবি পাঠানোর API
app.post('/api/admin/send-message', async (req, res) => {
    const { adminId, targetUserId, messageText, imageUrl } = req.body;

    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({ error: 'Unauthorized!' });
    }

    try {
        const targetId = parseInt(targetUserId);
        if (imageUrl && imageUrl.trim() !== "") {
            await bot.sendPhoto(targetId, imageUrl, { caption: messageText || '', parse_mode: 'Markdown' });
        } else if (messageText && messageText.trim() !== "") {
            await bot.sendMessage(targetId, messageText, { parse_mode: 'Markdown' });
        }
        res.json({ success: true, message: 'মেসেজ পাঠানো হয়েছে!' });
    } catch (err) {
        res.json({ success: false, error: 'মেসেজ পাঠাতে ব্যর্থ হয়েছে।' });
    }
});

// 🚫 ইউজার ব্যান/আনব্যান API
app.post('/api/admin/user-control', (req, res) => {
    const { adminId, targetUserId, action } = req.body;

    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({ error: 'Unauthorized!' });
    }

    const targetId = parseInt(targetUserId);
    if (action === 'ban') {
        userAccess.set(targetId, false);
    } else if (action === 'add_sub') {
        userAccess.set(targetId, true);
    }

    res.json({ success: true });
});

app.post('/api/admin/update-settings', (req, res) => {
    const { adminId, bkashNumber, nagadNumber, binanceAddress, targetBotUrl, requiredChannel, channelLink, bannerAdText, bannerAdUrl, thirdPartyScript } = req.body;

    if (parseInt(adminId) !== ADMIN_ID) {
        return res.status(403).json({ error: 'Unauthorized!' });
    }

    appSettings.bkashNumber = bkashNumber || appSettings.bkashNumber;
    appSettings.nagadNumber = nagadNumber || appSettings.nagadNumber;
    appSettings.binanceAddress = binanceAddress || appSettings.binanceAddress;
    appSettings.targetBotUrl = targetBotUrl || appSettings.targetBotUrl;
    appSettings.requiredChannel = requiredChannel || appSettings.requiredChannel;
    appSettings.channelLink = channelLink || appSettings.channelLink;
    appSettings.bannerAdText = bannerAdText || appSettings.bannerAdText;
    appSettings.bannerAdUrl = bannerAdUrl || appSettings.bannerAdUrl;
    appSettings.thirdPartyScript = thirdPartyScript !== undefined ? thirdPartyScript : appSettings.thirdPartyScript;

    res.json({ success: true, message: 'সেটিংস সফলভাবে আপডেট হয়েছে!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
