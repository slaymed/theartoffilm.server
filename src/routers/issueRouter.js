import express from "express";
import expressAsyncHandler from "express-async-handler";

import Chat from "../models/chatModel.js";
import Issue from "../models/IssueModal.js";
import Message from "../models/messageModal.js";
import Order from "../models/orderModel.js";
import Socket from "../models/socketModal.js";
import { isAuth } from "../utils.js";

const issueRouter = express.Router();

issueRouter.get(
    "/order-issues/:orderId",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const { orderId } = req.params;

            const order = await Order.findById(orderId);
            if (!order) return res.status(401).json({ message: "Unauthorized" });

            const between = [order.user.toString(), order.seller.toString()];
            if (!between.includes(req.user._id.toString())) return res.status(401).json({ message: "Unauthorized" });

            const issues = await Issue.find({ order: order._id.toString() }).populate("user");
            if (issues.length === 0) return res.status(404).json({ message: "Order have no issues" });
            return res.status(200).json(issues);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

issueRouter.post(
    "/raise-an-issue",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const { orderId, becauseOf } = req.body;
            const io = req.app.locals.settings.io;

            if (typeof becauseOf !== "string" || !becauseOf.trim())
                return res.status(401).json({ message: "Issue Reason must be provided" });

            const order = await Order.findById(orderId).populate("user").populate("seller");
            if (!order) return res.status(404).json({ message: "Order Not Found" });

            const chat = await Chat.findById(order.chatId).populate("messages").populate("seller").populate("buyer");
            if (!chat) return res.status(404).json({ message: "Order Chat Not Found, Please Contact Admin" });

            const between = [chat.seller._id.toString(), chat.buyer._id.toString()];
            if (!between.includes(req.user._id.toString())) return res.status(401).json({ message: "Unauthorized" });

            if (order.haveIssue)
                return res
                    .status(401)
                    .json({ message: "Order Already has unsolved issue", redirect: `/issues/${order._id.toString()}` });
            if (!order.isPaid) return res.status(401).json({ message: "Order not paid yet" });
            if (order.isRecieved)
                return res.status(401).json({ message: "Can't raise an issue with a recieved order" });

            const now_time = new Date().getTime();
            const day_time = 1000 * 60 * 60 * 24;
            const period_time = day_time * 3;

            const gone_period = now_time - order.paidAt;

            if (gone_period < period_time) return res.status(401).json({ message: "Raising an issue not allowed yet" });

            const issue = new Issue({
                becauseOf,
                order: order._id,
                user: req.user._id,
            });

            await issue.save();

            order.haveIssue = true;
            order.issueId = issue._id.toString();

            const savedOrder = await order.save();

            const message = new Message({
                body: "( Raised an Issue )",
                from: req.user._id,
                chatId: chat._id,
                isStatus: true,
            });

            const savedMessage = await message.save();

            chat.messages.push(message);

            await chat.save();

            for (const socket of await Socket.find({ user: order.user._id })) {
                if (io.sockets.sockets.has(socket.socketId)) {
                    io.to(socket.socketId).emit("order-status-change", {
                        data: { message: savedMessage.toJSON(), order: savedOrder.toJSON() },
                        success: true,
                    });
                }
            }

            for (const socket of await Socket.find({ user: order.seller._id })) {
                if (io.sockets.sockets.has(socket.socketId)) {
                    io.to(socket.socketId).emit("order-status-change", {
                        data: { message: savedMessage.toJSON(), order: savedOrder.toJSON() },
                        success: true,
                    });
                }
            }

            const issues = await Issue.find({ order: order._id.toString() }).populate("user");
            return res.status(200).json(issues);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

issueRouter.post(
    "/mark-as-solved",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        const { issueId } = req.body;
        const io = req.app.locals.settings.io;

        try {
            const issue = await Issue.findById(issueId);
            if (!issue) return res.status(404).json({ message: "Issue Not Found" });
            if (issue.user.toString() !== req.user._id.toString())
                return res.status(401).json({ message: "Unauthorized" });
            if (issue.solved) return res.status(401).json({ message: "Issue Already Solved" });

            const order = await Order.findOne({ issueId: issue._id.toString() }).populate("user").populate("seller");
            if (!order) return res.status(404).json({ message: "Issue Order Not Found" });

            issue.solved = true;
            issue.solvedAt = new Date().getTime();
            await issue.save();

            order.issueId = null;
            order.haveIssue = false;
            const savedOrder = await order.save();

            const chat = await Chat.findById(savedOrder.chatId);

            const message = new Message({
                body: "( Issue Solved )",
                from: req.user._id,
                chatId: chat._id,
                isStatus: true,
            });
            const savedMessage = await message.save();

            chat.messages.push(message);
            await chat.save();

            for (const socket of await Socket.find({ user: order.user._id })) {
                if (io.sockets.sockets.has(socket.socketId)) {
                    io.to(socket.socketId).emit("order-status-change", {
                        data: { message: savedMessage.toJSON(), order: savedOrder.toJSON() },
                        success: true,
                    });
                }
            }

            for (const socket of await Socket.find({ user: order.seller._id })) {
                if (io.sockets.sockets.has(socket.socketId)) {
                    io.to(socket.socketId).emit("order-status-change", {
                        data: { message: savedMessage.toJSON(), order: savedOrder.toJSON() },
                        success: true,
                    });
                }
            }

            const issues = await Issue.find({ order: order._id.toString() }).populate("user");
            return res.status(200).json(issues);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

export default issueRouter;
