# 1.4.1
- Merge PR from [mogelbuster](https://github.com/mogelbuster) to clarify the need for file names to end with `.rule` or `.rules`. Thank you mogelbuster!

# 1.4.0
- Merge PR from [Sam Stern](https://github.com/samtstern) to update the [index specification](https://github.com/firebase/firebase-tools/blob/master/src/firestore/indexes-spec.ts). Thank you Sam!
- Merge PR from [Konrad Linkowski](https://github.com/KonradLinkowski) to correct grammar note. Thank you Konrad!
- Update dependencies
   - Fix tests
   - Strict null checks

# 1.3.2
- Merge PR from [Arturo Guzman](https://github.com/guzart) to allow `uid` field in `request.auth`. Thank you Arturo!

# 1.3.1
- Merge PR from [Sam Stern](https://github.com/samtstern) to allow `.` (period) in a field path. Thank you Sam!

# 1.3.0
- Add [JSON Schema](https://code.visualstudio.com/docs/languages/json#_intellisense-validation) for [Index Definitions](https://cloud.google.com/firestore/docs/reference/rest/v1beta1/projects.databases.indexes) (enables completions and hovers).
- [#8](https://github.com/toba/vsfire/issues/8)
   Fix access modifier highlighting if last element on line.

# 1.2.0
- [#4](https://github.com/toba/vsfire/issues/4)
   Initial hover support.
- [#3](https://github.com/toba/vsfire/issues/3)
   Completions for `server`, `match` and `allow` directives.
- [#5](https://github.com/toba/vsfire/issues/5)
   Fix symbol descriptions wrapping mid-word.

# 1.1.1
- [#2](https://github.com/toba/vsfire/issues/2)
   Add string syntax highlighting.
- [#1](https://github.com/toba/vsfire/issues/1)
   Fix highlighting for multiple function parameters.
- [#6](https://github.com/toba/vsfire/issues/6)
   Fix highlighting for various built-in types and methods.
- Still iterating on logo.

# 1.1.0
- Add completions for basic types and global objects.
- Add syntax highlighting for custom functions.
- Update logo (still meh).

# 1.0.1
- Add highlighting for additional syntax defined in the [Security Rules Reference](https://cloud.google.com/firestore/docs/reference/security/).

# 1.0.0
- Initial release with basic syntax highlighting.