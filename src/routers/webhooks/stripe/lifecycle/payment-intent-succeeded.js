import voucher from "voucher-code-generator";

import collectPayment from "../../../../helpers/collectPayment.js";
import getStripe from "../../../../helpers/get-stripe.js";
import releasePayment from "../../../../helpers/releasePayment.js";
import { sendEmail } from "../../../../mail/sendEmail.js";
import { paymentCollectedEmail } from "../../../../mail/transactionEmails.js";
import Advertise from "../../../../models/advertiseModel.js";
import Chat from "../../../../models/chatModel.js";
import Gift from "../../../../models/giftModal.js";
import Order from "../../../../models/orderModel.js";
import Product from "../../../../models/productModel.js";
import Session from "../../../../models/sessionModel.js";
import Socket from "../../../../models/socketModal.js";
import User from "../../../../models/userModel.js";

export async function paymentIntentSucceeded(event, io) {
    try {
        const { object } = event.data;
        const { ref, socketId } = object.metadata;

        const now_time = new Date().getTime();

        const session = await Session.findOne({ ref });
        if (!session) throw new Error("Session Not Found");

        session.lifeCycle = "payment_intent.succeeded";
        session.status = "paid";
        session.payment_intent_id = object.id;
        await session.save();

        await collectPayment(session.payment_record, session.user ? session.user : null);

        switch (session.type) {
            case "advertisement":
                await releasePayment(session.payment_record, session.user ? session.user : null);

                const advertise = await Advertise.findById(session.ref);
                if (!advertise) throw new Error("Advertise Removed");

                if (advertise.user) {
                    const user = await User.findById(advertise.user);

                    if (user) {
                        const advertismentAnchor = `<a href="${
                            process.env.WEB_APP
                        }/advertisement/${session.ref.toString()}" target="_blank">Advertisment</a>`;
                        const message = `Your ${advertismentAnchor} Payment has been successfully Paid`;
                        sendEmail(paymentCollectedEmail({ email: user.email, name: user.name, message }));
                    }
                }

                advertise.active = true;
                advertise.activated_at = now_time;
                await advertise.save();
                break;
            case "poster":
                const order = await Order.findById(session.ref);
                if (!order) throw new Error("Order Removed");

                const buyer = await User.findById(order.user);
                if (!buyer) throw new Error("We can't find your account");
                const seller = await User.findById(order.seller);
                if (!seller) throw new Error("We can't find seller account");

                const products = [];

                for (const orderItem of order.orderItems) {
                    const product = await Product.findById(orderItem.product);
                    if (!product) throw new Error("Some Products are not found");
                    if (!product.forSale) throw new Error("Some Products are not for sale anymore");
                    if (product.sold) throw new Error("Some Products are already sold");
                    products.push(product);
                }

                for (const product of products) {
                    product.sold = true;
                    product.salePrice = product.price;
                    await product.save();
                }

                const chat = new Chat({
                    messages: [],
                    buyer: buyer._id,
                    seller: seller._id,
                    order: order._id,
                });
                await chat.save();
                const savedChat = await Chat.findById(chat._id).populate("buyer").populate("seller");

                order.isPaid = true;
                order.paidAt = new Date().getTime();
                order.chatId = savedChat._id;
                await order.save();
                const savedOrder = await Order.findById(order._id).populate("user").populate("seller");

                const orderAnchor = `<a href="${
                    process.env.WEB_APP
                }/order/${session.ref.toString()}" target="_blank">Order</a>`;
                const buyerMessage = `Your ${orderAnchor} Payment has been successfully Paid`;
                sendEmail(paymentCollectedEmail({ email: buyer.email, name: buyer.name, message: buyerMessage }));

                const sellerMessage = `Your ${
                    order.orderItems.length > 1 ? "Posters" : "Poster"
                } Sold, See ${orderAnchor} Detail`;
                sendEmail(paymentCollectedEmail({ email: seller.email, name: seller.name, message: sellerMessage }));

                for (const socket of await Socket.find({ user: order.seller._id })) {
                    if (io.sockets.sockets.has(socket.socketId)) {
                        io.to(socket.socketId).emit("order-paid", {
                            data: { chat: savedChat.toJSON(), order: savedOrder.toJSON() },
                            success: true,
                        });
                    }
                }

                break;
            case "gift":
                await releasePayment(session.payment_record, session.user ? session.user : null);
                const gift = await Gift.findById(session.ref).populate("buyer");
                if (!gift) throw new Error("Gift not found");

                const giftAnchor = `<a href="${
                    process.env.WEB_APP
                }/purchaced-gifts/${session.ref.toString()}" target="_blank">Gift</a>`;
                const message = `Your ${giftAnchor} Payment has been successfully Paid`;
                sendEmail(paymentCollectedEmail({ email: gift.buyer.email, name: gift.buyer.name, message }));


                const [code] = voucher.generate({ length: 16, count: 1 });

                gift.is_paid = true;
                gift.paid_at = now_time;
                gift.code = code;

                await gift.save();
                break;
            default:
                throw new Error(`${session.type} Must be supported in payment-intent.succeeded event`);
        }

        if (io.sockets.sockets.has(socketId)) {
            const { id, url, period, status, type, ref, refund } = session;

            io.to(socketId).emit("checkout-session-paid", {
                data: { id, url, period, status, type, ref, refund },
                success: true,
            });
        }

        return { success: true };
    } catch (error) {
        const { object } = event.data;
        const { ref } = object.metadata;

        const session = await Session.findOne({ ref });
        if (!session) return { success: false, message: error.message, detail: "Failed In Payment Intent Succeeded" };
        const stripe = await getStripe();
        await stripe.refunds.create({ payment_intent: session.payment_intent_id });
        return { success: false, message: error.message, detail: "Payment Refund" };
    }
}
