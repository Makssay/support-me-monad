// Display refresh has a separate process queue from sign-in and payments.
// It performs only chain reads and fenced display/index persistence.
const handler = require('../.server/handler.cjs').default;
module.exports = (req,res) => { req.url='/api/state?refresh=1';return handler(req,res); };
