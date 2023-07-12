const { identifyUser } = require("../prisma/util");
const prisma = require("../prisma/client");
const bot = require("./telegramClient");
const { Keyboard } = require("../util/defaultInlineKeyboardLayout");

bot.onText(/\/start/, async (data) => {
    let welcomeText;
    let options;
    const userChatId = data.chat.id;
    const strUserChatId = String(data.chat.id);
    const userStatus = await identifyUser(data);

    // JIKA USER BELUM MENGUNJUNGI BOT SEBELUMNYA
    if (userStatus === false) {
        welcomeText =
            "Welcome to our Health Monitoring Telegram bot! We're excited to have you on board. Our bot is designed to help you track and monitor your health metrics, such as SpO2, heart rate, body temperature, and more. With our easy-to-use interface and powerful features, you'll be able to stay on top of your health and make informed decisions about your wellness.\nThe first step to achieving your best health goals is to create an account. Creating an account is quick and easy. Simply tap \"Create Profil\" button";
        options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "CREATE PROFIL",
                            callback_data: "profilcreate",
                        },
                    ],
                ],
            },
        };
    }

    // JIKA USER SUDAH MENGUNJUNGI BOT SEBELUMNYA
    if (userStatus === true) {
        // Ambil Data User Dari Database
        const user = await prisma.user.findUnique({
            where: {
                user_chat_id: strUserChatId,
            },
        });

        // Jika User Sudah Memiliki Akun
        if (user) {
            welcomeText = `Hello ${
                user?.first_name || user?.last_name || user?.username
            }, nice to see you again.\nWe're glad to see you again and hope that our bot has been helping you stay on top of your health and wellness.\nWhether you've been away for a while or just taking a short break, our bot is always here to support you. Simply type in any command you need or refer to the menu to get started.`;
            options = Keyboard.defaultInlineKeyboard();
        }

        // Jika User Belum Memiliki Akun
        if (!user) {
            welcomeText =
                "Hello, you seem to have been here before, but we still don't really know you 🙄. We highly recommend creating an account to get the most out of our features. By creating an account, you'll be able to record your health condition, Get health status from our latest artificial intelligence technology. Creating an account is quick and easy. Simply tap \"Create Profil\" button";
            options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "CREATE PROFIL",
                                callback_data: "profilcreate",
                            },
                        ],
                    ],
                },
            };
        }
    }

    bot.sendMessage(data.chat.id, welcomeText, options);
});

module.exports = bot;
