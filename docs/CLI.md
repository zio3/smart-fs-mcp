# CLI Testing Guide

## File Operations

### Test file reading
```bash
npm run cli read package.json
```

### Test large file handling
```bash
npm run cli read /var/log/system.log
```

### Test directory listing
```bash
npm run cli list ./src --hidden --sort size
```

### Test file search
```bash
# Find TypeScript files
npm run cli search -f ".*\\.ts$" ./src

# Find TODOs
npm run cli search -c "TODO|FIXME" --extensions .js .ts

# Case-sensitive whole-word search
npm run cli search -c "function.*Error" -s -w
```

### Test file write
```bash
# Write with content option
npm run cli write test.txt -c "Hello World"

# Write from stdin
echo "Hello World" | npm run cli write test.txt
```

### Test file edit
```bash
# Simple replacement
npm run cli edit config.js -l "console.log,logger.info" --dry-run

# Config change
npm run cli edit test.js -l "PORT = 3000,PORT = 8080"

# Multiple replacements
npm run cli edit app.js -l "localhost,0.0.0.0" -l "var,const"

# Preview regex edit
npm run cli edit test.js -r "TODO.*$,DONE" -d

# Apply diff from file
npm run cli edit app.js -f patch.diff

# Apply diff from stdin
cat changes.diff | npm run cli edit app.js -f -

# Disable formatting
npm run cli edit code.js -l "var,const" -p false
```

### Test file move
```bash
# Rename file
npm run cli move old-name.js new-name.js

# Backup with overwrite
npm run cli move important.js backup/important.js.bak -o
```

## Directory Operations

### Test directory operations
```bash
# Show allowed directories
npm run cli list-allowed

# Get detailed file info
npm run cli info src/index.js

# Create nested directories
npm run cli mkdir new/deep/directory

# Delete a file
npm run cli delete temp/cache.txt

# Force delete read-only file
npm run cli delete readonly.txt --force

# Preview directory deletion
npm run cli rmdir node_modules --recursive --dry-run

# Delete empty directory
npm run cli rmdir empty-dir

# Move/rename directory
npm run cli movedir old-folder new-folder

# Move with overwrite
npm run cli movedir project backup/project.old --overwrite
```

## Security Testing

### Test security features
```bash
# Test security (should fail)
npm run cli security-test /etc/passwd

# Run with custom allowed directories
npm run cli /path/to/allowed/dir1 /path/to/allowed/dir2 list-allowed
```

## REST API Examples

### File Operations
```bash
curl "http://localhost:3000/api/files/info?path=./package.json"

curl "http://localhost:3000/api/files/content?path=./README.md"

curl -X POST http://localhost:3000/api/files/content \
  -H "Content-Type: application/json" \
  -d '{"path": "./test.txt", "content": "Hello World"}'

curl -X PUT http://localhost:3000/api/files/edit \
  -H "Content-Type: application/json" \
  -d '{"path": "./config.js", "edits": [{"oldText": "console.log", "newText": "logger.info"}], "dry_run": true}'
```

### Directory Operations
```bash
curl "http://localhost:3000/api/directories/list?path=./src&include_hidden=true"

curl -X POST http://localhost:3000/api/directories \
  -H "Content-Type: application/json" \
  -d '{"path": "./new-folder"}'

curl -X DELETE "http://localhost:3000/api/directories?path=./temp&recursive=true&dry_run=true"
```

### Search Operations
```bash
curl -X POST http://localhost:3000/api/search/content \
  -H "Content-Type: application/json" \
  -d '{"content_pattern": "TODO|FIXME", "directory": "./src", "extensions": [".js", ".ts"]}'

curl "http://localhost:3000/api/search/content?content_pattern=SafetyController&directory=./src"
```
