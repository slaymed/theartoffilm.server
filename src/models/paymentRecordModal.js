import mongoose from "mongoose";

const paymentRecordSchema = new mongoose.Schema(
    {
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        to: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        total_collected_amount: { type: Number, required: true },
        commission_percentage: { type: Number, required: true },
        total_commission_fee: { type: Number, required: true },
        total_release_amount_after_fee: { type: Number, required: true },
        collected: { type: Boolean, default: false },
        collected_at: { type: Number, default: null },
        refunded: { type: Boolean, default: false },
        refunded_at: { type: Number, default: null },
        released: { type: Boolean, default: false },
        released_at: { type: Number, default: null },
        type: { type: String, required: true, enum: ["order", "gift", "advertise"] },
        ref: { type: String, required: true },
        session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true },
        payment_intent_id: { type: String, default: null },
    },
    { timestamps: true }
);

const PaymentRecord = mongoose.model("PaymentRecord", paymentRecordSchema);

paymentRecordSchema.set("toJSON", {
    transform: (doc, paymentRecord, options) => {
        delete paymentRecord.payment_intent_id;

        return paymentRecord;
    },
});

export default PaymentRecord;
