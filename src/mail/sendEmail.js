import { createTransporter } from "./transporter.js";

export const sendEmail = (mailOptions, onSuccess, onError) => {
    try {
        const transporter = createTransporter();

        transporter.sendMail(mailOptions, function (err, info) {
            if (err && onError) return onError();
            if (onSuccess) onSuccess();
        });
    } catch (error) {}
};
