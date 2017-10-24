/* tslint:disable:no-unused-expression */
import "mocha";
import { expect } from "chai";
import { find } from "./grammar";

// Modules that import `vscode` cannot be tested with mocha. At least I can't
// figure it out. See
// https://github.com/Microsoft/vscode-wordcount/issues/5
describe("Grammar", () => {
   it("finds named TypeInfo", () => {
      ["math", "document"].forEach(name => {
         const info = find(name);
         expect(info).to.exist;
         expect(info).has.property("methods");
      });

      const info = find("token");
      expect(info).to.exist;
      expect(info).has.property("fields");
      expect(info.fields).has.property("phone_number");
   });
});