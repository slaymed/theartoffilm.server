import mongoose from "mongoose";

const giftSchema = new mongoose.Schema(
    {
        buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        used_at: { type: Number, default: null },
        code: { type: String, default: null },
        type: { type: String, required: true, enum: ["subscription"] },
        period: { type: String, default: "month", enum: ["month", "year"] },
        ref_id: { type: String, default: null },
        targeted_ref_id: { type: String, default: null },
        paid_at: { type: Number, default: null },
        is_paid: { type: Boolean, default: false },
        payment_record: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentRecord" },
    },
    { timestamps: true }
);

const Gift = mongoose.model("Gift", giftSchema);

export default Gift;
