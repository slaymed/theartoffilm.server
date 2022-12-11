export const withdrawRequestCreatedEmail = ({ email, name, amount }) => {
    return {
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Money Withdrawal",
        html: `<p>Hi ${name},</p>
  <p>You have successfully withdrawn £${amount} from your account.</p>
  <p>Thanks for using our service. Funds will be sent to your bank account within 2 working days.</p>
  <p>Regards,</p>
  <p>The Art of Film</p>
  `,
    };
};

export const withdrawRequestCanceledEmail = ({ email, name }) => {
    return {
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Withdraw Request",
        html: `<p>Hi ${name},</p>
  <p>Your Withdraw Request has been canceled successfully</p>
  <p>Thanks for using our service. Funds back to your account.</p>
  <p>Regards,</p>
  <p>The Art of Film</p>
  `,
    };
};
