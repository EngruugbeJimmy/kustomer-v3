/**
 * accountGuard — blocks suspended or banned accounts
 * Phone verification is not enforced at this stage
 */
module.exports = (req, res, next) => {
  const { accountStatus } = req.user || {};

  if (accountStatus === "suspended") {
    return res.status(403).json({
      error: "Your account has been suspended. Contact support if you believe this is a mistake.",
      code:  "ACCOUNT_SUSPENDED"
    });
  }

  if (accountStatus === "banned") {
    return res.status(403).json({
      error: "Your account has been permanently disabled.",
      code:  "ACCOUNT_BANNED"
    });
  }

  // warned accounts can still use the app — just flagged for review
  if (accountStatus === "warned") {
    res.setHeader("X-Account-Warning", "Your account has received reports and is under review.");
  }

  next();
};
