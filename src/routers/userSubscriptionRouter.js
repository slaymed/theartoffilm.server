import express from "express";
import expressAsyncHandler from "express-async-handler";
import get_or_create_stripe_customer from "../helpers/get-or-create-stripe-customer.js";

import getStripe from "../helpers/get-stripe.js";
import get_or_create_user_stripe_info from "../helpers/get_or_create_user_stripe_info.js";
import { isObject } from "../helpers/isObject.js";
import { mapGiftSub } from "../helpers/map-gift-sub.js";
import { mapSubscription } from "../helpers/map-subscription.js";
import { toFixed } from "../helpers/toFixed.js";
import Subscription from "../models/subscriptionModel.js";
import User from "../models/userModel.js";
import UserStripeInfo from "../models/userStripeInfoModal.js";
import { getGiftSub, getStripeSubscription, giftSubValid, isAuth, is_subscribed, stripeSubValid } from "../utils.js";

const userSubscriptionRouter = express.Router();

userSubscriptionRouter.get(
    "/current",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const giftSub = await getGiftSub(req.user);
            if (await giftSubValid(giftSub)) return res.status(200).json(mapGiftSub(giftSub));

            const stripeSub = await getStripeSubscription(req.user);
            if (stripeSub) return res.status(200).json(await mapSubscription(stripeSub));

            return res.status(401).json({
                message: "You're Not Subscribed, Please Subscribe to access this feature.",
                redirect: "/page/subscriptions",
            });
        } catch (error) {
            console.log(error);
            return res.status(500).json(error);
        }
    })
);

userSubscriptionRouter.post(
    "/subscribe",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const user = req.user;

            const giftSub = await getGiftSub(user);
            if (await giftSubValid(giftSub))
                return res.status(401).json({
                    message: "You Already have a valid subscription, Enjoy your Gift",
                    redirect: "/my-subscription",
                });

            const { subscriptionId, charge_period = "month" } = req.body;

            if (charge_period !== "month" && charge_period !== "year") charge_period = "month";

            const targetedSub = await Subscription.findById(subscriptionId);
            if (!targetedSub) return res.status(404).json({ message: "Subscription not found" });

            const stripe = await getStripe();

            const userStripeInfo = await get_or_create_user_stripe_info(user);
            if (!userStripeInfo) throw new Error("Something went wrong");
            const customer = await get_or_create_stripe_customer(user);
            if (!customer || customer.deleted) throw new Error("Something went wrong");

            const stripe_monthly_price = await stripe.prices.retrieve(targetedSub.monthly_stripe_data.price_id);
            const stripe_yearly_price = await stripe.prices.retrieve(targetedSub.yearly_stripe_data.price_id);
            const targeted_price = charge_period === "month" ? stripe_monthly_price : stripe_yearly_price;

            if (!user.trialUsed) {
                const subscription = await stripe.subscriptions.create({
                    customer: customer.id,
                    items: [{ price: targeted_price.id }],
                    trial_period_days: 30,
                    metadata: {
                        current_sub_id: targetedSub._id.toString(),
                    },
                });

                userStripeInfo.sub = subscription.id;
                await userStripeInfo.save();

                const savedUser = await User.findById(user._id);
                savedUser.trialUsed = true;
                await savedUser.save();

                return res.status(200).json(await mapSubscription(subscription));
            }

            let current_sub = null;
            if (userStripeInfo.sub) {
                try {
                    current_sub = await stripe.subscriptions.retrieve(userStripeInfo.sub);
                } catch (error) {}
            }

            if (!customer.invoice_settings.default_payment_method)
                return res.status(401).json({
                    message: "Please add a default payment method before upgrade or downgrade your subscription",
                    redirect: "/payment-methods",
                });

            if (current_sub && (current_sub.status === "active" || current_sub.status === "trialing")) {
                // TODO: Convert to valid time
                const test_clock = await stripe.testHelpers.testClocks.retrieve(customer.test_clock);
                const now_time = test_clock.frozen_time;
                const period_time = current_sub.current_period_end - current_sub.current_period_start;
                const used_time = now_time - current_sub.current_period_start;
                const rest_time = current_sub.current_period_end - now_time;

                const day_time = 60 * 60 * 24;

                const period_days = Math.round(period_time / day_time);
                const used_days = Math.round(used_time / day_time);
                const rest_days = Math.round(rest_time / day_time);

                const [{ price }] = current_sub.items.data;

                const current_price_amount = price.unit_amount / 100;
                const next_price_amount = targeted_price.unit_amount / 100;

                if (price.id === targeted_price.id && used_days < 1)
                    return res.status(401).json({
                        message:
                            "Subscribing again to the same plan require at least 1 day of usage, want to upgrade or downgrade?",
                        redirect: "/page/subscriptions",
                    });

                if (current_price_amount > next_price_amount) {
                    const updated_current_sub = await stripe.subscriptions.update(current_sub.id, {
                        cancel_at_period_end: true,
                        metadata: {
                            ...current_sub.metadata,
                            expecting_downgrade: JSON.stringify({
                                will_start_in: current_sub.current_period_end,
                                targeted_sub_id: targetedSub._id.toString(),
                                charge_period,
                            }),
                        },
                    });

                    return res.status(200).json(await mapSubscription(updated_current_sub));
                }

                const charge_amount_per_day = current_price_amount / period_days;

                const amount_spent = toFixed(used_days * charge_amount_per_day);
                const amount_rest = toFixed(rest_days * charge_amount_per_day);

                const total_amount_spent_percentage = toFixed((amount_spent / next_price_amount) * 100);
                const total_amount_rest_percentage = toFixed((amount_rest / next_price_amount) * 100);

                const newCoupon = await stripe.coupons.create({
                    percent_off: total_amount_rest_percentage > 100 ? 100 : total_amount_rest_percentage,
                    duration: "once",
                });

                const subscription = await stripe.subscriptions.create({
                    customer: customer.id,
                    items: [{ price: targeted_price.id }],
                    coupon: newCoupon.id,
                    metadata: {
                        current_sub_id: targetedSub._id.toString(),
                    },
                });

                userStripeInfo.sub = subscription.id;
                await userStripeInfo.save();

                try {
                    await stripe.subscriptions.update(current_sub.id, {
                        metadata: { expecting_downgrade: null },
                    });

                    await stripe.subscriptions.del(current_sub.id);
                } catch (error) {}

                return res.status(200).json(await mapSubscription(subscription));
            }

            const subscription = await stripe.subscriptions.create({
                customer: customer.id,
                items: [{ price: targeted_price.id }],
                metadata: {
                    current_sub_id: targetedSub._id.toString(),
                },
            });

            userStripeInfo.sub = subscription.id;
            await userStripeInfo.save();

            try {
                await stripe.subscriptions.update(current_sub.id, {
                    metadata: { ...current_sub.metadata, expecting_downgrade: null },
                });

                await stripe.subscriptions.del(current_sub.id);
            } catch (error) {}

            return res.status(200).json(await mapSubscription(subscription));
        } catch (error) {
            console.log(error);
            return res.status(500).json({ message: error?.raw?.message || "Something went wrong" });
        }
    })
);

export default userSubscriptionRouter;
