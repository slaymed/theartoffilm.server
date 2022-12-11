import getStripe from "./get-stripe.js";

const create_stripe_customer = async (user) => {
    try {
        if (!user) return null;
        const stripe = await getStripe();

        const test_clock = await stripe.testHelpers.testClocks.create({
            frozen_time: 1000 * 60 * 60 * 24 * 30,
        });
        if (!test_clock || test_clock.deleted) return null;

        const customer = await stripe.customers.create({
            name: user.name,
            email: user.email,
            metadata: {
                userId: user._id,
            },
            test_clock: test_clock.id,
        });
        if (customer && !customer.deleted) return customer;

        return null;
    } catch (error) {
        console.log(error);
        console.log("Failed inside (create_stripe_customer)");
    }
};

export default create_stripe_customer;
