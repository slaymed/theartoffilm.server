import getStripe from "../../../../helpers/get-stripe.js";
import UserStripeInfo from "../../../../models/userStripeInfoModal.js";
import Subscription from "../../../../models/subscriptionModel.js";

export async function customerSubscriptionDeleted(event, io) {
    try {
        const { object } = event.data;
        let { expecting_downgrade } = object.metadata;

        if (!expecting_downgrade) throw new Error("No subscription is waiting");
        const { targeted_sub_id, charge_period } = JSON.parse(expecting_downgrade);

        const stripe = await getStripe();
        const userStripeInfo = await UserStripeInfo.findOne({ sub: object.id });
        if (!userStripeInfo) throw new Error("User Already Changed his Subscription");
        const customer = await stripe.customers.retrieve(userStripeInfo.customer);
        if (!customer.invoice_settings.default_payment_method) throw new Error("No Customer Payment Method");
        const targeted_sub = await Subscription.findById(targeted_sub_id);
        if (!targeted_sub) throw new Error("Targeted Subscription Not Found");

        const stripe_monthly_price = await stripe.prices.retrieve(targeted_sub.monthly_stripe_data.price_id);
        const stripe_yearly_price = await stripe.prices.retrieve(targeted_sub.yearly_stripe_data.price_id);
        const targeted_price = charge_period === "month" ? stripe_monthly_price : stripe_yearly_price;
        if (!targeted_price) throw new Error("Subscription Price Not Found");

        let stripe_monthly_coupon = undefined;
        let stripe_yearly_coupon = undefined;
        let coupon = undefined;

        if (targeted_sub.monthly_stripe_data.coupon_id)
            stripe_monthly_coupon = await stripe.coupons.retrieve(targeted_sub.monthly_stripe_data.coupon_id);
        if (targeted_sub.yearly_stripe_data.coupon_id)
            stripe_yearly_coupon = await stripe.coupons.retrieve(targeted_sub.yearly_stripe_data.coupon_id);
        if (stripe_monthly_coupon || stripe_yearly_coupon)
            coupon = charge_period === "month" ? stripe_monthly_coupon : stripe_yearly_coupon;

        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: targeted_price.id }],
            coupon: coupon?.id,
            metadata: {
                current_sub_id: targeted_sub._id.toString(),
            },
        });

        userStripeInfo.sub = subscription.id;
        await userStripeInfo.save();

        return { success: true };
    } catch (error) {
        const { object } = event.data;

        const userStripeInfo = await UserStripeInfo.findOne({ sub: object.id });
        if (userStripeInfo) {
            userStripeInfo.sub = null;
            await userStripeInfo.save();
        }

        return { success: false, message: error.message, detail: "Subscription Deleted" };
    }
}
