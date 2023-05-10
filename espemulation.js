const mqtt = require("mqtt");

console.log("----------------ESP EMULATION START----------------");

const client = mqtt.connect(
    `mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`,
    {
        clean: true,
        connectTimeout: 4000,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        reconnectPeriod: 1000,
    }
);

client.on("connect", function () {
    console.log("ESP Emulator connect to MQTT Server");

    client.subscribe("/session/start/fa03d", function (err) {
        if (!err) {
            console.log(
                'ESP Emulator listening to "/session/start/fa03d" topic'
            );
            // client.publish("presence", "Hello mqtt");
        }
    });
});

client.on("message", function (topic, message) {
    // message is Buffer
    console.log(message.toString());
    // client.end();
});
