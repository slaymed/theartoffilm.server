import express from "express";
import expressAsyncHandler from "express-async-handler";

import getStripe from "../../../helpers/get-stripe.js";
import { chargeRefunded } from "./lifecycle/charge-refunded.js";
import { customerSubscriptionDeleted } from "./lifecycle/customer-subscription-deleted.js";
import { paymentIntentSucceeded } from "./lifecycle/payment-intent-succeeded.js";

const stripeWebhooksRouter = express.Router();

stripeWebhooksRouter.post(
    "/",
    expressAsyncHandler(async (req, res) => {
        try {
            const io = req.app.locals.settings.io;

            const stripe = await getStripe();

            const payload = req.body;
            const sig = req.headers["stripe-signature"];

            let event;

            try {
                event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SIGNITOR_SECRET);
            } catch (error) {
                console.log(error.message);
                return res.status(400).json({ success: false });
            }

            let data;

            switch (event.type) {
                case "payment_intent.succeeded":
                    data = await paymentIntentSucceeded(event, io);
                    break;
                case "charge.refunded":
                    data = await chargeRefunded(event, io);
                    break;
                case "customer.subscription.deleted":
                    data = await customerSubscriptionDeleted(event, io);
                    break;
                default:
                    return res.status(400).json({ success: false, message: "Event Not Supported Yet!" });
            }

            console.log(data);

            if (data?.success) return res.send(data);
            if (!data?.success) return res.status(500).send(data);

            return res.send();
        } catch (error) {
            console.log(error);
        }
    })
);

export default stripeWebhooksRouter;
