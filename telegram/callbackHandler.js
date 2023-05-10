const prisma = require("../prisma/client");
const { setUserActivity } = require("../prisma/util");
const { Keyboard } = require("../util/defaultInlineKeyboardLayout");
const bot = require("./telegramClient");
const mqttpublish = require("../mqttWrapper");

bot.on("callback_query", async (query) => {
    console.log("---------------- ⬇NEW CALLBACK⬇ ----------------");
    console.log(query);

    const userChatId = query.message.chat.id;
    const strUserChatId = String(query.message.chat.id);
    const userMessageId = query.message.message_id;
    const userActivity = query.data;

    // CREATE PROFIL CALLBACK
    if (userActivity === "profilcreate") {
        // Cek If user Already have profil
        const user = await prisma.user.findUnique({
            where: {
                user_chat_id: strUserChatId,
            },
        });

        if (user) {
            setUserActivity(query, "USER_ALREADY_HAVE_PROFIL");
            bot.editMessageText(
                "Don't worry, we have already set up your account. Use the start menu to enjoy other features of our service.",
                {
                    chat_id: userChatId,
                    message_id: userMessageId,
                }
            );

            return;
        }

        setUserActivity(query, "FINISH_CREATE_PROFIL");
        await prisma.user.create({
            data: {
                user_chat_id: strUserChatId,
                username: query.from?.username || `user-${userChatId}`,
                first_name: query.from?.first_name,
                last_name: query.from?.last_name,
            },
        });
        bot.editMessageText(
            "Yeayy 😎, We are already save your data 📝\nNow you can enjoy all telegram bot feature.\nSimply press /start to start",
            {
                chat_id: userChatId,
                message_id: userMessageId,
            }
        );
    }

    // GET PROFIL DETAIL
    if (userActivity === "profildetail") {
        let text = "";
        const user = await prisma.user.findUnique({
            where: {
                user_chat_id: strUserChatId,
            },
        });
        if (user) {
            text = ` ⭐This Your Profile Detail⭐\nUsername:\t${user?.username}\nName:\t${user?.first_name} ${user?.last_name}\n`;
        }

        if (!user) {
            text =
                "Sorry, we not recognize you. Are you new here? please fill up your profil first";
        }
        text += "\nQuick Access to bot menu";
        bot.sendMessage(userChatId, text, Keyboard.defaultInlineKeyboard());
    }

    // JIKA USER MEMILIH MENU UNTUK REGISTER DEVICE
    if (userActivity === "registerdevice") {
        setUserActivity(query, "REGISTER_DEVICE");
        bot.sendMessage(userChatId, "Please type your device id. ex: fa03d");
    }

    // JIKA USER MEMILIH MENU UNTUK DETAIL DEVICE
    if (userActivity === "mydevice") {
        let text;
        let options = {
            chat_id: userChatId,
            message_id: userMessageId,
        };
        const user = await prisma.user.findUnique({
            where: {
                user_chat_id: strUserChatId,
            },
            select: {
                username: true,
                first_name: true,
                last_name: true,
                Device: {
                    select: {
                        shortid: true,
                    },
                },
            },
        });

        if (!user.Device) {
            text =
                'It seems we don\'t recognize your device. Have you linked your device with this account? If not, you can easily link it by pressing the "REGISTER DEVICE" button';
            options["reply_markup"] = JSON.stringify({
                inline_keyboard: [
                    [
                        {
                            text: "REGISTER DEVICE ",
                            callback_data: "registerdevice",
                        },
                    ],
                ],
            });
        }

        if (user.Device) {
            text = `Hello ${
                user?.first_name || user?.last_name || user?.username
            } your account is already linked to a device with id "${
                user?.Device.shortid
            }"`;
        }

        bot.editMessageText(text, options);
    }

    // JIKA USER MEMILIH MENU UNTUK START SESSION
    if (userActivity === "startsession") {
        let text;
        let options = {
            chat_id: userChatId,
            message_id: userMessageId,
        };
        // Ambil Data User Dari DB
        const user = await prisma.user.findUnique({
            where: {
                user_chat_id: strUserChatId,
            },
            select: {
                username: true,
                first_name: true,
                last_name: true,
                Device: {
                    select: {
                        shortid: true,
                    },
                },
            },
        });

        // Jika User Belum memiliki perangkkat
        if (!user.Device) {
            text =
                'It seems we don\'t recognize your device. Have you linked your device with this account? If not, you can easily link it by pressing the "REGISTER DEVICE" button';
            options["reply_markup"] = JSON.stringify({
                inline_keyboard: [
                    [
                        {
                            text: "REGISTER DEVICE ",
                            callback_data: "registerdevice",
                        },
                    ],
                ],
            });
            bot.editMessageText(text, options);
            return;
        }

        // Jika User Sudah Memiliki device maka start session
        const session = await prisma.session.create({
            data: {
                active: true,
                device: {
                    connect: {
                        shortid: user.Device.shortid,
                    },
                },
            },
        });
        setUserActivity(query, `START_SESSION#${session.id}#${userMessageId}`);
        bot.editMessageText(
            "The measurement session will start immediately, place your finger on the sensor for 2 minutes. The results of measurements taken by your device will appear below.",
            options
        );

        // Broadcast data ke MQTT agar segera memulai pengukuran
        mqttpublish(`/session/start/${user.Device.shortid}`, "BROADCAST#2");
    }

    // JIKA USER MEMILIH UNTUK MELIHAT LIST SESSION
    if (userActivity === "mysession") {
        setUserActivity(query, "SESSION_LIST");
        let options = {
            chat_id: userChatId,
            message_id: userMessageId,
        };
        const sessions = await prisma.session.findMany({
            orderBy: { id: "asc" },
            take: 5,
        });

        const itemList = [];
        sessions.forEach((session) => {
            itemList.push([
                {
                    text: `${session.id}`,
                    callback_data: `SESSION_DETAIL#${session.id}`,
                },
            ]);
        });

        options["reply_markup"] = JSON.stringify({
            inline_keyboard: itemList,
        });

        bot.editMessageText(
            "Our bot provides a comprehensive list of all your recent health measurements, including SPO2, heart rate, and body temperature. You can access this list at any time to track your progress, identify trends, and make informed decisions about your health and wellness. If you have any questions about your measurements, don't hesitate to reach out to our support team for assistance.\n\n🧾Here's a list of your recent health measurements:",
            options
        );
    }

    // JIKA USER MEMILIH UNTUK MELIHAT DETAIL SESSION
    if (userActivity.startsWith("SESSION_DETAIL")) {
        const [activity, sessionId] = userActivity.split("#");

        const data = await prisma.session.findUnique({
            where: {
                id: sessionId,
            },
            select: {
                id: true,
                spo2: true,
                heartRate: true,
                temprature: true,
            },
        });

        const text = `🧾 This is a summary of the measurement\n🆔 Session ID: ${data.id}\n\n💓 Average Heart Rate: ${data.heartRate}\n 🫧 Average SpO2: ${data.spo2}\n 🌡️ Average Body Temprature: ${data.temprature}\n\nOur displayed data is based on the average measurements taken at regular intervals. This helps to ensure accuracy and consistency in your readings, so you can be confident in the information you're receiving about your health metrics.\n\n 🖥️ System Diagnostics:\nBased on measurement data and analysis of our system. We diagnose you are experiencing excessive fatigue. Maybe your final project activities are too burdensome, try to take a break for a while, differentiating activities can make you more relaxed.*diagnostic data is dummy`;
        let options = {
            chat_id: userChatId,
            message_id: userMessageId,
        };
        bot.editMessageText(text, options);
    }
});

module.exports = bot;
