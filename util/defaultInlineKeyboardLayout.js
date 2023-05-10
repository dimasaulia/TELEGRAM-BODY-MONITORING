class Keyboard {
    static defaultInlineKeyboard() {
        return {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "PROFIL DETAIL",
                            callback_data: "profildetail",
                        },
                        {
                            text: "CREATE PROFIL",
                            callback_data: "profilcreate",
                        },
                    ],
                    [
                        { text: "MY DEVICE ", callback_data: "mydevice" },
                        {
                            text: "REGISTER DEVICE ",
                            callback_data: "registerdevice",
                        },
                    ],
                    [
                        {
                            text: "START SESSION",
                            callback_data: "startsession",
                        },
                    ],
                    [{ text: "MY SESSION", callback_data: "mysession" }],
                ],
            },
        };
    }
}

module.exports = { Keyboard };
