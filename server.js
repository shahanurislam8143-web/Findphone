const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe.user || { id: 0, first_name: 'Guest' };
let targetUrl = '';
let currentLang = 'bn';

function toggleLanguage() {
    currentLang = currentLang === 'bn' ? 'en' : 'bn';
    document.querySelectorAll('[data-bn]').forEach(el => {
        el.innerText = el.getAttribute(`data-${currentLang}`);
    });
}

function initApp() {
    fetch(`/api/init-app/${user.id}`)
        .then(res => res.json())
        .then(data => {
            if (data.appSettings) {
                targetUrl = data.appSettings.targetBotUrl;
                document.getElementById('show-bkash').innerText = data.appSettings.bkashNumber || 'N/A';
                document.getElementById('show-nagad').innerText = data.appSettings.nagadNumber || 'N/A';
                document.getElementById('show-binance').innerText = data.appSettings.binanceAddress || 'N/A';

                document.getElementById('join-chan-btn').onclick = () => {
                    tg.openTelegramLink(data.appSettings.channelLink || "https://t.me/nexuslink0");
                };

                if (data.appSettings.bannerAdText) {
                    document.getElementById('ad-text').innerText = data.appSettings.bannerAdText;
                    document.getElementById('ad-link').href = data.appSettings.bannerAdUrl;
                    document.getElementById('custom-ad-banner').style.display = 'block';
                }
                if (data.appSettings.thirdPartyScript) {
                    injectScript(data.appSettings.thirdPartyScript);
                }
            }

            // 🎯 পেমেন্ট ও জয়েন লজিক ফিক্স
            if (data.approved) {
                document.getElementById('payment-section').style.display = 'none';
                
                // পেমেন্ট অ্যাপ্রুভ হলেও আগে চ্যানেল জয়েন চেক করবে
                if (data.isJoined) {
                    showSuccessService();
                } else {
                    // চ্যানেলে যুক্ত না থাকলে বাধ্যতামুলক জয়েন বক্স দেখাবে
                    document.getElementById('join-section').style.display = 'block';
                }
            } else {
                document.getElementById('payment-section').style.display = 'block';
            }

            // অ্যাডমিন প্যানেল চেক
            fetch(`/api/admin/payments/${user.id}`)
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Not admin');
                })
                .then(adminData => {
                    document.getElementById('admin-panel').style.display = 'block';
                    loadAdminDataWithData(adminData);
                })
                .catch(() => {
                    document.getElementById('admin-panel').style.display = 'none';
                });
        });
}

document.getElementById('verify-join-btn').onclick = () => {
    fetch(`/api/check-join/${user.id}`)
        .then(res => res.json())
        .then(data => {
            if (data.isJoined) {
                document.getElementById('join-section').style.display = 'none';
                showSuccessService();
            } else {
                alert(currentLang === 'bn' ? 'আপনি এখনো আমাদের চ্যানেলে জয়েন করেননি! আগে জয়েন করুন।' : 'You have not joined our channel yet!');
            }
        });
};

function showSuccessService() {
    document.getElementById('service-section').style.display = 'block';
    const redirectToTarget = () => {
        if (targetUrl.includes('t.me')) {
            tg.openTelegramLink(targetUrl);
        } else {
            tg.openLink(targetUrl);
        }
    };
    document.getElementById('go-to-bot-btn').onclick = redirectToTarget;
    // অটো রিডাইরেক্ট তুলে দেওয়া হলো যেন ইউজার নিজে বাটন প্রেস করে যেতে পারে
}

function submitPayment() {
    const phone = document.getElementById('user-phone').value;
    const method = document.getElementById('pay-method').value;
    const trxId = document.getElementById('trx-id').value;

    if (!phone || !trxId) return alert('অ্যাকাউন্ট তথ্য এবং TrxID প্রদান করুন!');

    fetch('/api/submit-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: user.id,
            userName: user.first_name,
            phone: phone,
            method: method,
            trxId: trxId
        })
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('pay-msg').innerText = data.message;
    });
}

function loadAdminDataWithData(data) {
    const tbody = document.getElementById('payment-table-body');
    tbody.innerHTML = '';

    data.payments.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${p.userName}</b><br>${p.phone}<br><small>(${p.userId})</small></td>
            <td><b>${p.method}</b><br><code>${p.trxId}</code></td>
            <td><span class="badge bg-${p.status}">${p.status}</span></td>
            <td>
                ${p.status === 'pending' ? `
                    <button class="btn-approve" onclick="handleAction(${p.id}, 'approve')">Approve</button>
                    <button class="btn-reject" onclick="handleAction(${p.id}, 'reject')">Reject</button>
                ` : 'N/A'}
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('admin-bkash').value = data.appSettings.bkashNumber || '';
    document.getElementById('admin-nagad').value = data.appSettings.nagadNumber || '';
    document.getElementById('admin-binance').value = data.appSettings.binanceAddress || '';
    document.getElementById('admin-target-bot').value = data.appSettings.targetBotUrl || '';
    document.getElementById('admin-req-channel').value = data.appSettings.requiredChannel || '';
    document.getElementById('admin-chan-link').value = data.appSettings.channelLink || '';
    document.getElementById('admin-ad-text').value = data.appSettings.bannerAdText || '';
    document.getElementById('admin-ad-url').value = data.appSettings.bannerAdUrl || '';
    document.getElementById('admin-ad-script').value = data.appSettings.thirdPartyScript || '';
}

function handleAction(paymentId, action) {
    fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, paymentId: paymentId, action: action })
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            location.reload();
        }
    });
}

function saveAdminSettings() {
    const bkash = document.getElementById('admin-bkash').value;
    const nagad = document.getElementById('admin-nagad').value;
    const binance = document.getElementById('admin-binance').value;
    const targetBot = document.getElementById('admin-target-bot').value;
    const reqChan = document.getElementById('admin-req-channel').value;
    const chanLink = document.getElementById('admin-chan-link').value;
    const text = document.getElementById('admin-ad-text').value;
    const url = document.getElementById('admin-ad-url').value;
    const script = document.getElementById('admin-ad-script').value;

    fetch('/api/admin/update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            adminId: user.id,
            bkashNumber: bkash,
            nagadNumber: nagad,
            binanceAddress: binance,
            targetBotUrl: targetBot,
            requiredChannel: reqChan,
            channelLink: chanLink,
            bannerAdText: text,
            bannerAdUrl: url,
            thirdPartyScript: script
        })
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            alert('সব সেটিংস সফলভাবে সেভ করা হয়েছে!');
            location.reload();
        }
    });
}

function injectScript(scriptHtml) {
    const container = document.getElementById('third-party-ads');
    const range = document.createRange();
    range.setStart(container, 0);
    container.appendChild(range.createContextualFragment(scriptHtml));
}

initApp();
