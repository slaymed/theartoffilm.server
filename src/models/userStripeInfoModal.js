import mongoose from "mongoose";

const userStripeInfoSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        customer: { type: String, required: true },
        sub: { type: String, default: null },
    },
    {
        timestamps: true,
    }
);

userStripeInfoSchema.set("toJSON", {
    transform: (doc, stripeInfo, options) => {
        delete stripeInfo.user;

        return stripeInfo;
    },
});

const UserStripeInfo = mongoose.model("UserStripeInfo", userStripeInfoSchema);
export default UserStripeInfo;
