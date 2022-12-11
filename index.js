import http from "http";
import cookieParser from "cookie-parser";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { Server } from "socket.io";

import productRouter from "./src/routers/productRouter.js";
import userRouter from "./src/routers/userRouter.js";
import orderRouter from "./src/routers/orderRouter.js";
import uploadRouter from "./src/routers/uploadRouter.js";
import subscriptionRouter from "./src/routers/subscriptionRouter.js";
import userSubscriptionRouter from "./src/routers/userSubscriptionRouter.js";
import subscriptionGiftsRouter from "./src/routers/subscriptionGiftsRouter.js";
import giftsRouter from "./src/routers/giftsRouter.js";
import userStripeInfoRouter from "./src/routers/userStripeInfoRouter.js";
import sessionRouter from "./src/routers/sessionRouter.js";
import issueRouter from "./src/routers/issueRouter.js";
import advertiseRouter from "./src/routers/advertiseRouter.js";
import webhooksRouter from "./src/routers/webhooks/index.js";
import globalRouter from "./src/routers/globalRouter.js";
import cartRouter from "./src/routers/cartRouter.js";
import chatRouter from "./src/routers/chatRouter.js";
import Socket from "./src/models/socketModal.js";
import tagsRouter from "./src/routers/tagsRouter.js";
import sellerShowcaseRouter from "./src/routers/sellerShowcaseRouter.js";
import withdrawRequestsRouter from "./src/routers/withdrawRequestsRouter.js";
import settingsRouter from "./src/routers/settingsRouter.js";
import paymentRecordRouter from "./src/routers/paymentRecordRouter.js";
import testClocksRouter from "./src/routers/testClocksRouter.js";

dotenv.config();

const app = express();

app.use((req, res, next) => {
    if (req.originalUrl.startsWith("/webhooks/stripe")) {
        next();
    } else {
        express.json()(req, res, next);
    }
});

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ credentials: true, origin: process.env.WEB_APP }));

mongoose.connect(process.env.MONGODB_URI);

app.use("/webhooks", webhooksRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/test-clocks", testClocksRouter);
app.use("/api/uploads", uploadRouter);
app.use("/api/users", userRouter);
app.use("/api/subscriptions", subscriptionRouter);
app.use("/api/user-subscription", userSubscriptionRouter);
app.use("/api/subscription-gifts", subscriptionGiftsRouter);
app.use("/api/gifts", giftsRouter);
app.use("/api/seller-showcase", sellerShowcaseRouter);
app.use("/api/user-stripe-info", userStripeInfoRouter);
app.use("/api/withdraw-requests", withdrawRequestsRouter);
app.use("/api/products", productRouter);
app.use("/api/posters-tags", tagsRouter);
app.use("/api/issues", issueRouter);
app.use("/api/orders", orderRouter);
app.use("/api/sessions", sessionRouter);
app.use("/api/advertise", advertiseRouter);
app.use("/api/globals", globalRouter);
app.use("/api/cart", cartRouter);
app.use("/api/chat", chatRouter);
app.use("/api/payment-records", paymentRecordRouter);

// app.get("/api/config/paypal", (req, res) => {
//     res.send(process.env.PAYPAL_CLIENT_ID || "sb");
// });

// app.get("/api/config/google", (req, res) => {
//     res.send(process.env.GOOGLE_API_KEY || "");
// });

// app.use("/uploads", express.static(path.join(path.resolve(), "/uploads")));

app.get("/", (_, res) => res.status(200).json("Server Running"));

const port = process.env.PORT || 5000;

export const server = http.Server(app);

const io = new Server(server, { cors: { credentials: true, origin: process.env.WEB_APP } });

app.set("io", io);

io.on("connection", async (socket) => {
    socket.on("disconnect", async () => {
        const saved = await Socket.findOne({ socketId: socket.id });
        if (saved) await saved.remove();
    });
});

server.listen(port, async () => {
    const sockets = await Socket.find();
    for (const socket of sockets) await socket.remove();
    console.log(`Serve at http://localhost:${port}`);
});
