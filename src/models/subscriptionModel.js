import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        itsPopular: { type: Boolean, default: false },
        monthPrice: { type: Number, required: true },
        yearPrice: { type: Number, required: true },
        perks: { type: Array, required: true },
        stripe_product: { type: String, required: true },
        monthly_stripe_data: {
            price_id: { type: String, required: true },
        },
        yearly_stripe_data: {
            price_id: { type: String, required: true },
        },
    },
    {
        timestamps: true,
    }
);

subscriptionSchema.set("toJSON", {
    transform: (doc, sub, options) => {
        delete sub.stripe_product;
        delete sub.monthly_stripe_data;
        delete sub.yearly_stripe_data;

        return sub;
    },
});

const Subscription = mongoose.model("Subscription", subscriptionSchema);
export default Subscription;
