const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ==================== ⚙️ CONFIGURATION ⚙️ ====================
const TOKEN = '8864054482:AAENYq7qGxVccgTOvCgeLin-LZP5uhQUk50'; 
const ADMIN_ID = 7779071715;                                   
const WEBAPP_URL = 'https://findphone-rxl7.onrender.com';      
// ==============================================================

const bot = new TelegramBot(TOKEN, { polling: true });

let payments = []; 
let userAccess = new Map(); 

let appSettings = {
    bkashNumber: "বন্ধ আছে",
    nagadNumber: "01341048143",
    binanceAddress: "1135769847 (Pay ID)",
    targetBotUrl: "https://t.me/findsyourdevice_bot",
    requiredChannel: "@nexuslink0",
    channelLink: "https://t.me/nexuslink0",
    bannerAdText: "🔥 বিশেষ ছাড়! ৫০% ডিসকাউন্ট পেতে স্পন্সর ওয়েবসাইট দেখুন।",
    bannerAdUrl: "https://example.com",
    thirdPartyScript: ""
};

// 🔍 Channel Join Status Checker
async function checkChannelMembership(userId) {
    try {
        if (!appSettings.requiredChannel) return true;
        
        let targetChannel = appSettings.requiredChannel.trim();
        
        if (!targetChannel.startsWith('@') && !targetChannel.startsWith('-100')) {
            targetChannel = '@' + targetChannel;
        }

        const member = await bot.getChatMember(targetChannel, userId);
        return ['creator', 'administrator', 'member'].includes(member.status);
    } catch (error) {
        console.error("Channel Check Failed Reason:", error.message);
        return false;
    }
}

// Bot Command Handler
bot.on('message', async (msg) => {
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

app.post('/api/submit-payment', async (req, res) => {
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

    // Admin Bot Inbox Notification Message
    try {
        await bot.sendMessage(ADMIN_ID,
            `🔔 **নতুন সাবস্ক্রিপশন পেমেন্ট রিকোয়েস্ট!**\n\n` +
            `👤 **User:** ${userName} (\`${userId}\`)\n` +
            `📱 **Phone/Account:** \`${phone}\`\n` +
            `💳 **Method:** ${method}\n` +
            `🧾 **TrxID/TxID:** \`${trxId}\`\n\n` +
            `অনুমোদনের জন্য মিনি অ্যাপের অ্যাডমিন প্যানেল ভিজিট করুন।`,
            { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "💳 Subscription Panel", web_app: { url: WEBAPP_URL } }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error("Admin Notify Error:", err.message);
    }

    res.json({ success: true, message: 'পেমেন্ট সাবমিট করা হয়েছে! অ্যাডমিন ভেরিফাই করলে সেবা আনলক হবে।' });
});

app.get('/api/admin/payments/:adminId', (req, res) => {
    const adminId = parseInt(req.params.adminId);
    if (adminId !== ADMIN_ID) {
        return res.status(403).json({ error: 'Unauthorized!' });
    }
    res.json({ payments: payments, appSettings: appSettings });
});

app.post('/api/admin/action', async (req, res) => {
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

        try {
            await bot.sendMessage(targetPayment.userId, 
                '🎉 **অভিনন্দন! আপনার পেমেন্ট সফল হয়েছে।**\n\nঅ্যাপে ঢুকে চ্যানেল জয়েন ভেরিফাই করে মূল সার্ভিস ব্যবহার করুন।');
        } catch (e) {
            console.error("User notify error:", e.message);
        }
    } else if (action === 'reject') {
        targetPayment.status = 'rejected';
        userAccess.set(targetPayment.userId, false);

        try {
            await bot.sendMessage(targetPayment.userId, '❌ দুঃখিত, আপনার পেমেন্ট রিকোয়েস্টটি বাতিল করা হয়েছে। সঠিক TrxID দিন।');
        } catch (e) {
            console.error("User notify error:", e.message);
        }
    }

    res.json({ success: true, payment: targetPayment });
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

app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
        
