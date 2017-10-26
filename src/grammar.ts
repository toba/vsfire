/**
 * `TypeInfo` mapped to both absolute and short names. For example, `token` is
 * keyed to both "token" and "request.auth.token".
 */
const cache:{[key:string]:TypeInfo} = {};
const listeners:{():void}[] = [];
/** Whether grammar has been compiled to simple cache map. */
let compiled = false;
/** Whether grammar is currently being compiled. */
let compiling = false;

export interface SymbolInfo {
   about:string;
}

/**
 * Data request method
 * https://cloud.google.com/firestore/docs/reference/security/#request_methods
 */
export interface AllowInfo extends SymbolInfo {
   name:string;
   /** Key list converted to object map during compile. */
   includeTypes?:string[];
   includes?:AllowInfo[];
}

export interface TypeInfo extends SymbolInfo {
   methods?:{[key:string]:MethodInfo};
   fields?:{[key:string]:TypeInfo};
   /**
    * Assigning a `basicType` will attach that types fields and methods to this
    * type.
    */
   basicType?:string;
}

export interface MethodInfo extends SymbolInfo {
   parameters?:string[];
   returns?:string;
   /**
    * Snippets are generated during compile if `parameters` have been defined.
    * https://code.visualstudio.com/docs/editor/userdefinedsnippets
    */
   snippet?:string;
}

/**
 * Find type information with given short or fully-qualified name.
 */
export async function find(name:string):Promise<TypeInfo> {
   if (name == null || name == "") { return null; }
   await compile();
   return (cache[name] !== undefined) ? cache[name] : null;
}

/**
 * Get named access information.
 */
export async function allowances():Promise<AllowInfo[]> {
   await compile();
   return allowTypes;
}

/**
 * Compile heirarchical grammar into flat map for faster lookup. If already
 * compiled then promise resolves immediately. Otherwise the resolver is added
 * to any prior resolvers (listeners) awaiting compilation.
 */
export function compile(force = false):Promise<void> {
   if (force) { compiled = false; }

   return (compiled)
      ? Promise.resolve()
      : new Promise((resolve, _reject) => {
         listeners.push(resolve);
         if (!compiling) {
            compiling = true;
            compileBasicMethods(basicTypes);
            compileTypes(grammar);
            compileAllowTypes(allowTypes);
            compiled = true;
            compiling = false;
         }
         while (listeners.length > 0) {
            listeners.pop()();
         }
      });
}

/**
 * Assign basic type members to implementing types. For example, assign `string`
 * methods to `request.path`.
 */
function compileTypes(fields:{[key:string]:TypeInfo}, path:string = ""):void {
   Reflect.ownKeys(fields).forEach(key => {
      const info = fields[key];
      const name = key as string;
      const full = path + ((path != "") ? "." : "") + name;

      if (info.basicType) {
         // copy members from basic type
         const basic = basicTypes[info.basicType];
         if (basic) {
            info.methods = basic.methods;
            info.fields = basic.fields;
         }
      } else if (info.methods) {
         compileMethods(info.methods);
      }

      // cache with both simple and fully-qualified name
      cache[name] = info;
      cache[full] = info;

      if (info.fields) { compileTypes(info.fields, full); }
   });
}

/**
 * Generate snippets for basic type methods so they don't have to be generated
 * again when assigned to an implementing type.
 */
function compileBasicMethods(fields:{[key:string]:TypeInfo}):void {
   Reflect.ownKeys(fields).forEach(key => {
      const info = fields[key];
      if (info.methods) { compileMethods(info.methods); }
      // recurse if basic type has children
      if (info.fields) { compileBasicMethods(info.fields); }
   });
}

/**
 * Generate snippets for methods that define their parameters. Methods that have
 * an empty parameter array will get a parameterless method call snippet like
 * `method()`.
 * https://code.visualstudio.com/docs/editor/userdefinedsnippets
 */
function compileMethods(methods:{[key:string]:MethodInfo}):void {
   Reflect.ownKeys(methods).forEach(key => {
      const info = methods[key];

      if (info.parameters) {
         let args = "";
         if (info.parameters.length > 0) {
            args = info.parameters.reduce((snippet, p, i) => {
               if (i > 0) { snippet += ", "; }
               return snippet + `\${${i + 1}:${p}}`;
            }, "");
         }
         info.snippet = `${key}(${args})$0`;
      }
   });
}

function compileAllowTypes(access:AllowInfo[]):void {
   access.forEach(info => {
      if (info.includeTypes) {
         info.includes = info.includeTypes.map(name => access.find(a => a.name == name));
         //info.snippet = `${key}(${args})$0`;
      }
   });
}

/**
 * Permitted request methods
 * https://cloud.google.com/firestore/docs/reference/security/#request_methods
 */
const allowTypes:AllowInfo[] = [
   {
      name: "read",
      about: "Allow both `get` and `list` operations",
      includeTypes: ["get", "list"]
   },
   {
      name: "get",
      about: "Corresponds to `get()` query method"
   },
   {
      name: "list",
      about: "Corresponds to `where().get()` query method"
   },
   {
      name: "write",
      about: "Allows `create`, `update` and `delete` operations",
      includeTypes: ["create", "update", "delete"]
   },
   {
      name: "create",
      about: "Corresponds to `set()` and `add()` query methods"
   },
   {
      name: "update",
      about: "Corresponds to `update()` query method"
   },
   {
      name: "delete",
      about: "Corresponds to `remove()` query method"
   }
];

/**
 * Basic type members are assigned by reference to the symbols implementing
 * them.
 */
const basicTypes:{[key:string]:TypeInfo} = {
   "string": {
      about: "Strings can be lexographically compared and ordered using the ==, !=, >, <, >=, and <= operators.",
      methods: {
         "size": {
            about: "Returns the number of characters in the string.",
            parameters: []
         },
         "matches": {
            about: "Performs a regular expression match, returns true if the string matches the given regular expression. Uses Google RE2 syntax.",
            parameters: ["regex"]
         },
         "split": {
            about: "Splits a string according to a provided regular expression and returns a list of strings. Uses Google RE2 syntax.",
            returns: "list",
            parameters: ["regex"]
         }
      }
   },
   "timestamp": {
      about: "Timestamps are in UTC, with possible values beginning at 0001-01-01T00.00.00Z and ending at 9999-12-31T23.59.59Z.",
      methods: {
         "date": {
            about: "A timestamp value containing the year, month, and day only.",
            parameters: []
         },
         "year": {
            about: "The year value as an int, from 1 to 9999.",
            parameters: []
         },
         "month": {
            about: "The month value as an int, from 1 to 12.",
            parameters: []
         },
         "day": {
            about: "The current day of the month as an int, from 1 to 31.",
            parameters: []
         },
         "time": {
            about: "A `duration` value containing the current time.",
            returns: "duration",
            parameters: []
         },
         "hours": {
            about: "The hours value as an int, from 0 to 23.",
            parameters: []
         },
         "minutes": {
            about: "The minutes value as an int, from 0 to 59.",
            parameters: []
         },
         "seconds": {
            about: "The seconds value as an int, from 0 to 59.",
            parameters: []
         },
         "nanos": {
            about: "The fractional seconds in nanos as an int.",
            parameters: []
         },
         "dayOfWeek": {
            about: "The day of the week, from 1 (Monday) to 7 (Sunday).",
            parameters: []
         },
         "dayOfYear": {
            about: "The day of the current year, from 1 to 366.",
            parameters: []
         },
         "toMillis": {
            about: "Returns the current number of milliseconds since the Unix epoch.",
            parameters: []
         }
      }
   },
   "duration": {
      about: "Duration values are represented as seconds plus fractional seconds in nanoseconds.",
      methods: {
         "seconds": {
            about: "The number of seconds in the current duration. Must be between -315,576,000,000 and +315,576,000,000 inclusive.",
            parameters: []
         },
         "nanos": {
            about: "The number of fractional seconds (in nanoseconds) of the current duration. Must be beween -999,999,999 and +999,999,999 inclusive. For non-zero seconds and non-zero nanonseconds, the signs of both must be in agreement.",
            parameters: []
         }
      }
   },
   "list": {
      about: "A list contains an ordered array of values, which can of type: null, bool, int, float, string, path, list, map, timestamp, or duration.",
      methods: {
         "in": {
            about: "Returns `true` if the desired value is present in the list or `false` if not present.",
            parameters: ["value"]
         },
         "join": {
            about: "Combines a list of strings into a single string, separated by the given string.",
            parameters: []
         },
         "size": {
            about: "The number of items in the list.",
            parameters: []
         },
         "hasAny": {
            about: "Returns `true` if any given values are present in the list.",
            parameters: ["list"]
         },
         "hasAll": {
            about: "Returns `true` if all values are present in the list.",
            parameters: ["list"]
         }
      }
   },
   "map": {
      about: "A map contains key/value pairs, where keys are strings and values can be any of: null, bool, int, float, string, path, list, map, timestamp, or duration.",
      methods: {
         "in": {
            about: "Returns true if the desired key is present in the map or false if not present.",
            parameters: ["key"]
         },
         "size": {
            about: "The number of keys in the map.",
            parameters: []
         },
         "keys": {
            about: "A list of all keys in the map.",
            returns: "list",
            parameters: []
         },
         "values": {
            about: "A list of all values in the map, in key order.",
            returns: "list",
            parameters: []
         }
      }
   }

};

/**
 * Types defined in Firestore Security Reference
 * https://cloud.google.com/firestore/docs/reference/security/
 */
const grammar:{[key:string]:TypeInfo} = {
   "global": {
      about: "Globally defined methods",
      methods: {
         "path": {
            about: "Converts a string argument to a path."
         },
         "exists": {
            about: "`exists()` takes a path and returns a bool, indicating whether a document exists at that path. The path provided must begin with `/databases/$(database)/documents`."
         },
         "get": {
            about: "`get()` takes a path and returns the resource at that path. Like `exists()`, the path provided must begin with `/databases/$(database)/documents`."
         }
      }
   },
   "math": {
      about: "Cloud Firestore Security Rules also provides a number of mathematics helper functions to simplify expressions.",
      methods: {
         "ceil": {
            about: "Ceiling of the numeric value",
            parameters: ["number"]
         },
         "floor": {
            about: "Floor of the numeric value",
            parameters: ["number"]
         },
         "round": {
            about: "Round the input value to the nearest int",
            parameters: ["number"]
         },
         "abs": {
            about: "Absolute value of the input",
            parameters: ["number"]
         },
         "isInfinite": {
            about: "Test whether the value is ±∞, returns a `bool`",
            parameters: ["number"]
         },
         "isNaN": {
            about: "Test whether the value is not a number `NaN`, returns a `bool`",
            parameters: ["number"]
         }
      }
   },
   "request": {
      about: "The request variable is provided within a condition to represent the request being made at that path. The request variable has a number of properties which can be used to decide whether to allow the incoming request.",
      fields: {
         "path": {
            about: "The path variable contains the path that a request is being performed against.",
            basicType: "string"
         },
         "resource": {
            about: "The resource variable contains data and metadata about the document being written. It is closely related to the resource variable, which contains the current document at the requested path, as opposed to the document being written.",
            fields: {
               "data": {
                  about: "Developer provided data is surfaced in request.resource.data, which is a map containing the fields and values.",
                  basicType: "map"
               }
            }
         },
         "time": {
            about: "The time variable contains a timestamp representing the current server time a request is being evaluated at. You can use this to provide time-based access to files, such as: only allowing files to be uploaded until a certain date, or only allowing files to be read up to an hour after they were uploaded.",
            basicType: "timestamp"
         },
         "auth": {
            about: "When an authenticated user performs a request against Cloud Firestore, the auth variable is populated with the user's uid (request.auth.uid) as well as the claims of the Firebase Authentication JWT (request.auth.token).",
            fields: {
               "token": {
                  about: "Firebase Authentication JWT",
                  fields: {
                     "email": {
                        about: "The email address associated with the account, if present.",
                        basicType: "string"
                     },
                     "email_verified": {
                        about: "`true` if the user has verified they have access to the `email` address. Some providers automatically verify email addresses they own."
                     },
                     "phone_number": {
                        about: "The phone number associated with the account, if present.",
                        basicType: "string"
                     },
                     "name": {
                        about: "The user's display name, if set.",
                        basicType: "string"
                     },
                     "sub": {
                        about: "The user's Firebase UID. This is unique within a project.",
                        basicType: "string"
                     },
                     "firebase": {
                        about: "Firebase specific token properties.",
                        fields: {
                           "identities": {
                              about: "Dictionary of all the identities that are associated with this user's account. The keys of the dictionary can be any of the following: email, phone, google.com, facebook.com, github.com, twitter.com. The values of the dictionary are arrays of unique identifiers for each identity provider associated with the account. For example, auth.token.firebase.identities[\"google.com\"][0] contains the first Google user ID associated with the account.",
                              basicType: "map"
                           },
                           "sign_in_provider": {
                              about: "The sign-in provider used to obtain this token. Can be one of the following strings: custom, password, phone, anonymous, google.com, facebook.com, github.com, twitter.com.",
                              basicType: "string"
                           }
                        }
                     }
                  }
               }
            }
         }
      }
   }
};