/* tslint:disable:no-require-imports no-var-requires */
const testRunner = require("vscode/lib/testrunner");
testRunner.configure({ ui: "tdd", useColors: true });
module.exports = testRunner;