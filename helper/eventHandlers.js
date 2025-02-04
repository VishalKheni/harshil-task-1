const redisClient = require('../config/redisConfig');
const { getIO } = require('./io_setup');
const db  = require('../config/db');


const emitToSockets = async (userId, eventName, data) => {
    try {
        const socketIds = await redisClient.lrange(`user:${userId}:sockets`, 0, -1);
        console.log("userId, eventName, data, socketIds", userId, eventName, data, socketIds);

        socketIds.forEach((socketId) => {
            const socket = getIO().sockets.sockets.get(socketId);
            if (socket) {
                console.log("emit snet")
                socket.emit(eventName, data);
            } else {
                console.log(`Socket not found for event: ${eventName}`);
            }
        });
    } catch (error) {
        console.log("error in emitToSocket", error)
    }
};

const getSocketCount = async () => {
    try {
        const userKeys = await redisClient.keys('user:*:sockets');
        let totalSocketCount = 0;

        for (const key of userKeys) {   
            const socketIds = await redisClient.lrange(key, 0, -1);
            totalSocketCount += socketIds.length;
        }

        return totalSocketCount;
    } catch (error) {
        console.error("Error getting socket count:", error);
        return 0;
    }
};

const socket_register = async (io,socket, data) => {
    console.log("socket_register <<data,socket.id>>", data, socket.id);
    const user_id = data.user_id;
    socket.user_id = user_id;

    await redisClient.lpush(`user:${user_id}:sockets`, socket.id);
    try {
        let active_count = await getSocketCount()
        io.emit("active_count", { active_count: active_count })
    } catch (error) {
        console.log("error in active_count emit", error)
    }
    console.log("socketIds", await redisClient.lrange(`user:${user_id}:sockets`, 0, -1));
}

const join_room = async (socket, data) => {
    console.log("join_room called", data);
    const user_id = data.user_id;
    const chat_id = parseInt(data.chat_id);
    socket.user_id = user_id;
    socket.join(chat_id);

    try {
        const clientsInRoom = getIO().sockets.adapter.rooms.get(chat_id).size;
        console.log(`clientsInRoom: ${clientsInRoom}`);
        await emitToSockets(user_id, "join_room", {Message: "Successful", info: data});
    } catch (error) {
        console.error("Error joining room:", error);
    }
}

const left_room = async (socket, data) => {
    console.log("left_room called", data);

    const chat_id = parseInt(data.chat_id);
    socket.leave(chat_id);

    try {
        await emitToSockets(data.user_id, "left_room", {Message: "Successful", info: data});
    } catch (error) {
        console.error("Error left room:", error);
    }
}

const ready_to_join = async (socket, data) => {
    console.log("ready_to_join called", data);
    let user_id = data.user_id
    // console.log(userData)
    await db.User.update({ is_ready: 1 }, { where: { user_id: user_id } })


    // let otherUser = await db.User.findOne({
    //     where: {
    //         user_id: {
    //             [Op.not]: user_id
    //         },
    //         is_ready: 1,
    //     },
    //     order: db.sequelize.random(),
    // });
    // let res = await db.sequelize.query("call FindAndUpdateRandomUser()", { type: QueryTypes.SELECT })
    const results = await db.sequelize.query('CALL FindAndUpdateRandomUser(:param1)', {
        replacements: { param1: user_id },
        type: db.Sequelize.QueryTypes.RAW,
    })
    console.log("results", results[0]);
    console.log(" results[0].user_id", results[0].user_id);
    console.log("user_id ", user_id);

    if (results[0].user_id == undefined) {
        emitToSockets(user_id, "join_video", { status: "fail", message: "no user found" })
    } else {
        let userData = await db.User.findOne({ where: { user_id: user_id } })
        let otherUser = await db.User.findOne({ where: { user_id: results[0].user_id } })

        let roomData = await createVideoRoom()
        console.log("roomData", roomData)

        await db.Room.create({
            room_created_by: user_id,
            room_created_to: otherUser.user_id,
            hms_room_id: roomData.room_id
        })

        let emitData = {
            user_id: userData.user_id,
            email: userData.email,
            username: userData.username,
            first_name: userData.first_name,
            last_name: userData.last_name,
            profile_image: userData.profile_image,
            other_user_id: otherUser.user_id,
            other_email: otherUser.email,
            other_username: otherUser.username,
            other_first_name: otherUser.first_name,
            other_last_name: otherUser.last_name,
            other_profile_image: otherUser.profile_image,
            room_id: roomData.room_id
        }
        console.log("log3")
        emitToSockets(user_id, "join_video", emitData)
        emitToSockets(otherUser.user_id, "join_video", emitData)
    }

}

const left_video = async (socket, data) => {
    console.log("left_video called", data);
    let is_ready = parseInt(data.is_ready)
    let user_id = data.user_id
    let other_id = data.other_id
    await db.User.update({ is_ready: 0 }, { where: { user_id: user_id } })
    await db.User.update({ is_ready: 0 }, { where: { user_id: other_id } })

    let userData = await db.User.findOne({ where: { user_id: user_id } })
    let emitData = {
        user_id: userData.user_id,
        email: userData.email,
        username: userData.username,
        first_name: userData.first_name,
        last_name: userData.last_name,
        profile_image: userData.profile_image,
    }
    console.log("emitData in left_vidfeo", emitData)
    emitToSockets(other_id, "end_video_call", emitData)
}

const back_video_user = async (socket, data) => {
    console.log("back_video_user called", data);
    let user_id = data.user_id
    await db.User.update({ is_ready: 0 }, { where: { user_id: user_id } })
}

const video_running = async (socket, data) => {
    console.log("video_running called", data);
    let user_id = data.user_id
    let is_ready = data.is_ready
    await db.User.update({ is_ready: is_ready }, { where: { user_id: user_id } })
}

const notification_count = async (socket, data) => {
    try {
        let userId = data.user_id
        let notificationCount = await db.Notification.count({ where: { notification_to: userId, message_status: "Unread" } });
        console.log("im in notification_count emit", notificationCount);
        const info = {
            notificationCount

        }
        await emitToSockets(userId, "notification_count", info);
        try {
            let active_count = await getSocketCount()
            io.emit("active_count", { active_count: active_count })
        } catch (error) {
            console.log("error in active_count emit", error)
        }
    } catch (error) {
        console.error("Error in afterCreate hook:", error);
    }
}

const unread_chat_count = async (socket, data) => {
    // const getChatCountQuery = `SELECT COUNT(distinct(chat_id)) as total_unread FROM 
    //tbl_messages where message_to = ? AND message_status = 0 group by chat_id`;

    // const getChatRes = await commonService.performQuery(getChatCountQuery, [
    //   data.user_id,
    // ]);
    // const getChatroomCountQuery = `SELECT COUNT(distinct(chatroom_id)) as total_unread FROM tbl_seen_chatroom_message where message_to = ? AND is_seen = 0`;
    // const getChatroomRes = await commonService.performQuery(
    //   getChatroomCountQuery,
    //   [data.user_id]
    // );
    const unreadChatCount = await db.Message.count({
        where: {
            message_to: data.user_id, message_status: "Unread"
            //     [Op.or]: [
            //         { message_to: data.user_id, is_read: false },
            //         // { message_by: user_id, is_read: false }
            //     ]
        },
        distinct: true,
        col: 'chat_id'
    });

    const unreadMessageCount = await db.Message.count({
        where: {
            message_to: data.user_id, message_status: "Unread"
            // [Op.or]: [
            //     { message_to: data.user_id, message_status: false },
            //     // { message_by: user_id, is_read: false }
            // ]
        }
    });

    await emitToSockets(data.user_id, "unread_counts", {
        unreadChatCount,
        unreadMessageCount
    });
    console.log(`>>>>>>>${unreadChatCount}  ${unreadMessageCount}`);
    try {
        //   await commonService.emitToSockets(data.user_id, "unread_count", {
        //     unread_count: getChatRes.length + getChatroomRes.length,
        //   });
        //   console.log(`unread_count: unread_count :`, getRes.length);
    } catch {
        console.log(`unread_count emit not send`);
    }
}

const typing_chat = async (socket, data) => {
    console.log('typing_chat',data);
    const otherId = parseInt(data.other_id);
    try {
      await emitToSockets(otherId, "is_typing_chat", data);
      console.log(`typing_chat emit sent successfully`);
    } catch (error) {
      console.log("typing_chat emit not send");
    }
}

const disconnect = async (io,socket, data) => {
    console.log("disconnectedSocketId", socket.id, socket.user_id);
    try {
        await redisClient.lrem(`user:${socket.user_id}:sockets`, 0, socket.id);
        io.emit("active_count", { active_count: await getSocketCount() })
    } catch (e) {
        console.log("id is not found ->>", socket.id);
    }
}

function socketConfig(io) {

    io.on("connection", async (socket) => {

        console.log("connection", socket.id);

        socket.on("socket_register", (data) => socket_register(io,socket, data));

        socket.on("join_room", (data) => join_room(socket, data));

        socket.on("left_room", (data) => left_room(socket, data));

        socket.on("ready_to_join", (data) => ready_to_join(socket, data));

        socket.on("left_video", (data) => left_video(socket, data))

        socket.on("back_video_user", (data) => back_video_user(socket, data))

        socket.on("video_running", (data) => video_running(socket, data))

        socket.on("notification_count", (data) => notification_count(socket, data));

        socket.on("unread_chat_count", (data) => unread_chat_count(socket, data));
        
        socket.on("typing_chat", async (data) => typing_chat(socket, data));

        socket.on("disconnect", (data) => disconnect(io,socket, data));

        global.socket_id = socket.id;

    });

    const SOCKET_TIMEOUT = 30000; // Timeout value in milliseconds (adjust as needed)

    // Function to periodically check and disconnect sockets whose IDs have been removed from Redis
    setInterval(async () => {
        try {
            const userIds = await redisClient.keys("user:*:sockets");
            for (const userId of userIds) {
                console.log('userId===>>>', userId);
                const socketIds = await redisClient.lrange(userId, 0, -1);
                for (const socketId of socketIds) {
                    const socket = io.sockets.sockets.get(socketId);

                    if (!socket || !socket.connected) {

                        console.log("Disconnecting socket:", socketId);
                        await redisClient.lrem(userId, 0, socketId);
                        io.emit("active_count", { active_count: await getSocketCount() })
                    }
                }
            }
        } catch (error) {
            console.error("Error checking and disconnecting sockets:", error);
        }
    }, SOCKET_TIMEOUT); // Run the check every SOCKET_TIMEOUT milliseconds
}



module.exports = { socketConfig, emitToSockets, getSocketCount };
