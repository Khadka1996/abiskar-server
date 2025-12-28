const nodemailer = require('nodemailer');

// Email configuration based on environment
const getEmailConfig = () => {
  switch (process.env.NODE_ENV) {
    case 'production':
      return {
        service: 'gmail',
        auth: {
          user: process.env.PROD_EMAIL_USER,
          pass: process.env.PROD_EMAIL_PASSWORD
        },
        from: process.env.PROD_EMAIL_FROM || 'no-reply@yourdomain.com',
        to: process.env.PROD_EMAIL_TO
      };
    case 'staging':
      return {
        host: process.env.STAGING_SMTP_HOST,
        port: process.env.STAGING_SMTP_PORT || 587,
        secure: process.env.STAGING_SMTP_SECURE === 'true',
        auth: {
          user: process.env.STAGING_EMAIL_USER,
          pass: process.env.STAGING_EMAIL_PASSWORD
        },
        from: process.env.STAGING_EMAIL_FROM || 'staging@yourdomain.com',
        to: process.env.STAGING_EMAIL_TO
      };
    case 'test':
      return {
        service: 'gmail',
        auth: {
          user: process.env.TEST_EMAIL_USER,
          pass: process.env.TEST_EMAIL_PASSWORD
        },
        from: process.env.TEST_EMAIL_FROM || 'test@yourdomain.com',
        to: process.env.TEST_EMAIL_TO
      };
    default: // development
      return {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: process.env.DEV_EMAIL_USER || 'user@ethereal.email',
          pass: process.env.DEV_EMAIL_PASSWORD || 'password'
        },
        from: process.env.DEV_EMAIL_FROM || 'dev@yourdomain.com',
        to: process.env.DEV_EMAIL_TO || 'dev-team@yourdomain.com'
      };
  }
};

// Create reusable transporter object
const emailConfig = getEmailConfig();
const transporter = nodemailer.createTransport({
  service: emailConfig.service,
  host: emailConfig.host,
  port: emailConfig.port,
  secure: emailConfig.secure,
  auth: emailConfig.auth,
  tls: {
    // Do not fail on invalid certs
    rejectUnauthorized: process.env.NODE_ENV !== 'production'
  }
});

// Verify connection configuration
transporter.verify((error) => {
  if (error) {
    console.error('Error with email configuration:', error);
  } else {
    console.log(`Email server is ready to send messages in ${process.env.NODE_ENV} mode`);
    console.log(`From: ${emailConfig.from}, To: ${emailConfig.to}`);
  }
});

const sendNewMessageEmail = async ({ name, email, service, message }) => {
  try {
    const mailOptions = {
      from: `"Service Notifications" <${emailConfig.from}>`,
      to: emailConfig.to,
      subject: `[${process.env.NODE_ENV?.toUpperCase() || 'DEV'}] New Message About ${service}`,
      html: `
        <h2>New Contact Message</h2>
        <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
        <p><strong>Service:</strong> ${service}</p>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
        <hr>
        <p>You can respond to this message through your admin dashboard.</p>
        ${process.env.NODE_ENV !== 'production' ? 
          `<p style="color: #ff0000;">THIS IS A ${process.env.NODE_ENV?.toUpperCase() || 'DEVELOPMENT'} EMAIL - DO NOT REPLY</p>` : ''}
      `,
      // Add headers for tracking
      headers: {
        'X-Environment': process.env.NODE_ENV || 'development',
        'X-Application': 'Service Messages Backend'
      }
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email notification: ${error.message}`);
  }
};

module.exports = {
  sendNewMessageEmail,
  transporter // export for testing purposes
};