import express from "express";
import expressAsyncHandler from "express-async-handler";

import { isAuth } from "../utils.js";
import Chat from "../models/chatModel.js";
import Message from "../models/messageModal.js";
import Socket from "../models/socketModal.js";
import Order from "../models/orderModel.js";

const chatRouter = express.Router();

chatRouter.get(
    "/list/:orderId",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const { orderId } = req.params;
            const user = req.user;

            const order = await Order.findById(orderId);
            if (!order) return res.status(404).json({ message: "Chat not found" });

            const chat = await Chat.findById(order.chatId).populate("messages").populate("seller").populate("buyer");
            if (!chat) return res.status(404).json({ message: "Chat not found" });

            const between = [chat.seller._id.toString(), chat.buyer._id.toString()];
            if (!between.includes(user._id.toString())) res.status(401).json({ message: "Unauthorized" });

            chat.messages.sort((a, b) => b.createdAt - a.createdAt);

            return res.status(200).json(chat);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

chatRouter.get(
    "/list",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const chatList = await Chat.find({
                $or: [{ seller: req.user._id.toString() }, { buyer: req.user._id.toString() }],
            })
                .populate("messages")
                .populate("seller")
                .populate("buyer")
                .sort({ updatedAt: "-1" });

            for (const chat of chatList) chat.messages.sort((a, b) => b.createdAt - a.createdAt);

            return res.status(200).json(chatList);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

chatRouter.post(
    "/send-message/:chatId",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const user = req.user;
            const { chatId } = req.params;
            const { body } = req.body;
            const io = req.app.locals.settings.io;

            if (typeof body !== "string" || !body.trim())
                return res.status(401).json({ message: "Message body can't be empty" });

            const chat = await Chat.findById(chatId).populate("messages");
            if (!chat) return res.status(404).json({ message: "Chat not found" });

            const between = [chat.seller.toString(), chat.buyer.toString()];
            if (!between.includes(user._id.toString())) return res.status(401).json({ message: "Unauthorized" });

            const message = new Message({
                chatId: chat._id,
                from: user._id,
                body,
            });

            const savedMessage = await message.save();

            chat.messages.push(message);

            const opossite = between.filter((id) => id !== user._id.toString())[0];

            chat.readBy = [user._id.toString()];

            for (const socket of await Socket.find({ user: opossite })) {
                if (io.sockets.sockets.has(socket.socketId)) {
                    io.to(socket.socketId).emit("recieve-message", {
                        data: savedMessage.toJSON(),
                        success: true,
                    });
                }
            }

            await chat.save();

            return res.status(201).json(message);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

chatRouter.get(
    "/read/:chatId",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const user = req.user;
            const { chatId } = req.params;
            const io = req.app.locals.settings.io;

            const chat = await Chat.findById(chatId).populate("messages");
            if (!chat) return res.status(404).json({ message: "Chat not found" });

            const between = [chat.seller.toString(), chat.buyer.toString()];
            if (!between.includes(user._id.toString())) return res.status(401).json({ message: "Unauthorized" });

            if (!chat.readBy.includes(user._id.toString())) chat.readBy.push(user._id.toString());

            const opossite = between.filter((id) => id !== user._id.toString())[0];

            const savedChat = await chat.save();

            savedChat.messages.sort((a, b) => b.createdAt - a.createdAt);

            for (const socket of await Socket.find({ user: opossite })) {
                if (io.sockets.sockets.has(socket.socketId)) {
                    io.to(socket.socketId).emit("chat-seen", {
                        data: { _id: savedChat._id.toString(), readBy: savedChat.readBy },
                        success: true,
                    });
                }
            }

            return res.status(200).json(savedChat.readBy);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

export default chatRouter;
