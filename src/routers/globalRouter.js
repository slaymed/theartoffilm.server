import express from "express";
import expressAsyncHandler from "express-async-handler";
import Stripe from "stripe";

import Session from "../models/sessionModel.js";
import Setting from "../models/settingModel.js";
import Advertise from "../models/advertiseModel.js";
import Order from "../models/orderModel.js";
import Gift from "../models/giftModal.js";
import PaymentRecord from "../models/paymentRecordModal.js";
import { getUser } from "../utils.js";

const globalRouter = express.Router();

globalRouter.post(
    "/cancel-checkout-session",
    expressAsyncHandler(async (req, res) => {
        try {
            const { sessionId } = req.body;

            const user = await getUser(req.cookies.access_token);

            const session = await Session.findOne({ id: sessionId });
            if (!session) return res.status(404).json({ message: "Checkout session not found" });

            if (session.user && user && session.user.toString() !== user._id.toString())
                return res.status(401).json({ message: "Unauthorized" });

            if (session.status === "paid")
                return res.status(401).json({ message: "Can't cancel an already paid checkout session" });

            if (session.status === "refunded")
                return res.status(401).json({ message: "Can't cancel a refunded checkout session" });

            const { stripe_private_key } = await Setting.findOne();
            const stripe = new Stripe(stripe_private_key);

            try {
                await stripe.checkout.sessions.expire(session.id);
            } catch (error) {}

            switch (session.type) {
                case "advertisement":
                    const advertise = await Advertise.findById(session.ref);
                    if (advertise) await advertise.remove();
                    break;
                case "poster":
                    const order = await Order.findById(session.ref);
                    if (order) await order.remove();
                    break;
                case "gift":
                    const gift = await Gift.findById(session.ref);
                    if (gift) await gift.remove();
                    break;
                default:
                    return res.status(401).json({ message: `Removing ${session.type} is not supported yet` });
            }

            const payment_record = await PaymentRecord.findById(session.payment_record);
            if (payment_record) await payment_record.remove();
            await session.remove();

            return res.status(200).json(null);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

export default globalRouter;
