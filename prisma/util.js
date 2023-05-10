const prisma = require("./client");

async function identifyUser(msg) {
    try {
        // GET USER CHAT FROM USER ACTIVITY DB
        const user = await prisma.userActivity.findUnique({
            where: {
                user_chat_id: String(msg.chat.id),
            },
        });

        // JIKA SUDAH TERDAPAT USER, MAKA STATUS MENJADI WELCOME_BACK
        if (user) {
            await prisma.userActivity.update({
                where: {
                    user_chat_id: String(msg.chat.id),
                },
                data: {
                    activity: "WELCOME_BACK",
                },
            });
            return true;
        }

        // JIKA TIDAK TERDAPAT USER, MAKA STATUS MENJADI WELCOME NEW USER
        if (!user) {
            await prisma.userActivity.create({
                data: {
                    user_chat_id: String(msg.chat.id),
                    activity: "WELCOME_NEW_USER",
                },
            });
            return false;
        }
    } catch (error) {
        console.log(error);
    }
}

async function setUserActivity(data, activity) {
    const chatID = data?.message?.chat?.id || data?.chat?.id;
    await prisma.userActivity.update({
        where: {
            user_chat_id: String(chatID),
        },
        data: {
            activity: activity,
        },
    });
}

async function getUserActivity(data) {
    const chatID = data?.message?.chat?.id || data?.chat?.id;
    const userActivity = await prisma.userActivity.findUnique({
        where: {
            user_chat_id: String(chatID),
        },
    });

    return userActivity?.activity;
}

module.exports = { identifyUser, setUserActivity, getUserActivity };
