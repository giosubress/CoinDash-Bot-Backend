   // IMPORTANT: This Node.js code MUST be run on a server (VPS, Vercel, AWS Lambda, etc.)
        // It requires the following libraries: telegraf and firebase-admin (defined in package.json)

        const { Telegraf } = require('telegraf');
        const admin = require('firebase-admin');

        // --- 1. BOT AND FIREBASE ADMIN CONFIGURATION ---

        // 🚨 ACTION REQUIRED: Set the BOT_TOKEN obtained from BotFather.
        // It is read securely from the Vercel/Hosting environment variables.
        const BOT_TOKEN = process.env.BOT_TOKEN || CoinDashGika_bot; 

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
                    // Fallback for local testing or platforms that use default credentials
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
            // Check if Firestore is initialized
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
                
                // Create the Markdown formatted row for Telegram
                message += `${index + 1}. | ${scoreFormatted} | ${multiplierText} | ${player.username}\n`;
            });
            
            message += `\n*Total score includes the referral bonus. Play here: ${GAME_LINK}`;

            // Send the message using Markdown formatting
            ctx.reply(message, { parse_mode: 'Markdown' });
        });


        // Set up a simple webhook or use long polling. For Vercel, a webhook is generally cleaner.
        // For simplicity in a single script, we stick to long polling for immediate testing.
        bot.launch()
            .then(() => console.log('CoinDash Telegram Bot started! Listening...'))
            .catch(err => console.error('Error starting the bot:', err));

        // Enable graceful termination
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));

