export const paymentCollectedEmail = ({ email, name, message }) => {
    return {
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Payment Collected",
        html: `<p>Hi ${name},</p>
  <p>${message}</p>
  <p>Thanks for using our service.</p>
  <p>Regards,</p>
  <p>The Art of Film</p>
  `,
    };
};

export const paymentReleasedEmail = ({ email, name, message }) => {
    return {
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Payment Released",
        html: `<p>Hi ${name},</p>
  <p>${message}</p>
  <p>Thanks for using our service.</p>
  <p>Regards,</p>
  <p>The Art of Film</p>
  `,
    };
};

export const paymentRefundedEmail = ({ email, name, message }) => {
    return {
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Payment Refunded",
        html: `<p>Hi ${name},</p>
  <p>${message}</p>
  <p>Thanks for using our service.</p>
  <p>Regards,</p>
  <p>The Art of Film</p>
  `,
    };
};
