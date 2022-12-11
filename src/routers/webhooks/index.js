import express from "express";

import stripeWebhooksRouter from "./stripe/stripe.js";

const webhooksRouter = express.Router();

webhooksRouter.use("/stripe", express.raw({ type: "application/json" }), stripeWebhooksRouter);

export default webhooksRouter;
