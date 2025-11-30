@echo off
REM Rename and move Feb/March papers from nested folders to flat /past-papers/ structure

REM IGCSE Papers
for /r "D:\Apps\PythonDocs\Accounting\acc\public\past-paper\IGCSE" %%F in (*_m*.pdf) do (
    set "file=%%~nF"
    set "renamed=!file:_m=-m!"
    copy "%%F" "D:\Apps\PythonDocs\Accounting\acc\public\past-papers\!renamed!" /Y
    echo Copied: !renamed!
)

REM A-Level Papers
for /r "D:\Apps\PythonDocs\Accounting\acc\public\past-paper\A Level" %%F in (*_m*.pdf) do (
    set "file=%%~nF"
    set "renamed=!file:_m=-m!"
    copy "%%F" "D:\Apps\PythonDocs\Accounting\acc\public\past-papers\!renamed!" /Y
    echo Copied: !renamed!
)

echo Done!
pause
