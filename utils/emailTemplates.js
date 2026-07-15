// One shared wrapper so every email looks like it came from the same app.
const wrapEmail = (title, message, actionUrl) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #EDEBE2;">
    <h2 style="color: #1F5C4E; margin-bottom: 8px;">CrowdFundHub</h2>
    <h3 style="color: #10231C; margin-bottom: 12px;">${title}</h3>
    <p style="color: #10231C; line-height: 1.5;">${message}</p>
    ${actionUrl ? `<a href="${actionUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#1F5C4E;color:#FBFAF6;text-decoration:none;border-radius:24px;">Open CrowdFundHub</a>` : ''}
  </div>
`;

module.exports = wrapEmail;
