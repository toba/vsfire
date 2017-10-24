//import { CompletionItem, CompletionItemKind } from "vscode";

interface MemberInfo {
   about?:string;
   aliases?:string[];
}

interface TypeInfo extends MemberInfo {
   methods?:{[key:string]:MethodInfo};
   fields?:{[key:string]:TypeInfo};
   typeName?:string;
}

interface MethodInfo extends MemberInfo {
   parameters?:TypeInfo[];
   returns?:TypeInfo;
}

const grammar:{[key:string]:TypeInfo} = {
   "math": {
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
   "document": {
      methods: {
         "size": {
            about: "Returns the number of characters in the string."
         }
      }
   },
   "request": {
      fields: {
         "path": {
            about: "The path variable contains the path that a request is being performed against."
         },
         "resource": {
            about: "The resource variable contains data and metadata about the document being written. It is closely related to the resource variable, which contains the current document at the requested path, as opposed to the document being written.",
            fields: {
               "data": {
                  about: "Developer provided data is surfaced in request.resource.data, which is a map containing the fields and values."
               }
            }
         },
         "time": {
            about: "The time variable contains a timestamp representing the current server time a request is being evaluated at. You can use this to provide time-based access to files, such as: only allowing files to be uploaded until a certain date, or only allowing files to be read up to an hour after they were uploaded."
         },
         "auth": {
            about: "When an authenticated user performs a request against Cloud Firestore, the auth variable is populated with the user's uid (request.auth.uid) as well as the claims of the Firebase Authentication JWT (request.auth.token).",
            fields: {
               "token": {
                  fields: {
                     "email": {
                        about: "The email address associated with the account, if present."
                     },
                     "email_verified": {
                        about: "`true` if the user has verified they have access to the `email` address. Some providers automatically verify email addresses they own."
                     },
                     "phone_number": {
                        about: "The phone number associated with the account, if present."
                     },
                     "name": {
                        about: "The user's display name, if set."
                     },
                     "sub": {
                        about: "The user's Firebase UID. This is unique within a project."
                     },
                     "firebase": {
                        fields: {
                           "identities": {
                              about: "Dictionary of all the identities that are associated with this user's account. The keys of the dictionary can be any of the following: email, phone, google.com, facebook.com, github.com, twitter.com. The values of the dictionary are arrays of unique identifiers for each identity provider associated with the account. For example, auth.token.firebase.identities[\"google.com\"][0] contains the first Google user ID associated with the account."  
                           },
                           "sign_in_provider": {
                              about: "The sign-in provider used to obtain this token. Can be one of the following strings: custom, password, phone, anonymous, google.com, facebook.com, github.com, twitter.com."
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
 * Find type information having given name.
 */
export function find(name:string):TypeInfo {
   if (name == null || name == "") { return null; }
   return findChild(grammar, name);
}

// export function suggestions(name:string):CompletionItem[] {
//    const info = find(name);
//    if (info && info.fields || info.methods) {
//       const items:CompletionItem[] = [];

//       Reflect.ownKeys(info.fields).forEach(key => {
//          const f = info.fields[key];
//          const item = new CompletionItem(key as string, CompletionItemKind.Field);

//          item.detail = f.about;

//          items.push(item);
//       });
//       return items;
//    }
//    return null;
// }

/**
 * Find member of TypeInfo map having given name.
 */
function findChild(fields:{[key:string]:TypeInfo}, name:string):TypeInfo {
   let info:TypeInfo = null;

   if (fields) {
      const match = Reflect.ownKeys(fields).find(key => key == name);

      if (match) {
         info = fields[match];
      } else {
         Reflect.ownKeys(fields).forEach(key => {
            info = findChild(fields[key].fields, name);
            if (info != null) { return; }
         });
      }
   }
   return info;
}