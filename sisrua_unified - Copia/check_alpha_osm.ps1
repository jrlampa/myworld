$content = git show release/alpha-release:"sisrua_unified/py_engine/controller.py" 2>&1
$lines = $content.Split([Environment]::NewLine)

$in_query = $false
foreach ($line in $lines) {
    if ($line -like "*way(*" -or $line -like "*node(*") {
        Write-Output $line
    }
    if ($line -like "*query*" -or $line -like "*Overpass*") {
        $in_query = $true
    }
    if ($in_query) {
        Write-Output $line
    }
    if ($in_query -and $line -like "*out*") {
        break
    }
}
