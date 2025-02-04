const { Op } = require("sequelize");
require("dotenv").config();
const db = require("../config/db");
console.log("im in chatController");
const { emitToSockets } = require("../helper/eventHandlers")
const fs = require("fs").promises;
const { getIO } = require("../helper/io_setup");
const { Sequelize } = require("sequelize")

const uploadMediaInChat = async (media, thumbnails, mediaType, mediaText, documentText, messageText) => {
  const uploadedMedia = [];
  try {
    const types = mediaType;
    let thumbnailIndex = 0;
    let mediaTextIndex = 0;
    let documentTextIndex = 0;
    console.log("types[0]", types[0])
    if (types[0] == "Text") {
      const object = {
        image: messageText,
        thumbnail: null,
        media_text: null,
        file_name: null,
        message_type: types[0]
      };
      uploadedMedia.push(object);
    } else {
      for (const [index, element] of media.entries()) {
        const imageUrl = `chat_media${element.filename}`;
        const object = {
          image: imageUrl,
          thumbnail: null,
          media_text: null,
          file_name: null,
          message_type: types[index]
        };
        if (types[index] == 'Video' || types[index] == 'Video/Text') {
          if (thumbnails && thumbnails[thumbnailIndex]) {
            // const thumbnailUrl = await uploadToS3(thumbnails[thumbnailIndex], "chat_image");
            const thumbnailUrl = `chat_media${thumbnails[thumbnailIndex].filename}`;
            object.thumbnail = thumbnailUrl;
            thumbnailIndex++; // Increment thumbnail index only when used
          }
        }
        if (types[index] == 'Image/Text' || types[index] == 'Video/Text') {
          if (mediaText && mediaText[mediaTextIndex]) {
            object.media_text = mediaText[mediaTextIndex];
            mediaTextIndex++; // Increment thumbnail index only when used
          }
        }
        if (types[index] == 'Document') {
          if (documentText && documentText[documentTextIndex]) {
            object.file_name = documentText[documentTextIndex];
            documentTextIndex++; // Increment thumbnail index only when used
          }
        }
        uploadedMedia.push(object);
      }
    }
    return uploadedMedia;

  } catch (error) {
    console.error('Error uploading media:', error);
    throw new Error('Failed to upload media');
  }
};

const createChat = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const user_id = req.user.user_id;
    const { other_id, task_id } = req.body;

    // Check if the tasker (other user) exists
    const isOtherExist = await db.User.findOne({ where: { user_id: other_id, role: "tasker" } });
    if (!isOtherExist) {
      await transaction.rollback();
      return res.status(404).json({
        status: 0,
        message: "The specified user does not exist. Please verify the user information and try again.",
      });
    }

    // Check if a chat already exists between the users
    const existingChat = await db.Chat.findOne({
      where: { chat_created_from: user_id, chat_created_to: other_id },
    });

    if (existingChat) {
      await transaction.rollback();
      return res.status(200).json({
        status: 1,
        message: `A chat with this user already exists! Invitation status: ${existingChat.invitation_accepted}.`,
        data: existingChat,
      });
    }

    // Create a new chat if no existing chat found
    const newChat = await db.Chat.create(
      { chat_created_from: user_id, chat_created_to: other_id, task_id },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      status: 1,
      message: "Chat created successfully! You can now send messages.",
      data: newChat,
    });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error creating chat:", error);
    return res.status(500).json({
      status: 0,
      message: "An error occurred while creating the chat. Please try again or contact support if the problem persists.",
    });
  }
};


const sendMessage = async (req, res) => {
  const db = req.dbInstance;
  const { chat_id, message_type, other_id, file_name, media_text, message_text } = req.body;
  const message_by = req.user.user_id; // Assume authenticated user is the sender
  const sender = await db.User.findByPk(message_by); // Get the sender's user info
  const receiver = await db.User.findByPk(other_id); // Get the sender's user info
  if (!receiver) return res.status(404).json({ Status: 0, message: "The other user was not found", });

  if (message_by == other_id) return res.status(400).json({ Status: 0, message: "You can't create chat with yourself" });

  try {
    let clientsInRoom;
    // Fetch chat details from the database
    const chat = await db.Chat.findByPk(chat_id);
    if (!chat) {
      return res.status(404).json({ status: 0, message: "Chat not found" });
    }
    // Check if any clients are in the chat room (Socket.io)
    try {
      const room = getIO().sockets.adapter.rooms.get(parseInt(chat_id));
      if (room) {
        clientsInRoom = room.size;
        console.log("clientsInRoom in sendMessage", clientsInRoom);
      } else {
        console.log(`Room ${parseInt(chat_id)} does not exist`);
      }
    } catch (error) {
      console.log("Error checking socket room", error);
    }
    const mediaTextArray = Array.isArray(media_text) ? media_text : media_text ? JSON.parse(media_text) : [];
    const fileNameArray = Array.isArray(file_name) ? file_name : file_name ? JSON.parse(file_name) : [];
    const messageTypes = Array.isArray(message_type) ? message_type : message_type ? JSON.parse(message_type) : [];


    console.log("mediaTextArray", mediaTextArray, fileNameArray, messageTypes)
    console.log("mediaTextArray", mediaTextArray[0], mediaTextArray[1])
    let arrayOfMedias = await uploadMediaInChat(req.files.media, req.files.thumbnail, messageTypes, mediaTextArray, fileNameArray, message_text)
    console.log("arrayOfMedias", arrayOfMedias)

    if (arrayOfMedias.length > 0) {
      arrayOfMedias.map(async media => {
        let messageData = {
          message_by,
          chat_id,
          message_type: media.message_type,
          message_to: other_id,
          message_status: clientsInRoom && clientsInRoom == 2 ? "Read" : "Unread",
          message_text: media.image,
          thumbnail: media.thumbnail,
          media_text: media.media_text,
          filename: media.file_name,
        };
        // Create the message record in the database
        const message = await db.Message.create(messageData);
        // console.log('message', message)
        const data = await db.Message.findOne({
          where: { message_id: message.message_id },
          include: [
            {
              model: db.User,
              as: "sender",
              attributes: ["user_id", "firstname", "lastname", "profile_image"],
            },
          ],
        });
        // console.log('data', data)
        // 
        try {
          await getIO().to(parseInt(data.chat_id)).emit("new_message", data);
          console.log(`NEW MESSAGE EMIT: ${JSON.stringify(data)}`);
        } catch (error) {
          console.log(`NEW MESSAGE EMIT NOT SENT`, error);
        }


        if (clientsInRoom && clientsInRoom < 2) {
          let chatDetails = await getChatDetails(req, data);
          try {
            await emitToSockets(data.message_to, "count_update", chatDetails);
            console.log(`count_update: ${JSON.stringify(chatDetails)}`);
          } catch (error) {
            console.log("COUNT UPDATE EMIT NOT SENT : error", error);
          }
          const text = mediaTextArray[0] == 'Text' ? media.image : `sent you an attachment 📎`
          const notiType = "chat";
          const message = {
            title: "New Message Received",
            body: `💬 ${data.sender.first_name} ${data.sender.last_name}: ${text} (Tap to reply).`,
          };
          const Data = {
            chat_id: data.chat_id,
            other_id: data.message_to,
            user_id: data.message_by,
            first_name: data.message_by.first_name,
            last_name: data.message_by.last_name,
            notiType: notiType,
            mode: receiver.mode
          };
          // await send_notification(messageData.message_to, message, notiType, Data);
        }
      })
    }
    // Return the response with the created message
    return res.status(201).json({
      status: 1,
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({
      status: 0,
      message: "Internal server error",
      error: error.message,
    });
  }
};

async function getChatDetails(req, messageData) {
  const db = req.dbInstance;
  return await db.Chat.findOne({
    where: { chat_id: messageData.chat_id },
    attributes: {
      include: [
        // Subquery for unreadMessagesCount
        [
          Sequelize.literal(`(
                        SELECT COUNT(*) FROM tbl_messages t2 
                        WHERE t2.chat_id = chat_model.chat_id AND t2.message_status = "Unread" 
                        AND t2.message_to = ${messageData.message_to}
                        )`),
          "unreadMessagesCount",
        ],
        // Subquery for latestMessageCreatedAt
        [
          Sequelize.literal(`(
                        SELECT MAX(chat_messages.createdAt)
                        FROM tbl_messages AS chat_messages
                        WHERE chat_messages.chat_id = chat_model.chat_id
                    )`),
          "latestMessageCreatedAt",
        ],
        [
          Sequelize.literal(`(
                        SELECT u.user_id      
                        FROM tbl_users u
                        WHERE u.user_id = CASE 
                            WHEN chat_model.chat_created_from = ${messageData.message_to} THEN chat_model.chat_created_to
                            ELSE chat_model.chat_created_from 
                        END
                    )`),
          "other_id",
        ],
        [
          Sequelize.literal(`(
                        SELECT u.first_name
                        FROM tbl_users u
                        WHERE u.user_id = CASE 
                            WHEN chat_model.chat_created_from = ${messageData.message_to} THEN chat_model.chat_created_to
                            ELSE chat_model.chat_created_from 
                        END
                    )`),
          "otherUserFirstName",
        ],
        [
          Sequelize.literal(`(
                        SELECT u.last_name
                        FROM tbl_users u
                        WHERE u.user_id = CASE 
                            WHEN chat_model.chat_created_from = ${messageData.message_to} THEN chat_model.chat_created_to
                            ELSE chat_model.chat_created_from 
                        END
                    )`),
          "otherUserLastName",
        ],
        [
          Sequelize.literal(`(
                        SELECT u.profile_pic
                        FROM tbl_users u
                        WHERE u.user_id = CASE 
                            WHEN chat_model.chat_created_from = ${messageData.message_to} THEN chat_model.chat_created_to
                            ELSE chat_model.chat_created_from 
                        END
                    )`),
          "otherUserBusinessProfile",
        ],
      ],
    },
    // attributes: ['id', 'chat_created_by', 'chat_created_to', 'mode', 'createdAt'],  // Basic chat details
    include: [
      {
        model: db.Message,
        as: "chat_message",
        limit: 1, // Get the last message
        order: [["createdAt", "DESC"]],
      },
    ],
  });
}

const getMessages = async (req, res) => {
  const db = req.dbInstance;

  try {
    const { page, chat_id } = req.query;
    console.log('req.query', req.query)
    const pageSize = 20;
    let currentPage = parseInt(page, 10) || 1;
    const offset = (currentPage - 1) * pageSize;

    const chat = await db.Chat.findByPk(chat_id)
    // console.log('chat', chat)
    if (!chat) return res.status(404).json({ Status: 0, message: "Chat Not Found", });

    const { count, rows } = await db.Message.findAndCountAll({
      where: { chat_id },
      include: [{
        model: db.User,
        as: 'sender',
        attributes: ['first_name', 'last_name', 'profile_pic'],
      },],
      distinct: true,
      limit: pageSize,
      offset,
      order: [["createdAt", "DESC"]],
    });
    const totalPages = Math.ceil(count / pageSize);

    await db.Message.update(
      { message_status: "Read" },
      { where: { chat_id: chat_id, message_to: req.userData.user_id, message_status: "Unread" } }
    );

    return res.status(200).json({ status: 1, message: "List of chats retrieved successfully", currentPage, totalPages, data: rows });
  } catch (error) {
    console.error("Error fetching chat list:", error)
    return res.status(500).json({ Status: 0, message: "Internal Server Error", });
  }
}

const reportChat = async (req, res) => {
  try {
    const { reason, chat_id } = req.body;
    const reportedFrom = req.userData.user_id; // Assuming user_id is stored in req.userData

    const chat = await db.Chat.findByPk(chat_id);
    if (!chat) return res.status(404).json({ status: 0, message: "Chat not found" });

    if (chat.chat_created_from !== reportedFrom && chat.chat_created_to !== reportedFrom) {
      return res.status(403).json({ status: 0, message: "User is not a participant in this chat" });
    }

    const reportedTo = chat.chat_created_from === reportedFrom ? chat.chat_created_to : chat.chat_created_from;

    const newReport = await db.Report.create({
      reported_from: reportedFrom,
      reported_to: reportedTo,
      reason,
      chat_id
    });

    return res.status(201).json({ status: 1, message: "Report created successfully", report: newReport });
  } catch (error) {
    console.error("Error reporting chat:", error);
    return res.status(500).json({ status: 0, message: "Internal server error", error: error.message });
  }
};

const createdChatListForUser = async (req, res) => {
  try {
    const db = req.dbInstance;
    const user_id = req.userData.user_id;
    const { page, task_id } = req.query;

    const limit = 20;
    const offset = (page - 1) * limit;

    const chats = await db.Chat.findAll({
      attributes: [
        [db.Sequelize.literal(`
            CASE
              WHEN chat_created_from = ${user_id} THEN chat_created_to
              ELSE chat_created_from
            END
          `), 'other_id'],
        [db.Sequelize.literal(`
            (
              SELECT COUNT(*)
              FROM tbl_messages AS t2
              WHERE t2.chat_id = chat_model.chat_id
                AND t2.message_status = "Unread"
                AND t2.message_to = ${user_id}
            )
          `), 'unread_count'],
        [db.Sequelize.literal(`
            (
              SELECT COUNT(*)
              FROM tbl_messages
              WHERE chat_id = chat_model.chat_id
            )
          `), 'is_chat_show'],
        'chat_id',
        [db.Sequelize.literal(`IFNULL(chat_message.message_id, 0)`), 'message_id'],
        [db.Sequelize.col('chat_message.message_text'), 'message_text'],
        [db.Sequelize.col('chat_message.message_type'), 'message_type'],
        [db.Sequelize.col('createdFromUser.first_name'), 'first_name'],
        [db.Sequelize.col('createdFromUser.last_name'), 'last_name'],
        [db.Sequelize.col('chat_message.createdAt'), 'createdAt'],
        [db.Sequelize.literal(`CONCAT_WS(' ', createdFromUser.first_name, createdFromUser.last_name)`), 'username'],
        [db.Sequelize.col('createdFromUser.profile_pic'), 'profile_pic'],
      ],
      include: [
        {
          model: db.Message,
          as: 'chat_message',
          attributes: [],
          required: false,
          where: {
            message_id: {
              [Op.in]: db.Sequelize.literal(`
                (
                  SELECT MAX(message_id)
                  FROM tbl_messages AS t4
                  WHERE t4.chat_id = chat_model.chat_id
                  GROUP BY t4.chat_id
                )
              `),
            },
          },
        },
        {
          model: db.User,
          as: 'createdFromUser',
          attributes: [],
          where: db.Sequelize.literal(`
            (chat_model.chat_created_from = createdFromUser.user_id AND chat_model.chat_created_to = ${user_id})
            OR (chat_model.chat_created_to = createdFromUser.user_id AND chat_model.chat_created_from = ${user_id})
          `),
        },
      ],
      order: [[db.Sequelize.col('chat_message.message_id'), 'DESC']],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      subQuery: false,
    });

    return res.status(200).json({ status: 1, message: "Chat list fetched successfully", data: chats });
  } catch (error) {
    console.error("Error fetching chat list:", error);
    return res.status(500).json({ status: 0, message: "Internal Server Error" });
  }
};

module.exports = {
  createChat,
  createdChatListForUser,
  sendMessage,
  getMessages,
  reportChat,
}




