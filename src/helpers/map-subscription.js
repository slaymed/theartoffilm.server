import Subscription from "../models/subscriptionModel.js";
import getStripe from "./get-stripe.js";

export const mapSubscription = async (subscription) => {
    const stripe = await getStripe();

    const targeted_sub = await Subscription.findById(subscription.metadata.current_sub_id);

    let customer;

    try {
        customer = await stripe.customers.retrieve(subscription.customer);
    } catch (error) {}

    if (!customer) throw new Error("Customer Not Found");
    if (customer.deleted) throw new Error("Customer has been deleted");

    const test_clock = await stripe.testHelpers.testClocks.retrieve(customer.test_clock);
    const now_time = test_clock.frozen_time;
    const period_time = subscription.current_period_end - subscription.current_period_start;
    const used_time = now_time - subscription.current_period_start;

    const progress_percentage = Math.round((used_time / period_time) * 100);

    const [{ price }] = subscription.items.data;

    const sub_data = {
        cancel_at: subscription.cancel_at,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at,
        created: subscription.created,
        current_period_end: subscription.current_period_end,
        current_period_start: subscription.current_period_start,
        customer: subscription.customer,
        days_until_due: subscription.days_until_due,
        ended_at: subscription.ended_at,
        metadata: subscription.metadata,
        start_date: subscription.start_date,
        status: subscription.status,
        trial_end: subscription.trial_end,
        trial_start: subscription.trial_start,
        progress_percentage,
        billing: price.recurring.interval,
        price: price.unit_amount / 100,
        sub: targeted_sub,
    };

    let next_sub_data;

    if (subscription.metadata.expecting_downgrade) {
        const { targeted_sub_id, charge_period } = JSON.parse(subscription.metadata.expecting_downgrade);

        const nextSub = await Subscription.findById(targeted_sub_id);

        if (nextSub) {
            next_sub_data = {
                charge_period,
                start_date: subscription.cancel_at,
                sub: nextSub,
            };
        }
    }

    const invoice = await stripe.invoices.retrieve(subscription.latest_invoice);

    const mappedInvoice = {
        hosted_invoice_url: invoice.hosted_invoice_url,
        invoice_pdf: invoice.invoice_pdf,
        amount_paid: invoice.total / 100,
        paid: invoice.paid,
    };

    return { sub_data, next_sub_data, invoice: mappedInvoice };
};
