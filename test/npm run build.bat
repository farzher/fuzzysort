rem depends on uglify-js v3.17.4 being installed globally
set /p version="enter fuzzysort's new version number: "
call npm run build -- %version%
pause
