#!/bin/bash

# Read the PID from the file
pid=$(cat pid.txt)

# Kill the process if it's running
if kill -0 $pid 2> /dev/null; then
echo "Current PID: $pid"
        kill $pid
        echo "Killed previous process"
fi

# Run the Go program in a new terminal
bin/server