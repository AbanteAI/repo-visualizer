#!/bin/bash
echo "Starting backend server with clean install..."
cd backend
rm -rf node_modules package-lock.json
npm install
node server.js
