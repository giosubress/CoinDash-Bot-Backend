// IMPORTANT: This Node.js code MUST be run on a serverless platform (like Vercel).
// It now uses the Webhook method required by Vercel's serverless functions.

const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');

// --- 1. BOT AND FIREBASE ADMIN CONFIGURATION ---

// 🚨 ACTION REQUIRED: Set the BOT_TOKEN obtained from BotFather.
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE'; 

// 🚨 ACTION REQUIRED: Set the actual appId used in your index.html. 
const APP_ID = process.env.APP_ID || 'default-app-id'; 

// CRITICAL: Initialize Firebase Admin using the Service Account Key file (JSON) content 
// which should be passed via an environment variable named SERVICE_ACCOUNT_KEY on Vercel.
if (!admin.apps.length) {
    try {
        if (process.env.SERVICE_ACCOUNT_KEY) {
            const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("Firebase Admin initialized using SERVICE_ACCOUNT_KEY.");
        } else {
             admin.initializeApp({
                credential: admin.credential.applicationDefault() 
            });
            console.log("Firebase Admin initialized using default application credentials (e.g., for local testing).");
        }
    } catch (error) {
        console.error("Failed to initialize Firebase Admin. Check SERVICE_ACCOUNT_KEY format.", error);
    }
}

const db = admin.firestore();

// The collection path MUST be the same as used in the Canvas game (index.html)
const SCORE_COLLECTION_PATH = `artifacts/${APP_ID}/public/data/coindash_scores`;
const GAME_LINK = 'https://giosubress.github.io/CoinDashGIKA/'; // Your live game link

// --- 2. MULTIPLIER LOGIC (COPIED FROM THE GAME) ---
const calculateMultiplier = (refCount) => {
    if (refCount >= 50) {
        return 5.0; 
    } else if (refCount >= 10) {
        return 2.0; 
    } else if (refCount >= 5) {
        return 1.5; 
    } else {
        return 1.0; 
    }
};

// --- 3. FIRESTORE LEADERBOARD RETRIEVAL LOGIC ---

async function getLeaderboard() {
    if (!db) {
        console.error("Firestore DB is not initialized.");
        return null;
    }
    
    try {
        const q = db.collection(SCORE_COLLECTION_PATH)
                    .orderBy("highScore", "desc")
                    .limit(10);
                    
        const snapshot = await q.get();
        const leaderboard = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            leaderboard.push({
                username: data.username,
                highScore: data.highScore || 0,
                referrals: data.referrals || 0,
            });
        });

        return leaderboard;
    } catch (error) {
        console.error("Error retrieving leaderboard from Firestore:", error);
        return null;
    }
}

// --- 4. BOT COMMANDS CONFIGURATION ---

const bot = new Telegraf(BOT_TOKEN);

// Command /start
bot.start((ctx) => {
    ctx.reply(`Welcome to the CoinDash Bot! 🚀 I'm here to show you the latest leaderboard. Use the /leaderboard command to see the Top 10!`);
});

// Command /leaderboard
bot.command('leaderboard', async (ctx) => {
    ctx.reply('Loading leaderboard... ⏳');
    
    const leaderboard = await getLeaderboard();
    
    if (!leaderboard) {
        return ctx.reply('Could not load the leaderboard right now. Please try again later.');
    }
    
    if (leaderboard.length === 0) {
        return ctx.reply(`The leaderboard is empty! Be the first to play! Start the challenge here: ${GAME_LINK}`);
    }

    let message = '🏆 **COINDASH OFFICIAL LEADERBOARD** 🏆\n\n';
    message += 'Pos. | Score | Multiplier | Player\n';
    message += '--- | --- | --- | ---\n';
    
    leaderboard.forEach((player, index) => {
        const multiplierValue = calculateMultiplier(player.referrals);
        const multiplierText = `x${multiplierValue.toFixed(1)}`;
        const scoreFormatted = player.highScore.toLocaleString();
        
        message += `${index + 1}. | ${scoreFormatted} | ${multiplierText} | ${player.username}\n`;
    });
    
    message += `\n*Total score includes the referral bonus. Play here: ${GAME_LINK}`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});


// --- 5. VERCEL WEBHOOK HANDLER (NEW SECTION) ---
// This exports the function Vercel needs to run the bot as a serverless function.
module.exports = async (req, res) => {
    // Telegraf handles the complexities of the Webhook internally
    try {
        await bot.handleUpdate(req.body, res);
    } catch (err) {
        console.error('Error processing update on Vercel:', err);
        // Important: Always send a 200 OK response to Telegram, even if there was an internal error.
        res.status(200).send('OK'); 
    }
};
