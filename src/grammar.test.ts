/* tslint:disable:no-unused-expression */
import "mocha";
import { expect } from "chai";
import { find } from "./grammar";

// Modules that import `vscode` cannot be tested with mocha. At least I can't
// figure it out. See
// https://github.com/Microsoft/vscode-wordcount/issues/5
describe("Grammar", () => {
   it("finds named TypeInfo", () => {
      ["math", "document"].forEach(async (name) => {
         const info = await find(name);
         expect(info).to.exist;
         expect(info).has.property("methods");
      });
   });

   it("supports full and relative type paths", async () => {
      const t1 = await find("token");
      const t2 = await find("request.auth.token");

      expect(t1).to.exist;
      expect(t1).has.property("fields");
      expect(t1.fields).has.property("phone_number");

      expect(t2).to.exist;
      expect(t1).equals(t2);
   });
});