/* tslint:disable:no-require-imports no-var-requires */
import "mocha";

/**
 * Test modules that depend on `vscode` must be run in the workspace test
 * environment, which is slow to initialize, so most logic is abstracted to
 * avoid that dependency for quick "unit" testing.
 *
 * Include those tests here so that they're also run by Travis from GitHub.
 */
describe("Unit Tests", ()=> {
   require("../src/grammar.test");
});