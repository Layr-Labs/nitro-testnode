#!/bin/bash
# wait-for-file.sh - Wait for a file to exist and be non-empty

set -e

show_help() {
    echo "Usage: wait-for-file.sh --file <file_path> [--timeout <seconds>]"
    echo "  --file     Path to the file to wait for"
    echo "  --timeout  Timeout in seconds (default: 30)"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --file)
            file="$2"
            shift 2
            ;;
        --timeout)
            timeout="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            ;;
    esac
done

# Set default timeout if not provided
timeout="${timeout:-30}"

if [ -z "$file" ]; then
    echo "Error: No file path provided"
    show_help
fi

until_time=$(($(date +%s) + timeout))

echo "Waiting for file $file to exist..."

while true; do
    if [ -f "$file" ] && [ -s "$file" ]; then
        echo "File $file is available"
        exit 0
    fi
    
    if [ $(date +%s) -gt $until_time ]; then
        echo "Timeout waiting for file $file"
        exit 1
    fi
    
    sleep 0.5
done