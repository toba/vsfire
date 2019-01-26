const config = require('@toba/test/jest');
// Jest shouldn't try to run /test/ folder tests
config.testRegex = __dirname + '/src/.*\\.test\\.tsx?$';
module.exports = config;
