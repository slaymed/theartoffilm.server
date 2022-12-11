import refundPayment from "../../../../helpers/refundPayment.js";
import { sendEmail } from "../../../../mail/sendEmail.js";
import { paymentRefundedEmail } from "../../../../mail/transactionEmails.js";
import Advertise from "../../../../models/advertiseModel.js";
import Chat from "../../../../models/chatModel.js";
import Gift from "../../../../models/giftModal.js";
import Order from "../../../../models/orderModel.js";
import Product from "../../../../models/productModel.js";
import Session from "../../../../models/sessionModel.js";
import Socket from "../../../../models/socketModal.js";
import User from "../../../../models/userModel.js";

export async function chargeRefunded(event, io) {
    try {
        const { object } = event.data;
        const { ref, socketId } = object.metadata;

        const session = await Session.findOne({ payment_intent_id: object.payment_intent, ref });
        if (!session) throw new Error("Session not found");

        session.refund = {
            amount: object.amount_refunded,
            url: object.receipt_url,
            refunded: object.refunded,
            refundedIn: object.created,
            currency: object.currency,
        };
        session.status = "refunded";
        await session.save();

        await refundPayment(session.payment_record, session.user ? session.user : null);
        if (session.user) {
            const user = await User.findById(session.user);

            if (user) {
                const message = `Your ${session.type.toUpperCase()} Payment has been refunded`;
                sendEmail(paymentRefundedEmail({ email: user.email, name: user.name, message }));
            }
        }

        switch (session.type) {
            case "advertisement":
                const advertise = await Advertise.findById(session.ref);
                if (advertise) {
                    await advertise.remove();
                }
                break;
            case "poster":
                const order = await Order.findById(session.ref);

                if (order) {
                    const chat = await Chat.findById(order.chatId);
                    if (chat) await chat.remove();

                    for (const item of order.orderItems) {
                        const product = await Product.findById(item.product);
                        if (product && product.sold) {
                            product.sold = false;
                            await product.save();
                        }
                    }

                    for (const socket of await Socket.find({ user: order.seller })) {
                        if (io.sockets.sockets.has(socket.socketId)) {
                            io.to(socket.socketId).emit("order-paiment-refunded", {
                                data: { chatId: order.chatId, orderId: order._id.toString() },
                                success: true,
                            });
                        }
                    }

                    await order.remove();
                }
                break;
            case "gift":
                const gift = await Gift.findById(session.ref);
                if (gift) await gift.remove();
                break;
            default:
                throw new Error(`${session.type} Must be supported in charge.refunded event`);
        }

        if (io.sockets.sockets.has(socketId)) {
            const { id, url, period, status, type, ref, refund } = session;

            io.to(socketId).emit("checkout-session-refuded", {
                data: { id, url, period, status, type, ref, refund },
                success: true,
            });
        }

        return { success: true };
    } catch (error) {
        return { success: false, message: error.message, detail: "Failed in Charge Refund" };
    }
}
