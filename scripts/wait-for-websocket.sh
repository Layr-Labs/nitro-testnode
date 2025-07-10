#!/bin/bash
# wait-for-websocket.sh - Wait for WebSocket service to be available

set -e

host="$1"
port="$2"
timeout="${3:-30}"

until_time=$(($(date +%s) + timeout))

echo "Waiting for WebSocket at $host:$port..."

while true; do
    if timeout 1 bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
        echo "WebSocket port $port is available on $host"
        exit 0
    fi
    
    if [ $(date +%s) -gt $until_time ]; then
        echo "Timeout waiting for WebSocket at $host:$port"
        exit 1
    fi
    
    sleep 0.1
done