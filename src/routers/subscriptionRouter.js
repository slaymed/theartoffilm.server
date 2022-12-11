import express from "express";
import expressAsyncHandler from "express-async-handler";
import Subscription from "../models/subscriptionModel.js";
import data from "../data.js";
import getStripe from "../helpers/get-stripe.js";

const defaultSubs = data.subscriptions;

const subscriptionRouter = express.Router();

subscriptionRouter.get(
    "/",
    expressAsyncHandler(async (req, res) => {
        try {
            const subs = await Subscription.find();
            if (subs.length === 0) return res.status(404).json({ message: "No Available Subscriptions" });

            return res.status(200).json(subs);
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

// FIXME: ADD isAdmin Middleware
subscriptionRouter.post(
    "/create",
    expressAsyncHandler(async (req, res) => {
        try {
            const createdSubs = await Subscription.find();
            if (createdSubs.length >= 3) return res.status(401).json({ message: "Subscriptions Already Created" });

            const stripe = await getStripe();

            for (const sub of defaultSubs) {
                const stripe_product = await stripe.products.create({
                    name: sub.name,
                });

                const stripe_month_price = await stripe.prices.create({
                    unit_amount: Math.round(sub.monthPrice * 100),
                    currency: "gbp",
                    recurring: { interval: "month" },
                    product: stripe_product.id,
                });

                const stripe_year_price = await stripe.prices.create({
                    unit_amount: Math.round(sub.yearPrice * 100),
                    currency: "gbp",
                    recurring: { interval: "year" },
                    product: stripe_product.id,
                });

                const subscription = new Subscription({
                    name: sub.name,
                    itsPopular: sub.itsPopular,
                    monthPrice: sub.monthPrice,
                    yearPrice: sub.yearPrice,
                    perks: sub.perks,
                    stripe_product: stripe_product.id,
                    monthly_stripe_data: {
                        price_id: stripe_month_price.id,
                    },
                    yearly_stripe_data: {
                        price_id: stripe_year_price.id,
                    },
                });

                await subscription.save();
            }

            return res.status(200).json("Subscriptions Successfully Created");
        } catch (error) {
            console.log(error);
            return res.status(500).json({ message: error?.raw?.message || "Something went wrong" });
        }
    })
);

subscriptionRouter.post("/subscribe");

export default subscriptionRouter;
