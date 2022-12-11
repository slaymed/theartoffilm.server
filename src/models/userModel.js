import mongoose from "mongoose";

const defaultRolledFoldedObject = { default: { rolled: 15, folded: 15 } };
const shippingCost = { default: 15 };

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        address: { type: String, required: false },
        city: { type: String, required: false },
        availableBalance: { type: Number, default: 0 },
        pendingBalance: { type: Number, default: 0 },
        postalCode: { type: String, required: false },
        country: { type: String, required: false },
        code: { type: String, required: false },
        sessions: Array,
        sellerName: { type: String, required: true },
        logo: String,
        description: String,
        stripe_account_id: String,
        shipping_cost: { type: Object, default: shippingCost },
        rolled_folded_shipping_cost: { type: Object, default: defaultRolledFoldedObject },
        rating: { type: Number, default: 0, required: true },
        numReviews: { type: Number, default: 0, required: true },
        isAdmin: { type: Boolean, default: false, required: true },
        account_link: { type: String, required: false },
        resetPasswordToken: { type: String, required: false },
        resetPasswordExpires: { type: Date, required: false },
        cart: { type: mongoose.Schema.Types.ObjectId, ref: "Cart" },
        trialUsed: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    }
);

userSchema.set("toJSON", {
    transform: (doc, user, options) => {
        delete user.password;
        delete user.resetPasswordToken;
        delete user.resetPasswordExpires;
        delete user.cart;

        return user;
    },
});

const User = mongoose.model("User", userSchema);
export default User;
