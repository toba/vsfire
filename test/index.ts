/* tslint:disable:no-require-imports no-var-requires */
const testRunner = require('vscode/lib/testrunner');
testRunner.configure({ ui: 'bdd', useColors: true });
module.exports = testRunner;
