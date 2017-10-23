/* tslint:disable:no-unused-expression */
import "mocha";
import { expect } from "chai";
import { find } from "./grammar";

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