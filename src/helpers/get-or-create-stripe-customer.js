import create_stripe_customer from "./create_stripe_customer.js";
import getStripe from "./get-stripe.js";
import get_or_create_user_stripe_info from "./get_or_create_user_stripe_info.js";

const get_or_create_stripe_customer = async (user) => {
    try {
        if (!user) return null;
        const stripe = await getStripe();

        const userStripeInfo = await get_or_create_user_stripe_info(user);
        if (!userStripeInfo) throw new Error("Something went wrong");

        let customer;

        customer = await stripe.customers.retrieve(userStripeInfo.customer);

        if (!customer || customer.deleted) {
            customer = await create_stripe_customer(user);
            if (customer && !customer.deleted) {
                userStripeInfo.customer = customer.id;
                await userStripeInfo.save();
            }
        }

        return customer && !customer.deleted ? customer : null;
    } catch (error) {
        console.log(error);
        console.log("Failed inside (get_or_create_stripe_customer)");
    }
};

export default get_or_create_stripe_customer;
