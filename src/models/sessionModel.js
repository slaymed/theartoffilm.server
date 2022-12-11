import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        url: { type: String, required: true },
        type: {
            type: String,
            required: true,
            enum: ["gift", "poster", "advertisement"],
        },
        ref: { type: mongoose.Schema.Types.ObjectId },
        status: { type: String, required: true, enum: ["unpaid", "paid", "refunded"] },
        payment_intent_id: { type: String },
        lifeCycle: {
            type: String,
            enum: ["payment_intent.succeeded", "charge.refunded"],
        },
        refund: {
            type: Object,
            default: null,
        },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        payment_record: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentRecord" },
    },
    {
        timestamps: true,
    }
);
const Session = mongoose.model("Session", sessionSchema);

sessionSchema.set("toJSON", {
    transform: (doc, session, options) => {
        delete session.payment_intent_id;

        return session;
    },
});

export default Session;
