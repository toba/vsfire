/* tslint:disable:no-unused-expression */
import "mocha";
import { expect } from "chai";
import { findType, accessModifiers } from "./grammar";

describe("Grammar", () => {
   it("finds named TypeInfo", () => {
      ["math", "document"].forEach(async (name)=> {
         const info = await findType(name);
         expect(info).to.exist;
         expect(info).has.property("methods");
      });
   });

   it("supports full and relative type paths", async ()=> {
      const t1 = await findType("token");
      const t2 = await findType("request.auth.token");

      expect(t1).to.exist;
      expect(t1).has.property("fields");
      expect(t1.fields).has.property("phone_number");

      expect(t2).to.exist;
      expect(t1).equals(t2);
   });

   it("applies basic type members to implementations", async ()=> {
      const info = await findType("request.time");

      expect(info).to.exist;
      expect(info).has.property("methods");
      expect(info.methods["year"]).has.property("about", "The year value as an `int`, from 1 to 9999.");
   });

   it("generates snippets for parameterized methods", async ()=> {
      const info = await findType("request.path");

      expect(info).to.exist;
      expect(info).has.property("methods");
      expect(info.methods["split"]).has.property("snippet", "split(${1:regex})$0");
      expect(info.methods["size"]).has.property("snippet", "size()$0");
   });

   it("builds list of request access methods", async ()=> {
      const methods = await accessModifiers();

      expect(methods).to.exist;
      expect(methods).is.length(7);
   });
});