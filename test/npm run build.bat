set /p version="enter fuzzysort's new version number: "
call npm run release -- %version%
pause
