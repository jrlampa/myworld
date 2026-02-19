cd "c:\myworld"
$content = git show release/alpha-release:"sisrua_unified/py_engine/dxf_generator.py" 2>&1

# Find all method definitions
$methods = $content | Select-String "def " | Select-Object -ExpandProperty Line

Write-Output "=== Methods in dxf_generator.py ==="
foreach ($m in $methods) {
    if ($m -match "def (_\w+|add_|get_)" ) {
        Write-Output $m
    }
}

Write-Output ""
Write-Output "=== Layer/Color assignments ==="
$content | Select-String "layer.*=|color.*=" | Select-Object -ExpandProperty Line | Sort-Object -Unique | head -40
