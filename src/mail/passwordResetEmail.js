export const passwordResetEmail = ({ email, token }) => {
    return {
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Password Reset",
        text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
  Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n
  ${process.env.WEB_APP}/reset/${token}\n\n
  If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };
};
