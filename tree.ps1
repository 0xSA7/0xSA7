function Show-Tree {
    param([string]$path = ".", [string]$indent = "")
    
    # Get only immediate children of the current path
    Get-ChildItem -Path $path | ForEach-Object {
        # Strictly skip node_modules and hidden folders like .git
        if ($_.Name -eq "node_modules" -or $_.Name -eq ".git") {
            return
        }

        # Print the current item
        Write-Output ($indent + "├── " + $_.Name)

        # If it is a folder, recursively scan it with deeper indent
        if ($_.PSIsContainer) {
            Show-Tree -Path $_.FullName -indent ($indent + "│   ")
        }
    }
}
Show-Tree
