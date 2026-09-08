const { getCollections } = require('../config/db');

// Ensures a user can only read their own `:email` resource.
// Admins bypass the check so dashboards still work.
// Must run AFTER verifyToken (needs req.decoded.email).
// Usage: router.get('/payments/:email', verifyToken, verifyOwner('email'), ...)
function verifyOwner(paramName = 'email') {
  return async (req, res, next) => {
    const tokenEmail = req.decoded?.email;
    const paramEmail = req.params[paramName];

    if (!tokenEmail) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }

    if (tokenEmail === paramEmail) return next();

    // Allow admins to read other users' data (e.g. support/debugging)
    try {
      const { usersCollection } = getCollections();
      const requester = await usersCollection.findOne({ email: tokenEmail });
      if (requester && requester.role === 'admin') return next();
    } catch {
      // fall through to 403
    }

    return res.status(403).send({ message: 'Forbidden access: email mismatch' });
  };
}

module.exports = verifyOwner;
