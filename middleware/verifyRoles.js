const { getCollections } = require('../config/db');

// Factory that builds a role-checking middleware.
// Must run AFTER verifyToken, since it reads req.decoded.email
const verifyRole = (role) => async (req, res, next) => {
  const email = req.decoded.email;
  const { usersCollection } = getCollections();
  const user = await usersCollection.findOne({ email });

  if (!user || user.role !== role) {
    return res.status(403).send({ message: 'Forbidden access: role mismatch' });
  }
  next();
};

const verifySupporter = verifyRole('supporter');
const verifyCreator = verifyRole('creator');
const verifyAdmin = verifyRole('admin');

module.exports = { verifySupporter, verifyCreator, verifyAdmin };
