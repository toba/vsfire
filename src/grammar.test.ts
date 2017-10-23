/* tslint:disable:no-unused-expression */
import "mocha";
import { expect } from "chai";
import { find } from "./grammar";

describe("Grammar", () => {
   it("finds named TypeInfo", () => {
      const info = find("math");
      expect(info).is.not.null;
   });
});