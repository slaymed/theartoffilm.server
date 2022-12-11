export const giftCodeUsed = ({ email, name, message }) => {
    return {
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Gift Code Redeem",
        html: `<p>Hi ${name},</p>
  <p>${message}</p>
  <p>Thanks for using our service.</p>
  <p>Regards,</p>
  <p>The Art of Film</p>
  `,
    };
};
