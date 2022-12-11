import UserStripeInfo from "../models/userStripeInfoModal.js";
import create_stripe_customer from "./create_stripe_customer.js";

const get_or_create_user_stripe_info = async (user) => {
    try {
        if (!user) return null;
        let userStripeInfo = await UserStripeInfo.findOne({ user: user._id });
        if (!userStripeInfo) {
            const customer = await create_stripe_customer(user);
            if (customer && !customer.deleted) {
                userStripeInfo = await new UserStripeInfo({ customer: customer.id, user: user._id }).save();
            }
        }

        if (!userStripeInfo) return null;

        return userStripeInfo;
    } catch (error) {
        console.log(error);
        console.log("Failed inside get_or_create_user_stripe_info");
    }
};

export default get_or_create_user_stripe_info;
