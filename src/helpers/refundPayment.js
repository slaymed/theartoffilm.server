import PaymentRecord from "../models/paymentRecordModal.js";
import User from "../models/userModel.js";

const refundPayment = async (paymentId, userId) => {
    let user;

    if (userId) {
        user = await User.findById(userId);
        if (!user) throw new Error("user not found");
    }

    const payment = await PaymentRecord.findById(paymentId).populate("by");
    if (!payment) throw new Error("Payment Record not found");

    if (user && payment.by && payment.by._id.toString() !== user._id.toString()) throw new Error("Unauthorized");

    if (!payment.collected) throw new Error("Unauthorized");

    const now_time = new Date().getTime();

    let to;

    if (payment.to) {
        to = await User.findById(payment.to);
    }

    if (!payment.refunded) {
        payment.refunded = true;
        payment.refunded_at = now_time;

        if (to) {
            if (!payment.released) {
                to.pendingBalance -= payment.total_release_amount_after_fee;
                await to.save();
            }
            if (payment.released) {
                to.availableBalance -= payment.total_release_amount_after_fee;
                await to.save();
            }
        }
    }

    return await payment.save();
};

export default refundPayment;
