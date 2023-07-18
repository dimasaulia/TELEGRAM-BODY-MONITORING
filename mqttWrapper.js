const { MqttServer } = require("./connection/mqttserver");
const prisma = require("./prisma/client");
const { setUserActivity } = require("./prisma/util");
const axios = require("axios");
const bot = require("./telegram/telegramClient");
MqttServer.createConnection();

let counter = 1;

MqttServer.listener("/session/record/+", async (payload, _) => {
    const body = JSON.parse(payload);
    const device = await prisma.device.findUnique({
        where: {
            shortid: body.deviceId,
        },
        select: {
            shortid: true,
            user: {
                select: {
                    user_chat_id: true,
                },
            },
        },
    });

    // Jika ID Perangkat Tidak Ditemukan
    if (!device) {
        console.log(
            "ERR: Device Not Found, Incoming data will not be processed"
        );
        return;
    }

    // Jika Perangkat masih belum memiliki user
    if (!device?.user?.user_chat_id) {
        console.log(
            "ERR: Device Not Linked to user, Incoming data will not be processed"
        );
        return;
    }

    const userActivity = await prisma.userActivity.findUnique({
        where: {
            user_chat_id: device.user.user_chat_id,
        },
    });

    // Jika Session Tidak Aktif
    if (!userActivity.activity.startsWith("START_SESSION")) {
        console.log(
            "ERR: No active sessions found, Incoming data will not be processed"
        );
        return;
    }

    // Jika terdapat Sessi yang aktif, maka split data
    const [activityName, sessionId, userMessageId] =
        userActivity.activity.split("#");

    // Perbaharui pesan milik user
    const text = `🕺🏽This Is Your Measurements🎉\n 📥 Measurements No: ${body.no}\n 💓 Heart Rate: ${body.heartRate}\n 🫧 SpO2: ${body.spo2}\n 🌡️ Body temperature: ${body.temperature}`;
    bot.editMessageText(text, {
        chat_id: device.user.user_chat_id,
        message_id: userMessageId,
    });
    counter++;

    // Option To Give Some Interval when data come

    // Save data to session history
    await prisma.history.create({
        data: {
            heartRate: body.heartRate,
            spo2: body.spo2,
            temperature: body.temperature,
            session: {
                connect: {
                    id: sessionId,
                },
            },
        },
    });
});

MqttServer.listener("/session/stop/+", async (payload, _) => {
    const body = JSON.parse(payload);

    const device = await prisma.device.findUnique({
        where: {
            shortid: body.deviceId,
        },
        select: {
            shortid: true,
            user: {
                select: {
                    user_chat_id: true,
                },
            },
        },
    });

    // Jika ID Perangkat Tidak Ditemukan
    if (!device) {
        console.log(
            "ERR: Device Not Found, Incoming data will not be processed"
        );
        return;
    }

    // Jika Perangkat masih belum memiliki user
    if (!device?.user?.user_chat_id) {
        console.log(
            "ERR: Device Not Linked to user, Incoming data will not be processed"
        );
        return;
    }

    const userActivity = await prisma.userActivity.findUnique({
        where: {
            user_chat_id: device.user.user_chat_id,
        },
    });

    // Jika Aktifitas terkahir user bukan START_SESSION
    if (!userActivity.activity.startsWith("START_SESSION")) {
        console.log(
            "ERR: No active sessions found, Incoming data will not be processed"
        );
        return;
    }

    // Jika terdapat Sessi yang aktif, maka split data
    const [activityName, sessionId, userMessageId] =
        userActivity.activity.split("#");

    // Lakukan Pemrosesan Data Yang Dikumpulkan disini
    const session = await prisma.session.findUnique({
        where: {
            id: sessionId,
        },
        select: {
            id: true,
            sleepTime: true,
            mood: true,
            History: {
                where: {
                    sessionId: sessionId,
                },
                select: {
                    temperature: true,
                    spo2: true,
                    heartRate: true,
                },
            },
        },
    });

    const sessionLength = session.History.length;

    const temperatureSum = session.History.reduce(
        (a, b) => a + Number(b.temperature),
        0
    );
    const spo2Sum = session.History.reduce((a, b) => a + Number(b.spo2), 0);
    const heartRateSum = session.History.reduce(
        (a, b) => a + Number(b.heartRate),
        0
    );
    const temperatureAverage = temperatureSum / sessionLength;
    const spo2Average = spo2Sum / sessionLength;
    const heartRateAverage = heartRateSum / sessionLength;

    // KIRIM DATA KE AI SERVER
    // Define the data to be sent in the request body
    const data = {
        temperature: parseFloat(temperatureAverage),
        spo2: parseFloat(spo2Average),
        sleepTime: parseFloat(session.sleepTime),
        heartRate: parseFloat(heartRateAverage),
    };

    // Make a POST request
    const resp = await axios.post(`http://${process.env.AI_SERVER}/`, data);
    const stressLevel = resp.data.stressLevel;
    let description = "";

    if (stressLevel == "0") {
        description =
            "Based on measurement data and analysis of our system, we diagnose you are in a good state and relaxed. Your vital signs are showing good results. Keep healthy and be happy!\n\n⚠️ This is not standardized medical advice. If you experience an abnormal reaction in your body, please visit the nearest hospital for further examination.";
    }

    if (stressLevel == "1") {
        description =
            "Based on measurement data and analysis of our system, we diagnose you are experiencing a slight stress. Maybe you feel a little bit dizzy or overwhelmed. Try to take a break for a while, do activities you like can make you more relaxed.\n\n⚠️ This is not standardized medical advice. If you experience an abnormal reaction in your body, please visit the nearest hospital for further examination.";
    }

    if (stressLevel == "2") {
        description =
            "Based on measurement data and analysis of our system, we diagnose you are experiencing excessive fatigue. Maybe your work is too burdensome for you. Try to take a break for a while, differentiating activities can make you more relaxed.\n\n⚠️ This is not standardized medical advice. If you experience an abnormal reaction in your body, please visit the nearest hospital for further examination.";
    }

    if (stressLevel == "3") {
        description =
            "Based on measurement data and analysis of our system, we diagnose you are experiencing anxiety and pessimism. Do not overthink things too much. Try to avoid something that makes you feel overwhelmed and moody. You can start by do something you regularly enjoy.\n\n⚠️ This is not standardized medical advice. If you experience an abnormal reaction in your body, please visit the nearest hospital for further examination.";
    }

    if (stressLevel == "4") {
        description =
            "Based on measurement data and analysis of our system, we diagnose you are experiencing burn-out and breakdown. You need to escape from this state because it can be worse. Try to reduce the stressor and do some exercises to make you healthy and your mind focused.\n\n⚠️ This is not standardized medical advice. If you experience an abnormal reaction in your body, please visit the nearest hospital for further examination.";
    }

    // Jika tidak ada rule yang dilanggar
    const text = `⏳ Your health measurement session is over\n🧾 This is a summary of the measurement\n💓 Average Heart Rate: ${heartRateAverage}\n 🫧 Average SpO2: ${spo2Average}\n 🌡️ Average Body Temperature: ${temperatureAverage}\n 💤 Sleep Time: ${session.sleepTime} hours\n 🍫 Mood: ${session.mood}\n 📈Stress Level: ${stressLevel}\n\nOur displayed data is based on the average of ${sessionLength} measurements taken at regular intervals. This helps to ensure accuracy and consistency in your readings, so you can be confident in the information you're receiving about your health metrics.\n\n 🖥️ System Diagnostics:\n${description}`;

    bot.editMessageText(text, {
        chat_id: device.user.user_chat_id,
        message_id: userMessageId,
    });

    // UPDATE SESSION DATA
    await prisma.session.update({
        where: {
            id: sessionId,
        },
        data: {
            active: false,
            heartRate: String(heartRateAverage),
            spo2: String(spo2Average),
            temperature: String(temperatureAverage),
            description: description,
            stressLevel: String(stressLevel),
        },
    });

    // Update User Activity
    await prisma.userActivity.update({
        where: {
            user_chat_id: device.user.user_chat_id,
        },
        data: {
            activity: "FINISH_SESSION",
        },
    });
});

module.exports = MqttServer.response;
