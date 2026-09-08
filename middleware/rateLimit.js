// Tiny in-memory rate limiter — no new dependency needed.
// Good enough for auth endpoints on a small platform + serverless.
// For heavy traffic, move to Redis / gateway-level limiting.
const buckets = new Map();

function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const key = `${req.path}:${req.ip}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now > bucket.reset) {
      bucket = { count: 0, reset: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      res.set('Retry-After', Math.ceil((bucket.reset - now) / 1000));
      return res.status(429).send({ message: 'Too many requests. Please try again later.' });
    }

    // Opportunistic cleanup so the map doesn't grow forever
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (now > v.reset) buckets.delete(k);
      }
    }

    next();
  };
}

// Brute-force guards for public auth endpoints
const jwtLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });

module.exports = { rateLimit, jwtLimiter, registerLimiter };
