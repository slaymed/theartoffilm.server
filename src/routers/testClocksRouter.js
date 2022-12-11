import express from "express";
import expressAsyncHandler from "express-async-handler";

import get_or_create_stripe_customer from "../helpers/get-or-create-stripe-customer.js";
import getStripe from "../helpers/get-stripe.js";
import { isAuth } from "../utils.js";

const testClocksRouter = express.Router();

testClocksRouter.get(
    "/mine",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const customer = await get_or_create_stripe_customer(req.user);
            if (!customer) return res.status(500).json({ message: "Something went wrong" });

            const stripe = await getStripe();
            const testClock = await stripe.testHelpers.testClocks.retrieve(customer.test_clock);
            if (!testClock || testClock.deleted) return res.status(404).json({ message: "Test Clock not found" });

            return res.status(200).json(testClock);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

testClocksRouter.post(
    "/advance",
    isAuth,
    expressAsyncHandler(async (req, res) => {
        try {
            const { advanceBy } = req.body;
            if (typeof advanceBy !== "number") return res.status(401).json({ message: "Invalid Time Type" });

            const stripe_day_time = 60 * 60 * 24;
            const stripe_advance_by_time = advanceBy;
            const stripe_advance_by_days = Math.round(stripe_advance_by_time / stripe_day_time);

            if (stripe_advance_by_days > 59 || stripe_advance_by_days < 0)
                return res.status(401).json({ message: "Time not allowed" });

            const customer = await get_or_create_stripe_customer(req.user);
            if (!customer) return res.status(500).json({ message: "Something went wrong" });

            const stripe = await getStripe();

            const testClock = await stripe.testHelpers.testClocks.retrieve(customer.test_clock);
            if (!testClock || testClock.deleted) return res.status(404).json({ message: "Test Clock not found" });

            const advancedClockTest = await stripe.testHelpers.testClocks.advance(testClock.id, {
                frozen_time: Math.round(testClock.frozen_time + stripe_advance_by_time),
            });

            return res.status(200).json(advancedClockTest);
        } catch (error) {
            return res.status(500).json(error);
        }
    })
);

export default testClocksRouter;
