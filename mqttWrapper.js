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
    axios
        .post("http://127.0.0.1:8000/", data)
        .then((response) => {
            // Handle the response data
            const text = `⏳ Your health measurement session is over\n🧾 This is a summary of the measurement\n💓 Average Heart Rate: ${heartRateAverage}\n 🫧 Average SpO2: ${spo2Average}\n 🌡️ Average Body Temperature: ${temperatureAverage}\n 💤 Sleep Time: ${session.sleepTime} hours\n 🍫 Mood: ${session.mood}\n 📈Stress Level: ${response.data.stressLevel}\n\nOur displayed data is based on the average of ${sessionLength} measurements taken at regular intervals. This helps to ensure accuracy and consistency in your readings, so you can be confident in the information you're receiving about your health metrics.\n\n 🖥️ System Diagnostics:\nBased on measurement data and analysis of our system. We diagnose you are experiencing excessive fatigue. Maybe your final project activities are too burdensome, try to take a break for a while, differentiating activities can make you more relaxed.*diagnostic data is dummy`;

            bot.editMessageText(text, {
                chat_id: device.user.user_chat_id,
                message_id: userMessageId,
            });
        })
        .catch((error) => {
            // Handle the error
            console.error(error);
        });

    // Jika tidak ada rule yang dilanggar
    await prisma.session.update({
        where: {
            id: sessionId,
        },
        data: {
            active: false,
            heartRate: String(temperatureAverage),
            spo2: String(spo2Average),
            temperature: String(heartRateAverage),
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
