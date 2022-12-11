import express from "express";
import expressAsyncHandler from "express-async-handler";
import Order from "../models/orderModel.js";
import User from "../models/userModel.js";
import Product from "../models/productModel.js";
import { isAuth } from "../utils.js";
import Session from "../models/sessionModel.js";
import { getCart } from "./cartRouter.js";
import Chat from "../models/chatModel.js";
import Message from "../models/messageModal.js";
import Socket from "../models/socketModal.js";
import getStripe from "../helpers/get-stripe.js";
import getSettings from "../helpers/getSettings.js";
import get_or_create_stripe_customer from "../helpers/get-or-create-stripe-customer.js";
import PaymentRecord from "../models/paymentRecordModal.js";
import releasePayment from "../helpers/releasePayment.js";
import { toFixed } from "../helpers/toFixed.js";
import { sendEmail } from "../mail/sendEmail.js";
import { paymentReleasedEmail } from "../mail/transactionEmails.js";
import { orderDelivered, orderRecieved } from "../mail/ordersEmails.js";

const orderRouter = express.Router();

orderRouter.get(
    "/",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const myOrders = await Order.find({ user: req.user._id })
                .populate("user")
                .populate("seller")
                .sort({ createdAt: "-1" });

            const myClientsOrders = await Order.find({ seller: req.user._id })
                .populate("user")
                .populate("seller")
                .sort({ createdAt: "-1" });

            return res.status(200).json([...myOrders, ...myClientsOrders]);
        } catch (error) {
            return res.status(500).json(500);
        }
    })
);

orderRouter.post(
    "/place-order",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const cart = await getCart(req.user);
            if (cart.items.length === 0) return res.status(400).json({ message: "Cart is empty" });

            if (Object.keys(cart.shippingAddress).some((key) => !cart.shippingAddress[key].trim()))
                return res.status(401).json({
                    message: "Missing Address Fields, Go Back and check your shipping address",
                    redirect: "/shipping",
                });

            const orderItems = [];

            for (const item of cart.items) {
                const product = await Product.findById(item._id);
                if (!product) return res.status(404).json({ message: "Poster not found" });

                const seller = await User.findById(product.seller);
                if (!seller)
                    return res
                        .status(404)
                        .json({ message: `Seller for ${product.name} is not selling posters anymore` });
                if (seller._id.toString() === req.user._id.toString())
                    return res.status(401).json({ message: "You can't buy your own posters" });

                if (!product.forSale)
                    return res.status(401).json({ message: `Poster ${product.name} is not for sale anymore!` });
                if (product.sold)
                    return res.status(401).json({ message: `Poster ${product.name} has been already sold.` });

                const price = product.salePrice ?? product.price;

                orderItems.push({
                    name: product.name,
                    qty: 1,
                    image: product.image,
                    price: price,
                    product: product._id,
                });
            }

            const order = new Order({
                seller: cart.currentSellerId,
                orderItems,
                shippingAddress: cart.shippingAddress,
                paymentMethod: cart.paymentMethod,
                itemsPrice: toFixed(cart.itemsPrice),
                shippingCost: toFixed(cart.totalPrice - cart.itemsPrice),
                taxPrice: 0,
                totalPrice: toFixed(cart.totalPrice),
                allowedToPay: true,
                user: req.user._id,
            });

            await order.save();

            const savedOrder = await Order.findById(order._id).populate("user").populate("seller");

            return res.status(201).json(savedOrder);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

orderRouter.post(
    "/sync-order",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const order = await Order.findById(req.body.orderId).populate("seller").populate("user");
            if (!order) return res.status(404).json({ message: "Order not found" });

            if (order.user._id.toString() !== req.user._id.toString())
                return res.status(401).json({ message: "Unauthorized" });

            return res.status(200).json(order);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

orderRouter.post(
    "/delete-order",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const order = await Order.findById(req.body.orderId);
            if (!order) return res.status(404).json({ message: "Order not found" });

            const isMine = order.user.toString() === req.user._id.toString();

            if (!isMine || order.isPaid) return res.status(401).json({ message: "Unauthorized" });

            await order.remove();

            return res.status(200).json(null);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

orderRouter.post(
    "/mark-as-delivered",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const user = req.user;
            const io = req.app.locals.settings.io;

            const order = await Order.findById(req.body.orderId).populate("seller").populate("user");
            if (!order) return res.status(404).json({ message: "Order not found" });
            if (order.seller._id.toString() !== user._id.toString())
                return res.status(401).json({ message: "Unauthorized" });
            if (order.isDelivered) return res.status(401).json({ message: "Order is Already Delivered" });
            if (order.isRecieved) return res.status(401).json({ message: "Order Recieved" });
            if (order.haveIssue) return res.status(401).json({ message: "There's an issue" });

            order.isDelivered = true;
            order.deliveredAt = new Date().getTime();
            const savedOrder = await order.save();

            const chat = await Chat.findById(order.chatId).populate("messages");
            if (!chat) return res.status(200).json(savedOrder);

            const message = new Message({
                body: "( Order Delivered )",
                from: user._id,
                chatId: chat._id,
                isStatus: true,
            });

            const savedMessage = await message.save();

            chat.messages.push(message);

            await chat.save();

            const anchor = `<a href="${process.env.WEB_APP}/order/${order._id.toString()}" target="_blank">Order</a>`;
            if (order.seller) {
                sendEmail(
                    orderDelivered({
                        email: order.seller.email,
                        name: order.seller.name,
                        message: `You marked ${order.user.name} ${anchor} as delievered`,
                    })
                );
            }
            if (order.user) {
                sendEmail(
                    orderDelivered({
                        email: order.user.email,
                        name: order.user.name,
                        message: `${user.name} delivered your ${anchor}`,
                    })
                );
            }

            for (const socket of await Socket.find({ user: order.seller._id })) {
                if (io.sockets.sockets.has(socket.socketId)) {
                    io.to(socket.socketId).emit("order-status-change", {
                        data: { message: savedMessage.toJSON(), order: savedOrder.toJSON() },
                        success: true,
                    });
                }
            }

            for (const socket of await Socket.find({ user: order.user._id })) {
                if (io.sockets.sockets.has(socket.socketId)) {
                    io.to(socket.socketId).emit("order-status-change", {
                        data: { message: savedMessage.toJSON(), order: savedOrder.toJSON() },
                        success: true,
                    });
                }
            }

            return res.status(200).json(savedOrder);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

orderRouter.post(
    "/mark-as-recieved",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const user = req.user;
            const io = req.app.locals.settings.io;

            const order = await Order.findById(req.body.orderId).populate("seller").populate("user");
            if (!order) return res.status(404).json({ message: "Order not found" });
            if (order.user._id.toString() !== user._id.toString())
                return res.status(401).json({ message: "Unauthorized" });
            if (!order.isDelivered)
                return res
                    .status(401)
                    .json({ message: "You can't mark order as recieved, wait for seller to deliver it" });
            if (order.isRecieved) return res.status(401).json({ message: "Order Already Recieved" });
            if (order.haveIssue) return res.status(401).json({ message: "There's an issue" });

            order.isRecieved = true;
            order.recievedAt = new Date().getTime();
            const savedOrder = await order.save();

            const payment = await PaymentRecord.findById(savedOrder.payment_record);
            if (payment) await releasePayment(payment, order.user._id);

            const chat = await Chat.findById(order.chatId).populate("messages");
            if (!chat) return res.status(200).json(savedOrder);

            const message = new Message({
                body: "( Order Recieved )",
                from: user._id,
                chatId: chat._id,
                isStatus: true,
            });

            const savedMessage = await message.save();

            chat.messages.push(message);

            await chat.save();

            const anchor = `<a href="${process.env.WEB_APP}/order/${order._id.toString()}" target="_blank">Order</a>`;
            if (order.seller) {
                sendEmail(
                    orderRecieved({
                        email: order.seller.email,
                        name: order.seller.name,
                        message: `${user.name} marked ${anchor} as recieved`,
                    })
                );
                sendEmail(
                    paymentReleasedEmail({
                        email: order.seller.email,
                        name: order.seller.name,
                        message: `Payment for ${anchor} are released by ${user.name}. Funds added to your available balance`,
                    })
                );
            }
            if (order.user) {
                sendEmail(
                    orderRecieved({
                        email: order.user.email,
                        name: order.user.name,
                        message: `You marked your ${anchor} as recieved.`,
                    })
                );
                sendEmail(
                    paymentReleasedEmail({
                        email: order.user.email,
                        name: order.user.name,
                        message: `Payment for ${anchor} are released by you.`,
                    })
                );
            }

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

            return res.status(200).json(savedOrder);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

orderRouter.post(
    "/create-order-checkout-session",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const { socketId, orderId } = req.body;

            const order = await Order.findById(orderId).populate("seller").populate("user");
            if (!order) return res.status(404).json({ message: "Order not found" });
            if (order.orderItems.length === 0) return res.status(401).json({ message: "Order Empty" });
            if (order.user._id.toString() !== req.user._id.toString())
                return res.status(401).json({ message: "Unauthorized" });

            let product_data = { name: "" };

            for (const orderItem of order.orderItems) {
                const product = await Product.findById(orderItem.product);
                if (!product)
                    return res.status(404).json({ message: `${orderItem.name} Poster not found or may be deleted` });

                const seller = await User.findById(product.seller);
                if (!seller)
                    return res
                        .status(404)
                        .json({ message: `Seller for ${product.name} is not selling posters anymore` });
                if (seller._id.toString() === req.user._id.toString())
                    return res.status(401).json({ message: "You can't buy your own posters" });

                if (!product.forSale)
                    return res.status(401).json({ message: `${product.name} Poster is not for sale more` });

                if (product.sold) return res.status(401).json({ message: `${product.name} Poster Already Sold` });

                product_data = { name: product.name };
            }

            const stripe = await getStripe();

            const customer = await get_or_create_stripe_customer(req.user);
            if (!customer || customer.deleted) throw new Error("Something went wrong");

            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: { currency: "GBP", product_data, unit_amount: Math.round(order.totalPrice * 100) },
                        quantity: 1,
                    },
                ],
                mode: "payment",
                metadata: {
                    ref: order._id.toString(),
                    socketId,
                },
                payment_intent_data: {
                    metadata: {
                        ref: order._id.toString(),
                        socketId,
                    },
                },
                customer: customer.id,
                success_url: `${process.env.WEB_APP}/payment/success`,
                cancel_url: `${process.env.WEB_APP}/payment/canceled`,
            });

            await Session.deleteMany({ ref: orderId, status: "unpaid" });
            const new_session = new Session({
                id: session.id,
                url: session.url,
                type: "poster",
                ref: order._id.toString(),
                status: session.payment_status,
                user: order.user,
            });

            const { commission_percentage_on_sold_posters } = await getSettings();

            const total_commission_fee = toFixed((order.totalPrice * commission_percentage_on_sold_posters) / 100);

            await PaymentRecord.deleteMany({ ref: orderId, status: "pending", collected: false });
            const orderPayment = await new PaymentRecord({
                by: order.user,
                to: order.seller,
                total_collected_amount: order.totalPrice,
                commission_percentage: commission_percentage_on_sold_posters,
                total_commission_fee,
                total_release_amount_after_fee: toFixed(order.totalPrice - total_commission_fee),
                session: new_session._id,
                type: "order",
                ref: order._id.toString(),
            }).save();

            order.payment_record = orderPayment._id;
            await order.save();
            new_session.payment_record = orderPayment._id;

            return res.status(200).json(await new_session.save());
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

export const autoReleaseOrders = async () => {
    try {
        const now_time = new Date().getTime();
        const { auto_release_orders_time } = await getSettings();

        const period = now_time - auto_release_orders_time;

        const orders = await Order.find({
            haveIssue: false,
            deliveredAt: { $lte: period },
            paidAt: { $lte: period },
            isPaid: true,
            isRecieved: false,
            isDelivered: true,
        })
            .populate("user")
            .populate("seller");

        for (const order of orders) {
            order.isRecieved = true;
            order.recievedAt = now_time;
            const savedOrder = await order.save();

            const payment = await PaymentRecord.findById(savedOrder.payment_record);
            if (payment) {
                await releasePayment(payment, savedOrder.user._id);

                const anchor = `<a href="${
                    process.env.WEB_APP
                }/order/${order._id.toString()}" target="_blank">Order</a>`;

                if (order.seller) {
                    sendEmail(
                        orderRecieved({
                            email: order.seller.email,
                            name: order.seller.name,
                            message: `${anchor} is marked as recieved Automatically.`,
                        })
                    );
                    sendEmail(
                        paymentReleasedEmail({
                            email: order.seller.email,
                            name: order.seller.name,
                            message: `Payment for ${anchor} are automatically released. Funds added to your available balance`,
                        })
                    );
                }
                if (order.user) {
                    sendEmail(
                        orderRecieved({
                            email: order.user.email,
                            name: order.user.name,
                            message: `Your ${anchor} is marked as recieved Automatically.`,
                        })
                    );
                    sendEmail(
                        paymentReleasedEmail({
                            email: order.user.email,
                            name: order.user.name,
                            message: `Payment for ${anchor} are automatically released.`,
                        })
                    );
                }
            }
        }
    } catch (error) {}
};

setInterval(autoReleaseOrders, 1000 * 60 * 60 * 24);

export default orderRouter;
