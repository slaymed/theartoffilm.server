export const orderRecieved = ({ email, name, message }) => {
    return {
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Order Recieved",
        html: `<p>Hi ${name},</p>
  <p>${message}</p>
  <p>Thanks for using our service.</p>
  <p>Regards,</p>
  <p>The Art of Film</p>
  `,
    };
};

export const orderDelivered = ({ email, name, message }) => {
    return {
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Order Delivered",
        html: `<p>Hi ${name},</p>
  <p>${message}</p>
  <p>Thanks for using our service.</p>
  <p>Regards,</p>
  <p>The Art of Film</p>
  `,
    };
};
