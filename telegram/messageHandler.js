const prisma = require("../prisma/client");
const { getUserActivity, setUserActivity } = require("../prisma/util");
const bot = require("./telegramClient");

bot.on("message", async (data) => {
    console.log("---------------- ⬇NEW MESSAGE⬇ ----------------");
    console.log(data);

    // IGNORE COMMAND
    if (
        data?.entities &&
        data?.entities.length > 0 &&
        data?.entities[0]?.type === "bot_command"
    ) {
        return;
    }

    /**
     * Fungsi ini digunakan untuk menangani pesan yang dikirim oleh user. Cara kerjanya, ketika user mengirim pesan tanpa command
     * Sistem akan melihat aktifitas terakhir user di databse.
     * Fungsi yang akan dijalankan akan sesuai dengan aktifitas terakhir user yang tercatat.
     * EX: User memilih mendafatarkan perangkatnya, pada database aktivitas user akan dicatat sebagai REGISTER_DEVICE
     * ketika bot menerima pesan tanpa konteks, bot akan menjalankan fungsi untuk menyimpan device user ke database dan menautkan nya kepada user
     */

    const userActivity = await getUserActivity(data);
    const userChatId = data.chat.id;
    const strUserChatId = String(data.chat.id);
    const userMessage = data.text;

    //INFO: REGISTER_DEVICE
    if (userActivity === "REGISTER_DEVICE") {
        // Ambil data dari databse
        const device = await prisma.device.findUnique({
            where: {
                shortid: userMessage,
            },
            select: {
                id: true,
                user: {
                    select: {
                        user_chat_id: true,
                    },
                },
            },
        });

        // Cek Apakah Perangkat Tersedia
        if (!device) {
            setUserActivity(data, "FAILED_TO_REGISTER_DEVICE_DEVICE_NOT_FOUND");
            bot.sendMessage(
                userChatId,
                "Sorry we can't find your device in our system"
            );
            return;
        }

        // Cek Apakah Perangkat Sudah Tertaut dengan user lain
        if (
            device?.user?.user_chat_id &&
            strUserChatId !== device?.user?.user_chat_id
        ) {
            setUserActivity(
                data,
                "FAILED_TO_REGISTER_DEVICE_DEVICE_ALREADY_LINKED"
            );
            bot.sendMessage(
                userChatId,
                "Sorry we can't link your account to this device. This device already have user"
            );
            return;
        }

        // Jika perangkat sudah ditautkan dengan user yang meminta penautan perangkat
        if (strUserChatId === device?.user?.user_chat_id) {
            setUserActivity(data, "DEVICE_READY_TO_USE");
            bot.sendMessage(
                userChatId,
                "Don't worry, we have already link your device with your account. From now you can record your health condition, and get health advice from our artificial intelligence"
            );
            return;
        }

        // Jika tidak ada rule yang dilanggar
        await prisma.device.update({
            where: {
                shortid: userMessage,
            },
            data: {
                user: {
                    connect: {
                        user_chat_id: strUserChatId,
                    },
                },
            },
        });
        bot.sendMessage(
            userChatId,
            "Yeayyy 🌞\nSuccessfully link your device with your account"
        );
    }
});

module.exports = bot;
