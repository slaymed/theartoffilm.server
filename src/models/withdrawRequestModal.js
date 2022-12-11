import mongoose from "mongoose";

const withdrawRequestSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        amount: { type: Number, required: true },
        to: {
            accountType: { type: String, required: true, enum: ["bank_account", "paypal_account"] },
            bank_account: {
                type: Object,
                default: null,
            },
            paypal_account: { type: Object, default: null },
        },
        status: { type: String, default: "pending", enum: ["pending", "success", "rejected"] },
        rejected_because: { type: String, default: null },
    },
    {
        timestamps: true,
    }
);

withdrawRequestSchema.set("toJSON", {
    transform: (doc, wr, options) => {
        if (wr.to.accountType === "bank_account") delete wr.to.bank_account.account_sort_code;

        return wr;
    },
});

const WithdrawRequest = mongoose.model("WithdrawRequest", withdrawRequestSchema);
export default WithdrawRequest;
