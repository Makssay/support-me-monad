// Separate serverless function: a slow executor cannot occupy the API process's
// in-memory queue. The handler still requires the scheduler secret.
const handler = require('../.server/handler.cjs').default;
module.exports = (req,res) => { req.url='/api/internal/tick';return handler(req,res); };
