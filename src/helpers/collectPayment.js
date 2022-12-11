import PaymentRecord from "../models/paymentRecordModal.js";
import User from "../models/userModel.js";

const collectPayment = async (paymentId, userId) => {
    let user;

    if (userId) {
        user = await User.findById(userId);
        if (!user) throw new Error("user not found");
    }

    const payment = await PaymentRecord.findById(paymentId).populate("by");
    if (!payment) throw new Error("Payment Record not found");

    if (user && payment.by && payment.by._id.toString() !== user._id.toString()) throw new Error("Unauthorized");

    const now_time = new Date().getTime();

    if (!payment.collected) {
        payment.collected_at = now_time;
        payment.collected = true;

        if (payment.to) {
            const to = await User.findById(payment.to);
            if (to) {
                to.pendingBalance += payment.total_release_amount_after_fee;
                await to.save();
            }
        }
    }

    await payment.save();

    return payment;
};

export default collectPayment;
