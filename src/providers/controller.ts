import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
// import * as json5 from 'json5';
// import * as dateFormat from 'dateformat';

interface IPlDocObject {
   type:string;
   name:string;
   dataType?:string;
   params?:IParameter[];
}

interface IParameter {
   name:string;
   dataType?:string;
}

interface IPlDocVariablesCustom {
   author:string;
   date:Date;
}

interface IPlDocVariables extends IPlDocVariablesCustom {
   type:string;
   object:string;
}

interface IPlDocVariablesDef {
   regFindVar:RegExp;
   values:IPlDocVariables;
   shift?:number;
   offset?:number;
}

export interface RuleSnippet {
   prefix:string;
   body:string[];
   description?:string;
}

export interface RuleTemplate extends RuleSnippet {
   paramIndex?:number;
   paramMaxVar?:number;
   paramVarCount?:number;
   returnIndex?:number;
}

export class RuleController {
   private template:RuleTemplate;
   private snippets:RuleSnippet[];
   private author:string;
   private enable:boolean;

   constructor() {}

   public getDocSnippet(text:string):RuleSnippet {
      this.init();

      if (this.enable && this.template) {
         let doc = this.getInfo(text);
         if (doc) {
            return this.buildTemplate(doc, this.template);
         }
      }
   }

   public getCustomSnippets():RuleSnippet[] {
      this.init();
      return this.snippets;
   }

   private init() {
      if (this.enable == null) {
         this.enable = vscode.workspace.getConfiguration("plsql-language").get<boolean>("pldoc.enable");
         this.author = vscode.workspace.getConfiguration("plsql-language").get<string>("pldoc.author");
         this.initTemplates();
      }
   }

   private getInfo(text:string):IPlDocObject {
      let plDocObj:IPlDocObject;
      const regex = /(function|procedure)\s*(\w+)\s*(\([\s\S]*?\))?(?:\s*(return))?/i;
      let found = regex.exec(text);

      if (found && found.length > 0) {
         // Function or Procedure
         plDocObj = {
            type: found[1].toLowerCase(),
            name: found[2],
            params: []
         };

         // Params
         const params = found[3];
         const regexParams = /(?:\(|,)\s*(\w+)/g;

         if (params !== '') {
            while (found = regexParams.exec(params)) {
               if (found.length > 0) {
                  plDocObj.params.push({name: found[1]});
               }
            }
         }
      }

      return plDocObj;
   }

   private initTemplates() {
      let parsedJSON;
      let location: string = vscode.workspace.getConfiguration("plsql-language").get<string>("pldoc.path");
      if (!location) {
         location = path.join(__dirname, '../../snippets/pldoc.json');
      } else {
         location = path.join(location.replace('${workspaceRoot}', vscode.workspace.rootPath), 'pldoc.json');
      }
      try {
         parsedJSON = json5.parse(fs.readFileSync(location).toString()); // invalid JSON or permission issue can happen here
      } catch (error) {
         console.error(error);
         return;
      }

      if (parsedJSON) {
         const variables: IPlDocVariablesCustom = {
            author: this.author,
            date: new Date()
         };

         Object.keys(parsedJSON).forEach(key => {
               // Doc
               if (key === 'pldoc') {
                  if (this.enable && parsedJSON.pldoc.body) {
                     this.template = parsedJSON.pldoc;
                     this.addTemplateInfo(this.template);
                  }
                  else
                     this.template = null;
               } else { // Other custom snippet
                  const snippet = parsedJSON[key];
                  snippet.body.forEach( (text, index) =>
                     snippet.body[index] = this.replaceText(variables, text)
                  );
                  if (!this.snippets)
                     this.snippets = [];
                  this.snippets.push(snippet);
               }
         });
      }
   }

   private addTemplateInfo(template:RuleTemplate) {
      // Find index of params line
      const regFindParam = getRegFindVarParam(),
            regFindVar = getRegFindVar(),
            regFindReturn = getRegFindReturn();

      let found;
      template.body.forEach( (text, index) => {
         if (template.paramIndex == null) {
               found = regFindParam.exec(text);
               if (found) {
                  template.paramIndex = index;
                  template.paramMaxVar = 0;
                  template.paramVarCount = 0;
                  let foundVar, numberVar = 0;
                  while (foundVar = regFindVar.exec(text)) {
                     ++template.paramVarCount;
                     numberVar = Number(foundVar[1]);
                     if (template.paramMaxVar < numberVar)
                           template.paramMaxVar = numberVar;
                  }
               }
         }
         if (template.returnIndex == null) {
               found = regFindReturn.exec(text);
               if (found)
                  template.returnIndex = index;
         }
      });
   }

   private buildTemplate(plDocObj: IPlDocObject, template: RuleTemplate): RuleTemplate  {
      let body: string[] = [];

      const variables: IPlDocVariablesDef = {
         regFindVar: getRegFindVar(),
         values: {
               type: plDocObj.type,
               object: plDocObj.name,
               author: this.author,
               date: new Date()
         },
         shift: plDocObj.params.length > 1 ? (plDocObj.params.length - 1)*template.paramVarCount : 0,
         offset: template.paramMaxVar
      };

      template.body.forEach( (text, index) => {
         let lineText = text;
         if (index !== template.paramIndex) {
               if (index !== template.returnIndex || plDocObj.type === 'function') {
                  lineText = this.replaceText(variables.values, lineText);
                  lineText = this.shiftVariables(variables, lineText, template);
                  body.push(lineText);
               }
         } else {
               plDocObj.params.forEach( (param, paramIndex) => {
                  let paramText = lineText;
                  paramText = replaceTextParam(param, paramText);
                  if (paramIndex > 0)
                     paramText = this.shiftParamVariables(variables, paramText);
                  body.push(paramText);
               });
         }
      });

      if (body.length > 0)
         return {
               prefix: template.prefix,
               body: body,
               description: template.description
         };
   }

   private replaceText(variables: IPlDocVariablesCustom, text: string): string {
      // replace special variables values
      Object.keys(variables).forEach(key => {
         text = text.replace(getRegFindVarDoc(key), (match, p1, p2) => {
            if (!p1 || (p1.toLowerCase() !== 'date'))
               return variables[key];
            else {
               // replace date
               if (!p2 || (p2.trim() === ''))
                  return variables.date.toLocaleDateString();
               else
                  return dateFormat(variables.date, p2);
            }
         });
      });
      return text;
   }

   private shiftVariables(variables: IPlDocVariablesDef, text: string, template: RuleTemplate): string {
      if (variables.shift > 0) {
         text = text.replace(variables.regFindVar, (match, p1) => {
            if (Number(p1) > template.paramMaxVar) {
               // Shift variables $n or ${n:xxx}
               if (match.startsWith('${'))
                  return '${'+String(variables.shift+Number(p1));
               else //if (match.startsWith('$'))
                  return '$'+String(variables.shift+Number(p1));
            } else {
               return match;
            }
         });
      }
      return text;
   }

   private shiftParamVariables(variables: IPlDocVariablesDef, text: string): string {
      if (variables.offset != null) {
         text = text.replace(variables.regFindVar, (match, _p1) => 
            match.startsWith("${")
               ? "${" + String(++variables.offset)
               : "$" + String(++variables.offset)
         );
      }
      return text;
   }
}

const replaceTextParam = (param:IParameter, text:string) =>
   text.replace(getRegFindVarParam(), param.name);

const getRegFindVar = ()=> /\$(?:{)?(\d+)/gi;
const getRegFindVarParam = ()=> new RegExp(`\\\${pldoc_${'param'}}`, 'i');
const getRegFindVarDoc = (key:string) =>
   new RegExp(`\\\${pldoc_(${key})(?:(?:\\s*\\|\\s*)([^}]*))?}`, 'i');
const getRegFindReturn = () => /\breturn\b/i;
