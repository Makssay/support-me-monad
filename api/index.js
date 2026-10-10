// The build produces one server-only CommonJS bundle. Keeping this entry tiny
// avoids Node ESM extension/JSON-loader differences between tsx and Vercel.
module.exports = require('../.server/handler.cjs').default;
