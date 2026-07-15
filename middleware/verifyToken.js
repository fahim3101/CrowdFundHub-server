const jwt = require('jsonwebtoken');

// Checks the Authorization header for a valid JWT.
// Every private route uses this before it runs.
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }
    req.decoded = decoded;
    next();
  });
};

module.exports = verifyToken;
