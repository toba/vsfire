export interface MemberInfo {
   about:string;
}

interface TypeInfo extends MemberInfo {
   methods?:{[key:string]:MethodInfo};
   fields?:{[key:string]:TypeInfo};
   basicType?:string;
}

interface MethodInfo extends MemberInfo {
   parameters?:string[];
   returns?:string;
}

/**
 * Basic type members are assigned by reference to the symbols implementing
 * them.
 */
const basicTypes:{[key:string]:TypeInfo} = {
   "string": {
      about: "Strings can be lexographically compared and ordered using the ==, !=, >, <, >=, and <= operators.",
      methods: {
         "size": {
            about: "Returns the number of characters in the string."
         },
         "matches": {
            about: "Performs a regular expression match, returns true if the string matches the given regular expression. Uses Google RE2 syntax."
         },
         "split": {
            about: "Splits a string according to a provided regular expression and returns a list of strings. Uses Google RE2 syntax.",
            returns: "list"
         }
      }
   },
   "timestamp": {
      about: "Timestamps are in UTC, with possible values beginning at 0001-01-01T00.00.00Z and ending at 9999-12-31T23.59.59Z.",
      methods: {
         "date": {
            about: "A timestamp value containing the year, month, and day only."
         },
         "year": {
            about: "The year value as an int, from 1 to 9999."
         },
         "month": {
            about: "The month value as an int, from 1 to 12."
         },
         "day": {
            about: "The current day of the month as an int, from 1 to 31."
         },
         "time": {
            about: "A `duration` value containing the current time.",
            returns: "duration"
         },
         "hours": {
            about: "The hours value as an int, from 0 to 23."
         },
         "minutes": {
            about: "The minutes value as an int, from 0 to 59."
         },
         "seconds": {
            about: "The seconds value as an int, from 0 to 59."
         },
         "nanos": {
            about: "The fractional seconds in nanos as an int."
         },
         "dayOfWeek": {
            about: "The day of the week, from 1 (Monday) to 7 (Sunday)."
         },
         "dayOfYear": {
            about: "The day of the current year, from 1 to 366."
         },
         "toMillis": {
            about: "Returns the current number of milliseconds since the Unix epoch."
         }
      }
   },
   "duration": {
      about: "Duration values are represented as seconds plus fractional seconds in nanoseconds.",
      methods: {
         "seconds": {
            about: "The number of seconds in the current duration. Must be between -315,576,000,000 and +315,576,000,000 inclusive."
         },
         "nanos": {
            about: "The number of fractional seconds (in nanoseconds) of the current duration. Must be beween -999,999,999 and +999,999,999 inclusive. For non-zero seconds and non-zero nanonseconds, the signs of both must be in agreement."
         }
      }
   },
   "list": {
      about: "A list contains an ordered array of values, which can of type: null, bool, int, float, string, path, list, map, timestamp, or duration.",
      methods: {
         "in": {
            about: "Returns `true` if the desired value is present in the list or `false` if not present."
         },
         "join": {
            about: "Combines a list of strings into a single string, separated by the given string."
         },
         "size": {
            about: "The number of items in the list."
         },
         "hasAny": {
            about: "Returns `true` if any given values are present in the list."
         },
         "hasAll": {
            about: "Returns `true` if all values are present in the list."
         }
      }
   },
   "map": {
      about: "A map contains key/value pairs, where keys are strings and values can be any of: null, bool, int, float, string, path, list, map, timestamp, or duration.",
      methods: {
         "in": {
            about: "Returns true if the desired key is present in the map or false if not present."
         },
         "size": {
            about: "The number of keys in the map."
         },
         "keys": {
            about: "A list of all keys in the map.",
            returns: "list"
         },
         "values": {
            about: "A list of all values in the map, in key order.",
            returns: "list"
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
            about: "Ceiling of the numeric value"
         },
         "floor": {
            about: "Floor of the numeric value"
         },
         "round": {
            about: "Round the input value to the nearest int"
         },
         "abs": {
            about: "Absolute value of the input"
         },
         "isInfinite": {
            about: "Test whether the value is ±∞, returns a `bool`"
         },
         "isNaN": {
            about: "Test whether the value is not a number `NaN`, returns a `bool`"
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

/**
 * `TypeInfo` mapped to both absolute and short names. For example, `token` is
 * keyed to both "token" and "request.auth.token".
 */
const cache:{[key:string]:TypeInfo} = {};
const listeners:{():void}[] = [];
let compiled = false;
let compiling = false;

/**
 * Find type information with given short or fully-qualified name.
 */
export async function find(name:string):Promise<TypeInfo> {
   if (name == null || name == "") { return null; }
   await compile();
   return (cache[name] !== undefined) ? cache[name] : null;
}


/**
 * Compile heirarchical grammar into flat map for faster lookup.
 */
export function compile(force = false):Promise<void> {
   if (force) { compiled = false; }

   return (compiled)
      ? Promise.resolve()
      : new Promise((resolve, _reject) => {
         listeners.push(resolve);
         if (!compiling) {
            compiling = true;
            compileTypes(grammar);
         }
         while (listeners.length > 0) {
            listeners.pop()();
         }
      });
}


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
      }

      cache[name] = info;
      cache[full] = info;

      if (info.fields) { compileTypes(info.fields, full); }
   });
}