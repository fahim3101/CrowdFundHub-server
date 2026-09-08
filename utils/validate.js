const { ObjectId } = require('mongodb');

// Returns true only for 24-hex strings Mongo can actually use.
// Prevents `new ObjectId(bad)` from throwing a 500.
function isValidObjectId(id) {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === String(id);
}

// Express middleware factory: rejects /:id routes with a 400 instead of crashing.
function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    if (!isValidObjectId(req.params[paramName])) {
      return res.status(400).send({ message: 'Invalid ID format' });
    }
    next();
  };
}

const ALLOWED_ROLES = ['supporter', 'creator', 'admin'];
const ALLOWED_CAMPAIGN_STATUS = ['approved', 'rejected'];
const ALLOWED_CONTRIBUTION_STATUS = ['approved', 'rejected'];

module.exports = {
  isValidObjectId,
  validateObjectId,
  ALLOWED_ROLES,
  ALLOWED_CAMPAIGN_STATUS,
  ALLOWED_CONTRIBUTION_STATUS,
};
