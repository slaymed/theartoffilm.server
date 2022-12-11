import mongoose from "mongoose";

const subscriptionGiftSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    start_date: { type: Number, required: true },
    cancel_at: { type: Number, required: true },
    gift: { type: mongoose.Schema.Types.ObjectId, ref: "Gift" },
    targeted_sub: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
    period: { type: String, required: true, enum: ["year", "month"] },
    period_time: { type: Number, required: true },
    active: { type: Boolean, default: false },
});

const SubscriptionGift = mongoose.model("SubscriptionGift", subscriptionGiftSchema);

export default SubscriptionGift;
