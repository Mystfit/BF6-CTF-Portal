This repository contains a Capture the Flag gamemode in typescript for the first-person-shooter Battlefield 6. A stripped version of the API is available in index_stripped.d.ts.

It is built out of multiple .ts files that need to be assembed using the script "compile.ps1 -o "CTF.combined.ts" and the file include order is specified in FileOrder.ps1. After compiling, the combined ts file must be examined for any typescript errors that may have occured due to missing forward declarations

Class, variable, and function declarations must be declared in "globals.d.ts" so that they are visible in the IDE. This file is NOT included in a compiled version of the script, so the class, variable, and function definitions still need to be present in each source file.
